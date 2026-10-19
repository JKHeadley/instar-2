import type { FactEnvelope, FactStorePort } from '../facts/index.js';
import type { RunGraphPort } from './types.js';
import { encoded, freeze, need, object, same } from './boundary.js';
import { recordFromWire } from './records.js';
const readRecordFact = (fact: FactEnvelope) => recordFromWire(object(fact.body).record!);

/** Five's durable join, consumed only from a verified same-store prefix. */
export interface AcceptedReplyOpening {
  readonly opening: string; readonly acceptance: string; readonly provider: string;
  readonly reply: string; readonly predecessor: string; readonly obligation: string;
  readonly operation: string; readonly answerDigest: string; readonly conversation: string;
}
export function acceptedReplyOpening(facts: readonly FactEnvelope[], reply: string): AcceptedReplyOpening {
  const opening = facts.find(f => f.kind === 'run-opening' && object(f.body).run === reply);
  need(opening, 'accepted reply Run opening absent');
  const run = object(readRecordFact(opening));
  const acceptance = facts.find(f => f.id === object(run.opening).id
    && f.kind === 'judgment-provider-ProviderAnswerAcceptance');
  need(acceptance, 'Run is not an accepted provider reply');
  const a = object(object(acceptance.body).record);
  const request = facts.find(f => f.kind === 'judgment-provider-ProviderJudgmentRequest'
    && object(object(f.body).record).id === a.request);
  need(request, 'accepted reply provider request absent');
  const q = object(object(request.body).record);
  const effect = facts.find(f => f.kind === 'effect-provider-ProviderEffectRequest'
    && object(object(f.body).record).id === q.effectRequest);
  need(effect, 'accepted reply provider operation absent');
  const e = object(object(effect.body).record);
  const original = facts.find(f => f.kind === 'run-opening' && object(f.body).run === q.run);
  const obligation = facts.find(f => f.id === e.obligation && f.kind === 'transport-LoopRecord');
  need(original && obligation && object(object(obligation.body).record).run === q.run,
    'accepted reply original Run or conversation obligation differs');
  const parent = object(readRecordFact(original));
  need(same(run.resultDestination, parent.resultDestination) && same(run.owner, parent.owner)
    && same(run.scope, parent.scope) && same(run.generation, parent.generation),
  'accepted reply original conversation or accountability differs');
  need(opening.predecessors.required.includes(acceptance.id)
    && opening.predecessors.required.includes(obligation.id), 'accepted reply opening lacks causal closure');
  need(typeof q.run === 'string' && typeof q.predecessor === 'string'
    && typeof a.operation === 'string' && typeof a.answerDigest === 'string', 'accepted reply cause malformed');
  return freeze({ opening: opening.id, acceptance: acceptance.id, provider: q.run, reply,
    predecessor: q.predecessor, obligation: obligation.id, operation: a.operation,
    answerDigest: a.answerDigest, conversation: encoded(run.resultDestination).hash });
}

/** Pure projection of owner-validated same-store facts; this grants no authority. */
export function acceptedReplyPreviewText(facts: readonly FactEnvelope[], replyRun: string): string {
  const join = acceptedReplyOpening(facts, replyRun);
  const acceptance = facts.find(f => f.id === join.acceptance
    && f.kind === 'judgment-provider-ProviderAnswerAcceptance');
  need(acceptance, 'preview acceptance absent');
  const body = object(acceptance.body);
  need(object(body.record).answerDigest === join.answerDigest, 'preview answer digest differs');
  const conclusion = object(object(body.decision).conclusion);
  need(conclusion.subject === 'preview-stage2-answer' && conclusion.predicate === 'answer-text'
    && typeof conclusion.value === 'string' && conclusion.value.length > 0, 'preview answer conclusion differs');
  const text = conclusion.value;
  need(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text), 'preview answer contains unsupported controls');
  const rendered = text.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
  need(new TextEncoder().encode(rendered).length <= 4096, 'preview answer exceeds byte bound');
  return rendered;
}

const graphs = new WeakMap<object, { store: FactStorePort; read: (run: string) => AcceptedReplyOpening }>();
// Internal constructor registration; no caller role or structural port grants authority.
export function bindAcceptedReplyGraph(graph: RunGraphPort, store: FactStorePort,
  read: (run: string) => AcceptedReplyOpening): void { graphs.set(graph, { store, read }); }
export function consumeAcceptedReplyOpening<T>(graph: RunGraphPort, store: FactStorePort,
  run: string, consumer: (opening: AcceptedReplyOpening) => T): T {
  const owner = graphs.get(graph);
  need(owner?.store === store, 'genuine same-store Five accepted-reply consumer required');
  return consumer(owner.read(run));
}
