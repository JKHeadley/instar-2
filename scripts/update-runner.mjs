// The actual admitted runner calls this boundary, after intake and before a new work cycle.
// A request is not health evidence. Healthy means this launch completed a real channel poll.
import { installedUpdate, readUpdateRuntime, writeUpdateRuntime } from './update.mjs';
import { UpdateRestartHandshake } from './update-handshake.mjs';
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
