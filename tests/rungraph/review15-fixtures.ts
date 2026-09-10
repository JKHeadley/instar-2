import { decode } from '../../src/index.js';
import type { Json } from '../../src/index.js';
import { recordFromWire } from '../../src/rungraph/index.js';
import type { SegmentStoragePort } from '../../src/facts/index.js';
import { continuityFixture, exhaustionFixture } from './closure-fixtures.js';
import { digest, json, ref, value } from './fixtures.js';

export function transitionedContinuity(available: boolean,
  storageFactory?: (fallback: SegmentStoragePort) => SegmentStoragePort) {
  const f = continuityFixture(storageFactory);
  const running = value(f.graph.transition(f.start(f.ready, f.groundingFact)));
  const groundingFact = value(f.graph.ground(f.id, 'w', 'h', 'resume', f.lease));
  const grounding = recordFromWire((groundingFact.body as Readonly<{ record: Json }>).record) as Readonly<{ id: string }>;
  const firstReply = { operation: 'review15:reply', digest: digest('review15:reply') };
  const proposal = f.append('continuity-reply-proposal', json({ run: f.id, expected: running.head,
    grounding: groundingFact.id, inbound: f.opening.id, ...firstReply, status: 'proposed', permission: 'none' })).fact;
  const disclosure = f.append('continuity-disclosure', json({ run: f.id, grounding: groundingFact.id,
    inbound: f.opening.id, ...firstReply }), [proposal.id]).fact;
  const accounting = { ...f.accounting, id: `review15:continuity:${available ? 'available' : 'unavailable'}`,
    expected: running.head,
    grounding: { ...f.accounting.grounding, id: grounding.id, fact: ref(groundingFact) },
    firstReply, disclosure: ref(disclosure),
    prePauseCapture: { ...f.accounting.prePauseCapture, status: available ? 'available' as const : 'unavailable' as const },
    disposition: { kind: 'pending' as const, work: ref(f.opening), reason: 'capture recovery pending' } };
  if (!available) Object.assign(f.ctx.captures['message:1']!, { status: 'missing', bytes: null });
  return { ...f, running, currentGroundingFact: groundingFact, proposal, currentDisclosure: disclosure, accounting };
}

export function unknownDependencyExhaustion(storageFactory?: (fallback: SegmentStoragePort) => SegmentStoragePort) {
  const f = exhaustionFixture(storageFactory);
  const dependency = f.append('run-dependency-observation',
    json({ ...f.dependency.body as object, status: 'unknown' }), [f.dependency.id]).fact;
  const decision = value(decode('Decision', f.decisionInput({ id: 'review15:partial-conclusion',
    conclusion: { subject: f.id, predicate: 'exhaustion-conclusion', value: false, evidence: ['e1'] },
    reason: { subject: f.id, predicate: 'partial-support', value: true, evidence: ['e1', 'e2'] },
  }), f.ctx.decode));
  const decisionFact = f.append('decision-record', json({ decision }), f.evidenceFacts.map(fact => fact.id)).fact;
  const partial = { ...f.exhaustion, id: 'review15:partial-exhaustion', dependencies: [ref(dependency)],
    conclusion: { type: 'Decision' as const, id: decision.id, fact: ref(decisionFact), field: 'decision' as const } };
  const exhaustive = { ...f.exhaustion, id: 'review15:exhaustive-with-unknown', dependencies: [ref(dependency)] };
  return { ...f, currentUnknownDependency: dependency, partialDecision: decision,
    partialDecisionFact: decisionFact, partial, exhaustive };
}
