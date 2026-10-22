import { expect, it } from 'vitest';
import { createFactStore, decodeEnvelope, decodeHistoricalBody } from '../../src/facts/index.js';
import type { FactContext, FactEnvelope } from '../../src/facts/index.js';
import { decodeFrame } from '../../src/facts/envelope.js';
import { causalStanding } from '../../src/facts/admission.js';
import { historicalScope } from '../../src/facts/historical.js';
import { factsFixture, refused, value, point } from './fixtures.js';
import { recordedSource } from '../recall/read-fixture.js';

it('replays recorded ancestry identically to the full walk, in both source orders', () => {
  const { store, context } = recordedSource(50, true), facts = value(store.read());
  for (const order of [facts, [...facts].reverse()]) {
    const fast = { ...context, facts: order }, scope = historicalScope(fast);
    // An equal duplicate breaks the chain index's eligibility without changing the
    // recursive walk's by-id graph. This invokes the retained full-walk oracle.
    const walked = { ...context, facts: [...order, order[0]!] };
    for (const fact of [...order].reverse()) {
      const actual = value(decodeHistoricalBody(fact, fast, causalStanding(fact, fast, false).decode, scope));
      const expected = value(decodeHistoricalBody(fact, walked, causalStanding(fact, walked, false).decode));
      expect(actual).toEqual(expected);
    }
  }
});

it('shared and independent reads preserve multi-machine ancestry and poisoned ancestors', () => {
  const f = factsFixture();
  const a = f.fact(), b = f.fact({ machine: 'machine-b', segment: { machine: 'machine-b', epoch: 0, position: 0 } });
  const c = f.next(a, { predecessors: { inSegment: a.id, required: [b.id], frontier: {} } });
  const d = f.next(b, { predecessors: { inSegment: b.id, required: [a.id], frontier: { 'machine-a': point(c) } } });
  for (const facts of [[a, b, c, d], [d, c, b, a]]) {
    const ctx = { ...f.ctx, facts }, scope = historicalScope(ctx);
    for (const fact of facts) expect(decodeHistoricalBody(fact, ctx, ctx.decode, scope))
      .toEqual(decodeHistoricalBody(fact, { ...ctx, facts: [...facts, a] }, ctx.decode));
  }
  const poison = { ...a, signature: '00' } as FactEnvelope;
  const ctx = { ...f.ctx, facts: [poison, b, c, d] };
  refused(decodeHistoricalBody(d, ctx, ctx.decode, historicalScope(ctx)), 'signature');
});

it('verified-frame reuse never reuses changed bytes or changed key policy', () => {
  const f = factsFixture(), fact = value(decodeEnvelope(f.wire(), f.ctx, 'replication'));
  const first = value(decodeFrame(fact, f.ctx));
  expect(value(decodeFrame(fact, f.ctx))).toEqual(first);
  refused(decodeFrame({ ...fact, signature: '00'.repeat(64) }, f.ctx), 'signature');
  refused(decodeFrame({ ...fact, body: { identity: 'changed', amount: '10' } }, f.ctx), 'content hash');
  const compromised: FactContext = { ...f.ctx, keys: f.ctx.keys.map(k => ({ ...k, compromisedAt: { epoch: 0, position: 0 } })) };
  refused(decodeFrame(fact, compromised), 'compromised-key');
  refused(decodeFrame(fact, { ...f.ctx, keys: [] }), 'signature');
  expect(value(decodeFrame(fact, f.ctx))).toEqual(first);
  // A principal decoder can normalize optional fields. Its reconstructed envelope
  // must not borrow the original frame's proof unless the complete bytes still match.
  const normalized = value(decodeEnvelope(f.wire({ principal: { ...f.alice, standing: 'requester' } }), f.ctx, 'replication'));
  refused(decodeFrame(normalized, f.ctx), 'content hash');
});

it('single-pass loading checks every chain link and recovers after an interrupted read', () => {
  const f = factsFixture(), a = f.fact(), b = f.next(a), c = f.next(b);
  const peer = f.fact({ machine: 'machine-b', segment: { machine: 'machine-b', epoch: 0, position: 0 } });
  const epoch = f.fact({ segment: { machine: 'machine-a', epoch: 1, position: 0 }, prevInSegment: c.contentHash,
    predecessors: { inSegment: null, frontier: { 'machine-a': point(c) }, required: [] } });
  const raw = [a, peer, b, c, epoch];
  const storage = { owner: 'part-ten' as const, read: () => raw, append: () => { throw new Error('read only'); } };
  let interrupted = false;
  const interruptedStore = createFactStore(f.ctx, storage, { onVerified: fact => {
    if (fact.id === b.id && !interrupted) { interrupted = true; throw new Error('injected interruption'); }
  } });
  refused(interruptedStore.read(), 'injected interruption');
  expect(value(interruptedStore.read())).toEqual(value(createFactStore(f.ctx, storage).read()));
  for (const rows of [[a, c], [a, b, b], [a, b, c, { ...epoch, prevInSegment: a.contentHash }]]) {
    expect(createFactStore(f.ctx, { ...storage, read: () => rows }).read().kind).toBe('Refused');
  }
  raw[1] = { ...peer, signature: '00'.repeat(64) };
  refused(interruptedStore.read(), 'prefix changed');
});
