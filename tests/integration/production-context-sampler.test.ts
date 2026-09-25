// @ts-nocheck -- R5 real Two/Five/Ten/Seven preparation and capture joins, tamper cases and restart.
// External model IO is a SYNTHETIC in-process adapter stand-in that records the bytes it
// would receive; no provider, Telegram or network call is made in this file.
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { createFactStore } from '../../src/facts/index.js';
import { createProviderJudgmentPort } from '../../src/judgment/index.js';
import { createProductionContextSampler, groundedSubmission, verifyGroundedSubmission } from '../../src/assembly/production-context-sampler.js';
import { createJudgmentCaptures } from '../../scripts/judgment-captures.mjs';
import { SYNTHETIC_APPROVAL, acceptedSecondTurn, groundingFixture, withSeven } from '../assembly/production-context-sampler-fixture.js';
import { json, refused, value } from '../facts/fixtures.js';

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });
const QUESTION_ONE = 'What is Instar for?';
const QUESTION_TWO = 'Can this installation talk in any conversation other than this one?';
const SECOND_DETAIL = 'one pre-bound Telegram conversation';
const CONSTRAINT = 'Operator constraint: answer in at most two sentences.';
const PROPOSED_INPUT_BOUND = 12288; // the R5 proposed Seven route bound; see progress handoff

function turnOne(maxInputBytes = PROPOSED_INPUT_BOUND) {
  const f = groundingFixture(), directory = mkdtempSync(join(tmpdir(), 'r5-join-'));
  directories.push(directory);
  const s = withSeven(f, directory, maxInputBytes);
  const ready = value(f.graph.open(f.run)), ground = value(f.graph.ground(f.id, 'w', 'native', 'start', f.lease));
  const rendered = value(f.render());
  const calls: string[] = [];
  const joinInput = (prepared, bindings = f.bindings(), store = f.store, captures = f.captures, purpose = 'dispatch') => ({
    ...f.groundedInput({ store, captures, bindings }), request: prepared.value, requestFact: prepared.request.id, purpose });
  /** Synthetic adapter: the verifier runs before the stand-in external call records any bytes. */
  const invoke = (prepared, bytes, bindings = f.bindings()) => {
    value(verifyGroundedSubmission({ ...joinInput(prepared, bindings), received: bytes }));
    calls.push(bytes);
  };
  return { f, s, ready, ground, rendered, joinInput, invoke, calls, directory };
}
const submittedOf = (t, prepared) => value(t.s.captures.read(prepared.value.submitted));

describe('R5 manifest-to-Seven join', () => {
  it('Seven captures exactly the delivered manifest evidence and the adapter bytes equal that capture', () => {
    const t = turnOne();
    const prepared = value(t.s.prepareTurn(t.ready, t.ground, 'operation:1', QUESTION_ONE, t.rendered));
    const submitted = submittedOf(t, prepared);
    expect(submitted).toBe(t.s.submission(QUESTION_ONE, t.rendered).bytes);
    const joined = value(verifyGroundedSubmission(t.joinInput(prepared)));
    expect(joined.digest).toBe(prepared.value.inputDigest);
    expect(joined.rows).toBe(5);
    // Independent resolution: the persisted delivery's manifest rows and their owner facts.
    const { specification } = t.f.delivered();
    const packet = JSON.parse(JSON.parse(submitted).messages[1].content);
    for (const row of specification.contextManifest.filter(r => r.class !== 'message')) {
      const fact = value(t.f.store.read()).find(candidate => candidate.id === row.reference);
      expect(fact.contentHash).toBe(row.digest);
      expect(JSON.stringify({ items: packet.sources.find(source => source.reference === row.reference).items }))
        .toBe(fact.body.content);
    }
    expect(submitted).toContain('Make coherence something an AI cannot lose.');
    t.invoke(prepared, submitted);
    expect(t.calls).toEqual([submitted]);
  }, 60000);

  it('second turn carries the source-only detail, the pending predecessor\'s actual state and both inputs exactly once', () => {
    const t = turnOne();
    const first = value(t.s.prepareTurn(t.ready, t.ground, 'operation:1', QUESTION_ONE, t.rendered));
    t.f.nextInput(QUESTION_TWO);
    const ground = value(t.f.graph.ground(t.f.id, 'w', 'native', 'resume', t.f.lease));
    const packet = JSON.parse(value(t.f.render()));
    expect(packet.conversation.map(entry => Object.keys(entry).sort().join())).toEqual(['capture,hash,input,text', 'capture,hash,input,text']);
    expect(packet.conversation.map(entry => entry.input)).toEqual(t.f.plan.frontier);
    // The second detail is source-only: absent from every conversation turn, present in the delivered contract excerpt.
    expect(packet.conversation.some(entry => entry.text.includes(SECOND_DETAIL))).toBe(false);
    expect(packet.sources[1].items[0].content).toContain(SECOND_DETAIL);
    expect(packet.bindings.step).toBe('step:operation:2');
    // The pending predecessor contributes its inbound and its UNKNOWN pending state, not an invented reply.
    const status = JSON.parse(packet.sources[3].items[0].content);
    expect(status.pending).toEqual([{ step: 'step:operation:1', operation: 'operation:1',
      digest: first.value.inputDigest, disposition: 'unknown' }]);
    expect(packet.conversation.some(entry => 'reply' in entry)).toBe(false);
    // That status body is the one the durable delivery's manifest pins.
    const row = t.f.delivered().specification.contextManifest.find(entry => entry.class === 'pending-work');
    expect(row.reference).toBe(t.f.bodies['pending-work'].id);
    // Five itself holds new work while the predecessor is UNKNOWN, so this turn cannot reach Seven yet.
    refused(t.f.graph.transition(t.f.start(value(t.f.graph.read(t.f.id)), ground, 'operation:2')), 'state pair is not permitted');
  }, 90000);
});

