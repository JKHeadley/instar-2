// Build 9 repair 2 (Rule 38; scheduled work §5): the step supervisor reaches every business step — intake,
// preparation and due selection — and scheduled work is validated after its Result and before the next
// consequential step. Missing supervision stays missing; each pipeline keeps its failure direction.
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { packetDigest, STEP_SUPERVISOR_EXHAUSTED, type JournalRecord } from './journal.js';
import { readAnswer } from './answer-reading.js';
import { stepCoverage } from './proofs.js';
import { interpretStepJev, stepQuestionFor, stepQuestionsFor } from './step-check.js';

const key = new Uint8Array(32).fill(37);
const zone = 'America/Los_Angeles';
const start = Date.UTC(2026, 8, 26, 17); // Saturday 10:00 in Los Angeles.
const friday9 = Date.UTC(2026, 9, 2, 16);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:steps',
  configurationDigest: 'sha256:steps', expires: Date.UTC(2026, 9, 10), maxCalls: 40, maxReplies: 20, maxTurns: 20, maxBytes: 12000, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id, message: { chat: { id: 7654321, type: 'private' },
  from: { id: 7654321 }, text, date: Math.floor(start / 1000) + id * 60 } });
const priya = 'remind me Friday at 9 am to call Priya';
type Input = { id: string; question: string; context: string };
const decide = (input: Input) => {
  if (input.id.startsWith('requested-action:')) return JSON.stringify({ reply: 'Time to call Priya.', memory: [], dated: [] });
  if (input.question === priya) return JSON.stringify({ reply: 'Okay.', memory: [], dated: [{ quote: priya, when: 'Friday at 9 am', remind: true }] });
  return JSON.stringify({ reply: 'Noted.', memory: [], dated: [] });
};
/** Jev answers whichever step question it is asked; `score` picks the probability per step id. */
const answer = (questions: Record<string, unknown> | undefined, value: number) => ({ model: 'jev-1.13.0',
  answers: Object.fromEntries(Object.keys(questions ?? { unsupported_effect: 1 }).map(id => [id, { type: 'noul', noul: value }])) });
function world(options: { stepCheck?: 'pass' | ((step: string) => number | 'outage'); maxCalls?: number; dueDated?: unknown; dueAnswer?: string; dueAnswers?: string[] } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'business-steps-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { ...genesis, maxCalls: options.maxCalls ?? genesis.maxCalls });
  const frames: JournalRecord[] = [];
  const append = journal.append;
  journal.append = row => { frames.push(row); append(row); };
  const state = { now: start, sent: [] as string[], models: [] as string[], asked: [] as string[] };
  let dueCalls = 0;
  const score = options.stepCheck === 'pass' ? () => 0.01 : options.stepCheck;
  const worker = createJournalWorker(journal, { now: () => state.now, stopped: () => false, timeZone: zone,
    prepareModel: input => JSON.stringify({ messages: [{ role: 'context', content: input.context }, { role: 'user', content: input.question }] }),
    model: async (input: Input) => { state.models.push(input.id);
      if (input.id.startsWith('requested-action:') && options.dueAnswers !== undefined)
        return options.dueAnswers[Math.min(dueCalls++, options.dueAnswers.length - 1)]!;
      if (input.id.startsWith('requested-action:') && options.dueAnswer !== undefined) return options.dueAnswer;
      if (input.id.startsWith('requested-action:') && options.dueDated !== undefined)
        return JSON.stringify({ reply: 'Time to call Priya.', memory: [], dated: options.dueDated });
      return decide(input); }, checkOutbound: () => {},
    send: async (value: { expectedText: string }) => { state.sent.push(value.expectedText); return state.sent.length; },
    ...(score ? { stepCheck: { jev: async (text: string, questions?: Record<string, unknown>) => {
      const step = String((JSON.parse(text) as { step?: unknown }).step);
      state.asked.push(step);
      const value = score(step);
      if (value === 'outage') throw Error('Jev outage');
      return { value: answer(questions, value), latencyMs: 3 };
    } } } : {}) });
  worker.startStepChecks();
  const kinds = () => frames.map(row => row.kind === 'step-check' || row.kind === 'step-open' || row.kind === 'step-check-reserve'
    ? `${row.kind}:${row.step.split(':')[0]}` : row.kind);
  return { root, journal, worker, state, frames, kinds, close: () => { journal.close(); rmSync(root, { recursive: true, force: true }); } };
}
const row = (coverage: ReturnType<typeof stepCoverage>, pipeline: string, step: string) =>
  coverage[pipeline]!.rows.find(item => item.boundary === step)!;
