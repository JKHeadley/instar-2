import assert from './assertions.mjs';
import { providerFixture, value, localProvider, status } from './rereview-helpers.mjs';
import { createConfinedProviderInvocation } from '../../../src/assembly/index.js';
import { createProviderEffectDoorway } from '../../../src/effects/index.js';

// F6 — Ten must validate the ACCEPTED operation's required dependency closure, not
// every record in the store. An UNRELATED unavailable record must not block a clean
// invocation; the RELEVANT accepted capture going unavailable must still refuse.
export function registerCases(test) {
  // V44 (the corrected dependency-isolated case): at Ten's single acceptance read, an
  // Evidence about ANOTHER operation — appended AFTER the accepted observation, so its
  // taint cannot chain back into the acceptance prefix — is unavailable. The accepted
  // operation's required closure stays clean, so Ten must invoke exactly once. (The
  // reviewer's F6 hunk validates the closure, not the whole store.)
  test('V44', 'Ten permits exact accepted input when an unrelated capture is unavailable at the acceptance read', async () => {
    const h = await localProvider();
    try {
      const f = providerFixture(h), { request } = f.prepare();
      let reads = 0;
      const lateStore = { ...f.store, readForProjection: () => {
        reads++;
        // Record separate Evidence about another operation (after the acceptance), make
        // ONLY its capture unavailable for the gate's snapshot, then restore it so the
        // post-invocation append is unaffected — isolating the gate's closure check.
        const e = f.evidence('unrelated-operation-' + reads, 'unrelated-digest', 'operation-occurred');
        const original = f.metadata[e.capture.reference];
        f.metadata[e.capture.reference] = { ...original, status: 'missing', bytes: null };
        const snapshot = f.store.readForProjection();
        f.metadata[e.capture.reference] = original;
        return snapshot;
      } };
      const invocation = value(createConfinedProviderInvocation(f.route, f.six, f.th, f.captures, f.host.boundary, lateStore));
      const api = createProviderEffectDoorway({ ...f.dependencies, invocation });
      const r = status(await api.dispatch(request, f.fence));
      assert.equal(reads, 1);
      assert.equal(r.kind, 'Success', JSON.stringify(r));
      assert.equal(h.requests.length, 1);
      return { reads, calls: h.requests.length };
    } finally { await h.close(); }
  });
  // V56/V57 controls: making the RELEVANT accepted capture unavailable refuses; a clean
  // invocation succeeds once.
  for (const [mode, id] of [['relevant', 'V56'], ['clean', 'V57']]) {
    test(id, 'Ten dependency isolation control (' + mode + ' capture)', async () => {
      const h = await localProvider();
      try {
        const f = providerFixture(h), { request } = f.prepare();
        let observed;
        const finalStore = { ...f.store, readForProjection: () => {
          const before = value(f.store.readForProjection());
          const accepted = before.entries.find(e => e.fact.kind === 'effect-provider-ProviderOperationObservation'
            && e.fact.body.record.stage === 'executor-accepted');
          const cap = accepted.fact.body.record.capture;
          if (mode === 'relevant') f.metadata[cap.reference] = { ...f.metadata[cap.reference], status: 'missing', bytes: null };
          const result = f.store.readForProjection(), snapshot = value(result), dependencies = [], seen = new Set();
          const visit = id => { if (seen.has(id)) return; seen.add(id);
            const entry = snapshot.entries.find(e => e.fact.id === id);
            dependencies.push({ id, taint: entry?.taint, conflicts: entry?.conflicts });
            entry?.fact.predecessors.required.forEach(visit); };
          visit(accepted.fact.id);
          observed = { dependencies };
          return result;
        } };
        const invocation = value(createConfinedProviderInvocation(f.route, f.six, f.th, f.captures, f.host.boundary, finalStore));
        const api = createProviderEffectDoorway({ ...f.dependencies, invocation });
        const r = status(await api.dispatch(request, f.fence));
        assert.equal(r.kind, mode === 'relevant' ? 'Refused' : 'Success', JSON.stringify(r));
        assert.equal(h.requests.length, mode === 'relevant' ? 0 : 1);
        return { mode, result: r, calls: h.requests.length };
      } finally { await h.close(); }
    });
  }
}