describe('R5 accepted replies are resolved from Seven records (genuine offline acceptance)', () => {
  // One genuine ProviderAnswerAcceptance through the real Seven/Eight/Nine/Six chain, then
  // turn two grounded through the real Ten reader and Five. A hostile store VIEW (same
  // genuine records, one relabelled or duplicated in projection) exercises the join guards.
  let r;
  const hostile = (edit) => ({ ...r.f.store, readForProjection: () => {
    const snapshot = value(r.f.store.readForProjection());
    return r.f.success({ ...snapshot, entries: edit(snapshot.entries) });
  } });
  const relabel = (row, record) => ({ ...row, fact: { ...row.fact, body: { ...row.fact.body, record: { ...row.fact.body.record, ...record } } } });

  it('turn two\'s delivered packet carries the real accepted answer right after the input it answers, exactly once', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'r5-reply-'));
    directories.push(directory);
    r = await acceptedSecondTurn(directory, QUESTION_TWO, QUESTION_ONE);
    const acceptances = value(r.f.store.read()).filter(row => row.kind === 'judgment-provider-ProviderAnswerAcceptance');
    expect(acceptances.map(row => row.id)).toEqual([r.accepted.acceptanceFact.id]);
    const request = value(r.f.store.read()).find(row => row.kind === 'judgment-provider-ProviderJudgmentRequest'
      && row.body.record.id === r.accepted.acceptanceFact.body.record.request);
    expect([request.body.record.run, request.body.record.step]).toEqual([r.f.id, 'step:operation:1']);
    const packet = JSON.parse(r.rendered);
    expect(packet.conversation.map(entry => entry.input ?? `reply:${entry.reply}`))
      .toEqual([r.f.plan.frontier[0], `reply:${r.accepted.acceptanceFact.id}`, r.f.plan.frontier[1]]);
    expect(packet.conversation[1].text).toBe(r.accepted.answer);
    expect(packet.conversation[1].hash).toBe(r.accepted.acceptanceFact.body.record.answerDigest);
    expect(packet.bindings.manifest).toEqual(r.f.delivered().specification.contextManifest);
    // Re-rendering after a later fact is appended is identical: the reply set is frozen at the delivery fact.
    r.f.append('evidence-record', json({ evidence: r.f.evidence[0] }));
    expect(value(r.f.render())).toBe(r.rendered);
  }, 240000);

  it('refuses a reply attributed to the current input, a duplicate acceptance, or one naming no request', () => {
    const acceptance = r.accepted.acceptanceFact.id, request = r.accepted.acceptanceFact.body.record.request;
    refused(r.f.render({ store: hostile(entries => entries.map(row => row.fact.kind === 'judgment-provider-ProviderJudgmentRequest'
      && row.fact.body.record.id === request ? relabel(row, { step: 'step:operation:2' }) : row)) }),
    `accepted reply ${acceptance} does not answer an earlier delivered input`);
    refused(r.f.render({ store: hostile(entries => entries.flatMap(row => row.fact.id === acceptance
      ? [row, { ...row, fact: { ...row.fact, id: `${acceptance}:copy` } }] : [row])) }), 'has more than one accepted reply');
    refused(r.f.render({ store: hostile(entries => entries.filter(row => !(row.fact.kind === 'judgment-provider-ProviderJudgmentRequest'
      && row.fact.body.record.id === request))) }), `accepted reply ${acceptance} names no Seven request`);
    value(r.f.render());
  }, 60000);

  it('an uncertain (tainted or conflicted) required acceptance, request or delivery refuses by reference; it never disappears', () => {
    const acceptance = r.accepted.acceptanceFact.id, request = r.accepted.acceptanceFact.body.record.request;
    const turnOneDelivery = value(r.f.store.read()).find(row => row.kind === 'assembly-ContextDeliverySpecification'
      && row.body.record.run === r.f.id && row.body.record.step === 'step:operation:1').id;
    const mark = (match, field) => hostile(entries => entries.map(row => match(row) ? { ...row, [field]: ['review-uncertainty'] } : row));
    const isAcceptance = row => row.fact.id === acceptance;
    const isRequest = row => row.fact.kind === 'judgment-provider-ProviderJudgmentRequest' && row.fact.body.record.id === request;
    const isDelivery = row => row.fact.id === turnOneDelivery;
    for (const field of ['taint', 'conflicts']) for (const match of [isAcceptance, isRequest, isDelivery])
      refused(r.f.render({ store: mark(match, field) }), `accepted reply ${acceptance} of this conversation is tainted or conflicted`);
    // The unchanged genuine projection still renders the reply exactly once.
    expect(JSON.parse(value(r.f.render())).conversation.filter(entry => entry.reply)).toHaveLength(1);
  }, 60000);

  it('the sampler resolves the same join before delivery and refuses a misattributed reply there too', () => {
    const request = r.accepted.acceptanceFact.body.record.request, before = r.f.delivered().delivery.id;
    const sampler = (store) => createProductionContextSampler({ store, runtime: r.f.p.runtime, context: r.f.p.context,
      captures: r.f.captures, plan: () => r.f.plan, admitDelivery: () => { throw Error('must refuse before any delivery admission'); } });
    const read = { run: value(r.f.graph.read(r.f.id)), worker: 'w', harness: 'native', reason: 'resume', execution: {} };
    refused(sampler(hostile(entries => entries.map(row => row.fact.kind === 'judgment-provider-ProviderJudgmentRequest'
      && row.fact.body.record.id === request ? relabel(row, { step: 'step:operation:2' }) : row)))(read, r.f.deps.clock()),
    'does not answer an earlier delivered input');
    refused(sampler(hostile(entries => entries.filter(row => !(row.fact.kind === 'judgment-provider-ProviderJudgmentRequest'
      && row.fact.body.record.id === request))))(read, r.f.deps.clock()), 'names no Seven request');
    expect(r.f.delivered().delivery.id).toBe(before);
  }, 60000);
});

