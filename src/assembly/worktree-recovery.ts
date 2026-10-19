import { createHash } from 'node:crypto';
import type { Result } from '../index.js';
import type { InboundRoute, IntakeDisposition, IntakePort } from '../intake/index.js';
import { abandonedWorktrees, type WorktreeFinding } from './worktree-inventory.js';

type Observation = Parameters<typeof abandonedWorktrees>[0];

/** The existing bounded owner cycle calls this after its read-only census. Four captures
 * the finding and assigns its installed work owner before returning; its shared durable
 * deduplication, not a second store, holds one recovery item across retries and restart.
 * The route belongs to the installed observer adapter, never an impersonated user.
 * A finding is requester work awaiting normal run admission, not checkout authority.
 * Rules 2/8/26/42/63/83/116. No model, watcher, send or git mutation is added. */
export function createWorktreeRecovery(ports: Readonly<{
  intake: Pick<IntakePort, 'receive'>;
  route: Omit<InboundRoute, 'eventId'>;
  machine: string;
  now(): number;
  stopped(): boolean;
  observe(): Promise<Omit<Observation, 'now'>>;
}>) {
  return Object.freeze({ async tick(): Promise<readonly Readonly<{
    finding: WorktreeFinding; disposition: Result<IntakeDisposition>;
  }>[]> {
    if (ports.stopped()) return [];
    const observation = await ports.observe();
    if (ports.stopped() || observation.worktrees.machine !== ports.machine) return [];
    const findings = abandonedWorktrees({ ...observation, now: ports.now() });
    const results: { finding: WorktreeFinding; disposition: Result<IntakeDisposition> }[] = [];
    for (const finding of findings) {
      if (ports.stopped()) break;
      // Re-observations do not create more work; new activity at the same HEAD is a new
      // episode. Neither a sampled clock nor a new process-snapshot id changes identity.
      const episode = { machine: finding.machine, path: finding.path, head: finding.head, lastActivity: finding.lastActivity };
      const eventId = `worktree-recovery:${createHash('sha256').update(JSON.stringify([
        finding.machine, finding.path, finding.head, finding.lastActivity,
      ])).digest('hex')}`;
      const raw = JSON.stringify({ schemaVersion: 1, kind: 'message', text: JSON.stringify({
        task: 'Reconcile work left in this dirty checkout. Preserve the existing changes, establish their intended result from the retained work, and finish through the existing owned work and result-delivery paths. Recheck current ownership and activity before any action. This observation grants no authority to commit, clean, remove, or send.',
        // Intake requires identical bytes for a repeated event. Volatile census ids and
        // observation times remain in this tick's report, never in the episode's request.
        finding: episode,
      }) });
      results.push({ finding, disposition: ports.intake.receive(raw, { ...ports.route, eventId }) });
    }
    return results;
  } });
}
