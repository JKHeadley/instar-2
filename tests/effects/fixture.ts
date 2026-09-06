import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonical, decode } from '../../src/index.js';
import type { Json } from '../../src/index.js';
import { authorAndAppend, createFactStore, hashBytes } from '../../src/facts/index.js';
import type { CapturedContent, FactContext, GovernedVersion } from '../../src/facts/index.js';
import { createTransportAuthority, createTransportSpine, decodeLoopPolicy, registerTransportBodies, transportSchemas } from '../../src/transport/index.js';
import type { TransportHost } from '../../src/transport/index.js';
import { createEffectDoorway, createEffectSpine, decodeOutboundMessage, effectSchemas, installOperationDefinition, registerEffectBodies } from '../../src/effects/index.js';
import type { EffectComposition, EffectHost, EffectAssessmentPort, OperationAdapterPort } from '../../src/effects/index.js';
import { factsFixture, privateKey, value, refused, json } from '../facts/fixtures.js';
// @ts-expect-error Reference physical host is JavaScript, outside pure core compilation.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';
// @ts-expect-error Reference physical host is JavaScript, outside pure core compilation.
import { createEffectReplicaStorage } from '../../scripts/effect-replica-storage.mjs';
// @ts-expect-error Reference custody is outside pure core.
import { createEffectFileCaptures } from '../../scripts/effect-file-captures.mjs';
export { value, refused };