const on = { replyReview: true, summaryReview: true, stepCheck: true };

it("a requested action's due selection and packet are validated before its model call, and a pass sends it", async () => {
  const w = world({ stepCheck: 'pass' });
  try {
    w.worker.intake([update(1, priya)]); await w.worker.drain();
    w.state.now = friday9; await w.worker.sendRequested();
    const due = w.journal.view.order.find(turn => turn.requestedAction)!;
    expect(due.sent).toBeDefined();
    expect(w.state.models.filter(id => id === due.id)).toHaveLength(1);
    expect(due.answerRetried).toBeUndefined();
    expect(w.state.sent.at(-1)).toMatch(/^PREVIEW — You asked on .*\nTime to call Priya\.$/u);
    // Both judgments are durable before the reservation that precedes the model call.
    const order = w.kinds(), reserveAt = w.frames.findIndex(frame => frame.kind === 'reserve' && frame.id === due.id);
    expect(order.slice(0, reserveAt)).toEqual(expect.arrayContaining(['step-check:select-due', 'step-check:prepare']));
    const select = JSON.parse(w.frames.find((frame): frame is Extract<JournalRecord, { kind: 'step-check-reserve' }> =>
      frame.kind === 'step-check-reserve' && frame.step.startsWith('select-due:'))!.evidence) as Record<string, unknown>;
    expect(select).toMatchObject({ requests: [{ request: priya, when: 'Friday at 9 am', due: '2026-10-02 09:00 America/Los_Angeles' }], moreRequests: 0 });
    const coverage = stepCoverage(w.journal.view, on);
    expect(row(coverage, 'requested-action', 'select-due')).toMatchObject({ state: 'validated', population: 1 });
    expect(row(coverage, 'requested-action', 'prepare-packet')).toMatchObject({ state: 'validated', population: 1 });
    expect(stepCoverage(w.journal.view, on)).not.toHaveProperty('requested-reminder');
  } finally { w.close(); }
});

const invalidPromise = JSON.stringify({ reply: 'Time to call Priya.', memory: [], dated: [], promises: [{ quote: 'not in this reply' }] });
const validRepair = JSON.stringify({ reply: 'Time to call Priya.', memory: [], dated: [] });

it.each([validRepair, invalidPromise])('a declaration retry validates its replacement packet before calling and sends once: %s', async replacement => {
  const w = world({ stepCheck: 'pass', dueAnswers: [invalidPromise, replacement] });
  try {
    w.worker.intake([update(1, priya)]); await w.worker.drain();
    w.state.now = friday9; await w.worker.sendRequested(); await w.worker.sendRequested();
    const due = w.journal.view.order.find(turn => turn.requestedAction)!;
    expect(due.sent).toBeDefined();
    expect(due.answerRetried).toBe(true);
    expect(w.state.models.filter(id => id === due.id)).toHaveLength(2);
    expect(w.state.sent.filter(text => text.startsWith('PREVIEW — You asked on'))).toHaveLength(1);
    expect(w.journal.view.commitments.filter(item => item.agentPromise)).toHaveLength(0);
    const retryAt = w.frames.findIndex(frame => frame.kind === 'format-retry' && frame.id === due.id);
    const digest = packetDigest(due.prompt!);
    for (const prefix of ['select-due', 'prepare']) {
      const checks = w.frames.filter((frame): frame is Extract<JournalRecord, { kind: 'step-check' }> =>
        frame.kind === 'step-check' && frame.step.startsWith(`${prefix}:${due.id}:`));
      expect(checks).toHaveLength(2);
      expect(checks[0]!.step).not.toBe(checks[1]!.step);
      expect(checks[1]).toMatchObject({ step: `${prefix}:${due.id}:${digest}`, result: { verdict: 'pass' } });
      expect(w.frames.indexOf(checks[1]!)).toBeLessThan(retryAt);
    }
    const coverage = stepCoverage(w.journal.view, on);
    expect(row(coverage, 'requested-action', 'select-due')).toMatchObject({ state: 'validated', population: 1 });
    expect(row(coverage, 'requested-action', 'prepare-packet')).toMatchObject({ state: 'validated', population: 1 });
  } finally { w.close(); }
});

