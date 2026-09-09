import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, writeFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { createPrivateKey } from 'node:crypto';
import { authorizationRequestDigest, canonical, decode, consumeResult } from '../../src/index.js';
import type { Authorization, Hash, Json, ProvenanceInput, RegisterGenerationReference, Result, Scope } from '../../src/index.js';
import { authorAndAppend, createFactStore, hashBytes } from '../../src/facts/index.js';
import type { CapturedContent, FactContext, FactEnvelope, FactSchema, SegmentStoragePort } from '../../src/facts/index.js';
import { createIntakePort, intakeFactSchemas, intakeVerifiedActFactSchemas } from '../../src/intake/index.js';
import type { InboundRoute, IntakeDependencies, IntakeAdapterPort, VerifiedActAdmission } from '../../src/intake/index.js';
import { generateRegister, generationOf, decodeGenerationRecord, loadRegister } from '../../src/register/index.js';
import type { FactReference, SpineReadPort } from '../../src/register/index.js';
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
export function intakeFixture(options: { directory?: string } = {}) {
  const f = factsFixture(), r = setup();
  const peerPrivateKey = createPrivateKey({ key: Buffer.from('302e020100300506032b657004220420' + '22'.repeat(32), 'hex'),
    format: 'der', type: 'pkcs8' }).export({ format: 'pem', type: 'pkcs8' }).toString();
  Object.assign(r.context, { references: [...r.context.references ?? [], { provider: 'fixture', id: 'check', kind: 'captured-bytes' },
    { provider: 'fixture', id: 'P4-NF-06' }, ...['readProjection', 'authorAndAppend', 'decode:Provenance', 'decode:VerifiedPrincipal'].map(id => ({ provider: 'decoder', id }))] });
  const system = f.principal('intake-observer', 'system');
  const trace: string[] = [], segmentPath = options.directory ? join(options.directory, 'segment.jsonl') : undefined;
  const capturesPath = options.directory ? join(options.directory, 'captures') : undefined;
  if (options.directory) { mkdirSync(options.directory, { recursive: true }); mkdirSync(capturesPath!, { recursive: true }); }
  const frames: unknown[] = segmentPath && existsSync(segmentPath)
    ? readFileSync(segmentPath, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
  const captureIndex: Record<string, CapturedContent> = {};
  for (const [reference, bytes] of Object.entries(f.captures)) captureIndex[reference] = { bytes, hash: hashBytes(bytes), status: 'available', byteLength: Buffer.byteLength(bytes) };
  const context: FactContext = { ...f.ctx, decode: { ...f.ctx.decode, currentBase: 'base:1', artifact: f.artifact,
    register: { ...f.ctx.decode.register,
    entries: [...f.ctx.decode.register.entries, 'intake.admit', 'intake-slice'], sites: { ...f.ctx.decode.register.sites, 'intake.admit': 'closed' } } },
    captures: captureIndex, schemas: [...f.ctx.schemas, ...intakeFactSchemas(f.scope), ...intakeVerifiedActFactSchemas(f.scope)], grants: [], facts: [] };
  if (capturesPath) for (const name of readdirSync(capturesPath)) {
    const reference = decodeURIComponent(name), bytes = readFileSync(join(capturesPath, name), 'utf8'); f.captures[reference] = bytes;
  }
  function durable(path: string, bytes: string, append = false) {
    const fd = openSync(path, append ? 'a' : 'w', 0o600);
    try { append ? writeSync(fd, bytes) : writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
  }
  const storage: SegmentStoragePort = { owner: 'part-ten', read: () => frames,
    append(bytes, expected) { trace.push(`append:${(JSON.parse(bytes) as { kind: string }).kind}`);
      const current = frames.at(-1) as { contentHash?: string } | undefined;
      if ((current?.contentHash ?? null) !== expected) throw new Error('compare-head failed');
      if (segmentPath) durable(segmentPath, `${bytes}\n`, true);
      frames.push(JSON.parse(bytes)); return f.success({ kind: 'local-durable' as const }); } };
  // RAM here is a unit/integration double. E2E supplies fsync-backed provider storage.
  const declarations = JSON.parse(readFileSync('src/intake/port.declarations.json', 'utf8')) as object[];
  const parser = r.declaration('host', 'parsers', { fixture: 'check', authenticationClass: [
    { stimulusType: 'message', class: 'channel-attested' },{ stimulusType: 'operator-act', class: 'verified' }],
    eventIdAuthority: { mintedBy: 'provider', uniquenessScope: 'channel-and-sender', replayWindow: 1000,
      fallbackFingerprint: { policy: 'none', basis: 'provider id required' } }, ackPolicy: 'bound-only' }, { profile: r.profile });
  const surfaceParser = r.declaration('phone-surface', 'parsers', { fixture: 'check', authenticationClass: [
    { stimulusType: 'operator-act', class: 'verified' }],
    eventIdAuthority: { mintedBy: 'surface', uniquenessScope: 'challenge', replayWindow: 1000,
      fallbackFingerprint: { policy: 'none', basis: 'surface challenge required' } }, ackPolicy: 'never' }, { profile: r.profile });
  // Explicit test-only approved extract and injected spine verifier. Never a
  // production approval or a cast from generated replay into runtime authority.
  const governanceChecks: string[] = [];
  function govern(declared: readonly object[] = [...declarations, parser, surfaceParser], approved = true) {
    const contract = declared.find(d => (d as { id: string }).id === 'intake.contract');
    const approval = { owner: 'part-two', name: 'FactEnvelope', id: 'fixture:intake-contract-approval' } as const;
    const rows = approved && contract ? [{ id: 'intake.contract', version: 'intake-contract:v1', status: 'live', since: 'commit:1',
      supersedes: [], approvedIn: approval, landedIn: 'commit:1', base: 'commit:1', contentHash: value(canonical(contract)).hash }] : [];
    const input = r.input(declared, { extract: { ...r.extract, rows } });
    const candidate = value(generateRegister(input, r.context));
    const generation = value(generationOf(candidate, r.context));
    const record = value(decodeGenerationRecord({ type: 'GenerationRecord', schemaVersion: 1, generation, at: r.f.now }, r.context));
    const spine: SpineReadPort = { owner: 'part-two',
      verifyExtract(extract) { governanceChecks.push('extract');
        if (value(canonical(extract)).bytes !== value(canonical(candidate.extract)).bytes) throw new Error('fixture extract mismatch');
        return f.success<FactReference>(approval); },
      enteringForce(supplied) { governanceChecks.push('force');
        if (supplied.id !== generation.id) throw new Error('fixture generation mismatch');
        return f.success(record); },
      isCurrent(vector, now) { governanceChecks.push('current');
        return f.success(vector.id === candidate.extract.vector.id && now.value === r.f.now.value); } };
    return { input, governance: { register: value(loadRegister(candidate, generation, r.context, spine, r.f.now)), context: r.context } };
  }
  const { input: registerInput, governance } = govern();
  const current = value(generationOf(governance.register, r.context));
  const generation: RegisterGenerationReference = { owner: 'part-three', name: 'RegisterGeneration', id: current.id };
  const auth = f.proof({ id: 'alice', kind: 'person' }, { id: 'alice', kind: 'person' }, 'identity', true);
  function syncCaptures() {
    for (const [reference, bytes] of Object.entries(f.captures)) {
      captureIndex[reference] = { bytes, hash: hashBytes(bytes), status: 'available', byteLength: Buffer.byteLength(bytes) };
      if (capturesPath) durable(join(capturesPath, encodeURIComponent(reference)), bytes);
    }
  }
  function dropCapture(reference: string) { delete captureIndex[reference]; delete f.captures[reference]; }
  syncCaptures();
  const adapter: IntakeAdapterPort = { id: 'host',
    authenticate(_raw, route, _at) { trace.push('authenticate'); return f.success({ provenance: { ...auth.input, evidence: { kind: 'channel' as const, authenticated: true } }, principalId: 'alice', principalKind: 'person' as const,
      channel: route.channel, sender: route.sender, identityEpoch: route.identityEpoch }); },
    parse(raw) { trace.push('parse'); return JSON.parse(raw) as Json; } };
  let instant = 100;
  const deps: IntakeDependencies = { adapter, governance, storage, context: () => context,
    author: { machine: 'machine-a', principal: system, provenance: system.provenance, privateKey },
    capture: { owner: 'part-ten', preserve(raw) { trace.push('capture'); const hash = hashBytes(raw); f.captures[hash] = raw;
      if (capturesPath) durable(join(capturesPath, encodeURIComponent(hash)), raw);
      captureIndex[hash] = { hash, bytes: raw, status: 'available', byteLength: Buffer.byteLength(raw) }; return f.success({ reference: hash, hash }); } },
    clock: () => { trace.push('clock'); return f.clock(instant); }, scope: f.scope, workOwner: 'run-admission:owner', holdMaxAge: 1000, holdMaxActive: 2,
    dedupStalenessBound: 1000, dedupGeneration: () => ({ reference: context.decode.register.generation, kinds: [...new Set(context.schemas.map(s => s.kind))],
      lineages: { 'machine-a': { head: (frames.at(-1) as FactEnvelope | undefined)?.segment ?? null, observedAt: instant, closed: false } } }) };
  const port = () => value(createIntakePort(deps));
  const rootSchema = { ...f.schema, kind: 'genesis-grant', fields: { grant: { kind: 'constitutional' as const, type: 'StandingGrant' as const } } };
  function bind(overrides: Record<string, Json> = {}) {
    const grant = f.grant({ id: 'binding-grant', scope: f.scope }); syncCaptures();
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
  const requestSchema: FactSchema = { kind: 'authorization-request', version: 1, machineScope: 'shared', standing: 'requester', action: 'work',
    scope: f.scope, causallyBound: false, requiredReferences: [], authority: 'none', fields: {
      requestId: { kind: 'text', maxLength: 200 }, requestDigest: { kind: 'text', maxLength: 200 }, action: { kind: 'text', maxLength: 200 },
      scope: { kind: 'constitutional', type: 'Scope' }, audience: { kind: 'text', maxLength: 200 }, artifact: { kind: 'text', maxLength: 200 },
      base: { kind: 'text', maxLength: 200 }, expiresAt: { kind: 'integer' }, approverId: { kind: 'text', maxLength: 200 },
      requestedById: { kind: 'text', maxLength: 200 }, consequence: { kind: 'text', maxLength: 100 },
      reversibility: { kind: 'text', maxLength: 100 }, blockedWork: { kind: 'text', maxLength: 300 },
      recurrence: { kind: 'text', maxLength: 1000 }, requesterProse: { kind: 'text', maxLength: 2000 }, evidence: { kind: 'capture' },
    } };
  function verifiedAct(options: { request?: Record<string, Json>; action?: string; scope?: Scope; attested?: boolean; surface?: string;
    decision?: 'approve'|'decline'; generation?: RegisterGenerationReference; referenceId?: string; actScope?: Scope;
    challengeScope?: Scope; submittedDigest?: Hash; renderingDigest?: Hash; challengeId?: string; challengeIssuedAt?: number;
    challengeExpiresAt?: number; extra?: Record<string, unknown> } = {}) {
    if (!context.schemas.some(s => s.kind === requestSchema.kind)) Object.assign(context, { schemas: [...context.schemas, requestSchema] });
    const binding = bind(), root = facts().find(row => row.kind === 'genesis-grant')!;
    const scope = options.scope ?? f.scope, action = options.action ?? 'work', artifact = f.artifact, base = 'base:1';
    const digest = authorizationRequestDigest({ approver: f.alice, action: { kind: action, scope }, artifact, base });
    const requestEvidence = value(deps.capture.preserve(`request-evidence:${frames.length}`, f.now));
    const requestBody: Record<string, Json> = { requestId: 'request:verified-act', requestDigest: digest, action, scope: json(scope), audience: 'operator',
      artifact, base, expiresAt: 500, approverId: f.alice.id, requestedById: f.bob.id, consequence: 'control', reversibility: 'irreversible',
      blockedWork: 'operator-authorized work', recurrence: JSON.stringify(['same request recurred']), requesterProse: 'please proceed',
      evidence: json(requestEvidence), ...options.request };
    const request = value(authorAndAppend({ kind: 'authorization-request', schemaVersion: 1, machine: 'machine-a', principal: json(f.alice),
      provenance: json(f.alice.provenance), at: json(f.now), body: requestBody, required: [root.id] }, context,
    createFactStore(context, storage), privateKey)).fact;
    const actualScope = value(decode('Scope', requestBody.scope, context.decode)), liveGrant = f.grants.find(g => g.id === 'binding-grant')!;
    const actPayload = { id: `act:${request.id}`, at: f.now, approver: f.alice, under: liveGrant.id,
      action: { kind: action, scope: options.actScope ?? actualScope },
      artifact: requestBody.artifact as Hash, base: requestBody.base as string, kind: { kind: 'approval' as const }, requestedBy: f.bob,
      requestDigest: requestBody.requestDigest as Hash };
    const surface = options.surface ?? 'host';
    const actProof = f.proof(actPayload, { id: f.alice.id, kind: 'person' }, 'approval', false, surface);
    const act = value(decode('Authorization', { type: 'Authorization', schemaVersion: 1, ...actPayload, explicitYes: actProof.p },
      { ...context.decode, provenance: actProof.p, currentBase: requestBody.base as string, artifact: requestBody.artifact as Hash,
        now: f.now, actAt: f.now })) as Authorization;
    const decision = options.decision ?? 'approve';
    const referenceId = options.referenceId ?? request.id;
    const challengePayload = { type: 'VerifiedOperatorChallenge', schemaVersion: 1,
      challenge: options.challengeId ?? `challenge:${referenceId}`, request: referenceId,
      requestDigest: options.submittedDigest ?? requestBody.requestDigest,
      renderingDigest: options.renderingDigest ?? value(canonical(requestBody)).hash, action: requestBody.action,
      scope: json(options.challengeScope ?? actualScope),
      audience: requestBody.audience, operator: requestBody.approverId, requestedBy: requestBody.requestedById, artifact: requestBody.artifact,
      base: requestBody.base, issuedAt: options.challengeIssuedAt ?? 100, expiresAt: options.challengeExpiresAt ?? 200, singleUse: true, decision,
      actDigest: decision === 'decline' ? 'none' : value(canonical(act)).hash, surface, generation: options.generation ?? generation };
    const challengeProof = f.proof(challengePayload, { id: f.alice.id, kind: 'person' }, 'verified-operator-challenge', options.attested, surface);
    const bundle = JSON.stringify({ type: 'VerifiedActProofBundle', schemaVersion: 1, challenge: challengeProof.input,
      act: decision === 'decline' ? null : actProof.input });
    const proof = value(deps.capture.preserve(bundle, f.now)); syncCaptures();
    const input: VerifiedActAdmission = { request: { owner: 'part-two', name: 'FactEnvelope', id: referenceId },
      requestDigest: options.submittedDigest ?? requestBody.requestDigest as Hash, decision, act: decision === 'decline' ? null : act, proof,
      surface, generation: options.generation ?? generation, ...options.extra } as VerifiedActAdmission;
    return { binding, root, request, requestBody, requestEvidence, act, actProof: actProof.input as ProvenanceInput,
      challengeProof: challengeProof.input as ProvenanceInput, challengePayload, proof, input, generation };
  }
  function conflictRequest(original: ReturnType<typeof verifiedAct>) {
    return value(authorAndAppend({ kind: 'authorization-request', schemaVersion: 1, machine: 'machine-b', principal: json(f.alice),
      provenance: json(f.alice.provenance), at: json(f.now), body: { ...original.requestBody, base: 'base:concurrent' },
      required: [original.root.id] }, context, createFactStore(context, storage), peerPrivateKey)).fact;
  }
  const facts = () => value(createFactStore(context, storage).read());
  return { f, r, deps, context, storage, frames, trace, port, bind, facts, syncCaptures, dropCapture, registerInput, govern, governanceChecks,
    generation, rootSchema, requestSchema, verifiedAct, conflictRequest, setTime: (n: number) => { instant = n; } };
}
