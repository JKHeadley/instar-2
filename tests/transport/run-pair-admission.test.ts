import { afterEach, expect, it } from 'vitest';
afterEach(async () => { await new Promise<void>(done => setImmediate(done)); });
import { createProductionRunAdmission, admitAcceptedProviderReply } from '../../src/transport/index.js';
import { createRunGraph } from '../../src/rungraph/index.js';
import { runProviderAnswerReplyScenario, pair } from './pair-fixture.js';
import { value, refused, privateKey } from '../facts/fixtures.js';
import { authorAndAppend } from '../../src/facts/index.js';

it('SIX-PAIR production admission commits and reconstructs the exact acceptance-backed opening on its original-Run witness', async () => {
  const s = await runProviderAnswerReplyScenario(false, { unknown: true, noStop: true, beforeOpen: true });
  const admission = createProductionRunAdmission({ authority: s.f.six, store: s.f.store, context: s.f.host.boundary });
  // G6's provider fixture has pre-existing test-only placement/Run witnesses.
  // Retain those for the original Run; exercise the actual production consumer
  // for every new reply opening and its replay witness.
  const deps = { ...s.f.deps, acceptedAnswer: s.api, admission: { ...admission,
    reservation: s.f.deps.admission.reservation,
    execution: (_run: string, ownership: any) => s.f.result(() => ({ worker: 'w', harness: 'h', ownership,
      context: { owner: 'part-two', name: 'FactEnvelope', id: s.f.fence.assignment } })),
    verify: (reference: any) => {
      const fact = s.f.all().find((f: any) => f.id === reference.id);
      return fact?.kind === 'run-opening' && fact.body.run === s.reply.id
        ? admission.verify(reference) : s.f.deps.admission.verify(reference);
    } } };
  const graph = value(createRunGraph(deps));
  const replyInput = { ...s.replyInput, ownership: { owner: 'part-six' as const, name: 'Lease' as const,
    id: s.f.fence.assignment } };
  const opened = value(graph.openAcceptedProviderReply(replyInput));
  expect(opened.run.id).toBe(s.reply.id);
  const fact = s.f.all().find((f: any) => f.kind === 'run-opening' && f.body.run === s.reply.id);
  const reference = { owner: 'part-two' as const, name: 'FactEnvelope' as const, id: fact.id };
  expect(value(admission.verify(reference))).toEqual(reference);
  const rebuilt = createProductionRunAdmission({ authority: s.f.six, store: s.f.store, context: s.f.host.boundary });
  expect(value(rebuilt.verify(reference))).toEqual(reference);
  expect(value(graph.openAcceptedProviderReply(replyInput)).run.id).toBe(s.reply.id);
}, 60_000);

it('SIX-PAIR refuses a raw signed profile append without live Five consumption, then admits the genuine neighbor', async () => {
  const s = await pair();
  const { createTransportAuthority, createTransportSpine } = await import('../../src/transport/index.js');
  let candidate: any;
  const spine = createTransportSpine(s.f.th, { context: s.f.context, privateKey }, s.f.store);
  const paused = createTransportAuthority(s.f.th, { ...spine, append: (record, required) => {
    if (record.type === 'RunPairAdmission') {
      candidate = record;
      return s.f.result(() => { throw Error('stop before append'); });
    }
    return spine.append(record, required);
  } }, s.f.host.boundary);
  refused(s.admit(paused), 'stop before append');
  expect(candidate).toBeDefined();
  refused(authorAndAppend({ kind: 'transport-RunPairAdmission', schemaVersion: 1,
    machine: s.f.th.machine, principal: JSON.parse(JSON.stringify(s.f.th.principal)),
    provenance: JSON.parse(JSON.stringify(s.f.th.principal.provenance)), at: JSON.parse(JSON.stringify(s.f.clock(100))),
    body: JSON.parse(JSON.stringify({ record: candidate })),
    required: [candidate.predecessor, candidate.opening, candidate.acceptance, candidate.obligation] },
  s.f.context, s.f.store, privateKey), 'genuine Five consumption');
  value(admitAcceptedProviderReply(s.f.six, s.replyGraph, 'pair:genuine', s.f.fence, s.run, s.policy, s.f.host.boundary));
}, 60_000);
