/** 1.x db3ed6d3 SubscriptionRelogin{Service,Orchestrator,Helper,Runtime}: owned, bounded
 * repair, uncertain recovery, then independent identity + authenticated use. Browser details
 * stay behind a custody adapter; a helper's word never proves success (Rules 26/100/116).
 * The caller holds the pool root's writer lease. This is not an alternate effect authority. */
export type RepairReason = 'credential-needed' | 'phone-tap' | 'wrong-account' | 'fallback-code'
  | 'no-healthy-helper' | 'uncertain' | 'attempt-cap' | 'profile-unavailable';
export interface RepairEpisode {
  phase: 'owned' | 'attempting' | 'verifying' | 'cooldown' | 'parked' | 'succeeded';
  owner: string; attempts: number; nextAt: number; startedAt: number;
  reason?: RepairReason; verifiedAt?: number; resumeRevision?: string;
}
export interface RepairItem { index: number; account: string; machine: string; at: number; sequence?: number; episode?: RepairEpisode }
export interface RepairTarget { key: string; account: string; machine: string; profile: string }
/** Host adapter contract: acquire through existing run/resource/effect admission, retaining its
 * durable cause, spend liability, stop and exact role grant. Profile is resolved from the registered
 * agent-owned inventory, never a helper-supplied name. No secret values cross this interface.
 * close cancels only this episode's helper; revalidate proves any previous helper is quiescent.
 * normalSignIn cannot consume fallback/recovery codes. Such a prompt returns fallback-code. */
export interface SigninRepairPort {
  stopped(): boolean;
  acquire(target: RepairTarget, signal: AbortSignal): Promise<RepairLease | 'busy' | 'unavailable' | null>;
  /** A changed, authorized credential/approval revision; no values. Not permission by itself. */
  resumeRevision?(target: RepairTarget): string | undefined;
}
export interface RepairLease {
  owner: string; machine: string; deadline: number;
  profile: { reference: string; account: string; registered: boolean; ownership: 'agent' | 'person' };
  helper: { account: string; healthy: boolean } | null;
  current(): boolean;
  normalSignIn(signal: AbortSignal): Promise<'complete' | 'retryable' | RepairReason>;
  revalidate(signal: AbortSignal): Promise<'signed-in' | 'not-started' | 'unknown'>;
  verifyIdentity(signal: AbortSignal): Promise<'match' | 'mismatch' | 'unknown'>;
  authenticatedUse(signal: AbortSignal): Promise<boolean>;
  /** Atomically publish only the verified candidate; leave the serving slot intact on failure. */
  publish(signal: AbortSignal): Promise<boolean>;
  close(): void;
}
export const SIGNIN_REPAIR_LIMITS = Object.freeze({ attempts: 3, retryMs: 5000, lifetimeMs: 600000 });
export const NO_HEALTHY_LOGIN = 'None of my approved model logins can be used right now, so new work will wait until one is working again.';
const messages: Record<RepairReason, string> = {
  'credential-needed': 'Please supply this account’s sign-in credential through Secret Drop.',
  'phone-tap': 'Please approve the sign-in request on your phone.',
  'wrong-account': 'The service showed a different account. Please confirm which account I should use.',
  'fallback-code': 'The service requested a fallback code, which I will not use. Please approve a normal sign-in method.',
  'no-healthy-helper': NO_HEALTHY_LOGIN,
  uncertain: 'The previous sign-in has an unknown outcome; I am keeping it parked until it can be verified.',
  'attempt-cap': 'The bounded sign-in attempts did not finish; the repair remains parked.',
  'profile-unavailable': 'The repair has no admitted agent-owned browser profile.',
};
export function signinRepairAction(item: RepairItem): string {
  return item.episode?.reason ? messages[item.episode.reason] : item.episode?.phase ?? 'awaiting owned repair';
}
export function signinRepairNotice(item: RepairItem, key: string): { key: string; line: string }[] {
  const reason = item.episode?.reason;
  // Status and internal failures remain pull-only. The host journal spends each episode key once.
  return item.episode?.phase === 'parked' && reason && ['credential-needed', 'phone-tap', 'wrong-account', 'fallback-code', 'no-healthy-helper'].includes(reason)
    ? [{ key, line: reason === 'no-healthy-helper' ? messages[reason] : `Sign-in for ${item.account}: ${messages[reason]}` }] : [];
}
export function validateRepairEpisode(value: RepairEpisode | undefined): void {
  if (value === undefined) return; // Existing queue rows are adopted on their first tick.
  const phases = ['owned', 'attempting', 'verifying', 'cooldown', 'parked', 'succeeded'];
  const allowed = new Set(['phase', 'owner', 'attempts', 'nextAt', 'startedAt', 'reason', 'verifiedAt', 'resumeRevision']);
  const time = (at: unknown) => typeof at === 'number' && Number.isSafeInteger(at) && at >= 0;
  const malformed = () => { throw Error('invalid sign-in repair episode'); };
  if (!value || Array.isArray(value) || typeof value !== 'object') malformed();
  if (Object.keys(value).some(key => !allowed.has(key))) malformed();
  if (!phases.includes(value.phase)) malformed();
  if (typeof value.owner !== 'string' || !value.owner || value.owner.length > 128) malformed();
  if (!Number.isSafeInteger(value.attempts) || value.attempts < 0 || value.attempts > SIGNIN_REPAIR_LIMITS.attempts) malformed();
  if (!time(value.nextAt) || !time(value.startedAt)) malformed();
  if (value.reason !== undefined && !Object.hasOwn(messages, value.reason)) malformed();
  if (value.verifiedAt !== undefined && !time(value.verifiedAt)) malformed();
  if (value.resumeRevision !== undefined && !/^[a-f0-9]{64}$/u.test(value.resumeRevision)) malformed();
  if (value.phase === 'succeeded' && (!time(value.verifiedAt) || value.verifiedAt! < value.startedAt)) malformed();
  if (value.phase === 'parked' && value.reason === undefined) malformed();
  if (['attempting', 'verifying', 'cooldown', 'succeeded'].includes(value.phase) && value.attempts === 0) malformed();
}
/** The pool owns these records; invalid state is retained and refused, never silently reset. */
export function validateRepairItems(items: unknown, accounts: readonly string[]): asserts items is RepairItem[] {
  if (!Array.isArray(items)) throw Error('invalid sign-in repair items');
  const keys = new Set<string>(), open = new Set<number>();
  for (const item of items as RepairItem[]) {
    if (!item || !Number.isSafeInteger(item.index) || item.index < 0 || item.account !== accounts[item.index]
      || typeof item.machine !== 'string' || !item.machine || item.machine.length > 128
      || !Number.isSafeInteger(item.at) || item.at < 0
      || (item.sequence !== undefined && (!Number.isSafeInteger(item.sequence) || item.sequence < 1)))
      throw Error('invalid sign-in repair item');
    validateRepairEpisode(item.episode);
    const key = `${item.index}:${item.machine}:${item.sequence ?? `legacy-${item.at}`}`;
    if (keys.has(key)) throw Error('duplicate sign-in repair identity');
    keys.add(key);
    if (item.episode?.phase !== 'succeeded') {
      if (open.has(item.index)) throw Error('duplicate open sign-in repair');
      open.add(item.index);
    }
  }
}

