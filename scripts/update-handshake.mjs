// Adapted from 1.x UpdateRestartHandshake.ts: two-phase verification, retained failure
// counter and escalation at two failed boots. State is in the existing update transaction.
import { readUpdateRuntime, writeUpdateRuntime } from './update.mjs';
export class UpdateRestartHandshake {
  constructor(root) { this.root = root; }
  readPendingHandshake() {
    const state = readUpdateRuntime(this.root).handshake;
    if (!state || state.status === 'verified') return null;
    if (typeof state.expectedVersion !== 'string' || typeof state.previousVersion !== 'string'
      || !Number.isSafeInteger(state.retryCount) || state.retryCount < 0
      || !['pending', 'failed'].includes(state.status) || !Array.isArray(state.failures))
      throw Error('Malformed restart handshake; retained for repair');
    return state;
  }
  writePendingHandshake(input) {
    const previous = this.readPendingHandshake();
    if (previous?.expectedVersion === input.expectedVersion) return;
    writeUpdateRuntime(this.root, 'handshake', { ...input, triggeredAt: new Date().toISOString(), retryCount: 0,
      status: 'pending', failures: [], requestedByPid: process.pid });
  }
  verify({ runningVersion, launch, healthy }) {
    const pending = this.readPendingHandshake();
    if (!pending) return { kind: 'no-handshake' };
    if (typeof launch !== 'string' || !launch || typeof healthy !== 'boolean') throw Error('Restart boot evidence required');
    if (pending.lastLaunch === launch) return { kind: 'already-observed', status: pending.status };
    // Version equality alone is insufficient: only the admitted runner's successful poll
    // can establish service restoration. The caller never substitutes installedVersion.
    const verified = healthy && runningVersion === pending.expectedVersion;
    if (!verified && pending.retryCount >= 2) return { kind: 'failed', expectedVersion: pending.expectedVersion, runningVersion, retryCount: pending.retryCount, escalate: true };
    const retryCount = pending.retryCount + (verified ? 0 : 1);
    const next = { ...pending, status: verified ? 'verified' : 'failed', lastLaunch: launch, runningVersion,
      retryCount, observedAt: new Date().toISOString(),
      failures: verified ? pending.failures : [...pending.failures, { launch, runningVersion, healthy }] };
    writeUpdateRuntime(this.root, 'handshake', next);
    return verified ? { kind: 'verified', expectedVersion: pending.expectedVersion, previousVersion: pending.previousVersion }
      : { kind: 'failed', expectedVersion: pending.expectedVersion, runningVersion, retryCount, escalate: retryCount >= 2 };
  }
}
