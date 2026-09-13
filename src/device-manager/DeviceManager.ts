import { ElgatoClient, type ElgatoLogger } from '../elgato/ElgatoClient';
import type { ElgatoSnapshot, LightUpdate } from '../elgato/types';
import { normalizeTarget } from '../elgato/target';
import { systemTimers, type TimerController } from '../timers';
import type {
    ConfiguredDevice,
    DeviceClient,
    DeviceHealth,
    DeviceManagerEvents,
    DeviceManagerOptions,
    ManagedDeviceView,
} from './types';

interface PendingWrite {
    update: LightUpdate;
    timer: unknown;
    resolve: (snapshot: ElgatoSnapshot) => void;
    reject: (error: unknown) => void;
}

interface RuntimeDevice {
    config: ConfiguredDevice;
    client: DeviceClient;
    health: DeviceHealth;
    snapshot?: ElgatoSnapshot;
    queue: Promise<void>;
    pendingWrite?: PendingWrite | undefined;
}

export interface DeviceManagerLogger extends ElgatoLogger {
    /**
     *
     */
    warn(message: string): void;
}

export class DeviceManager {
    private readonly devices = new Map<string, RuntimeDevice>();
    private readonly timers: TimerController;
    private timer: unknown;
    private stopped = true;

    /**
     *
     */
    public constructor(
        private readonly events: DeviceManagerEvents,
        private readonly logger: DeviceManagerLogger,
        private readonly options: DeviceManagerOptions,
    ) {
        if (options.pollIntervalMs < 1_000) {
            throw new RangeError('Poll interval must be at least 1000 ms.');
        }
        this.timers = options.timers ?? systemTimers;
    }

    /**
     *
     */
    public async start(configurations: ConfiguredDevice[]): Promise<void> {
        this.stop();
        this.stopped = false;
        await Promise.allSettled(
            configurations.filter(config => config.enabled).map(config => this.add(config, false)),
        );
        this.schedule();
    }

    /**
     *
     */
    public stop(): void {
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
    public async add(configuration: ConfiguredDevice, notify = true): Promise<ElgatoSnapshot> {
        const target = normalizeTarget(configuration.host, configuration.port);
        const config: ConfiguredDevice = { ...configuration, ...target };
        const provisionalId = configuration.serialNumber || `${target.host}:${target.port}`;
        const existing = this.devices.get(provisionalId);
        if (existing) {
            if (
                configuration.source === 'discovery' &&
                (existing.config.host !== target.host || existing.config.port !== target.port)
            ) {
                return this.replaceDiscoveredTarget(
                    provisionalId,
                    { ...config, serialNumber: provisionalId },
                    existing,
                    notify,
                );
            }
            return this.refresh(provisionalId);
        }

        const client =
            this.options.clientFactory?.(target) ??
            new ElgatoClient(target.host, target.port, {
                timeoutMs: this.options.requestTimeoutMs,
                logger: this.logger,
            });
        const runtime: RuntimeDevice = {
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

    private async replaceDiscoveredTarget(
        id: string,
        config: ConfiguredDevice,
        previous: RuntimeDevice,
        notify: boolean,
    ): Promise<ElgatoSnapshot> {
        const client =
            this.options.clientFactory?.(config) ??
            new ElgatoClient(config.host, config.port, {
                timeoutMs: this.options.requestTimeoutMs,
                logger: this.logger,
            });
        const replacement: RuntimeDevice = {
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
        } catch (error) {
            this.devices.set(id, previous);
            throw error;
        }
    }

    /**
     *
     */
    public async remove(id: string): Promise<boolean> {
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
    public refresh(id: string): Promise<ElgatoSnapshot> {
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
            } catch (error) {
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
                } else {
                    this.logger.debug(message);
                }
                throw error;
            }
        });
    }

    /**
     *
     */
    public updateLight(id: string, update: LightUpdate): Promise<ElgatoSnapshot> {
        const runtime = this.requireDevice(id);
        return new Promise<ElgatoSnapshot>((resolve, reject) => {
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
    public async identify(id: string): Promise<void> {
        const runtime = this.requireDevice(id);
        await this.serialized(runtime, () => runtime.client.identify());
    }

    /**
     *
     */
    public async setDisplayName(id: string, displayName: string): Promise<ElgatoSnapshot> {
        const runtime = this.requireDevice(id);
        await this.serialized(runtime, () => runtime.client.setDisplayName(displayName));
        return this.refresh(id);
    }

    /**
     *
     */
    public async setStudioMode(id: string, enabled: boolean): Promise<ElgatoSnapshot> {
        const runtime = this.requireDevice(id);
        await this.serialized(runtime, () => runtime.client.setSettings({ battery: { bypass: enabled ? 1 : 0 } }));
        return this.refresh(id);
    }

    /**
     *
     */
    public views(): ManagedDeviceView[] {
        return [...this.devices.values()].map(runtime => ({
            config: { ...runtime.config },
            health: { ...runtime.health },
            ...(runtime.snapshot ? { snapshot: runtime.snapshot, capabilities: runtime.snapshot.capabilities } : {}),
        }));
    }

    /**
     *
     */
    public configurations(): ConfiguredDevice[] {
        return [...this.devices.values()].map(runtime => ({ ...runtime.config }));
    }

    private createWriteTimer(runtime: RuntimeDevice): unknown {
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

    private serialized<T>(runtime: RuntimeDevice, task: () => Promise<T>): Promise<T> {
        const result = runtime.queue.then(task, task);
        runtime.queue = result.then(
            () => undefined,
            () => undefined,
        );
        return result;
    }

    private requireDevice(id: string): RuntimeDevice {
        const runtime = this.devices.get(id);
        if (!runtime) {
            throw new Error(`Unknown Elgato device: ${id}`);
        }
        return runtime;
    }

    private schedule(): void {
        if (this.stopped) {
            return;
        }
        if (this.timer !== undefined) {
            this.timers.clear(this.timer);
        }
        const next = Math.min(
            ...[...this.devices.values()].map(runtime => Date.parse(runtime.health.nextPollAt)),
            Date.now() + this.options.pollIntervalMs,
        );
        this.timer = this.timers.set(() => void this.pollDue(), Math.max(250, next - Date.now()));
    }

    private async pollDue(): Promise<void> {
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

function newHealth(id: string, target: { host: string; port: number }): DeviceHealth {
    return {
        id,
        target,
        reachable: false,
        consecutiveFailures: 0,
        nextPollAt: new Date().toISOString(),
    };
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
