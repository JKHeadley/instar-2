import { expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { causalIndex, extendsChain } from '../../src/facts/admission.js';
import { decodeHistoricalBody, historicalScope } from '../../src/facts/historical.js';
import { createFactStore, decodeEnvelope, prepareSnapshot } from '../../src/facts/index.js';
import type { FactContext, FactEnvelope } from '../../src/facts/index.js';
import { factsFixture, point, refused, value } from './fixtures.js';

const outcome = <T>(r: Result<T>) => consumeResult<T, { value: T } | { refused: string }>(r, {
  Success: value => ({ value }), Refused: r => ({ refused: r.detail }),
});
const bytes = (v: unknown) => value(canonical(v)).bytes;

function corpus(seed: number) {
  const f = factsFixture();
  const context = { ...f.ctx, schemas: [f.schema,
    { ...f.schema, kind: 'evidence', fields: { evidence: { kind: 'constitutional' as const, type: 'Evidence' as const } } }], ownedBodies: [] };
  const facts: FactEnvelope[] = [];
  for (let i = 0; i < 16; i++) {
    const machine = (i + seed) % 3 ? 'machine-a' : 'machine-b';
    const head = facts.filter(row => row.machine === machine).at(-1);
    const peer = facts.filter(row => row.machine !== machine).at(-1);
    const evidence = i % 5 === seed % 5;
    facts.push(value(decodeEnvelope(f.wire({ machine,
      segment: { machine, epoch: 0, position: head ? head.segment.position + 1 : 0 },
      prevInSegment: head?.contentHash ?? context.genesis.hash,
      predecessors: { inSegment: head?.id ?? null, required: peer && i % 2 ? [peer.id] : [],
        frontier: peer && i % 2 === 0 ? { [peer.machine]: point(peer) } : {} },
      kind: evidence ? 'evidence' : 'note',
      body: evidence ? { evidence: f.e } : { identity: `row-${seed}-${i}`, amount: String(i) },
    }, context), context, 'replication')));
  }
  return { f, facts, context: { ...context, facts } };
}

it('sparse ancestry equals full replay across joined histories, captures and reversed cold reads', () => {
  for (let seed = 0; seed < 10; seed++) {
    const { f, facts, context } = corpus(seed);
    const statuses = seed % 2 ? { 'capture:evidence': { hash: f.e.capture.hash, bytes: null, byteLength: 0, status: 'missing' as const } } : {};
    const fastContext: FactContext = { ...context, captures: statuses, ownedBodies: [] };
    const slowContext: FactContext = { ...fastContext, ownedBodies: [] };
    const fast = historicalScope(fastContext), original = historicalScope(slowContext);
    // Force the original full-cone branch, retaining all real decoders and signatures.
    const slow = { ...original, index: { ...original.index, frontierOf: () => undefined } };
    const order = seed % 3 ? facts : [...facts].reverse();
    for (const fact of order) {
      const actual = outcome(decodeHistoricalBody(fact, fastContext, fastContext.decode, fast));
      const expected = outcome(decodeHistoricalBody(fact, slowContext, slowContext.decode, slow));
      expect(bytes(actual)).toBe(bytes(expected));
      expect(actual).toHaveProperty('value');
    }
  }
});

it('recovery equals the full chain oracle through crash cuts, epoch changes and corruption', () => {
  const f = factsFixture(), root = f.fact(), second = f.next(root);
  const epoch = f.fact({ segment: { machine: 'machine-a', epoch: 1, position: 0 },
    prevInSegment: second.contentHash, predecessors: { inSegment: null, required: [], frontier: { 'machine-a': point(second) } } });
  const facts = [root, second, epoch, f.next(epoch)];
  const raw = facts.map(row => JSON.parse(bytes(row)) as unknown);
  const reference = () => {
    const verified: FactEnvelope[] = [];
    for (const input of raw) {
      const context = { ...f.ctx, facts: verified };
      const fact = value(decodeEnvelope(input, context, 'replication'));
      extendsChain(fact, context); verified.push(fact);
    }
    return verified;
  };
  const storage = { owner: 'part-ten' as const, read: () => raw, append: () => f.success({ kind: 'local-durable' as const }) };
  for (let cut = 0; cut <= facts.length; cut++) {
    let verified = 0;
    const interrupted = createFactStore(f.ctx, storage, { onVerified: () => { if (++verified === cut) throw new Error('crash before publication'); } });
    if (cut) refused(interrupted.read(), 'crash before publication');
    const recovered = createFactStore(f.ctx, storage);
    expect(bytes(value(recovered.read()))).toBe(bytes(reference()));
    expect(bytes(value(recovered.readForProjection()).entries)).toBe(bytes(value(prepareSnapshot(reference(), f.ctx)).entries));
    // The next tail is durable; no in-memory index from the first instance survives.
    expect(value(recovered.sweep())).toEqual(facts);
  }
  for (const changed of [raw.slice(1), [raw[0], raw[0]], [raw[1], raw[0]],
    [raw[0], { ...(raw[1] as object), body: { identity: 'tampered', amount: '2' } }]]) {
    const store = createFactStore(f.ctx, { ...storage, read: () => changed });
    expect(outcome(store.read())).toHaveProperty('refused');
  }
  refused(createFactStore(f.ctx, storage, { verificationBudget: 3 }).read(), 'budget exhausted');
});

it('cold causal index resolves a reversed long chain without recursive stack growth', () => {
  const f = factsFixture(), root = f.fact();
  // Graph-only fixture: signature admission is tested above; this isolates traversal size.
  const facts: FactEnvelope[] = [root];
  for (let i = 1; i < 20_000; i++) {
    const prev = facts.at(-1)!;
    facts.push({ ...root, id: `machine-a:0:${i}`, segment: { machine: 'machine-a', epoch: 0, position: i },
      prevInSegment: prev.contentHash, predecessors: { inSegment: prev.id, required: [], frontier: {} } });
  }
  const index = causalIndex([...facts].reverse());
  expect(index.coneSize(facts.at(-1)!)).toBe(19_999);
  expect(index.frontierOf(facts[0]!)).toEqual({});
  const cyclic = { ...facts[0]!, predecessors: { ...facts[0]!.predecessors, required: [facts.at(-1)!.id] } };
  expect(causalIndex([cyclic, ...facts.slice(1)]).frontierOf(cyclic)).toBeUndefined();
});

it('root-only inspection without causal standing cannot seed an ancestor summary', () => {
  const f = factsFixture();
  const root = f.fact(), tail = f.next(root);
  const context = { ...f.ctx, facts: [root, tail], schemas: [{ ...f.schema, standing: 'delegate' as const, causallyBound: true }], ownedBodies: [] };
  const scope = historicalScope(context);
  expect(outcome(decodeHistoricalBody(root, context, context.decode, scope))).toHaveProperty('value');
  const reference = { ...context, ownedBodies: [] };
  expect(outcome(decodeHistoricalBody(tail, context, context.decode, scope)))
    .toEqual(outcome(decodeHistoricalBody(tail, reference, reference.decode)));
  expect(outcome(decodeHistoricalBody(tail, context, context.decode, scope))).toHaveProperty('refused');
});

it('reused signed frames recheck key policy and never trust altered copies', async () => {
  const { decodeFrame } = await import('../../src/facts/envelope.js');
  const f = factsFixture(), fact = f.fact();
  expect(outcome(decodeFrame(fact, f.ctx))).toHaveProperty('value');
  expect(outcome(decodeFrame(fact, f.ctx))).toHaveProperty('value');
  const compromised = { ...f.ctx, keys: f.ctx.keys.map(k => ({ ...k, compromisedAt: { epoch: 0, position: 0 } })) };
  refused(decodeFrame(fact, compromised), 'compromised-key');
  refused(decodeFrame(fact, { ...f.ctx, keys: [] }), 'signature');
  refused(decodeFrame(fact, { ...f.ctx, keys: f.ctx.keys.map(k => ({ ...k, publicKey: Infinity as unknown as string })) }), 'canonical');
  refused(decodeFrame({ ...fact, body: { identity: 'changed', amount: '2' } }, f.ctx), 'content hash');
  expect(outcome(decodeFrame(fact, f.ctx))).toHaveProperty('value');
});