it.each(['select-due', 'prepare'])('refused or unavailable replacement %s holds before a retry call and survives reopen', async boundary => {
  for (const [verdict, reason] of [[0.95, 'step check violation'], ['outage', 'step check unavailable']] as const) {
    let checks = 0;
    const w = world({ dueAnswers: [invalidPromise, validRepair], stepCheck: step =>
      step.startsWith(`${boundary}:requested-action:`) && ++checks === 2 ? verdict : 0.01 });
    try {
      w.worker.intake([update(1, priya)]); await w.worker.drain();
      w.state.now = friday9; await w.worker.sendRequested(); await w.worker.sendRequested();
      const due = w.journal.view.order.find(turn => turn.requestedAction)!;
      expect(due.held).toBe(reason);
      expect(due.answerRetried).toBeUndefined();
      expect(due.intent).toBeUndefined();
      expect(w.state.models.filter(id => id === due.id)).toHaveLength(1);
      expect(w.frames.filter(frame => frame.kind === 'format-retry' && frame.id === due.id)).toEqual([]);
      expect(w.state.sent.filter(text => text.startsWith('PREVIEW — You asked on'))).toEqual([]);
      const replay = openPreviewJournal(join(w.root, 'journal.encrypted'), key, undefined, undefined, true);
      try { expect(replay.view.turns.get(due.id)?.held).toBe(reason); } finally { replay.close(); }
    } finally { w.close(); }
  }
});

it('recorded invalid fulfillment 715674119 reaches replacement supervision in a requested action', async () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/flap-a-declarations-2026-10-04.json', import.meta.url), 'utf8')) as {
    rows: { row: { kind: string; id: string; output?: string } }[] };
  const recorded = fixture.rows.find(item => item.row.kind === 'model-call' && item.row.id.endsWith(':715674119'))!.row;
  const reading = readAnswer(recorded.output!, { wrapped: 'accept' });
  if (!reading.ok) throw Error(reading.defect);
  const w = world({ stepCheck: 'pass', dueAnswers: [reading.value, validRepair] });
  try {
    w.worker.intake([update(1, priya)]); await w.worker.drain();
    w.state.now = friday9; await w.worker.sendRequested();
    const due = w.journal.view.order.find(turn => turn.requestedAction)!;
    expect(due.answerRetried).toBe(true);
    expect(due.prompt).toContain('not the old promise');
    expect(w.state.models.filter(id => id === due.id)).toHaveLength(2);
    expect(due.sent).toBeDefined();
    expect(row(stepCoverage(w.journal.view, on), 'requested-action', 'select-due').state).toBe('validated');
    expect(row(stepCoverage(w.journal.view, on), 'requested-action', 'prepare-packet').state).toBe('validated');
  } finally { w.close(); }
});

