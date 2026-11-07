// Copied/adapted from Instar 1.x 1cb59f787: src/core/UpdateGate.ts.
// Host-side policy; installation admission remains in the existing runner. See docs/update.md.
export class UpdateGate {
    config;
    restartSafetyResolver;
    deferralStartedAt = null;
    deferralReason = null;
    blockingSessions = [];
    restartSafeSessions = [];
    hardBlockingSessions = [];
    firstWarningSent = false;
    firstWarningPending = false;
    finalWarningSent = false;
    finalWarningPending = false;
    constructor(config) {
        this.config = {
            maxDeferralHours: config?.maxDeferralHours ?? 4,
            firstWarningMinutes: config?.firstWarningMinutes ?? 30,
            finalWarningMinutes: config?.finalWarningMinutes ?? 5,
            retryIntervalMs: config?.retryIntervalMs ?? 5 * 60_000,
            alwaysRestartImmediately: config?.alwaysRestartImmediately ?? false,
        };
        this.restartSafetyResolver = config?.restartSafetyResolver;
    }
    setAlwaysRestartImmediately(value) {
        if (this.config.alwaysRestartImmediately === value)
            return;
        this.config.alwaysRestartImmediately = value;
        if (value)
            this.reset();
    }
    canRestart(sessionManager, sessionMonitor) {
        if (this.config.alwaysRestartImmediately) {
            this.reset();
            return { allowed: true };
        }
        const sessions = sessionManager.listRunningSessions();
        if (sessions.length === 0) {
            this.reset();
            return { allowed: true };
        }
        const { activeSessions, unresponsiveSessions, nonBlockingJobSessions, restartSafeSessions, hardBlockingSessions, } = this.classifyRunningSessions(sessions, sessionManager, sessionMonitor);
        if (activeSessions.length === 0) {
            this.reset();
            return {
                allowed: true,
                unresponsiveSessions: unresponsiveSessions.length > 0 ? unresponsiveSessions : undefined,
                nonBlockingJobSessions: nonBlockingJobSessions.length > 0 ? nonBlockingJobSessions : undefined,
            };
        }
        if (!this.deferralStartedAt) {
            this.deferralStartedAt = Date.now();
        }
        const elapsedMs = Date.now() - this.deferralStartedAt;
        const maxDeferralMs = this.config.maxDeferralHours * 60 * 60_000;
        const remainingMs = maxDeferralMs - elapsedMs;
        this.deferralReason = `${activeSessions.length} active session(s): ${activeSessions.join(', ')}`;
        this.blockingSessions = activeSessions;
        this.restartSafeSessions = restartSafeSessions;
        this.hardBlockingSessions = hardBlockingSessions;
        if (remainingMs <= 0) {
            console.log(`[UpdateGate] Max deferral (${this.config.maxDeferralHours}h) exceeded, but ${activeSessions.length} healthy session(s) still running — continuing to defer`);
        }
        const remainingMinutes = remainingMs / 60_000;
        if (remainingMinutes <= this.config.finalWarningMinutes && !this.finalWarningSent) {
            this.finalWarningSent = true;
            this.finalWarningPending = true;
        }
        if (remainingMinutes <= this.config.firstWarningMinutes && !this.firstWarningSent) {
            this.firstWarningSent = true;
            this.firstWarningPending = true;
        }
        return {
            allowed: false,
            reason: this.deferralReason,
            retryInMs: this.config.retryIntervalMs,
            blockingSessions: activeSessions,
            unresponsiveSessions: unresponsiveSessions.length > 0 ? unresponsiveSessions : undefined,
            nonBlockingJobSessions: nonBlockingJobSessions.length > 0 ? nonBlockingJobSessions : undefined,
            restartSafeSessions: restartSafeSessions.length > 0 ? restartSafeSessions : undefined,
            hardBlockingSessions: hardBlockingSessions.length > 0 ? hardBlockingSessions : undefined,
        };
    }
    getBlockingSessions(sessionManager, sessionMonitor) {
        const sessions = sessionManager.listRunningSessions();
        if (sessions.length === 0)
            return [];
        return this.classifyRunningSessions(sessions, sessionManager, sessionMonitor).activeSessions;
    }
    classifyRunningSessions(sessions, sessionManager, sessionMonitor) {
        const health = sessionMonitor?.getStatus().sessionHealth ?? [];
        const healthMap = new Map(health.map(h => [h.sessionName, h]));
        const activeSessions = [];
        const unresponsiveSessions = [];
        const nonBlockingJobSessions = [];
        const restartSafeSessions = [];
        const hardBlockingSessions = [];
        const recordBlocker = (session) => {
            activeSessions.push(session.name);
            let safe = false;
            try {
                safe = this.restartSafetyResolver?.(session) ?? false;
            }
            catch {
                safe = false;
            }
            (safe ? restartSafeSessions : hardBlockingSessions).push(session.name);
        };
        for (const session of sessions) {
            if (this.isSafeIdleJobSession(session, sessionManager)) {
                nonBlockingJobSessions.push(session.name);
                continue;
            }
            const h = (session.tmuxSession ? healthMap.get(session.tmuxSession) : undefined) ??
                healthMap.get(session.name);
            if (!h) {
                recordBlocker(session);
            }
            else if (h.status === 'healthy') {
                recordBlocker(session);
            }
            else if (h.status === 'unresponsive') {
                unresponsiveSessions.push(session.name);
            }
        }
        return {
            activeSessions,
            unresponsiveSessions,
            nonBlockingJobSessions,
            restartSafeSessions,
            hardBlockingSessions,
        };
    }
    isSafeIdleJobSession(session, sessionManager) {
        if (!session.jobSlug || !session.tmuxSession || !sessionManager.hasActiveProcesses) {
            return false;
        }
        return !sessionManager.hasActiveProcesses(session.tmuxSession);
    }
    getStatus() {
        const elapsedMs = this.deferralStartedAt ? Date.now() - this.deferralStartedAt : 0;
        return {
            deferring: this.deferralStartedAt !== null,
            deferralStartedAt: this.deferralStartedAt ? new Date(this.deferralStartedAt).toISOString() : null,
            deferralElapsedMinutes: Math.round(elapsedMs / 60_000),
            maxDeferralHours: this.config.maxDeferralHours,
            deferralReason: this.deferralReason,
            blockingSessions: this.blockingSessions,
            restartSafeSessions: this.restartSafeSessions,
            hardBlockingSessions: this.hardBlockingSessions,
            firstWarningSent: this.firstWarningSent,
            finalWarningSent: this.finalWarningSent,
            alwaysRestartImmediately: this.config.alwaysRestartImmediately,
        };
    }
    shouldSendFirstWarning() {
        if (this.firstWarningPending) {
            this.firstWarningPending = false;
            return true;
        }
        return false;
    }
    shouldSendFinalWarning() {
        if (this.finalWarningPending) {
            this.finalWarningPending = false;
            return true;
        }
        return false;
    }
    holdProviders = new Map();
    setRestartHoldProvider(key, provider) {
        this.holdProviders.set(key, provider);
    }
    getActiveHolds(now = Date.now()) {
        const out = [];
        for (const [key, provider] of this.holdProviders) {
            let holds = [];
            try {
                holds = provider() ?? [];
            }
            catch (err) {
                console.warn(`[UpdateGate] restart hold provider "${key}" failed: ${err instanceof Error ? err.message : String(err)}`);
                continue;
            }
            for (const h of holds) {
                if (h && typeof h.name === 'string' && Number.isFinite(h.until) && h.until > now)
                    out.push(h);
            }
        }
        return out.sort((a, b) => a.until - b.until);
    }
    reset() {
        this.deferralStartedAt = null;
        this.deferralReason = null;
        this.blockingSessions = [];
        this.restartSafeSessions = [];
        this.hardBlockingSessions = [];
        this.firstWarningSent = false;
        this.firstWarningPending = false;
        this.finalWarningSent = false;
        this.finalWarningPending = false;
    }
}
