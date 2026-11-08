// The actual admitted runner calls this boundary, after intake and before a new work cycle.
// A request is not health evidence. Healthy means this launch completed a real channel poll.
import { installedUpdate, readUpdateRuntime, writeUpdateRuntime } from './update.mjs';
import { UpdateRestartHandshake } from './update-handshake.mjs';
// Read the real controller and a fresh transaction replay from outside the
// updater's decisions. Missing/corrupt evidence is unknown, never a green label.
export function observeUpdateBound(root, controller, resources) {
  if (!controller) return null;
  const u = controller.updater, saved = readUpdateRuntime(root).updater;
  if (!saved) return null;
  const failures = saved.failureState?.failures ?? [];
  if (!Array.isArray(failures) || (!saved.lastCheck && !failures.length)) return null;
  return {
    failures: failures.length, lastFailureAt: failures.at(-1)?.at ?? null,
    pausedAt: saved.failureState?.pausedAt ?? null,
    nextAttemptAt: saved.nextAttemptAt, lastCheck: saved.lastCheck,
    pressureMatches: JSON.stringify(saved.failureState ?? null) === JSON.stringify(u.failureState ?? null)
      && saved.nextAttemptAt === u.nextAttemptAt,
    stopped: u.stopped === true,
    timers: [u.interval, u.applyTimer, u.deferralTimer, u.batchedRestartTimer].filter(Boolean).length,
    intervalMinutes: u.config.checkIntervalMinutes,
    resourceAllocation: resources.allocation.state,
    activeLaunches: resources.active.length, launchCeiling: resources.ceilings.aggregate.launches,
    answerReserve: resources.ceilings.reserveLaunches,
    maintenanceLaunches: resources.active.filter(row => row.work === 'maintenance').length,
  };
}
export function observeUpdateBoot(root, { version, launch, healthy, pid = process.pid }) {
  if (!healthy) return { kind: 'not-healthy' };
  const handshake = new UpdateRestartHandshake(root);
  if (handshake.readPendingHandshake()?.requestedByPid === pid) return { kind: 'requesting-launch' };
  return handshake.verify({ runningVersion: version, launch, healthy });
}
export function drainUpdateRestart(root, { version, launch, idle, stopped, now = Date.now() }) {
  if (stopped || !idle) return false;
  const request = readUpdateRuntime(root).request;
  if (!request || request.status !== 'requested' || request.version === version
    || !Number.isSafeInteger(request.expiresAt) || request.expiresAt <= now) return false;
  const installed = installedUpdate(root);
  if (!installed || request.transaction !== installed.transaction || request.version !== installed.version) return false;
  writeUpdateRuntime(root, 'request', { ...request, status: 'drained', launch });
  return true;
}