it.each([null, 'invalid declaration', [{ quote: priya, when: 'Friday at 9 am', remind: true }]])(
  'a runner-authored due turn ignores dated=%j without a retry or new operator authority', async dueDated => {
    const w = world({ stepCheck: 'pass', dueDated });
    try {
      w.worker.intake([update(1, priya)]); await w.worker.drain();
      const dates = w.journal.view.dated.map(item => ({ ...item }));
      w.state.now = friday9; await w.worker.sendRequested(); await w.worker.sendRequested();
      const due = w.journal.view.order.find(turn => turn.requestedAction)!;
      expect(w.state.models.filter(id => id === due.id)).toHaveLength(1);
      expect(due.answerRetried).toBeUndefined();
      expect(w.journal.view.dated).toEqual(dates);
      expect(w.state.sent.filter(text => text.startsWith('PREVIEW — You asked on'))).toHaveLength(1);
      const coverage = stepCoverage(w.journal.view, on);
      expect(row(coverage, 'requested-action', 'select-due')).toMatchObject({ state: 'validated', population: 1 });
      expect(row(coverage, 'requested-action', 'prepare-packet')).toMatchObject({ state: 'validated', population: 1 });
    } finally { w.close(); }
  });

it('recorded dated output 6232376 grants no new date and needs no repair on a runner-authored due turn', async () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/flap-a-declarations-2026-10-04.json', import.meta.url), 'utf8')) as {
    rows: { row: { kind: string; id: string; output?: string } }[] };
  const recorded = fixture.rows.find(item => item.row.kind === 'model-call' && item.row.id.endsWith(':6232376'))!.row;
  const reading = readAnswer(recorded.output!, { wrapped: 'accept' });
  if (!reading.ok) throw Error(reading.defect);
  const w = world({ stepCheck: 'pass', dueAnswer: reading.value });
  try {
    w.worker.intake([update(1, priya)]); await w.worker.drain();
    const dates = w.journal.view.dated.map(item => ({ ...item }));
    w.state.now = friday9; await w.worker.sendRequested();
    const due = w.journal.view.order.find(turn => turn.requestedAction)!;
    expect(due.sent).toBeDefined();
    expect(w.state.models.filter(id => id === due.id)).toHaveLength(1);
    expect(due.answerRetried).toBeUndefined();
    expect(w.journal.view.dated).toEqual(dates);
    expect(row(stepCoverage(w.journal.view, on), 'requested-action', 'select-due').state).toBe('validated');
  } finally { w.close(); }
});

it('a requested action fails closed: a violation or an unavailable check holds it with no model call', async () => {
  for (const [verdict, reason] of [[0.95, 'step check violation'], ['outage', 'step check unavailable']] as const) {
    const w = world({ stepCheck: step => step.startsWith('select-due:') ? verdict : 0.01 });
    try {
      w.worker.intake([update(1, priya)]); await w.worker.drain();
      w.state.now = friday9; await w.worker.sendRequested(); await w.worker.sendRequested();
      const due = w.journal.view.order.find(turn => turn.requestedAction)!;
      expect(due).toMatchObject({ held: reason, reserved: false });
      expect(w.state.models.filter(id => id === due.id)).toEqual([]);
      expect(w.state.asked.filter(step => step.startsWith('select-due:'))).toHaveLength(1);
      expect(w.state.sent.filter(text => text.startsWith('PREVIEW — You asked on'))).toEqual([]);
    } finally { w.close(); }
  }
});

it('with the step supervisor off, a requested action still answers and its steps are missing, never validated', async () => {
  const w = world();
  try {
    w.worker.intake([update(1, priya)]); await w.worker.drain();
    w.state.now = friday9; await w.worker.sendRequested();
    expect(w.state.sent.filter(text => text.startsWith('PREVIEW — You asked on'))).toHaveLength(1);
    expect(w.frames.some(frame => frame.kind === 'step-open' || frame.kind === 'step-check-start')).toBe(false);
    const coverage = stepCoverage(w.journal.view, { ...on, stepCheck: false });
    expect(row(coverage, 'requested-action', 'select-due').state).toBe('missing');
  } finally { w.close(); }
});

