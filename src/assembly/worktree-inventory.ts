import type { ProcessInventorySnapshot } from './process-inventory.js';

/** Read-only evidence, never permission to commit, clean, launch, or send. */
export interface WorktreeObservation {
  readonly path: string;
  readonly head: string;
  readonly dirty: boolean;
  readonly owner: 'live' | 'absent' | 'unknown';
  /** Complete activity coverage comes from the owning observer, not an old file timestamp. */
  readonly activity: null | Readonly<{ coveredFrom: number; coveredThrough: number; lastActivity: number }>;
}
export interface WorktreeInventory {
  readonly machine: string;
  readonly sourceTime: number;
  readonly freshForMs: number;
  readonly status: 'complete' | 'partial' | 'failed';
  readonly worktrees: readonly WorktreeObservation[];
}
export type WorktreeFinding = Readonly<{ machine: string; path: string; head: string;
  lastActivity: number; observedAt: number; processSample: string }>;
const instant = (n: number) => Number.isSafeInteger(n) && n >= 0;
const fresh = (at: number, life: number, now: number) => instant(at) && instant(life)
  && life > 0 && at <= now && now - at <= life;
const canonical = (path: string) => path.startsWith('/') && path !== '/' && !path.endsWith('/')
  && !path.split('/').slice(1).some(part => part === '.' || part === '..' || part === '');
const inside = (path: string, area: string) => path === area || path.startsWith(`${area}/`);

/** Rules 26/63: missing evidence cannot establish owner absence. This opens a finding only;
 * the existing work owner must admit reconciliation with its own authority and durable identity. */
export function abandonedWorktrees(input: Readonly<{ now: number; quietMs: number;
  worktrees: WorktreeInventory; processes: ProcessInventorySnapshot;
  /** Every live process must have an independently resolved ownership join. */
  ownership: ReadonlyMap<number, 'non-owner' | 'owner' | 'unknown'>;
}>): readonly WorktreeFinding[] {
  const { now, quietMs, worktrees, processes, ownership } = input;
  if (!instant(now) || !instant(quietMs) || quietMs === 0 || worktrees.status !== 'complete'
    || processes.status !== 'complete' || processes.omitted !== 0 || processes.examined !== processes.processes.length
    || !worktrees.machine || worktrees.machine !== processes.machine
    || !fresh(worktrees.sourceTime, worktrees.freshForMs, now)
    || !fresh(processes.sourceTime, processes.freshForMs, now)) return [];
  if (new Set(worktrees.worktrees.map(row => row.path)).size !== worktrees.worktrees.length
    || worktrees.worktrees.some(row => !canonical(row.path))) return [];
  const live = processes.processes.filter(row => !row.zombie);
  if (live.some(row => row.cwd.state !== 'observed' || !canonical(row.cwd.path) && row.cwd.path !== '/'
    || ownership.get(row.pid) !== 'non-owner')) return [];
  return worktrees.worktrees.flatMap(checkout => {
    const activity = checkout.activity;
    if (!checkout.dirty || checkout.owner !== 'absent' || !checkout.head || !activity
      || ![activity.coveredFrom, activity.coveredThrough, activity.lastActivity].every(instant)
      || activity.coveredFrom > worktrees.sourceTime - quietMs || activity.coveredThrough < worktrees.sourceTime
      || activity.coveredThrough > now || activity.lastActivity > worktrees.sourceTime - quietMs
      || live.some(row => row.cwd.state === 'observed' && inside(row.cwd.path, checkout.path))) return [];
    return [{ machine: worktrees.machine, path: checkout.path, head: checkout.head,
      lastActivity: activity.lastActivity, observedAt: worktrees.sourceTime, processSample: processes.id }];
  });
}
