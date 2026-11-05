// Read-side port of 1.x LiveConfig.ts (1cb59f787), get/refresh/events/deepEqual.
// Separate non-authority settings; never writes config, grants, caps or installation facts.
import { EventEmitter } from 'node:events';
import { existsSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';
export class LiveConfig extends EventEmitter {
    stateDir;
    configPath;
    cache = {};
    lastMtime = 0;
    lastReadAt = 0;
    checkIntervalMs;
    interval = null;
    watchPaths;
    accessedPaths = new Set();
    constructor(stateDir, options) {
        super();
        this.stateDir = stateDir;
        this.configPath = path.join(stateDir, 'runtime-settings.json');
        this.checkIntervalMs = options?.checkIntervalMs ?? 5_000;
        this.watchPaths = new Set(options?.watchPaths ?? []);
        this.refresh();
    }
    start() {
        if (this.interval)
            return;
        this.interval = setInterval(() => {
            this.refreshIfStale();
        }, this.checkIntervalMs);
        this.interval.unref();
    }
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
    get(dotPath, defaultValue) {
        this.accessedPaths.add(dotPath);
        this.refreshIfStale();
        const value = this.getNestedValue(this.cache, dotPath);
        if (value === undefined)
            return defaultValue;
        return value;
    }
    getAll() {
        this.refreshIfStale();
        return { ...this.cache };
    }
    forceRefresh() {
        this.refresh();
    }
    refreshIfStale() {
        try {
            if (!existsSync(this.configPath))
                return;
            const stat = statSync(this.configPath);
            if (stat.mtimeMs !== this.lastMtime) {
                this.refresh();
            }
        }
        catch {
        }
    }
    refresh() {
        try {
            if (!existsSync(this.configPath)) {
                this.cache = {};
                return;
            }
            const content = readFileSync(this.configPath, 'utf-8');
            const newConfig = JSON.parse(content);
            if (!newConfig || typeof newConfig !== "object" || Array.isArray(newConfig))
                throw Error("settings object required");
            const stat = statSync(this.configPath);
            this.lastMtime = stat.mtimeMs;
            this.lastReadAt = Date.now();
            const pathsToCheck = this.watchPaths.size > 0
                ? this.watchPaths
                : this.accessedPaths;
            for (const dotPath of pathsToCheck) {
                const oldValue = this.getNestedValue(this.cache, dotPath);
                const newValue = this.getNestedValue(newConfig, dotPath);
                if (!this.deepEqual(oldValue, newValue)) {
                    const change = {
                        path: dotPath,
                        oldValue,
                        newValue,
                        detectedAt: new Date().toISOString(),
                    };
                    this.emit('change', change);
                }
            }
            this.cache = newConfig;
            this.lastError = null;
        }
        catch (err) {
            this.lastError = "Runtime settings unreadable; retained last valid settings";
        }
    }
    getNestedValue(obj, dotPath) {
        const parts = dotPath.split('.');
        let current = obj;
        for (const part of parts) {
            if (current === null || current === undefined || typeof current !== 'object') {
                return undefined;
            }
            current = current[part];
        }
        return current;
    }
    deepEqual(a, b) {
        if (a === b)
            return true;
        if (a === null || b === null)
            return false;
        if (typeof a !== typeof b)
            return false;
        if (typeof a !== 'object')
            return false;
        const aObj = a;
        const bObj = b;
        const keys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);
        for (const key of keys) {
            if (!this.deepEqual(aObj[key], bObj[key]))
                return false;
        }
        return true;
    }
}