it('reply intake and preparation are each judged by their own question and evidence, and stay missing when unobserved', async () => {
  const w = world({ stepCheck: 'pass' });
  try {
    w.worker.intake([update(1, 'what is on for today')]); await w.worker.drain(); await w.worker.checkSteps();
    const id = 'telegram:12345678:update:1';
    const evidence = (step: string) => JSON.parse(w.frames.find((frame): frame is Extract<JournalRecord, { kind: 'step-check-reserve' }> =>
      frame.kind === 'step-check-reserve' && frame.step === step)!.evidence) as Record<string, unknown>;
    expect(evidence(`intake:${id}`)).toMatchObject({ admitted: true, recorded: { sender: '7654321', chat: '7654321', chatType: 'private' },
      binding: { operator: '7654321', chat: '7654321' } });
    expect(evidence(`prepare:${id}`)).toMatchObject({ request: 'what is on for today', packetClipped: false });
    expect(String(evidence(`prepare:${id}`).packet)).toContain('what is on for today');
    const coverage = stepCoverage(w.journal.view, on);
    expect(row(coverage, 'operator-reply', 'intake')).toMatchObject({ state: 'validated', population: 1 });
    expect(row(coverage, 'operator-reply', 'prepare-packet')).toMatchObject({ state: 'validated', population: 1 });
    // No reply reviewer runs in this world: the steps only it reaches stay missing.
    expect(row(coverage, 'operator-reply', 'send').state).toBe('missing');
    // The same journal read with the supervisor off contributes nothing.
    expect(row(stepCoverage(w.journal.view, { ...on, stepCheck: false }), 'operator-reply', 'intake').state).toBe('missing');
  } finally { w.close(); }
});

it('an exhausted-budget judgment is refused while budget remains, and a requested action at an exhausted budget still holds (closed direction)', async () => {
  const w = world({ stepCheck: 'pass' });
  try {
    expect(() => { w.journal.append({ kind: 'step-open', step: 'select-due:requested-action:0:0123456789abcdef', at: start });
      w.journal.append({ kind: 'step-check', step: 'select-due:requested-action:0:0123456789abcdef', at: start,
        result: { verdict: 'unavailable', reason: STEP_SUPERVISOR_EXHAUSTED, score: null, latencyMs: 0 } }); }).toThrow(/step check result order/u);
  } finally { w.close(); }
  const x = world({ stepCheck: 'pass', maxCalls: 4 });
  try {
    x.worker.intake([update(1, priya)]); await x.worker.drain(); await x.worker.checkSteps();
    x.state.now = friday9; await x.worker.sendRequested(); await x.worker.sendRequested();
    const due = x.journal.view.order.find(turn => turn.requestedAction)!;
    expect(due.held).toBeDefined();
    expect(due.reserved).toBe(false);
    expect(x.state.models.filter(id => id === due.id)).toEqual([]);
  } finally { x.close(); }
});

it('real-Jev-shaped answers to the per-step questions: the requested key decides; an answer under another key is unavailable (live risk)', () => {
  // Each request names exactly one question (stepQuestionsFor); Jev is told the question in the request, not a system prompt.
  expect(Object.keys(stepQuestionsFor('select-due:requested-action:0:1'))).toEqual(['not_due']);
  const jev = (answers: Record<string, unknown>) => ({ model: 'jev-1.13.0', answers, usage: { input_tokens: 812, output_tokens: 4 } });
  const question = stepQuestionFor('select-due:requested-action:0:1');
  expect(interpretStepJev(jev({ not_due: { type: 'noul', noul: 0.04 } }), 310, question)).toMatchObject({ verdict: 'pass', score: 0.04 });
  // A confident not-due on a genuinely due request keeps it unsent (the calibration risk the desk watches on a step-check launch).
  expect(interpretStepJev(jev({ not_due: { type: 'noul', noul: 0.91 } }), 310, question)).toMatchObject({ verdict: 'violation' });
  expect(interpretStepJev(jev({ not_due: { type: 'noul', noul: 0.5 } }), 310, question)).toMatchObject({ verdict: 'unsure' });
  // Answered under the old generic key, or as a word: malformed, recorded as an unavailable check by the runner.
  expect(() => interpretStepJev(jev({ unsupported_effect: { type: 'noul', noul: 0.04 } }), 310, question)).toThrow('malformed');
  expect(() => interpretStepJev(jev({ not_due: { type: 'noul', noul: 'no' } }), 310, question)).toThrow('malformed');
});