export function effectFixture(directory = mkdtempSync(join(tmpdir(), 'p8-')), incarnation = 'executor:1', definitionOverrides: Record<string, unknown> = {}) {
  const f = factsFixture();
  // Separate agent executor and person approving the exact definition.
  f.grant({ id: 'agent-grant', grantee: f.bob });
  const register = { ...f.ctx.decode.register, entries: [...f.ctx.decode.register.entries, 'reply', 'telegram-fixture'] };
  const decodeContext = { ...f.ctx.decode, register };
  const boundary = { ...f.c, register };
  let now = 100, stopped = false;
  let authority: string[] = [], versions: GovernedVersion[] = [];
  const result = <T>(run: () => T) => f.success(run());
  const custody = createEffectFileCaptures([join(directory, 'origin-captures'), join(directory, 'peer-captures')], result);
  const captures: Record<string, CapturedContent> = custody.captures;
  const host: EffectHost = { machine: 'machine-a', incarnation, principal: f.bob, scope: f.scope, boundary,
    current: () => ({ decode: decodeContext, clock: f.clock(now), stopped, versions, authority }),
    capture: custody.capture,
  };
  const transportHost: TransportHost = { domain: 'conversation:1', machine: host.machine, incarnation,
    authorityIncarnation: 'authority:1', principal: host.principal, scope: host.scope, maxLeaseTerm: 1000, budget: 100,
    monotonic: () => now, current: () => ({ decode: decodeContext, clock: f.clock(now), generation: register.generation, stopped }) };
  const ctx: FactContext = { ...f.ctx, decode: decodeContext, captures,
    schemas: [f.schema, ...transportSchemas(transportHost), ...effectSchemas(host)],
    ownedBodies: [...value(registerTransportBodies(transportHost, boundary)), ...value(registerEffectBodies(host))] };
  const peer = createFactStore(ctx, createTransportFileStorage(join(directory, 'peer'), result));
  const replicas = createEffectReplicaStorage(join(directory, 'origin'), { id: 'fixture-peer-directory', store: peer }, result);
  const store = createFactStore(ctx, replicas.storage);
  const author = { context: ctx, privateKey };
  const spine = createEffectSpine(host, author, store);
  const transport = createTransportAuthority(transportHost, createTransportSpine(transportHost, author, store), boundary);
  const note = (identity: string) => value(authorAndAppend({ kind: 'note', schemaVersion: 1, machine: host.machine,
    principal: json(host.principal), provenance: json(host.principal.provenance), at: json(f.now), body: { identity, amount: '0' }, required: [] }, ctx, store, privateKey)).fact;
  const pending = note('five-owned pending and source result STAND-IN');
  authority = [pending.id];
  const definition = { type: 'OperationDefinition', schemaVersion: 1, id: 'reply-definition:1', feature: 'reply', version: 'reply-version:1',
    generation: register.generation.id, adapter: 'telegram-fixture', account: 'bot:fixture', conversation: 'chat:fixture',
    speaker: f.bob.id, scopeDigest: value(canonical(f.scope)).hash, durability: 'replicated', replicas: 1,
    lossModel: 'Second local directory is a peer STAND-IN; shared disk loss is NOT covered.', maxBytes: 4096,
    maxCharge: 20, timeout: 100, verificationBar: 'reply-bar:1', ...definitionOverrides };
  const approvedIn = f.authorize({ id: 'reply-approval', artifact: f.capture(value(canonical(definition)).bytes), base: 'reply-base:1' });
  versions = [{ id: definition.version, subject: definition.feature, content: json(definition), contentHash: value(canonical(definition)).hash,
    since: pending.id, supersedes: [], approvedIn, base: approvedIn.base, landedIn: null }];
  const d = value(installOperationDefinition(definition, host, spine));
  const policy = value(decodeLoopPolicy({ type: 'LoopPolicy', schemaVersion: 1, id: 'observation-policy', maxAttempts: 3,
    minDelay: 10, maxDuration: 1000, timeout: 10, concurrency: 1, failDirection: 'closed', breaker: 'stub-closed' }, boundary));
  const fence = value(transport.acquire('acquire', '', 500));
  const run = { owner: 'part-five' as const, name: 'Run' as const, id: 'run:1' };
  value(transport.schedule('schedule', fence, run, policy));
  const obligation = value(transport.inspect()).at(-1)!.fact.id;
  let calls = 0, queries = 0, invoke: (() => void) | undefined;
  const adapter: OperationAdapterPort = { owner: 'part-ten', id: 'telegram-fixture',
    describe: () => ({ contract: 'fixture-contract:1', account: definition.account, conversation: definition.conversation,
      maxCharge: 20, timeout: 100, hiddenRetries: 0 }),
    invoke: input => { calls++; invoke?.(); return f.success(JSON.stringify({ ok: true, result: { message_id: calls, chat: { id: input.message.conversation }, text: input.message.text } })); },
    observe: () => { queries++; return f.success(JSON.stringify({ status: 'unknown', reason: 'Telegram-shaped fixture has no decisive negative lookup' })); },
  };
  let assessmentState: 'happened' | 'uncertain' = 'uncertain';
  let finalCharge: number | null = null;
  let acceptanceId = '';
  let assessmentEvidence = '';
  // EXPLICIT nine stand-in. It records a note, not a counterfeit P9 fact/type.
  // No production claim or automatic retry may rely on this fixture composition.
  const assessor: EffectAssessmentPort = { owner: 'part-nine',
    assess: input => { acceptanceId ||= note('independent nine assessment STAND-IN').id;
      const evidenceId = `assessment:${input.reservation.operation}:${assessmentState}`;
      if (!f.evidence.some(e => e.id === evidenceId)) f.evidence.push(value(decode('Evidence', f.evidenceInput({ id: evidenceId,
        claim: { subject: input.reservation.operation, predicate: input.request.digest, value: assessmentState },
        strength: 'observation', observedAt: f.clock(now), freshFor: 100 }), decodeContext)));
      assessmentEvidence = evidenceId;
      return f.success({ owner: 'part-nine', name: 'EvidenceAcceptance', id: acceptanceId }); },
    read: (ref, input) => {
      if (ref.id !== acceptanceId || !input.observations.length) throw new Error('assessment binding');
      return f.success({ outcome: value(decode('Outcome', { type: 'Outcome', schemaVersion: 1, kind: assessmentState, evidence: [assessmentEvidence] }, decodeContext)),
        finalCharge, delayedExecutionExcluded: false, required: [acceptanceId] });
    },
  };
  const composition: EffectComposition = { host, spine, transport, durability: replicas.durability, adapter, assessment: assessor };
  const api = createEffectDoorway(composition);
  const message = value(decodeOutboundMessage({ type: 'OutboundMessage', schemaVersion: 1, id: 'message:1', semanticMessage: 'five-semantic-message:1',
    run: run.id, speaker: f.bob.id, account: definition.account, conversation: definition.conversation,
    text: 'Here is the requested result.', purpose: 'ordinary-reply', sourceResult: pending.id }, host));
  const prepare = () => value(api.prepare({ definition: d.id, message, run, pending: pending.id,
    attempt: 'attempt:1', verificationOwner: 'reply-verifier', obligation, closure: [], fence }));
  return { ...f, directory, host, ctx, store, peer, spine, transport, replicas, api, composition, note,
    d, definition, message, pending, run, obligation, fence, prepare,
    calls: () => calls, queries: () => queries, onInvoke: (fn: () => void) => { invoke = fn; },
    stop: () => { stopped = true; }, time: (v: number) => { now = v; },
    assess: (state: typeof assessmentState, charge: number | null) => { assessmentState = state; finalCharge = charge; },
    versions: (v: GovernedVersion[]) => { versions = v; },
  };
}
