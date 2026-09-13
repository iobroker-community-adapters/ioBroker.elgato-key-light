import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ElgatoSnapshot, LightUpdate } from '../elgato/types';
import { DeviceManager } from './DeviceManager';
import type { DeviceClient } from './types';

function snapshot(brightness = 20): ElgatoSnapshot {
    return {
        target: { host: '192.168.1.30', port: 9123 },
        info: { productName: 'Elgato Key Light', serialNumber: 'SERIAL', displayName: 'Desk', features: ['lights'] },
        lights: { numberOfLights: 1, lights: [{ on: 1, brightness, temperature: 230 }] },
        capabilities: {
            power: true,
            brightness: true,
            temperature: true,
            color: false,
            battery: false,
            studioMode: false,
            identify: true,
            settings: false,
            multipleLights: false,
            scenes: false,
        },
        capturedAt: new Date().toISOString(),
    };
}

describe('DeviceManager', () => {
    it('coalesces rapid slider updates into one device request', async () => {
        const writes: LightUpdate[] = [];
        let current = snapshot();
        const client: DeviceClient = {
            snapshot: async () => current,
            setLights: async update => {
                writes.push(update);
                current = snapshot(update.brightness);
            },
            setDisplayName: async () => undefined,
            setSettings: async () => undefined,
            identify: async () => undefined,
        };
        const manager = new DeviceManager(
            { onSnapshot: () => undefined, onHealth: () => undefined, onConfigurationChanged: () => undefined },
            { debug: () => undefined, silly: () => undefined, warn: () => undefined },
            {
                pollIntervalMs: 60_000,
                requestTimeoutMs: 1_000,
                maxBackoffMs: 120_000,
                writeDebounceMs: 5,
                clientFactory: () => client,
            },
        );
        await manager.start([{ host: '192.168.1.30', port: 9123, source: 'manual', enabled: true }]);
        await Promise.all([
            manager.updateLight('SERIAL', { brightness: 30 }),
            manager.updateLight('SERIAL', { brightness: 40 }),
            manager.updateLight('SERIAL', { brightness: 50 }),
        ]);
        assert.deepEqual(writes, [{ brightness: 50 }]);
        manager.stop();
    });

    it('tracks failures and applies bounded exponential backoff', async () => {
        const client: DeviceClient = {
            snapshot: async () => Promise.reject(new Error('offline')),
            setLights: async () => undefined,
            setDisplayName: async () => undefined,
            setSettings: async () => undefined,
            identify: async () => undefined,
        };
        const manager = new DeviceManager(
            { onSnapshot: () => undefined, onHealth: () => undefined, onConfigurationChanged: () => undefined },
            { debug: () => undefined, silly: () => undefined, warn: () => undefined },
            {
                pollIntervalMs: 1_000,
                requestTimeoutMs: 500,
                maxBackoffMs: 8_000,
                writeDebounceMs: 5,
                clientFactory: () => client,
            },
        );
        const before = Date.now();
        await manager.start([{ host: '192.168.1.31', port: 9123, source: 'manual', enabled: true }]);
        const health = manager.views()[0]?.health;
        assert.equal(health?.reachable, false);
        assert.equal(health?.consecutiveFailures, 1);
        assert.ok(Date.parse(health?.nextPollAt ?? '') >= before + 900);
        manager.stop();
    });

    it('reconnects a discovered serial when its IP address changes', async () => {
        const targets: string[] = [];
        const manager = new DeviceManager(
            { onSnapshot: () => undefined, onHealth: () => undefined, onConfigurationChanged: () => undefined },
            { debug: () => undefined, silly: () => undefined, warn: () => undefined },
            {
                pollIntervalMs: 60_000,
                requestTimeoutMs: 1_000,
                maxBackoffMs: 120_000,
                writeDebounceMs: 0,
                clientFactory: target => {
                    targets.push(target.host);
                    return {
                        snapshot: async () => ({ ...snapshot(), target }),
                        setLights: async () => undefined,
                        setDisplayName: async () => undefined,
                        setSettings: async () => undefined,
                        identify: async () => undefined,
                    };
                },
            },
        );
        await manager.start([
            { host: '192.168.1.30', port: 9123, serialNumber: 'SERIAL', source: 'discovery', enabled: true },
        ]);
        await manager.add({
            host: '192.168.1.31',
            port: 9123,
            serialNumber: 'SERIAL',
            source: 'discovery',
            enabled: true,
        });
        assert.deepEqual(targets, ['192.168.1.30', '192.168.1.31']);
        assert.equal(manager.configurations()[0]?.host, '192.168.1.31');
        manager.stop();
    });

    it('warns once per outage and logs repeat failures at debug level', async () => {
        let offline = true;
        const client: DeviceClient = {
            snapshot: async () => (offline ? Promise.reject(new Error('offline')) : snapshot()),
            setLights: async () => undefined,
            setDisplayName: async () => undefined,
            setSettings: async () => undefined,
            identify: async () => undefined,
        };
        const warnings: string[] = [];
        const debugs: string[] = [];
        const manager = new DeviceManager(
            { onSnapshot: () => undefined, onHealth: () => undefined, onConfigurationChanged: () => undefined },
            {
                debug: message => {
                    debugs.push(message);
                },
                silly: () => undefined,
                warn: message => {
                    warnings.push(message);
                },
            },
            {
                pollIntervalMs: 60_000,
                requestTimeoutMs: 500,
                maxBackoffMs: 8_000,
                writeDebounceMs: 5,
                clientFactory: () => client,
            },
        );
        const unavailable = (entries: string[]): number =>
            entries.filter(entry => entry.includes('unavailable')).length;

        try {
            await manager.start([{ host: '192.168.1.32', port: 9123, source: 'manual', enabled: true }]);
            const id = manager.views()[0]?.health.id;
            assert.ok(id);
            assert.equal(unavailable(warnings), 1);
            assert.equal(unavailable(debugs), 0);

            await manager.refresh(id).catch(() => undefined);
            await manager.refresh(id).catch(() => undefined);
            assert.equal(unavailable(warnings), 1);
            assert.equal(unavailable(debugs), 2);

            offline = false;
            await manager.refresh(id);
            offline = true;
            await manager.refresh(id).catch(() => undefined);
            assert.equal(unavailable(warnings), 2);
            assert.equal(unavailable(debugs), 2);
        } finally {
            manager.stop();
        }
    });
});
