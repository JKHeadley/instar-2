import { decode, readEvidence } from '../index.js';
import type { BoundaryContext, Decision, OwnedReference, Result, RunReference } from '../index.js';
import { authorAndAppend, causalCone, hashBytes, registerOwnedBody } from '../facts/index.js';
import type { FactContext, FactEnvelope, FactSchema, FactStorePort, OwnedShape } from '../facts/index.js';
import type { FenceToken, TransportAuthority } from '../transport/index.js';
import type { RunGraphPort } from '../rungraph/index.js';
import { consumeEffectSettlement } from '../effects/index.js';
import { consumeProviderReceipt } from '../effects/provider-api.js';
import type { ProviderReceipt } from '../effects/provider-api.js';
import type { EffectSettlement } from '../effects/index.js';
import type { Capture, JudgmentCapturePort, JudgmentHost, ProviderObservation, RecordedAnswer } from './contracts.js';
import { boundary, encoded, ensure, freeze, json, take } from './boundary.js';
import { observationCheck } from './model-adapter.js';

export interface ProviderJudgmentRequest {
  readonly type: 'ProviderJudgmentRequest'; readonly schemaVersion: 2; readonly id: string;
  readonly run: string; readonly step: string; readonly predecessor: string; readonly pending: string;
  readonly ordinal: number; readonly semanticMessage: string; readonly point: string; readonly consumer: 'advisory';
  readonly generation: string; readonly incarnation: string; readonly deadline: number;
  readonly question: Capture; readonly context: Capture; readonly submitted: Capture; readonly inputDigest: string;
  readonly floorDigest: string; readonly evidence: readonly string[]; readonly provider: string; readonly model: string; readonly route: string;
  readonly routeBasis: string; readonly disclosure: string; readonly settingsDigest: string; readonly outputSchemaDigest: string;
  readonly maxInputBytes: number; readonly maxOutputBytes: number; readonly maxCaptureBytes: number;
  readonly maxTokens: number; readonly maxCharge: number; readonly timeout: number;
  readonly attempt: string; readonly effectRequest: string;
}
export interface PreparedProviderJudgment {
  readonly request: OwnedReference<'part-seven', 'JudgmentRequest'>;
  readonly prepared: OwnedReference<'part-seven', 'JudgmentAttemptRecord'>;
  readonly value: ProviderJudgmentRequest;
}
export interface ProviderQuestionInput {
  readonly id: string; readonly run: RunReference; readonly step: string; readonly ordinal: number;
  readonly semanticMessage: string; readonly question: string; readonly context: string;
  readonly evidence: readonly string[]; readonly deadline: number;
}
export interface ProviderJudgmentPort {
  readonly owner: 'part-seven';
  prepare(input: ProviderQuestionInput, fence: FenceToken): Result<PreparedProviderJudgment>;
  readPrepared(reference: OwnedReference<'part-seven', 'JudgmentRequest'>, fence?: FenceToken): Result<PreparedProviderJudgment>;
  recordReceipt(receipt: ProviderReceipt): Result<OwnedReference<'part-seven', 'JudgmentAttemptRecord'>>;
  resolve(reference: OwnedReference<'part-seven', 'JudgmentRequest'>, settlement: EffectSettlement, fence: FenceToken): Result<RecordedAnswer>;
}
export interface ProviderJudgmentDependencies {
  readonly host: JudgmentHost; readonly boundary: BoundaryContext; readonly authority: TransportAuthority;
  readonly captures: JudgmentCapturePort; readonly store: FactStorePort; readonly context: FactContext; readonly privateKey: string;
  readonly runs: RunGraphPort;
  readonly settings: Readonly<Record<string, import('../index.js').Json>>;
  readonly outputSchema: Readonly<Record<string, import('../index.js').Json>>;
  readonly maxTokens: number; readonly maxCaptureBytes: number; readonly timeout: number; readonly disclosure: string;
}
const txt = { kind: 'text', maxLength: 512 } as const, int = { kind: 'integer' } as const;
const refs = { kind: 'array', maxLength: 64, items: txt } as const, cap = { kind: 'capture' } as const;
const common = { type: txt, schemaVersion: int, id: txt };
const shapes: Readonly<Record<string, OwnedShape>> = {
  ProviderJudgmentRequest: { kind: 'object', fields: { ...common, run: txt, step: txt, predecessor: txt, pending: txt,
    ordinal: int, semanticMessage: txt, point: txt, consumer: txt, generation: txt, incarnation: txt, deadline: int,
    question: cap, context: cap, submitted: cap, inputDigest: txt, floorDigest: txt, evidence: refs,
    provider: txt, model: txt, route: txt, routeBasis: txt, disclosure: txt, settingsDigest: txt, outputSchemaDigest: txt,
    maxInputBytes: int, maxOutputBytes: int, maxCaptureBytes: int, maxTokens: int, maxCharge: int, timeout: int, attempt: txt, effectRequest: txt } },
  ProviderJudgmentAttemptRecord: { kind: 'object', fields: { ...common, request: txt, attempt: txt, phase: txt,
    submittedDigest: txt, operation: txt, reservation: txt, claim: txt, observation: txt, receipt: cap },
    optional: ['receipt'] },
  ProviderJudgmentResolution: { kind: 'object', fields: { ...common, request: txt, attempt: txt, response: txt, settlement: txt, accounting: txt } },
};
const raw = (f: FactEnvelope) => (f.body as unknown as { record: Record<string, unknown> }).record;
const active = new WeakMap<object, string>();
export function providerJudgmentSchemas(host: JudgmentHost): readonly FactSchema[] {
  return Object.keys(shapes).map(name => ({ kind: `judgment-provider-${name}`, version: 1,
    fields: { record: { kind: 'owned', owner: 'part-seven', name }, decision: { kind: 'constitutional', type: 'Decision' } },
    optional: ['decision'], machineScope: 'shared', standing: 'requester', action: 'work', scope: host.transport.scope,
    causallyBound: false, requiredReferences: [], authority: 'none' }));
}
export function registerProviderJudgmentBodies(host: JudgmentHost, c: BoundaryContext) {
  return boundary('ProviderJudgmentRegistrations', null, c, () => Object.entries(shapes).map(([name, shape]) => take(registerOwnedBody({
    name, owner: 'part-seven', currentVersion: 2, versions: { 1: { validate: v => ({ ok: true, value: v }) }, 2: { validate: v => ({ ok: true, value: v }) } }, migrations: { 1: () => { throw new Error('legacy judgment uses the unchanged version-one decoder'); } },
    decodeCurrent: (v, ctx) => {
      try {
        const r = v as Record<string, import('../index.js').Json>, past = causalCone(ctx.origin, ctx.facts.facts);
        ensure(r.type === name && r.schemaVersion === 2 && typeof r.id === 'string' && r.id.length > 0, 'provider judgment identity');
        ensure(ctx.origin.machine === host.transport.machine && ctx.origin.principal.id === host.transport.principal.id, 'provider judgment recorder');
        ensure(!past.some(f => f.kind === ctx.origin.kind && raw(f)?.id === r.id), 'provider judgment identity collision');
        if (ctx.mode === 'origin') ensure(active.get(host) === encoded(v).hash, 'provider judgment requires owner operation');
        if (name === 'ProviderJudgmentRequest') {
          ensure(past.some(f => f.id === r.pending && f.kind === 'run-transition'), 'real Five pending step required');
          const q = v as unknown as ProviderJudgmentRequest;
          const bytes = ctx.facts.captures[q.submitted.reference];
          if (bytes?.bytes != null) ensure(hashBytes(bytes.bytes) === q.submitted.hash && encoded(bytes.bytes).hash === q.inputDigest, 'submitted bytes changed');
        } else {
          const q = past.find(f => f.kind === 'judgment-provider-ProviderJudgmentRequest' && f.schemaVersion === 1 && raw(f)?.id === r.request);
          ensure(q && raw(q)?.attempt === r.attempt, 'request attempt mismatch');
          if (r.phase !== 'prepared') {
            const consumed = past.find(f => f.id === r.reservation && f.kind === 'transport-AdmissionReservation');
            if (name === 'ProviderJudgmentAttemptRecord') ensure(consumed && raw(consumed)?.state === 'consumed'
              && raw(consumed)?.operation === r.operation && raw(consumed)?.attempt === r.attempt
              && raw(consumed)?.request === raw(q)?.effectRequest, 'missing consumed claim');
          }
        }
        return { ok: true, value: v };
      } catch (e) { return { ok: false, detail: String(e) }; }
    },
  }, shape, c))));
}
export function createProviderJudgmentPort(p: ProviderJudgmentDependencies): ProviderJudgmentPort {
  const checked = <T>(n: string, i: unknown, fn: () => T) => boundary(n, i, p.boundary, fn);
  const facts = () => { const s = take(p.store.readForProjection()); ensure(s.entries.every(e => !e.taint.length && !e.conflicts.length), 'judgment source tainted'); return s.entries.map(e => e.fact); };
  const append = <T extends { type: string; id: string }>(r: T, required: readonly string[], decision?: Decision) => {
    const prior = facts().find(f => f.kind === `judgment-provider-${r.type}` && raw(f)?.id === r.id);
    if (prior) { ensure(encoded(raw(prior)).bytes === encoded(r).bytes, 'judgment immutable collision'); return prior; }
    active.set(p.host, encoded(r).hash);
    try { return take(authorAndAppend({ kind: `judgment-provider-${r.type}`, schemaVersion: 1, machine: p.host.transport.machine,
      principal: json(p.host.transport.principal), provenance: json(p.host.transport.principal.provenance), at: json(p.host.transport.current().clock),
      body: json({ record: r, ...(decision ? { decision } : {}) }), required }, p.context, p.store, p.privateKey)).fact; }
    finally { active.delete(p.host); }
  };
  const current = (q: ProviderJudgmentRequest, fence: FenceToken) => {
    const now = p.host.transport.current(), view = take(p.runs.read(q.run));
    ensure(now.generation.id === q.generation && p.host.transport.incarnation === q.incarnation, 'stale judgment generation/incarnation');
    ensure(p.host.transport.monotonic() < q.deadline && !now.stopped, 'judgment deadline or stop');
    ensure(view.head === q.predecessor && view.pending.some(s => s.id === q.step) && view.conflicts.length === 0, 'stale Five predecessor or pending step');
    take(p.authority.admitWrite(`provider-current:${q.id}:${facts().at(-1)?.id}`, fence));
    for (const id of q.evidence) { const e = now.decode.evidence?.find(e => e.id === id); ensure(e, 'judgment evidence absent'); take(readEvidence(e, now.clock, p.boundary.preserved)); }
    ensure(encoded(p.host.floor).hash === q.floorDigest, 'judgment floor changed');
  };
  const readPrepared: ProviderJudgmentPort['readPrepared'] = (ref, fence) => checked('ReadPreparedProviderJudgment', ref, () => {
    ensure(ref.owner === 'part-seven' && ref.name === 'JudgmentRequest', 'preparation owner mismatch');
    const all = facts(), f = all.find(f => f.id === ref.id && f.kind === 'judgment-provider-ProviderJudgmentRequest' && f.schemaVersion === 1);
    ensure(f, 'prepared request absent'); const q = raw(f) as unknown as ProviderJudgmentRequest;
    const prepared = all.find(f => f.kind === 'judgment-provider-ProviderJudgmentAttemptRecord' && raw(f)?.request === q.id && raw(f)?.phase === 'prepared');
    ensure(prepared, 'prepared attempt absent');
    const bytes = take(p.captures.read(q.submitted));
    ensure(hashBytes(bytes) === q.submitted.hash && encoded(bytes).hash === q.inputDigest, 'missing or changed submitted bytes');
    if (fence) current(q, fence);
    return freeze({ request: ref, prepared: { owner: 'part-seven', name: 'JudgmentAttemptRecord', id: prepared.id }, value: q });
  });
  return Object.freeze({ owner: 'part-seven', readPrepared,
    prepare: (input, fence) => checked('PrepareProviderJudgment', input, () => {
      ensure(Object.keys(input).sort().join(',') === 'context,deadline,evidence,id,ordinal,question,run,semanticMessage,step', 'closed provider question');
      ensure(input.run.owner === 'part-five' && input.run.name === 'Run', 'Five run required');
      const view = take(p.runs.read(input.run.id)), pending = facts().find(f => f.kind === 'run-transition' && raw(f)?.id === view.head);
      ensure(pending && view.pending.some(s => s.id === input.step), 'real Five pending step required');
      ensure(Number.isSafeInteger(input.ordinal) && input.ordinal >= 0 && input.id.length > 0 && input.semanticMessage.length > 0, 'bounded question identity');
      const d = p.host.description;
      for (const n of [p.maxTokens, p.maxCaptureBytes, p.timeout, d.maxInputBytes, d.maxOutputBytes, d.maxCharge, input.deadline]) ensure(Number.isSafeInteger(n) && n >= 0, 'finite provider bound');
      ensure(d.automaticRetries === 0 && d.measured === false && d.basis.length > 0 && p.disclosure.length > 0, 'registered route basis required');
      ensure(p.settings.automaticRetries === 0 && p.settings.maxTokens === p.maxTokens, 'submitted settings exceed token/retry bounds');
      const submitted = encoded({ provider: d.provider, model: d.model, route: d.route, messages: [{ role: 'user', content: input.question },
        { role: 'context', content: input.context }], attachments: [], tools: [], settings: p.settings, outputSchema: p.outputSchema,
        floor: p.host.floor, evidence: input.evidence, point: p.host.point, generation: p.host.transport.current().generation.id }).bytes;
      ensure(new TextEncoder().encode(submitted).length <= d.maxInputBytes && p.maxTokens > 0 && p.timeout > 0, 'provider input/token/time bound exceeded');
      const digest = encoded(submitted).hash;
      ensure(view.pending.some(s => s.id === input.step && s.operation.key === input.semanticMessage && s.operation.digest === digest), 'Five pending input digest differs');
      const prior = facts().find(f => f.kind === 'judgment-provider-ProviderJudgmentRequest' && f.schemaVersion === 1 && (raw(f)?.id === input.id
        || raw(f)?.run === input.run.id && raw(f)?.step === input.step && raw(f)?.ordinal === input.ordinal));
      if (prior) { ensure(raw(prior)?.inputDigest === digest && raw(prior)?.id === input.id, 'request immutable collision');
        return take(readPrepared({ owner: 'part-seven', name: 'JudgmentRequest', id: prior.id }, fence)); }
      ensure(new TextEncoder().encode(input.question + input.context + submitted).length + 6 * d.maxOutputBytes + 8192 <= p.maxCaptureBytes, 'capture bound exceeded');
      const capture = (bytes: string) => take(p.captures.put(bytes, d.maxInputBytes));
      const attempt = `attempt:${input.id}:1`;
      const q: ProviderJudgmentRequest = freeze({ type: 'ProviderJudgmentRequest', schemaVersion: 2, id: input.id,
        run: input.run.id, step: input.step, predecessor: view.head, pending: pending.id, ordinal: input.ordinal,
        semanticMessage: input.semanticMessage, point: p.host.point, consumer: 'advisory', generation: p.host.transport.current().generation.id,
        incarnation: p.host.transport.incarnation, deadline: input.deadline, question: capture(input.question), context: capture(input.context), submitted: capture(submitted),
        inputDigest: digest, floorDigest: encoded(p.host.floor).hash, evidence: input.evidence, provider: d.provider, model: d.model, route: d.route,
        routeBasis: d.basis, disclosure: p.disclosure, settingsDigest: encoded(p.settings).hash, outputSchemaDigest: encoded(p.outputSchema).hash,
        maxInputBytes: d.maxInputBytes, maxOutputBytes: d.maxOutputBytes, maxCaptureBytes: p.maxCaptureBytes,
        maxTokens: p.maxTokens, maxCharge: d.maxCharge, timeout: p.timeout, attempt,
        effectRequest: `provider-request:${encoded([input.run.id, input.step, input.ordinal, attempt, digest]).hash}` });
      current(q, fence);
      const request = append(q, [pending.id]);
      append({ type: 'ProviderJudgmentAttemptRecord', schemaVersion: 2, id: `${attempt}:prepared`, request: q.id, attempt,
        phase: 'prepared', submittedDigest: digest, operation: '', reservation: '', claim: '', observation: '' }, [request.id]);
      return take(readPrepared({ owner: 'part-seven', name: 'JudgmentRequest', id: request.id }, fence));
    }),
    recordReceipt: receipt => checked('RecordProviderReceipt', null, () => take(consumeProviderReceipt(receipt, p.boundary, value => {
      const prepared = take(readPrepared(value.request)), q = prepared.value;
      ensure(value.attempt === q.attempt && value.digest === q.inputDigest && value.effectRequest === q.effectRequest, 'receipt request/attempt/operation mismatch');
      const consumed = facts().find(f => f.id === value.reservation && f.kind === 'transport-AdmissionReservation');
      ensure(consumed && raw(consumed)?.state === 'consumed' && raw(consumed)?.operation === value.operation, 'missing consumed claim');
      const observation = facts().find(f => f.id === value.observation && f.kind === 'effect-provider-ProviderOperationObservation');
      ensure(observation && raw(observation)?.stage === 'executor-accepted' && raw(observation)?.claim === value.claim, 'receipt missing executor observation');
      const content = take(p.captures.read(value.capture));
      observationCheck(JSON.parse(content) as ProviderObservation, p.host.description);
      const f = append({ type: 'ProviderJudgmentAttemptRecord', schemaVersion: 2, id: `${q.attempt}:response`, request: q.id,
        attempt: q.attempt, phase: 'response-observed', submittedDigest: q.inputDigest, operation: value.operation,
        reservation: value.reservation, claim: value.claim, observation: value.observation, receipt: value.capture },
      [prepared.prepared.id, consumed.id, observation.id, value.claim]);
      return freeze({ owner: 'part-seven' as const, name: 'JudgmentAttemptRecord' as const, id: f.id });
    }))),
    resolve: (reference, settlement, fence) => checked('ResolveProviderJudgment', reference, () => {
      const prepared = take(readPrepared(reference, fence)), q = prepared.value;
      const response = facts().find(f => f.kind === 'judgment-provider-ProviderJudgmentAttemptRecord' && raw(f)?.request === q.id && raw(f)?.phase === 'response-observed');
      ensure(response, 'missing receipt; uncertainty retained');
      const observation = JSON.parse(take(p.captures.read(raw(response)!.receipt as Capture))) as ProviderObservation;
      ensure(observation.state === 'complete' && observation.bytes !== null, 'provider timeout or missing answer; uncertainty retained');
      const decision = take(decode('Decision', JSON.parse(observation.bytes), p.host.transport.current().decode));
      ensure(decision.floor && encoded(decision.floor.allowed).hash === q.floorDigest && 'judgment' in decision.by
        && decision.by.judgment === q.point && decision.by.route === q.route && decision.by.model === q.model, 'answer floor/route mismatch');
      ensure([...decision.conclusion.evidence, ...decision.reason.evidence].every(id => q.evidence.includes(id)), 'answer invented evidence');
      const accounting = facts().find(f => f.kind === 'transport-SettlementApplication' && raw(f)?.settlement === settlement.id && raw(f)?.unresolved === 0);
      ensure(accounting, 'unknown charge or missing Six accounting');
      return take(consumeEffectSettlement(settlement, p.boundary, s => {
        ensure(s.request === q.effectRequest && s.operation === raw(response)?.operation && s.digest === q.inputDigest, 'settlement request mismatch');
        const sf = facts().find(f => f.kind === 'effect-EffectSettlement' && raw(f)?.id === s.id); ensure(sf, 'settlement missing');
        const resolution = append({ type: 'ProviderJudgmentResolution', schemaVersion: 2, id: `${q.id}:resolution`, request: q.id, attempt: q.attempt,
          response: response.id, settlement: sf.id, accounting: accounting.id }, [response.id, sf.id, accounting.id], decision);
        return freeze({ resolution: { owner: 'part-seven', name: 'JudgmentResolution', id: resolution.id }, decision });
      }));
    }),
  } satisfies ProviderJudgmentPort);
}