describe('R5 dispatch permission is re-checked against current owner state', () => {
  it('a withdrawn approval, an expired status or an unavailable source refuses dispatch; reconstruction still reads', () => {
    const t = turnOne();
    const prepared = value(t.s.prepareTurn(t.ready, t.ground, 'operation:1', QUESTION_ONE, t.rendered));
    const bytes = submittedOf(t, prepared);
    value(verifyGroundedSubmission(t.joinInput(prepared)));
    t.f.plan.approvals = [];
    refused(verifyGroundedSubmission(t.joinInput(prepared)), 'lacks current approval');
    t.f.plan.approvals = [SYNTHETIC_APPROVAL];
    t.f.time(t.f.deps.clock().value + 1001);
    refused(verifyGroundedSubmission(t.joinInput(prepared)), 'is stale');
    refused(t.f.render(), 'is stale');
    // Historical reconstruction proves the packet but grants no permission to send it.
    value(verifyGroundedSubmission(t.joinInput(prepared, t.f.bindings(), t.f.store, t.f.captures, 'reconstruct')));
    refused(verifyGroundedSubmission({ ...t.joinInput(prepared, t.f.bindings(), t.f.store, t.f.captures, 'reconstruct'), received: bytes }),
      'grants no permission');
    t.f.time(t.f.deps.clock().value - 1001);
    const read = t.f.captures.read, lost = t.f.corpus.rules[0].source.capture;
    t.f.captures.read = reference => reference === lost ? null : read(reference);
    refused(verifyGroundedSubmission(t.joinInput(prepared)), 'source capture unavailable or changed');
    t.f.captures.read = read;
    // A changed required source after delivery holds for re-preparation; bytes are never swapped under this request.
    t.f.refreshStatus();
    refused(verifyGroundedSubmission(t.joinInput(prepared)), 'hold and reprepare');
    expect(t.calls).toHaveLength(0);
  }, 90000);

  it('Seven\'s actual prepared route, not the plan\'s, is judged: an unapproved destination refuses before adapter bytes', () => {
    const t = turnOne();
    // A genuine Seven preparation of the original approved packet toward a route no source audience admits.
    t.s.host.description.route = 'route:unapproved-recipient';
    const submission = groundedSubmission({ provider: t.s.host.description.provider, model: t.s.host.description.model,
      route: t.s.host.description.route, question: QUESTION_ONE, context: t.rendered, settings: t.s.judgment.settings,
      outputSchema: t.s.judgment.outputSchema, floor: t.f.floor, evidence: [], point: 'judgment', generation: t.f.run.generation.id });
    const transition = t.f.start(t.ready, t.ground, 'operation:1');
    value(t.f.graph.transition({ ...transition, step: { ...transition.step, operation: { ...transition.step.operation, digest: submission.digest } } }));
    const prepared = value(t.s.seven.prepare({ id: 'r5-question:operation:1', run: { owner: 'part-five', name: 'Run', id: t.f.id },
      step: 'step:operation:1', ordinal: 0, semanticMessage: 'operation:1', question: QUESTION_ONE, context: t.rendered, evidence: [],
      deadline: 400 }, t.f.effects.fence));
    expect(prepared.value.route).toBe('route:unapproved-recipient');
    expect(prepared.value.route).not.toBe(t.f.plan.audience.route);
    expect(() => t.invoke(prepared, submittedOf(t, prepared))).toThrow(/not the verified model route of the current owner plan/);
    refused(verifyGroundedSubmission(t.joinInput(prepared)), 'not the verified model route of the current owner plan');
    // The same route named by the plan still refuses: no source audience admits it.
    refused(verifyGroundedSubmission({ ...t.joinInput(prepared), plan: () => ({ ...t.f.plan, audience: { ...t.f.plan.audience,
      route: 'route:unapproved-recipient' } }) }), 'is outside the verified audience or model route');
    expect(t.calls).toHaveLength(0);
  }, 90000);

  it('a consistently relabelled packet (other installation or step in packet AND bindings) refuses', () => {
    const t = turnOne();
    const other = { ...t.f.bindings(), installation: 'installation:unrelated' };
    const packet = JSON.parse(t.rendered); packet.bindings.installation = other.installation;
    const prepared = value(t.s.prepareTurn(t.ready, t.ground, 'operation:1', QUESTION_ONE, JSON.stringify(packet)));
    refused(verifyGroundedSubmission(t.joinInput(prepared, other)), 'bindings differ from the current owner plan');
    refused(verifyGroundedSubmission({ ...t.joinInput(prepared, other), plan: () => ({ ...t.f.plan, installation: other.installation }) }),
      'is outside this installation');
    refused(verifyGroundedSubmission(t.joinInput(prepared, other, t.f.store, t.f.captures, 'reconstruct')), 'is outside this installation');
    expect(t.calls).toHaveLength(0);
  }, 90000);
});

