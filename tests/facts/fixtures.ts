import { createPrivateKey, createPublicKey } from 'node:crypto';
import { fixture, value, clone } from '../fixtures.js';
import { consumeResult, decode } from '../../src/index.js';
import type { Json, Result } from '../../src/index.js';
import { decodeEnvelope, factId, genesisHash, signEnvelope } from '../../src/facts/index.js';
import type { FactContext, FactEnvelope, FactSchema } from '../../src/facts/index.js';
import { boundary } from '../../src/facts/boundary.js';
export { value, clone };
const secret = createPrivateKey({ key: Buffer.from('302e020100300506032b657004220420' + '11'.repeat(32), 'hex'), format: 'der', type: 'pkcs8' });
export const privateKey = secret.export({ format: 'pem', type: 'pkcs8' }).toString();
export const publicKey = createPublicKey(secret).export({ format: 'pem', type: 'spki' }).toString();
const secondKey = createPrivateKey({ key: Buffer.from('302e020100300506032b657004220420' + '22'.repeat(32), 'hex'), format: 'der', type: 'pkcs8' });
const secondPrivateKey = secondKey.export({ format: 'pem', type: 'pkcs8' }).toString();
const secondPublicKey = createPublicKey(secondKey).export({ format: 'pem', type: 'spki' }).toString();
export const json = (value: unknown): Json => JSON.parse(JSON.stringify(value)) as Json;
export const point = (fact: FactEnvelope) => ({ epoch: fact.segment.epoch, position: fact.segment.position });
export function refused<T>(r: Result<T>, detail?: string): string {
  return consumeResult(r, { Success: () => { throw new Error('expected refusal'); }, Refused: r => {
    if (detail && !r.detail.includes(detail)) throw new Error(`expected ${detail}, received ${r.detail}`); return r.detail;
  } });
}
export function factsFixture() {
  const f = fixture();
  const c = { site: 'facts.admit', preserved: 'refusal:metadata', register: { ...f.ctx.register, entries: [...f.ctx.register.entries, 'facts.admit'], sites: { ...f.ctx.register.sites, 'facts.admit': 'closed' as const },
    keys: { ...f.ctx.register.keys,
      'machine-a-key': { algorithm: 'ed25519' as const, owner: 'machine-a', publicKey, methods: ['fact-envelope'], adapters: ['host'] },
      'machine-b-key': { algorithm: 'ed25519' as const, owner: 'machine-b', publicKey: secondPublicKey, methods: ['fact-envelope'], adapters: ['host'] } } } };
  const schema: FactSchema = { kind: 'note', version: 1, fields: { identity: { kind: 'text', maxLength: 80 }, amount: { kind: 'exact', unit: 'minor' } }, machineScope: 'shared', standing: 'requester', action: 'work', scope: f.scope, causallyBound: false, requiredReferences: [], authority: 'none' };
  const ctx: FactContext = { site: c.site, preserved: c.preserved, decode: { ...f.ctx, register: c.register },
    schemas: [schema], keys: ['machine-a', 'machine-b'].map(machine => ({ id: `${machine}-key`, machine, publicKey: machine === 'machine-a' ? publicKey : secondPublicKey, from: { epoch: 0, position: 0 } })),
    facts: [], grants: [], revocations: [], genesis: { hash: genesisHash, clock: f.now }, timeAnchors: [], captures: {}, folded: {} };
  function wire(overrides: Record<string, unknown> = {}, context: FactContext = ctx): unknown {
    const segment = { machine: 'machine-a', epoch: 0, position: 0, ...(overrides.segment as object ?? {}) };
    return signEnvelope({ type: 'FactEnvelope', envelopeVersion: 1, id: factId(segment), kind: 'note', schemaVersion: 1, at: f.now,
      machine: segment.machine, principal: f.alice, provenance: f.alice.provenance, segment, prevInSegment: context.genesis.hash,
      predecessors: { inSegment: null, frontier: {}, required: [] }, body: { identity: 'one', amount: '10' }, ...overrides }, segment.machine === 'machine-a' ? privateKey : secondPrivateKey);
  }
  function fact(overrides: Record<string, unknown> = {}, context = ctx): FactEnvelope { return value(decodeEnvelope(wire(overrides, context), context)); }
  function next(previous: FactEnvelope, overrides: Record<string, unknown> = {}, context = ctx): FactEnvelope {
    return fact({ segment: { machine: previous.machine, epoch: previous.segment.epoch, position: previous.segment.position + 1 },
      prevInSegment: previous.contentHash, predecessors: { inSegment: previous.id, frontier: {}, required: [] }, ...overrides }, context);
  }
  const success = <T>(v: T): Result<T> => boundary('FixtureReceipt', null, c, () => v);
  return { ...f, c, ctx, schema, wire, fact, next, success };
}