export function createSigninRepairController(deps: {
  now(): number; machine: string; items(): RepairItem[];
  target(item: RepairItem): RepairTarget;
  save(item: RepairItem, episode: RepairEpisode): void;
  succeed(item: RepairItem, episode: RepairEpisode): void;
}) {
  let busy = false;
  return async (port: SigninRepairPort): Promise<void> => {
    if (busy || port.stopped()) return;
    busy = true;
    try {
      // One episode per tick, at most eight pool members. No polling loop or competing writer.
      let resumeRevision: string | undefined;
      const item = deps.items().find(row => {
        if (row.machine !== deps.machine || row.episode?.phase === 'succeeded' || (row.episode?.nextAt ?? 0) > deps.now()) return false;
        if (row.episode?.phase !== 'parked') return true;
        const revision = port.resumeRevision?.(deps.target(row));
        if (typeof revision !== 'string' || !/^[a-f0-9]{64}$/u.test(revision) || revision === row.episode.resumeRevision) return false;
        resumeRevision = revision; return true;
      });
      if (!item) return;
      let ep: RepairEpisode = item.episode ?? { phase: 'owned', owner: deps.machine, attempts: 0, nextAt: 0, startedAt: deps.now() };
      const save = (patch: Partial<RepairEpisode>) => { ep = { ...ep, ...patch }; deps.save(item, ep); };
      const park = (reason: RepairReason) => {
        const revision = port.resumeRevision?.(deps.target(item));
        save({ phase: 'parked', reason, ...(revision && /^[a-f0-9]{64}$/u.test(revision) ? { resumeRevision: revision } : {}) });
      };
      if (ep.phase === 'parked' && resumeRevision) {
        const { reason: _reason, ...resuming } = ep; ep = resuming;
        save({ phase: ep.attempts ? 'attempting' : 'owned', resumeRevision, startedAt: deps.now() });
      } // New admitted input allows revalidation, never an automatic fresh attempt.
      save({}); // Durable ownership precedes admission and every external operation.
      const abort = new AbortController();
      let lease: RepairLease | null = null;
      const end = Math.min(deps.now() + SIGNIN_REPAIR_LIMITS.lifetimeMs, ep.startedAt + SIGNIN_REPAIR_LIMITS.lifetimeMs);
      const closed = () => {
        try { return port.stopped() || deps.now() >= end
          || (lease !== null && (!lease.current() || deps.now() >= lease.deadline)); }
        catch { return true; } // A withdrawn/unreadable authority cancels; it cannot crash the host timer.
      };
      const timer = setInterval(() => { if (closed()) abort.abort(); }, 25);
      // A hung or throwing adapter never makes a new attempt safe. Discard late results.
      const call = async <T>(run: () => Promise<T>): Promise<T | undefined> => {
        if (closed() || abort.signal.aborted) return undefined;
        let cancel: (() => void) | undefined;
        try {
          return await Promise.race([Promise.resolve().then(run), new Promise<undefined>(resolve => {
            cancel = () => resolve(undefined); abort.signal.addEventListener('abort', cancel, { once: true });
          })]);
        } catch { return undefined; }
        finally { if (cancel) abort.signal.removeEventListener('abort', cancel); }
      };
      try {
        if (closed()) { if (!port.stopped()) park('attempt-cap'); return; }
        const admission = await call(async () => {
          const acquired = await port.acquire(deps.target(item), abort.signal);
          if (abort.signal.aborted) { if (acquired && typeof acquired === 'object') acquired.close(); return undefined; }
          return acquired;
        });
        if (admission && typeof admission === 'object') lease = admission;
        if (closed() || abort.signal.aborted) return;
        if (!lease) {
          if (admission === null) park('no-healthy-helper');
          else save({ nextAt: deps.now() + SIGNIN_REPAIR_LIMITS.retryMs });
          return;
        }
        const profile = lease.profile, target = deps.target(item);
        if (lease.machine !== item.machine || !lease.owner || lease.owner.length > 128
          || !Number.isSafeInteger(lease.deadline) || !profile.registered || profile.ownership !== 'agent'
          || profile.reference !== target.profile || profile.account !== item.account) { park('profile-unavailable'); return; }
        save({ owner: lease.owner });
        if (!lease.helper?.healthy || lease.helper.account === item.account) { park('no-healthy-helper'); return; }
        // 1.x recoverUncertain: never drive an interrupted attempt again based on stored state alone.
        if (ep.phase === 'attempting' || ep.phase === 'verifying') {
          const recovery = await call(() => lease!.revalidate(abort.signal));
          if (closed() || abort.signal.aborted) return;
          if (recovery === 'signed-in') save({ phase: 'verifying' });
          else if (recovery === 'not-started') { save({ phase: 'cooldown', nextAt: deps.now() + SIGNIN_REPAIR_LIMITS.retryMs }); return; }
          else { park('uncertain'); return; }
        }
        if (ep.phase !== 'verifying') {
          if (ep.attempts >= SIGNIN_REPAIR_LIMITS.attempts) { park('attempt-cap'); return; }
          save({ phase: 'attempting', attempts: ep.attempts + 1 });
          const result = await call(() => lease!.normalSignIn(abort.signal));
          if (closed() || abort.signal.aborted) return;
          if (result === 'retryable') {
            if (ep.attempts >= SIGNIN_REPAIR_LIMITS.attempts) park('attempt-cap');
            else save({ phase: 'cooldown', nextAt: deps.now() + SIGNIN_REPAIR_LIMITS.retryMs * 2 ** (ep.attempts - 1) });
            return;
          }
          if (result !== 'complete') {
            park(result && Object.hasOwn(messages, result) ? result : 'uncertain'); return;
          }
          save({ phase: 'verifying' });
        }
        const identity = await call(() => lease!.verifyIdentity(abort.signal));
        if (closed() || abort.signal.aborted) return;
        if (identity !== 'match') { park(identity === 'mismatch' ? 'wrong-account' : 'uncertain'); return; }
        const used = await call(() => lease!.authenticatedUse(abort.signal));
        if (closed() || abort.signal.aborted) return;
        if (used !== true) { park('uncertain'); return; }
        const published = await call(() => lease!.publish(abort.signal));
        if (closed() || abort.signal.aborted) return;
        if (published !== true) { park('uncertain'); return; }
        deps.succeed(item, { ...ep, phase: 'succeeded', verifiedAt: deps.now() });
      } finally {
        clearInterval(timer); abort.abort(); lease?.close();
      }
    } finally { busy = false; }
  };
}