describe('R5 negative joins refuse before any adapter invocation', () => {
  const tampered = (mutate) => {
    const t = turnOne();
    const packet = JSON.parse(t.rendered); mutate(packet, t);
    const bytes = JSON.stringify(packet);
    const prepared = value(t.s.prepareTurn(t.ready, t.ground, 'operation:1', QUESTION_ONE, bytes));
    expect(() => t.invoke(prepared, submittedOf(t, prepared))).toThrow();
    expect(t.calls).toHaveLength(0);
    return refused(verifyGroundedSubmission(t.joinInput(prepared)));
  };
  it('source text removed while its digest is retained', () => {
    expect(tampered(packet => { packet.sources[0].items[0].content = ''; })).toContain('submitted source identity differs');
  }, 60000);
  it('a digest/receipt without any source text', () => {
    expect(tampered(packet => { packet.sources = packet.sources.map(({ items, ...rest }) => rest); }))
      .toContain('submitted source identity differs');
  }, 60000);
  it('a replaced body version', () => {
    expect(tampered(packet => { packet.sources[1].items[0].standing.version = 'r5-offline-v2'; }))
      .toContain('submitted source rules differs');
  }, 60000);
  it('one changed UTF-8 byte in source text', () => {
    expect(tampered(packet => { packet.sources[1].items[0].content = packet.sources[1].items[0].content.replace('draft', 'drafT'); }))
      .toContain('submitted source rules differs');
  }, 60000);
  it('one changed conversation byte and an omitted history row', () => {
    expect(tampered(packet => { packet.conversation[0].text = packet.conversation[0].text.replace('initial', 'initiaL'); }))
      .toContain('submitted input 0 differs');
    expect(tampered(packet => { packet.conversation = []; })).toContain('omits or adds a turn');
  }, 120000);
  it('another turn\'s packet replayed into this turn', () => {
    const t = turnOne();
    const prepared = value(t.s.prepareTurn(t.ready, t.ground, 'operation:1', QUESTION_ONE, t.rendered));
    t.f.nextInput(QUESTION_TWO);
    value(t.f.graph.ground(t.f.id, 'w', 'native', 'resume', t.f.lease));
    // The turn-one packet (its bindings, manifest and single input) presented against turn two's delivery.
    const second = { ...t.f.bindings(), step: 'step:operation:1' };
    expect(() => t.invoke(prepared, submittedOf(t, prepared), second)).toThrow(/bindings differ/);
    expect(t.calls).toHaveLength(0);
  }, 60000);
});

