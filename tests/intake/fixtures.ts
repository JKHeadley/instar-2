import { readFileSync } from 'node:fs';
import { canonical, decode, consumeResult } from '../../src/index.js';
import type { Json, Result } from '../../src/index.js';
import { authorAndAppend, createFactStore, hashBytes } from '../../src/facts/index.js';
import type { CapturedContent, FactContext, FactEnvelope, SegmentStoragePort } from '../../src/facts/index.js';
import { createIntakePort, intakeFactSchemas } from '../../src/intake/index.js';
import type { InboundRoute, IntakeDependencies, IntakeAdapterPort } from '../../src/intake/index.js';
import { factsFixture, privateKey, json, value } from '../facts/fixtures.js';
import { setup } from '../register/fixtures.js';
export { value, json };

export const route: InboundRoute = { channel: 'chat-a', sender: 'platform-alice', identityEpoch: 'account-1', eventId: 'event-1' };
export const message = (text = 'hello') => JSON.stringify({ schemaVersion: 1, kind: 'message', text });
export const stop = JSON.stringify({ schemaVersion: 1, kind: 'stop', command: '/stop' });
export function refused<T>(result: Result<T>, detail?: string) {
  return consumeResult(result, { Success: () => { throw new Error('expected a refusal'); }, Refused: r => {
    if (detail && !r.detail.includes(detail)) throw new Error(`expected ${detail}; received ${r.detail}`); return r;
  } });
}
export function intakeFixture() {
  const f = factsFixture(), r = setup();
  Object.assign(r.context, { references: [...r.context.references ?? [], { provider: 'fixture', id: 'check', kind: 'captured-bytes' }] });
  const system = f.principal('intake-observer', 'system');
  const trace: string[] = [], frames: unknown[] = [];
  const captureIndex: Record<string, CapturedContent> = {};
  for (const [reference, bytes] of Object.entries(f.captures)) captureIndex[reference] = { bytes, hash: hashBytes(bytes), status: 'available', byteLength: Buffer.byteLength(bytes) };
  const context: FactContext = { ...f.ctx, decode: { ...f.ctx.decode, register: { ...f.ctx.decode.register,
    entries: [...f.ctx.decode.register.entries, 'intake.admit', 'intake-slice'], sites: { ...f.ctx.decode.register.sites, 'intake.admit': 'closed' } } },
    captures: captureIndex, schemas: [...f.ctx.schemas, ...intakeFactSchemas(f.scope)], grants: [], facts: [] };
  const storage: SegmentStoragePort = { owner: 'part-ten', read: () => frames,
    append(bytes, expected) { trace.push(`append:${(JSON.parse(bytes) as { kind: string }).kind}`);
      const current = frames.at(-1) as { contentHash?: string } | undefined;
      if ((current?.contentHash ?? null) !== expected) throw new Error('compare-head failed');
      frames.push(JSON.parse(bytes)); return f.success({ kind: 'local-durable' as const }); } };
  // RAM here is a unit/integration double. E2E supplies fsync-backed provider storage.
  const declarations = JSON.parse(readFileSync('src/intake/port.declarations.json', 'utf8')) as object[];
  const parser = r.declaration('host', 'parsers', { fixture: 'check', authenticationClass: [{ stimulusType: 'message', class: 'channel-attested' }],
    eventIdAuthority: { mintedBy: 'provider', uniquenessScope: 'channel-and-sender', replayWindow: 1000,
      fallbackFingerprint: { policy: 'none', basis: 'provider id required' } }, ackPolicy: 'bound-only' }, { profile: r.profile });
  const registerInput = r.input([...declarations, parser]);
  const governance = { register: r.build([...declarations, parser], { }), context: r.context };
  const auth = f.proof({ id: 'alice', kind: 'person' }, { id: 'alice', kind: 'person' }, 'identity', true);
  function syncCaptures() {
    for (const [reference, bytes] of Object.entries(f.captures)) captureIndex[reference] = { bytes, hash: hashBytes(bytes), status: 'available', byteLength: Buffer.byteLength(bytes) };
  }
  syncCaptures();
  const adapter: IntakeAdapterPort = { id: 'host',
    authenticate(_raw, route, _at) { trace.push('authenticate'); return f.success({ provenance: { ...auth.input, evidence: { kind: 'channel' as const, authenticated: true } }, principalId: 'alice', principalKind: 'person' as const,
      channel: route.channel, sender: route.sender, identityEpoch: route.identityEpoch }); },
    parse(raw) { trace.push('parse'); return JSON.parse(raw) as Json; } };
  let instant = 100;
  const deps: IntakeDependencies = { adapter, governance, storage, context: () => context,
    author: { machine: 'machine-a', principal: system, provenance: system.provenance, privateKey },
    capture: { owner: 'part-ten', preserve(raw) { trace.push('capture'); const hash = hashBytes(raw); f.captures[hash] = raw;
      captureIndex[hash] = { hash, bytes: raw, status: 'available', byteLength: Buffer.byteLength(raw) }; return f.success({ reference: hash, hash }); } },
    clock: () => { trace.push('clock'); return f.clock(instant); }, scope: f.scope, workOwner: 'run-admission:owner', holdMaxAge: 1000, holdMaxActive: 2,
    dedupStalenessBound: 1000, dedupGeneration: () => ({ reference: context.decode.register.generation, kinds: [...new Set(context.schemas.map(s => s.kind))],
      lineages: { 'machine-a': { head: (frames.at(-1) as FactEnvelope | undefined)?.segment ?? null, observedAt: instant, closed: false } } }) };
  const port = () => value(createIntakePort(deps));
  function bind(overrides: Record<string, Json> = {}) {
    const grant = f.grant({ id: 'binding-grant', scope: f.scope }); syncCaptures();
    const rootSchema = { ...f.schema, kind: 'genesis-grant', fields: { grant: { kind: 'constitutional' as const, type: 'StandingGrant' as const } } };
    // Genesis grant is installation input. P1 verifies the approved org-intent source.
    const grantContext = { ...context, schemas: [...context.schemas.filter(s => s.kind !== rootSchema.kind), rootSchema], decode: { ...context.decode, provenance: grant.source } };
    Object.assign(context, { schemas: grantContext.schemas });
    const root = value(authorAndAppend({ kind: 'genesis-grant', schemaVersion: 1, machine: 'machine-a', principal: json(f.alice), provenance: json(grant.source),
      at: json(f.now), body: { grant: json(grant) }, required: [] }, grantContext, createFactStore(grantContext, storage), privateKey)).fact;
    Object.assign(context, { grants: [{ factId: root.id, grant }] });
    const body = { adapter: 'host', channel: route.channel, sender: route.sender, identityEpoch: route.identityEpoch,
      principalId: 'alice', grantId: grant.id, scope: json(f.scope), supersedes: 'none', ...overrides };
    return value(authorAndAppend({ kind: 'conversation-binding', schemaVersion: 1, machine: 'machine-a', principal: json(f.alice), provenance: json(f.alice.provenance),
      at: json(f.now), body, required: [root.id] }, context, createFactStore(context, storage), privateKey)).fact;
  }
  const facts = () => value(createFactStore(context, storage).read());
  return { f, r, deps, context, storage, frames, trace, port, bind, facts, syncCaptures, registerInput, setTime: (n: number) => { instant = n; } };
}
