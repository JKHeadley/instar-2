// Copied/adapted from Instar 1.x 1cb59f787: src/core/RestartCascadeDampener.ts.
// Host-side policy; installation admission remains in the existing runner. See docs/update.md.
export class RestartCascadeDampener {
    windowMs;
    constructor(windowMs) {
        if (!Number.isFinite(windowMs) || windowMs < 0) {
            throw new Error(`RestartCascadeDampener: windowMs must be a non-negative finite number, got ${windowMs}`);
        }
        this.windowMs = windowMs;
    }
    decide(input) {
        const now = input.now ?? Date.now();
        if (!input.lastRequestedAt) {
            return { kind: 'proceed', reason: 'no prior restart recorded' };
        }
        const lastAt = Date.parse(input.lastRequestedAt);
        if (!Number.isFinite(lastAt)) {
            return { kind: 'proceed', reason: 'prior restart timestamp unparseable; failing open' };
        }
        const elapsed = now - lastAt;
        if (elapsed >= this.windowMs) {
            const elapsedMin = Math.round(elapsed / 60_000);
            const windowMin = Math.round(this.windowMs / 60_000);
            return {
                kind: 'proceed',
                reason: `prior restart ${elapsedMin}m ago, outside ${windowMin}m window`,
            };
        }
        const eligibleAt = lastAt + this.windowMs;
        const waitMs = Math.max(0, eligibleAt - now);
        const elapsedMin = Math.round(elapsed / 60_000);
        const waitMin = Math.max(1, Math.round(waitMs / 60_000));
        const windowMin = Math.round(this.windowMs / 60_000);
        return {
            kind: 'batch',
            eligibleAt,
            waitMs,
            reason: `prior restart ${elapsedMin}m ago — within ${windowMin}m window; deferring ~${waitMin}m`,
        };
    }
}
export function formatLocalTimeHHMM(ms, date = new Date(ms)) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}
