// Rules 26/55/60/63/83/100/114/116: existing runner owns the episode and its bounded child.
// Physical sign-in/custody stays behind an absent-by-default adapter; never repair in foreground refresh.
import { createHash } from 'node:crypto';
import { createAdmittedSigninRepairPort } from './signin-repair-host.js';

export function installSigninRepair({ adapter, pool, entries, machine, owner, now, stopped,
  current, eligible, hold, journal, authority, helper, recovered }) {
  if (!adapter || !pool) return { tick() {}, async close() {} };
  let ended = false, job = null, ordinal = 0;
  const releases = new Set();
  let releaseFailed = false;
  const closed = () => ended || stopped() || !current();
  const entryOf = target => entries.find(entry => entry.profile.reference === target.profile
    && entry.profile.expectedAccount === target.account);
  const profileOf = target => {
    const entry = entryOf(target);
    return entry && eligible(entry) && adapter.normalSigninAuthorized(entry) ? adapter.profile(entry, machine) : null;
  };
  const port = createAdmittedSigninRepairPort({ now, machine, stopped: closed,
    profile: profileOf, resumeRevision: target => adapter.resumeRevision(entryOf(target)),
    async admit(target, profile, bounds, signal) {
      if (closed() || signal.aborted) return 'unavailable';
      const entry = entryOf(target), assisting = helper(entry);
      if (typeof assisting === 'string') return assisting;
      if (!assisting) return null;
      const slot = await hold({ timeout: Math.max(1, bounds.deadline - now()), stopped: closed });
      if (!slot) return 'busy';
      let released = false, edge, opened = false, result = 'uncertain';
      const valid = () => !released && !closed() && !signal.aborted
        && now() < bounds.deadline && eligible(entry) && eligible(assisting) && adapter.normalSigninAuthorized(entry);
      const close = () => {
        if (released) return; released = true;
        try { adapter.cancel(target.key); } finally { const release = slot.release().then(outcome => { if (!outcome.verified) releaseFailed = true; }).catch(() => { releaseFailed = true; }).finally(() => releases.delete(release)); releases.add(release); }
        if (opened) journal.append({ kind: 'session-work', at: now(), record: {
          type: 'SessionWorkEdgeClose', schemaVersion: 1, id: `${edge.id}:close`, edge: edge.id,
          child: edge.child, state: result, detail: 'normal sign-in adapter ended', evidence: target.key,
          resultBytes: null, calls: 0, reserved: 1, closedAt: now() } });

      };
      try {
        if (!valid()) { close(); return 'unavailable'; }
        // Existing journal admission reserves liability BEFORE the helper. The fake adapter makes
        // no model call. A real model-using adapter must also bind the existing dispatch checkpoint.
        const id = `signin:${createHash('sha256').update(`${target.key}:${owner}:${++ordinal}`).digest('hex')}`;
        edge = { type: 'SessionWorkEdge', schemaVersion: 1, id, parent: owner, child: id,
          scope: `normal sign-in for ${target.account}`, owner: machine, authority,
          budget: { steps: 1, deadline: bounds.deadline, maxResultBytes: 1024, calls: 1, tokens: null },
          exitTest: 'independent matching identity and authenticated use, or bounded parked outcome',
          placement: `machine:${machine}`, transport: 'normal-sign-in adapter', resultDestination: target.key, openedAt: now() };
        journal.append({ kind: 'session-work', record: edge, at: now() }); opened = true;
        return { owner: id, machine, account: target.account, profileRevision: profile.revision,
          deadline: bounds.deadline, helper: { account: assisting.profile.expectedAccount, healthy: true }, current: valid,
          runNormal: async (input, abort) => {
            const answer = await adapter.runNormal(input, abort);
            result = answer === 'complete' || answer === 'uncertain' ? 'uncertain' : 'failed';
            return answer;
          }, quiescent: async abort => {
            if (!await adapter.quiescent(target.key, abort) || !valid()) return false;
            for (const old of Object.values(journal.view.activeSessionWork ?? {})) {
              if (old.id === edge.id || old.transport !== 'normal-sign-in adapter' || old.resultDestination !== target.key) continue;
              journal.append({ kind: 'session-work', at: now(), record: { type: 'SessionWorkEdgeClose', schemaVersion: 1,
                id: `${old.id}:close`, edge: old.id, child: old.child, state: 'uncertain',
                detail: 'previous helper proven quiescent; outcome requires revalidation', evidence: target.key,
                resultBytes: null, closedAt: now() } });
            }
            return true;
          }, verified: () => { result = 'complete'; }, close };
      } catch { edge = undefined; close(); return 'unavailable'; }
    },
    async candidate(target, run, signal) {
      const candidate = await adapter.candidate(target, run, signal);
      return { ...candidate, publish: async abort => {
        if (!await candidate.publish(abort)) return false;
        recovered(entryOf(target)); run.verified(); return true;
      } };
    },
  });
  return {
    // Offers one bounded job on the existing cycle; foreground replies never await it.
    tick() { if (!job && !releaseFailed && releases.size === 0 && !closed()) job = pool.repairSignins(port).catch(() => {}).finally(() => { job = null; }); },
    async close() { ended = true; await job; await Promise.all(releases); },
  };
}