describe('R5 restart reconstruction', () => {
  it('reopens durable storage, reconstructs the same request without re-dispatch, keeps the operator constraint, then freshly samples', () => {
    const t = turnOne();
    const prepared = value(t.s.prepareTurn(t.ready, t.ground, 'operation:1', QUESTION_ONE, t.rendered));
    const original = submittedOf(t, prepared), bindings = t.f.bindings();
    // The operator constraint arrives in the second admitted input; its directive item is those exact bytes.
    const input = t.f.nextInput(`${CONSTRAINT} ${QUESTION_TWO}`, CONSTRAINT);
    value(t.f.graph.ground(t.f.id, 'w', 'native', 'resume', t.f.lease));
    const secondBindings = t.f.bindings(), second = value(t.f.render());
    // Reopen: a fresh FactStore over the same durable wire and fresh file-backed Seven captures.
    const store = createFactStore(t.f.ctx, t.f.storage);
    const reopened = createJudgmentCaptures(t.directory, {}, fn => t.f.success(fn()), 1048576, {});
    const captures = { read: reference => reference.startsWith('judgment-capture:')
      ? value(reopened.read({ reference, hash: reference.slice('judgment-capture:'.length) })) : t.f.captures.read(reference) };
    const seven = createProviderJudgmentPort({ ...t.s.judgment, store, captures: reopened });
    const recovered = value(seven.readPrepared(prepared.request));
    expect(recovered.value).toEqual(prepared.value);
    // Turn one's recorded request is reconstructed (no permission to dispatch it: the plan has moved on).
    value(verifyGroundedSubmission(t.joinInput(recovered, bindings, store, captures, 'reconstruct')));
    refused(verifyGroundedSubmission({ ...t.joinInput(recovered, bindings, store, captures), received: original }),
      'bindings differ from the current owner plan');
    expect(t.calls).toHaveLength(0);
    // Turn two's delivered packet re-renders byte-identically from the reopened store, constraint included.
    expect(value(t.f.render({ store, captures, bindings: secondBindings }))).toBe(second);
    const directive = JSON.parse(second).sources[2].items.find(item => item.content === CONSTRAINT);
    expect(directive.source.facts).toEqual([input.id]);
    expect(directive.source.capture).toBe(value(store.read()).find(row => row.id === input.id).body.capture.reference);
    // A distinct next turn is freshly sampled and still carries the constraint.
    t.f.nextInput('Third question.');
    value(t.f.graph.ground(t.f.id, 'w', 'native', 'resume', t.f.lease));
    expect(t.f.bindings().delivery).not.toBe(secondBindings.delivery);
    expect(JSON.parse(value(t.f.render())).sources[2].items.map(item => item.content)).toContain(CONSTRAINT);
  }, 120000);
});
