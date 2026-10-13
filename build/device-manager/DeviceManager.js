"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceManager = void 0;
const ElgatoClient_1 = require("../elgato/ElgatoClient");
const target_1 = require("../elgato/target");
const timers_1 = require("../timers");
class DeviceManager {
    events;
    logger;
    options;
    devices = new Map();
    timers;
    timer;
    stopped = true;
    /**
     *
     */
    constructor(events, logger, options) {
        this.events = events;
        this.logger = logger;
        this.options = options;
        if (options.pollIntervalMs < 1_000) {
            throw new RangeError('Poll interval must be at least 1000 ms.');
        }
        this.timers = options.timers ?? timers_1.systemTimers;
    }
    /**
     *
     */
    async start(configurations) {
        this.stop();
        this.stopped = false;
        await Promise.allSettled(configurations.filter(config => config.enabled).map(config => this.add(config, false)));
        this.schedule();
    }
    /**
     *
     */
    stop() {
        this.stopped = true;
        if (this.timer !== undefined) {
            this.timers.clear(this.timer);
        }
        this.timer = undefined;
        for (const runtime of this.devices.values()) {
            if (runtime.pendingWrite) {
                this.timers.clear(runtime.pendingWrite.timer);
                runtime.pendingWrite.reject(new Error('Device manager stopped.'));
            }
        }
        this.devices.clear();
    }
    /**
     *
     */
    async add(configuration, notify = true) {
        const target = (0, target_1.normalizeTarget)(configuration.host, configuration.port);
        const config = { ...configuration, ...target };
        const provisionalId = configuration.serialNumber || `${target.host}:${target.port}`;
        const existing = this.devices.get(provisionalId);
        if (existing) {
            if (configuration.source === 'discovery' &&
                (existing.config.host !== target.host || existing.config.port !== target.port)) {
                return this.replaceDiscoveredTarget(provisionalId, { ...config, serialNumber: provisionalId }, existing, notify);
            }
            return this.refresh(provisionalId);
        }
        const client = this.options.clientFactory?.(target) ??
            new ElgatoClient_1.ElgatoClient(target.host, target.port, {
                timeoutMs: this.options.requestTimeoutMs,
                logger: this.logger,
            });
        const runtime = {
            config,
            client,
            health: newHealth(provisionalId, target),
            queue: Promise.resolve(),
        };
        this.devices.set(provisionalId, runtime);
        const snapshot = await this.refresh(provisionalId);
        const serial = snapshot.info.serialNumber;
        runtime.config.serialNumber = serial;
        runtime.config.displayName = snapshot.info.displayName || snapshot.info.productName;
        runtime.health.id = serial;
        if (serial !== provisionalId) {
            this.devices.delete(provisionalId);
            this.devices.set(serial, runtime);
        }
        if (notify) {
            await this.events.onConfigurationChanged(this.configurations());
        }
        return snapshot;
    }
    async replaceDiscoveredTarget(id, config, previous, notify) {
        const client = this.options.clientFactory?.(config) ??
            new ElgatoClient_1.ElgatoClient(config.host, config.port, {
                timeoutMs: this.options.requestTimeoutMs,
                logger: this.logger,
            });
        const replacement = {
            config,
            client,
            health: newHealth(id, config),
            queue: Promise.resolve(),
        };
        this.devices.set(id, replacement);
        try {
            const snapshot = await this.refresh(id);
            replacement.config.displayName = snapshot.info.displayName || snapshot.info.productName;
            if (notify) {
                await this.events.onConfigurationChanged(this.configurations());
            }
            return snapshot;
        }
        catch (error) {
            this.devices.set(id, previous);
            throw error;
        }
    }
    /**
     *
     */
    async remove(id) {
        const runtime = this.devices.get(id);
        if (!runtime) {
            return false;
        }
        if (runtime.pendingWrite) {
            this.timers.clear(runtime.pendingWrite.timer);
            runtime.pendingWrite.reject(new Error('Device removed.'));
        }
        this.devices.delete(id);
        await this.events.onConfigurationChanged(this.configurations());
        return true;
    }
    /**
     *
     */
    refresh(id) {
        const runtime = this.requireDevice(id);
        return this.serialized(runtime, async () => {
            const started = performance.now();
            try {
                const snapshot = await runtime.client.snapshot();
                runtime.snapshot = snapshot;
                runtime.health = {
                    ...runtime.health,
                    reachable: true,
                    lastSuccess: new Date().toISOString(),
                    lastError: undefined,
                    latencyMs: Math.round(performance.now() - started),
                    consecutiveFailures: 0,
                    nextPollAt: new Date(Date.now() + this.options.pollIntervalMs).toISOString(),
                };
                await this.events.onSnapshot(snapshot, runtime.config);
                await this.events.onHealth(runtime.health);
                return snapshot;
            }
            catch (error) {
                const failures = runtime.health.consecutiveFailures + 1;
                const backoff = Math.min(this.options.maxBackoffMs, this.options.pollIntervalMs * 2 ** (failures - 1));
                runtime.health = {
                    ...runtime.health,
                    reachable: false,
                    lastError: errorMessage(error),
                    latencyMs: Math.round(performance.now() - started),
                    consecutiveFailures: failures,
                    nextPollAt: new Date(Date.now() + backoff).toISOString(),
                };
                await this.events.onHealth(runtime.health);
                const message = `[ElgatoDevice] ${runtime.health.id} unavailable: ${runtime.health.lastError}`;
                if (failures === 1) {
                    this.logger.warn(message);
                }
                else {
                    this.logger.debug(message);
                }
                throw error;
            }
        });
    }
    /**
     *
     */
    updateLight(id, update) {
        const runtime = this.requireDevice(id);
        return new Promise((resolve, reject) => {
            if (runtime.pendingWrite) {
                this.timers.clear(runtime.pendingWrite.timer);
                runtime.pendingWrite.update = { ...runtime.pendingWrite.update, ...update };
                const previousResolve = runtime.pendingWrite.resolve;
                const previousReject = runtime.pendingWrite.reject;
                runtime.pendingWrite.resolve = snapshot => {
                    previousResolve(snapshot);
                    resolve(snapshot);
                };
                runtime.pendingWrite.reject = error => {
                    const rejection = error instanceof Error ? error : new Error(String(error));
                    previousReject(rejection);
                    reject(rejection);
                };
                runtime.pendingWrite.timer = this.createWriteTimer(runtime);
                return;
            }
            runtime.pendingWrite = {
                update,
                timer: this.createWriteTimer(runtime),
                resolve,
                reject,
            };
        });
    }
    /**
     *
     */
    async identify(id) {
        const runtime = this.requireDevice(id);
        await this.serialized(runtime, () => runtime.client.identify());
    }
    /**
     *
     */
    async setDisplayName(id, displayName) {
        const runtime = this.requireDevice(id);
        await this.serialized(runtime, () => runtime.client.setDisplayName(displayName));
        return this.refresh(id);
    }
    /**
     *
     */
    async setStudioMode(id, enabled) {
        const runtime = this.requireDevice(id);
        await this.serialized(runtime, () => runtime.client.setSettings({ battery: { bypass: enabled ? 1 : 0 } }));
        return this.refresh(id);
    }
    /**
     *
     */
    views() {
        return [...this.devices.values()].map(runtime => ({
            config: { ...runtime.config },
            health: { ...runtime.health },
            ...(runtime.snapshot ? { snapshot: runtime.snapshot, capabilities: runtime.snapshot.capabilities } : {}),
        }));
    }
    /**
     *
     */
    configurations() {
        return [...this.devices.values()].map(runtime => ({ ...runtime.config }));
    }
    createWriteTimer(runtime) {
        return this.timers.set(() => {
            const pending = runtime.pendingWrite;
            runtime.pendingWrite = undefined;
            if (!pending) {
                return;
            }
            this.serialized(runtime, () => runtime.client.setLights(pending.update))
                .then(() => this.refresh(runtime.health.id))
                .then(pending.resolve, pending.reject);
        }, this.options.writeDebounceMs);
    }
    serialized(runtime, task) {
        const result = runtime.queue.then(task, task);
        runtime.queue = result.then(() => undefined, () => undefined);
        return result;
    }
    requireDevice(id) {
        const runtime = this.devices.get(id);
        if (!runtime) {
            throw new Error(`Unknown Elgato device: ${id}`);
        }
        return runtime;
    }
    schedule() {
        if (this.stopped) {
            return;
        }
        if (this.timer !== undefined) {
            this.timers.clear(this.timer);
        }
        const next = Math.min(...[...this.devices.values()].map(runtime => Date.parse(runtime.health.nextPollAt)), Date.now() + this.options.pollIntervalMs);
        this.timer = this.timers.set(() => void this.pollDue(), Math.max(250, next - Date.now()));
    }
    async pollDue() {
        if (this.stopped) {
            return;
        }
        const now = Date.now();
        const due = [...this.devices.values()]
            .filter(runtime => Date.parse(runtime.health.nextPollAt) <= now)
            .map(runtime => this.refresh(runtime.health.id));
        await Promise.allSettled(due);
        this.schedule();
    }
}
exports.DeviceManager = DeviceManager;
function newHealth(id, target) {
    return {
        id,
        target,
        reachable: false,
        consecutiveFailures: 0,
        nextPollAt: new Date().toISOString(),
    };
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=DeviceManager.js.map