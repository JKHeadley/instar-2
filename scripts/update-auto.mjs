// Copied/adapted from Instar 1.x 1cb59f787: src/core/AutoUpdater.ts.
// Host-side policy; installation admission remains in the existing runner. See docs/update.md.
import { UpdateGate } from "./update-gate.mjs";
import { RestartCascadeDampener, formatLocalTimeHHMM } from "./update-dampener.mjs";
import { recordScheduledCrash } from '../src/scheduled/shedding.ts';
const FAILURE_POLICY = { threshold: 3, windowMs: 86400000 };
const crossesBreaking = (a, b) => a.split(".").slice(0, 2).join(".") !== b.split(".").slice(0, 2).join(".");
const DEFAULT_RESTART_RETRY_MS = 5 * 60_000;
const RESTART_HOLD_ENDED_RETRY_MS = 1_000;
function isNewerVersion(a, b) {
    const semverRe = /^(\d+)\.(\d+)\.(\d+)/;
    const matchA = semverRe.exec(a);
    const matchB = semverRe.exec(b);
    if (!matchA || !matchB)
        return false;
    for (let i = 1; i <= 3; i++) {
        const va = Number(matchA[i]);
        const vb = Number(matchB[i]);
        if (va !== vb)
            return va > vb;
    }
    return false;
}
export class AutoUpdater {
    updateChecker;
    config;
    interval = null;
    lastCheck = null;
    lastApply = null;
    lastAppliedVersion = null;
    lastError = null;
    pendingUpdate = null;
    isApplying = false;
    liveConfig = null;
    applyTimer = null;
    pendingUpdateDetectedAt = null;
    coalescingUntil = null;
    gate;
    sessionManager = null;
    sessionMonitor = null;
    deferralTimer = null;
    deferralRetryInFlight = false;
    deferralLifecycleGeneration = 0;
    restartDeferral = null;
    updateActivationPendingSince = null;
    notifiedVersionMismatch = null;
    lastNotifiedRestartVersion = null;
    lastRestartRequestedAt = null;
    lastRestartRequestedVersion = null;
    dampener;
    batchedRestartTimer = null;
    batchedRestartTargetVersion = null;
    batchedRestartEligibleAt = null;
    batchedRestartOriginalVersion = null;
    constructor(updateChecker, state, stateDir, config, telegram, liveConfig) {
        this.ports = state;
        this.updateChecker = updateChecker;
        this.liveConfig = liveConfig ?? null;
        this.config = {
            checkIntervalMinutes: config?.checkIntervalMinutes ?? 30,
            autoApply: config?.autoApply ?? true,
            autoRestart: config?.autoRestart ?? true,
            applyDelayMinutes: config?.applyDelayMinutes ?? 5,
            preRestartDelaySecs: config?.preRestartDelaySecs ?? 60,
            restartWindow: config?.restartWindow ?? null,
            restartCascadeDampenerWindowMs: config?.restartCascadeDampenerWindowMs ?? 15 * 60_000,
            restartImmediately: config?.restartImmediately ?? false,
            restartHandshake: config?.restartHandshake,
        };
        this.gate = new UpdateGate({
            alwaysRestartImmediately: this.config.restartImmediately,
            restartSafetyResolver: (session) => this.isSessionRestartSafe(session),
        });
        this.dampener = new RestartCascadeDampener(this.config.restartCascadeDampenerWindowMs);
        this.loadState();
    }
    start() {
        if (this.failureState?.pausedAt != null) return;
        this.stopped = false;
        if (this.interval)
            return;
        const intervalMs = this.config.checkIntervalMinutes * 60 * 1000;
        console.log(`[AutoUpdater] Started (every ${this.config.checkIntervalMinutes}m, ` +
            `autoApply: ${this.config.autoApply})`);
        this.startTimer = setTimeout(() => this.tick().catch(() => this.stop()), 10_000);
        this.ensureDeferredRestartRetry();
        this.interval = setInterval(() => this.tick().catch(() => this.stop()), intervalMs);
        this.interval.unref();
    }
    stop() {
        this.stopped = true;
        clearTimeout(this.startTimer);
        clearTimeout(this.batchedRestartTimer);
        this.batchedRestartTimer = null;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        if (this.applyTimer) {
            clearTimeout(this.applyTimer);
            this.applyTimer = null;
            this.coalescingUntil = null;
        }
        if (this.deferralTimer) {
            clearTimeout(this.deferralTimer);
            this.deferralTimer = null;
        }
        this.deferralLifecycleGeneration++;
        this.gate.reset();
    }
    getRestartBlockers(exclude = () => false) {
        const holds = this.gate.getActiveHolds().map((h) => `hold:${h.name}`);
        if (this.config.restartImmediately || !this.sessionManager)
            return holds;
        return [
            ...this.gate.getBlockingSessions(this.sessionManager, this.sessionMonitor).filter((n) => !exclude(n)),
            ...holds,
        ];
    }
    getStatus() {
        const gateStatus = this.gate.getStatus();
        return {
            running: this.interval !== null,
            failureState: this.failureState, nextAttemptAt: this.nextAttemptAt,
            lastCheck: this.lastCheck,
            lastApply: this.lastApply,
            lastAppliedVersion: this.lastAppliedVersion,
            updateActivationPendingSince: this.updateActivationPendingSince,
            config: { ...this.config },
            pendingUpdate: this.pendingUpdate,
            lastError: this.lastError,
            coalescingUntil: this.coalescingUntil,
            pendingUpdateDetectedAt: this.pendingUpdateDetectedAt,
            deferralReason: gateStatus.deferralReason,
            deferralElapsedMinutes: gateStatus.deferralElapsedMinutes,
            maxDeferralHours: gateStatus.maxDeferralHours,
            restartDeferral: this.restartDeferral ? { ...this.restartDeferral } : null,
            restartImmediately: gateStatus.alwaysRestartImmediately,
            restartSafeSessions: gateStatus.restartSafeSessions,
            hardBlockingSessions: gateStatus.hardBlockingSessions,
        };
    }
    isSessionRestartSafe(session) { return this.ports.restartSafe?.(session) === true; }
    setSessionDeps(sessionManager, sessionMonitor) {
        this.sessionManager = sessionManager;
        this.sessionMonitor = sessionMonitor ?? null;
    }
    setRestartHold(key, provider) {
        this.gate.setRestartHoldProvider(key, provider);
    }
    reloadDynamicConfig() {
        if (!this.liveConfig)
            return;
        const boolean = (key, fallback) => {
            const value = this.liveConfig.get(key, fallback);
            return typeof value === 'boolean' ? value : fallback;
        };
        this.config.autoApply = boolean('updates.autoApply', this.config.autoApply);
        this.config.autoRestart = boolean('updates.autoRestart', this.config.autoRestart);
        this.config.restartImmediately = boolean('updates.restartImmediately', this.config.restartImmediately);
        this.gate.setAlwaysRestartImmediately(this.config.restartImmediately);
        for (const [key, maximum] of [['applyDelayMinutes', 1440], ['preRestartDelaySecs', 600], ['restartCascadeDampenerWindowMs', 86400000]]) {
            const value = this.liveConfig.get(`updates.${key}`, this.config[key]);
            if (Number.isFinite(value) && value >= 0 && value <= maximum) this.config[key] = value;
        }
        this.dampener = new RestartCascadeDampener(this.config.restartCascadeDampenerWindowMs);
        const window = this.liveConfig.get('updates.restartWindow', this.config.restartWindow);
        if (window === null || (window && /^[0-2]?[0-9]:[0-5][0-9]$/.test(window.start)
            && /^[0-2]?[0-9]:[0-5][0-9]$/.test(window.end)
            && Number(window.start.split(':')[0]) < 24 && Number(window.end.split(':')[0]) < 24)) this.config.restartWindow = window;
        const minutes = this.liveConfig.get('updates.checkIntervalMinutes', this.config.checkIntervalMinutes);
        if (Number.isFinite(minutes) && minutes >= 1 && minutes <= 1440 && minutes !== this.config.checkIntervalMinutes) {
            this.config.checkIntervalMinutes = minutes;
            if (this.interval) {
                clearInterval(this.interval);
                this.interval = setInterval(() => this.tick().catch(() => this.stop()), minutes * 60000);
                this.interval.unref();
            }
        }
    }
    async tick() {
        if (this.checking || this.failureState?.pausedAt != null || Date.now() < this.nextAttemptAt) return;
        if (this.stopped || this.ports.stopped())
            return;
        if (this.isApplying) {
            console.log('[AutoUpdater] Skipping tick — update already in progress');
            return;
        }
        this.reloadDynamicConfig();
        this.checking = true;
        try {
            const info = await this.updateChecker.check();
            this.lastCheck = new Date().toISOString();
            this.lastError = null;
            if (!info.updateAvailable) {
                const runningVersion = this.updateChecker.getInstalledVersion();
                if (this.lastAppliedVersion && isNewerVersion(runningVersion, this.lastAppliedVersion)) {
                    console.log(`[AutoUpdater] Reconciling lastAppliedVersion v${this.lastAppliedVersion} → v${runningVersion} ` +
                        `(running build is newer than the recorded apply)`);
                    this.lastAppliedVersion = runningVersion;
                }
                this.pendingUpdate = null;
                this.pendingUpdateDetectedAt = null;
                this.coalescingUntil = null;
                this.clearRestartDeferral();
                if (this.applyTimer) {
                    clearTimeout(this.applyTimer);
                    this.applyTimer = null;
                }
                this.saveState();
                return;
            }
            console.log(`[AutoUpdater] Update available: ${info.currentVersion} → ${info.latestVersion}`);
            if (this.updateChecker.getShadowInstalledVersion() === info.latestVersion && this.lastAppliedVersion !== info.latestVersion) {
                this.lastAppliedVersion = info.latestVersion;
                this.saveState();
            }
            if (this.lastAppliedVersion === info.latestVersion) {
                const deferral = this.getActiveRestartDeferral(info.latestVersion);
                const shadowVersion = this.updateChecker.getShadowInstalledVersion();
                const isStrand = shadowVersion !== this.lastAppliedVersion;
                if (isStrand) {
                    this.lastAppliedVersion = null;
                    this.pendingUpdate = info.latestVersion;
                    this.saveState();
                    if (this.config.autoApply)
                        await this.applyPendingUpdate();
                    return;
                }
                else if (deferral) {
                    this.ensureDeferredRestartRetry();
                    console.log(`[AutoUpdater] Skipping — v${info.latestVersion} is installed in the shadow install ` +
                        `(at ${this.lastApply}) but the running process is still v${info.currentVersion}. ` +
                        `Restart activation is intentionally deferred: ${deferral.reason}.`);
                }
                else {
                    this.recordRestartDeferral({ targetVersion: info.latestVersion, reason: 'installed version awaits activation', currentBlockers: [], nextRetryAt: new Date().toISOString() });
                    this.ensureDeferredRestartRetry();
                    console.log(`[AutoUpdater] Skipping — v${info.latestVersion} was already applied ` +
                        `(at ${this.lastApply}) but getInstalledVersion() still reports v${info.currentVersion}. ` +
                        `A restart has not activated the new version yet.`);
                }
                if (!this.notifiedVersionMismatch) {
                    this.notifiedVersionMismatch = info.latestVersion;
                    if (isStrand) {
                        await this.notify(`Heads up — an update to v${this.lastAppliedVersion} was recorded as installed, but it's ` +
                            `not actually on disk (it reverted), so I'm stuck on v${info.currentVersion} and won't ` +
                            `auto-update until it's re-applied. Nothing is broken, but I won't pick up new versions until this is fixed.`);
                    }
                    else if (deferral) {
                        await this.notify(`v${info.latestVersion} is downloaded and waiting for a restart — still running v${info.currentVersion}. ` +
                            `Restart is being held back by ${deferral.reason}. ` +
                            `I'll switch over automatically once they finish.`);
                    }
                    else {
                        await this.notify(`v${info.latestVersion} is downloaded but the process hasn't restarted yet — still running v${info.currentVersion}. ` +
                            `A server restart will activate the new version.`);
                    }
                }
                this.saveState();
                return;
            }
            if (!this.pendingUpdateDetectedAt) {
                this.pendingUpdateDetectedAt = new Date().toISOString();
            }
            if (this.pendingUpdate === info.latestVersion && this.applyTimer) return;
            this.pendingUpdate = info.latestVersion;
            if (!this.config.autoApply) {
                this.saveState();
                if (!this.coalescingUntil) {
                    await this.notify(`There's a new version available (v${info.latestVersion}). I'm currently on v${info.currentVersion}.\n\n` +
                        `Auto-updates are off. Just say "update" or "apply the update" and I'll handle it. ` +
                        `Or to turn on auto-updates so this happens automatically, say "turn on auto-updates".`);
                    this.coalescingUntil = 'notified';
                }
                return;
            }
            const delayMs = this.config.applyDelayMinutes * 60_000;
            if (delayMs <= 0) {
                this.saveState();
                await this.applyPendingUpdate();
                return;
            }
            if (this.applyTimer) {
                clearTimeout(this.applyTimer);
                console.log(`[AutoUpdater] Coalescing: timer reset — newer version v${info.latestVersion} detected`);
            }
            else {
                console.log(`[AutoUpdater] Coalescing: waiting ${this.config.applyDelayMinutes}m before applying v${info.latestVersion}`);
            }
            this.coalescingUntil = new Date(Date.now() + delayMs).toISOString();
            this.saveState();
            this.applyTimer = setTimeout(async () => {
                this.applyTimer = null;
                this.coalescingUntil = null;
                await this.applyPendingUpdate();
            }, delayMs);
            this.applyTimer.unref();
        }
        catch (err) {
            this.isApplying = false;
            this.lastError = err instanceof Error ? err.message : String(err);
            this.saveState();
            this.recordFailure();
            console.error(`[AutoUpdater] Tick error: ${this.lastError}`);
        } finally { this.checking = false; }
    }
    async applyPendingUpdate(options) {
        if (this.failureState?.pausedAt != null || Date.now() < this.nextAttemptAt) return;
        if (this.stopped || this.ports.stopped())
            return;
        if (this.isApplying) {
            console.log('[AutoUpdater] Skipping apply — already in progress');
            return;
        }
        if (!this.pendingUpdate) {
            if (options?.bypassHolds && this.restartDeferral?.active) {
                await this.gatedRestart(this.restartDeferral.targetVersion, true, true);
                return;
            }
            console.log('[AutoUpdater] No pending update to apply');
            return;
        }
        this.reloadDynamicConfig();
        if (!this.config.autoApply && !options)
            return;
        const targetVersion = this.pendingUpdate;
        try {
            this.isApplying = true;
            this.updateActivationPendingSince = new Date().toISOString();
            console.log(`[AutoUpdater] Applying update to v${targetVersion}...`);
            const result = await this.updateChecker.applyUpdate();
            this.isApplying = false;
            if (!result.success) {
                this.updateActivationPendingSince = null;
                this.lastError = result.message;
                this.recordFailure();
                console.error(`[AutoUpdater] Update failed: ${result.message}`);
                await this.notify(`Heads up — I tried to update to v${targetVersion} but it didn't work out. ` +
                    `I'm still running fine on v${result.previousVersion}, so nothing's broken. ` +
                    `I'll try again next cycle.`);
                return;
            }
            this.lastApply = new Date().toISOString();
            const appliedVersion = isNewerVersion(result.newVersion, targetVersion)
                ? result.newVersion
                : targetVersion;
            this.lastAppliedVersion = appliedVersion;
            this.pendingUpdate = null;
            this.pendingUpdateDetectedAt = null;
            this.coalescingUntil = null;
            this.saveState();
            console.log(`[AutoUpdater] Updated: v${result.previousVersion} → v${result.newVersion} (target: v${targetVersion})`);
            await this.gatedRestart(appliedVersion, options?.bypassWindow ?? false, options?.bypassHolds ?? false);
        }
        catch (err) {
            this.isApplying = false;
            this.updateActivationPendingSince = null;
            this.lastError = err instanceof Error ? err.message : String(err);
            this.saveState();
            this.recordFailure();
            console.error(`[AutoUpdater] Apply error: ${this.lastError}`);
        }
    }
    isInRestartWindow() {
        const window = this.config.restartWindow;
        if (!window)
            return true;
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const [startH, startM] = window.start.split(':').map(Number);
        const [endH, endM] = window.end.split(':').map(Number);
        const startMinutes = startH * 60 + (startM || 0);
        const endMinutes = endH * 60 + (endM || 0);
        if (startMinutes <= endMinutes) {
            return currentMinutes >= startMinutes && currentMinutes < endMinutes;
        }
        else {
            return currentMinutes >= startMinutes || currentMinutes < endMinutes;
        }
    }
    msUntilRestartWindow() {
        const window = this.config.restartWindow;
        if (!window)
            return 0;
        const now = new Date();
        const [startH, startM] = window.start.split(':').map(Number);
        const target = new Date(now);
        target.setHours(startH, startM || 0, 0, 0);
        if (target.getTime() <= now.getTime()) {
            target.setDate(target.getDate() + 1);
        }
        return target.getTime() - now.getTime();
    }
    async gatedRestart(newVersion, bypassWindow = false, bypassHolds = false) {
        if (this.restartDecisionInFlight || this.stopped || this.ports.stopped()) return;
        this.restartDecisionInFlight = true;
        try { await this.decideRestart(newVersion, bypassWindow, bypassHolds); }
        finally { this.restartDecisionInFlight = false; }
    }
    async decideRestart(newVersion, bypassWindow = false, bypassHolds = false) {
        if (this.failureState?.pausedAt != null) return;
        this.reloadDynamicConfig();
        if (!this.config.autoRestart || this.stopped || this.ports.stopped())
            return;
        this.updateActivationPendingSince ??= new Date().toISOString();
        try {
            if (this.lastRestartRequestedVersion === newVersion && this.lastRestartRequestedAt) {
                const elapsed = Date.now() - new Date(this.lastRestartRequestedAt).getTime();
                const cooldownMs = 30 * 60_000;
                if (elapsed < cooldownMs) {
                    console.log(`[AutoUpdater] Restart cooldown: already requested restart for v${newVersion} ` +
                        `${Math.round(elapsed / 60_000)}m ago (cooldown: 30m). Skipping.`);
                    this.recordRestartDeferral({ targetVersion: newVersion, bypassWindow, reason: 'same-version restart cooldown', currentBlockers: [], nextRetryAt: new Date(Date.now() + cooldownMs - elapsed).toISOString() });
                    this.scheduleDeferredRestartRetry(newVersion, cooldownMs - elapsed, 'same-version cooldown elapsed');
                    this.updateActivationPendingSince = null;
                    return;
                }
            }
            if (!bypassWindow && this.lastRestartRequestedAt && this.lastRestartRequestedVersion !== newVersion) {
                const decision = this.dampener.decide({
                    requestedVersion: newVersion,
                    lastRequestedAt: this.lastRestartRequestedAt,
                });
                if (decision.kind === 'batch') {
                    await this.handleDampenerBatch(newVersion, decision.eligibleAt);
                    this.updateActivationPendingSince = null;
                    return;
                }
                console.log(`[AutoUpdater] Cascade dampener: ${decision.reason}`);
            }
            if (!bypassHolds) {
                const maxDeferralMs = this.gate.getStatus().maxDeferralHours * 3_600_000;
                const firstDeferredAt = this.getActiveRestartDeferral(newVersion)?.firstDeferredAt;
                const deferredSince = firstDeferredAt ? Date.parse(firstDeferredAt) : Number.NaN;
                const holdCeiling = Number.isFinite(deferredSince) ? deferredSince + maxDeferralMs : Date.now() + maxDeferralMs;
                let holds = this.gate.getActiveHolds();
                if (holds.length > 0 && Date.now() >= holdCeiling) {
                    console.log(`[AutoUpdater] Restart holds for v${newVersion} ignored: max deferral (${this.gate.getStatus().maxDeferralHours}h) reached (${holds.map((h) => h.name).join(', ')})`);
                    holds = [];
                    bypassHolds = true;
                }
                if (holds.length > 0) {
                    const soonest = holds[0];
                    const retryMs = Math.max(1_000, Math.min(DEFAULT_RESTART_RETRY_MS, soonest.until - Date.now() + 1_000, holdCeiling - Date.now() + 1_000));
                    const reason = `held for in-flight work: ${holds.map((h) => `${h.reason} (until ${new Date(h.until).toISOString()})`).join('; ')}`;
                    console.log(`[AutoUpdater] Restart deferred for v${newVersion}: ${reason}. Will retry in ${Math.ceil(retryMs / 1000)}s`);
                    this.recordRestartDeferral({
                        targetVersion: newVersion,
                        bypassWindow,
                        reason,
                        currentBlockers: holds.map((h) => h.name),
                        nextRetryAt: new Date(Date.now() + retryMs).toISOString(),
                    });
                    this.scheduleDeferredRestartRetry(newVersion, retryMs, 'restart hold re-check');
                    this.updateActivationPendingSince = null;
                    return;
                }
            }
            if (!bypassWindow && !this.config.restartImmediately && !this.isInRestartWindow()) {
                const blockers = this.sessionManager
                    ? this.gate.getBlockingSessions(this.sessionManager, this.sessionMonitor)
                    : [];
                if (blockers.length > 0) {
                    const waitMs = this.msUntilRestartWindow();
                    const waitH = Math.round(waitMs / 3600_000 * 10) / 10;
                    console.log(`[AutoUpdater] Outside restart window (${this.config.restartWindow.start}-${this.config.restartWindow.end}) with ${blockers.length} active session(s). Deferring restart for v${newVersion} (~${waitH}h)`);
                    this.recordRestartDeferral({
                        targetVersion: newVersion,
                        bypassWindow,
                        reason: `outside restart window (${this.config.restartWindow.start}-${this.config.restartWindow.end}); ${blockers.length} active session(s)`,
                        currentBlockers: blockers,
                        nextRetryAt: new Date(Date.now() + waitMs).toISOString(),
                    });
                    this.scheduleDeferredRestartRetry(newVersion, waitMs, 'restart window reached');
                    this.updateActivationPendingSince = null;
                    return;
                }
                console.log(`[AutoUpdater] Outside restart window but idle (no active sessions) — restarting now for v${newVersion}`);
            }
            if (!this.sessionManager) {
                console.log(`[AutoUpdater] Silent restart — no session manager wired (updating to v${newVersion})`);
                this.lastRestartRequestedAt = new Date().toISOString();
                this.lastRestartRequestedVersion = newVersion;
                this.saveState();
                await new Promise(r => setTimeout(r, 2000));
                if (!this.requestRestart(newVersion, bypassHolds))
                    this.updateActivationPendingSince = null;
                return;
            }
            const result = this.gate.canRestart(this.sessionManager, this.sessionMonitor);
            if (result.unresponsiveSessions?.length) {
                console.log(`[AutoUpdater] Unresponsive sessions (not blocking): ${result.unresponsiveSessions.join(', ')}`);
            }
            if (result.nonBlockingJobSessions?.length) {
                console.log(`[AutoUpdater] Idle background job sessions (not blocking): ${result.nonBlockingJobSessions.join(', ')}`);
            }
            if (result.allowed) {
                if (this.deferralTimer) {
                    clearTimeout(this.deferralTimer);
                    this.deferralTimer = null;
                }
                const runningSessions = this.sessionManager.listRunningSessions();
                const hasRunningSessions = runningSessions.length > 0;
                if (result.reason?.includes('Max deferral')) {
                    await this.notify(`Update to v${newVersion} was deferred for active sessions, but the maximum wait has been reached. Restarting now.`);
                }
                else if (hasRunningSessions) {
                    if (this.lastNotifiedRestartVersion !== newVersion) {
                        this.lastNotifiedRestartVersion = newVersion;
                        const previousVersion = this.updateChecker.getInstalledVersion();
                        const patchOnly = !crossesBreaking(previousVersion, newVersion);
                        const restartNote = patchOnly
                            ? ''
                            : `Just updated to v${newVersion}. Restarting to pick up the changes.`;
                        if (this.config.restartHandshake) {
                            try {
                                this.config.restartHandshake.writePendingHandshake({
                                    expectedVersion: newVersion,
                                    previousVersion,
                                    deferredNotification: restartNote,
                                });
                            }
                            catch (err) {
                                console.warn(`[AutoUpdater] Handshake write failed; falling back to immediate notify: ${err instanceof Error ? err.message : String(err)}`);
                                if (restartNote)
                                    await this.notify(restartNote);
                            }
                        }
                        else if (restartNote) {
                            await this.notify(restartNote);
                        }
                        if (patchOnly) {
                            console.log(`[AutoUpdater] Patch-only restart (v${previousVersion} → v${newVersion}) with ${runningSessions.length} active session(s) — suppressing restart narration (Fork 3); handshake verification preserved.`);
                        }
                    }
                    const delaySecs = this.config.preRestartDelaySecs;
                    if (delaySecs > 0) {
                        console.log(`[AutoUpdater] Pre-restart delay: ${delaySecs}s for ${runningSessions.length} session(s)`);
                        await new Promise(r => setTimeout(r, delaySecs * 1000));
                    }
                }
                else {
                    console.log(`[AutoUpdater] Silent restart — no active sessions (updating to v${newVersion})`);
                }
                this.lastRestartRequestedAt = new Date().toISOString();
                this.lastRestartRequestedVersion = newVersion;
                this.clearRestartDeferral();
                this.saveState();
                await new Promise(r => setTimeout(r, 2000));
                if (!this.requestRestart(newVersion, bypassHolds))
                    this.updateActivationPendingSince = null;
                return;
            }
            console.log(`[AutoUpdater] Restart deferred: ${result.reason}. Will retry in ${Math.round((result.retryInMs ?? 300_000) / 60_000)}m`);
            this.recordRestartDeferral({
                targetVersion: newVersion,
                bypassWindow,
                reason: result.reason ?? 'active sessions',
                currentBlockers: result.blockingSessions ?? [],
                nextRetryAt: new Date(Date.now() + (result.retryInMs ?? 300_000)).toISOString(),
            });
            if (this.gate.shouldSendFinalWarning()) {
                await this.notify(`Update to v${newVersion} installed. Active work still holds the restart.`);
            }
            else if (this.gate.shouldSendFirstWarning()) {
                await this.notify(`Update to v${newVersion} installed but restart is being deferred for ${result.blockingSessions?.length} active session(s). ` +
                    `Active work remains protected.`);
            }
            this.scheduleDeferredRestartRetry(newVersion, result.retryInMs ?? DEFAULT_RESTART_RETRY_MS, 'session deferral elapsed');
            this.updateActivationPendingSince = null;
        }
        catch (err) {
            this.updateActivationPendingSince = null;
            throw err;
        }
    }
    recheckRestartHolds() {
        const deferral = this.restartDeferral;
        if (!deferral?.active || this.deferralRetryInFlight || !this.deferralTimer)
            return;
        if (!(deferral.currentBlockers ?? []).some((b) => b.startsWith('local-verify')))
            return;
        if (this.gate.getActiveHolds().length > 0)
            return;
        this.scheduleDeferredRestartRetry(deferral.targetVersion, RESTART_HOLD_ENDED_RETRY_MS, 'restart hold ended');
    }
    ensureDeferredRestartRetry() {
        const deferral = this.restartDeferral;
        if (this.failureState?.pausedAt != null || this.stopped || !deferral?.active || this.deferralTimer || this.deferralRetryInFlight)
            return;
        const retryAt = deferral.nextRetryAt ? Date.parse(deferral.nextRetryAt) : Number.NaN;
        const delayMs = Number.isFinite(retryAt)
            ? Math.max(0, retryAt - Date.now())
            : DEFAULT_RESTART_RETRY_MS;
        this.scheduleDeferredRestartRetry(deferral.targetVersion, delayMs, 'durable deferral resumed');
    }
    scheduleDeferredRestartRetry(targetVersion, delayMs, reason) {
        if (this.failureState?.pausedAt != null || this.stopped) return;
        if (this.deferralTimer)
            clearTimeout(this.deferralTimer);
        const boundedDelayMs = Math.max(0, delayMs);
        const generation = this.deferralLifecycleGeneration;
        this.deferralTimer = setTimeout(() => {
            this.deferralTimer = null;
            if (this.deferralRetryInFlight || generation !== this.deferralLifecycleGeneration)
                return;
            this.deferralRetryInFlight = true;
            console.log(`[AutoUpdater] ${reason} — attempting restart for v${targetVersion}`);
            void this.retryDeferredRestart(targetVersion, generation).finally(() => {
                this.deferralRetryInFlight = false;
                if (generation === this.deferralLifecycleGeneration &&
                    !this.deferralTimer) {
                    this.ensureDeferredRestartRetry();
                }
            });
        }, boundedDelayMs);
        this.deferralTimer.unref();
    }
    async retryDeferredRestart(targetVersion, generation) {
        try {
            await this.gatedRestart(targetVersion, this.getActiveRestartDeferral(targetVersion)?.bypassWindow === true);
        }
        catch (err) {
            this.lastError = err instanceof Error ? err.message : String(err);
            this.recordFailure();
            console.error(`[AutoUpdater] Deferred restart retry failed: ${this.lastError}`);
            const deferral = this.getActiveRestartDeferral(targetVersion);
            if (!deferral || generation !== this.deferralLifecycleGeneration)
                return;
            const nextRetryAt = new Date(Date.now() + DEFAULT_RESTART_RETRY_MS).toISOString();
            this.recordRestartDeferral({
                targetVersion,
                bypassWindow: deferral.bypassWindow,
                reason: deferral.reason,
                currentBlockers: deferral.currentBlockers,
                nextRetryAt,
            });
            this.scheduleDeferredRestartRetry(targetVersion, DEFAULT_RESTART_RETRY_MS, 'retry after deferred restart error');
        }
    }
    async handleDampenerBatch(newVersion, eligibleAt) {
        const now = Date.now();
        const waitMs = Math.max(0, eligibleAt - now);
        const fireAt = new Date(eligibleAt);
        this.recordRestartDeferral({ targetVersion: this.pickHigherVersion(this.restartDeferral?.targetVersion ?? newVersion, newVersion),
            reason: 'cascade batching', currentBlockers: [], nextRetryAt: fireAt.toISOString() });
        if (!this.batchedRestartTimer) {
            this.batchedRestartOriginalVersion = this.lastRestartRequestedVersion;
            this.batchedRestartTargetVersion = newVersion;
            this.batchedRestartEligibleAt = eligibleAt;
            console.log(`[AutoUpdater] Restart batched: v${newVersion} queued (firing at ` +
                `${formatLocalTimeHHMM(eligibleAt, fireAt)}, ~${Math.max(1, Math.round(waitMs / 60_000))}m). ` +
                `Previous restart was v${this.lastRestartRequestedVersion ?? '?'} at ${this.lastRestartRequestedAt ?? '?'}.`);
            const hasActive = this.sessionManager
                ? this.sessionManager.listRunningSessions().length > 0
                : false;
            if (hasActive && this.lastNotifiedRestartVersion !== newVersion) {
                this.lastNotifiedRestartVersion = newVersion;
                await this.notify(`Update v${newVersion} queued — rolling into the pending restart at ` +
                    `${formatLocalTimeHHMM(eligibleAt, fireAt)} (about ${Math.max(1, Math.round(waitMs / 60_000))}m) so you don't get hit by two back-to-back restarts.`);
            }
            this.batchedRestartTimer = setTimeout(() => {
                const target = this.batchedRestartTargetVersion ?? newVersion;
                this.batchedRestartTimer = null;
                this.batchedRestartTargetVersion = null;
                this.batchedRestartEligibleAt = null;
                this.batchedRestartOriginalVersion = null;
                console.log(`[AutoUpdater] Cascade-dampener batch window elapsed — restarting for v${target}`);
                void this.gatedRestart(target, false);
            }, waitMs);
            this.batchedRestartTimer.unref();
            return;
        }
        const currentTarget = this.batchedRestartTargetVersion ?? newVersion;
        const nextTarget = this.pickHigherVersion(currentTarget, newVersion);
        if (nextTarget !== currentTarget) {
            console.log(`[AutoUpdater] Cascade-dampener batch updated: target v${currentTarget} → v${nextTarget} ` +
                `(firing at ${formatLocalTimeHHMM(this.batchedRestartEligibleAt ?? eligibleAt, new Date(this.batchedRestartEligibleAt ?? eligibleAt))})`);
            this.batchedRestartTargetVersion = nextTarget;
        }
        else {
            console.log(`[AutoUpdater] Cascade-dampener batch ignored v${newVersion} (current target v${currentTarget} is higher or equal)`);
        }
    }
    pickHigherVersion(a, b) {
        const pa = a.split('.').map(n => parseInt(n, 10));
        const pb = b.split('.').map(n => parseInt(n, 10));
        for (let i = 0; i < 3; i++) {
            const av = Number.isFinite(pa[i]) ? pa[i] : 0;
            const bv = Number.isFinite(pb[i]) ? pb[i] : 0;
            if (av > bv)
                return a;
            if (av < bv)
                return b;
        }
        return b;
    }
    _getBatchedRestartState() {
        return {
            targetVersion: this.batchedRestartTargetVersion,
            eligibleAt: this.batchedRestartEligibleAt,
            originalVersion: this.batchedRestartOriginalVersion,
            timerActive: this.batchedRestartTimer !== null,
        };
    }
    requestRestart(newVersion, bypassHolds = false) {
        if (this.stopped || this.ports.stopped())
            return false;
        this.config.restartHandshake.writePendingHandshake({ expectedVersion: newVersion,
            previousVersion: this.updateChecker.getInstalledVersion(), deferredNotification: '' });
        return this.ports.requestRestart(newVersion, bypassHolds);
    }
    async notify(message) {
        this.ports.observe(message);
    }
    recordFailure() {
        this.failureState = recordScheduledCrash(this.failureState ?? null, { at: Date.now(), kind: 'failure' }, FAILURE_POLICY);
        this.nextAttemptAt = Date.now() + Math.min(6 * 3600000, 30 * 60000 * 2 ** (this.failureState.failures.length - 1));
        this.saveState();
        if (this.failureState.pausedAt !== null) this.stop();
    }
    loadState() {
        const data = this.ports.load() ?? {};
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('Malformed updater state; preserved');
        for (const key of ['lastCheck', 'lastApply', 'lastAppliedVersion', 'lastError', 'pendingUpdate', 'pendingUpdateDetectedAt',
            'notifiedVersionMismatch', 'lastNotifiedRestartVersion', 'lastRestartRequestedAt', 'lastRestartRequestedVersion']) {
            if (data[key] != null && typeof data[key] !== 'string') throw Error('Malformed updater field; preserved');
        }
        this.failureState = data.failureState ?? null;
        if (this.failureState) recordScheduledCrash(this.failureState, { at: Date.now(), kind: 'no-work' }, FAILURE_POLICY);
        this.nextAttemptAt = data.nextAttemptAt ?? 0;
        if (!Number.isSafeInteger(this.nextAttemptAt) || this.nextAttemptAt < 0) throw Error('Malformed update retry time; preserved');
        this.lastCheck = data.lastCheck ?? null;
        this.lastApply = data.lastApply ?? null;
        this.lastAppliedVersion = data.lastAppliedVersion ?? null;
        this.lastError = data.lastError ?? null;
        this.pendingUpdate = data.pendingUpdate ?? null;
        this.pendingUpdateDetectedAt = data.pendingUpdateDetectedAt ?? null;
        this.notifiedVersionMismatch = data.notifiedVersionMismatch ?? null;
        this.lastNotifiedRestartVersion = data.lastNotifiedRestartVersion ?? null;
        this.lastRestartRequestedAt = data.lastRestartRequestedAt ?? null;
        this.lastRestartRequestedVersion = data.lastRestartRequestedVersion ?? null;
        this.restartDeferral = this.parseRestartDeferral(data.restartDeferral);
    }
    saveState() {
        const data = {
            failureState: this.failureState, nextAttemptAt: this.nextAttemptAt,
            lastCheck: this.lastCheck,
            lastApply: this.lastApply,
            lastAppliedVersion: this.lastAppliedVersion,
            lastError: this.lastError,
            pendingUpdate: this.pendingUpdate,
            pendingUpdateDetectedAt: this.pendingUpdateDetectedAt,
            coalescingUntil: this.coalescingUntil,
            notifiedVersionMismatch: this.notifiedVersionMismatch,
            lastNotifiedRestartVersion: this.lastNotifiedRestartVersion,
            lastRestartRequestedAt: this.lastRestartRequestedAt,
            lastRestartRequestedVersion: this.lastRestartRequestedVersion,
            restartDeferral: this.restartDeferral,
            savedAt: new Date().toISOString(),
        };
        this.ports.save(data);
    }
    getActiveRestartDeferral(targetVersion) {
        if (!this.restartDeferral?.active)
            return null;
        if (targetVersion && this.restartDeferral.targetVersion !== targetVersion)
            return null;
        return this.restartDeferral;
    }
    recordRestartDeferral(input) {
        const existing = this.restartDeferral?.targetVersion === input.targetVersion
            ? this.restartDeferral
            : null;
        this.restartDeferral = {
            active: true,
            targetVersion: input.targetVersion,
            ...(input.bypassWindow === true || existing?.bypassWindow === true ? { bypassWindow: true } : {}),
            firstDeferredAt: existing?.firstDeferredAt ?? new Date().toISOString(),
            reason: input.reason,
            currentBlockers: input.currentBlockers,
            nextRetryAt: input.nextRetryAt,
            updatedAt: new Date().toISOString(),
        };
        this.saveState();
    }
    clearRestartDeferral() {
        this.restartDeferral = null;
    }
    parseRestartDeferral(value) {
        if (!value || typeof value !== 'object')
            return null;
        const data = value;
        if (!data.active || typeof data.targetVersion !== 'string' || typeof data.reason !== 'string') {
            return null;
        }
        return {
            active: true,
            targetVersion: data.targetVersion,
            ...(data.bypassWindow === true ? { bypassWindow: true } : {}),
            firstDeferredAt: typeof data.firstDeferredAt === 'string' ? data.firstDeferredAt : new Date().toISOString(),
            reason: data.reason,
            currentBlockers: Array.isArray(data.currentBlockers)
                ? data.currentBlockers.filter((b) => typeof b === 'string')
                : [],
            nextRetryAt: typeof data.nextRetryAt === 'string' ? data.nextRetryAt : null,
            updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
        };
    }
}
