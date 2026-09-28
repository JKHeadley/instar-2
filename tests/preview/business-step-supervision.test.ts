// Build 9 repair 2 (Rule 38; scheduled work §5): the step supervisor reaches every business step — intake,
// preparation, due selection and reminder text — and scheduled work is validated after its Result and before
// the next consequential step. Missing supervision stays missing; each pipeline keeps its failure direction.
import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { STEP_SUPERVISOR_EXHAUSTED, type JournalRecord } from './journal.js';
import { stepCoverage } from './proofs.js';

const key = new Uint8Array(32).fill(37);
const zone = 'America/Los_Angeles';
const start = Date.UTC(2026, 8, 26, 17); // Saturday 10:00 in Los Angeles.
const friday9 = Date.UTC(2026, 9, 2, 16);
const sixPm = Date.UTC(2026, 8, 27, 1);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:steps',
  configurationDigest: 'sha256:steps', expires: Date.UTC(2026, 9, 10), maxCalls: 40, maxReplies: 20, maxTurns: 20, maxBytes: 12000, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id, message: { chat: { id: 7654321, type: 'private' },
  from: { id: 7654321 }, text, date: Math.floor(start / 1000) + id * 60 } });
const priya = 'remind me Friday at 9 am to call Priya';
const daily = 'send me a summary of today every day at 6 pm';
type Input = { id: string; question: string; context: string };
const decide = (input: Input) => {
  if (input.question.startsWith('[Scheduled summary')) return JSON.stringify({ reply: 'The day in brief.', memory: [], dated: [] });
  if (input.question === priya) return JSON.stringify({ reply: 'Okay.', memory: [], dated: [{ quote: priya, when: 'Friday at 9 am', remind: true }] });
  if (input.question === daily) return JSON.stringify({ reply: 'Okay.', memory: [], dated: [],
    summaries: [{ quote: daily, when: 'every day at 6 pm', period: 'today', repeat: 'daily' }] });
  return JSON.stringify({ reply: 'Noted.', memory: [], dated: [] });
};
/** Jev answers whichever step question it is asked; `score` picks the probability per step id. */
const answer = (questions: Record<string, unknown> | undefined, value: number) => ({ model: 'jev-1.13.0',
  answers: Object.fromEntries(Object.keys(questions ?? { unsupported_effect: 1 }).map(id => [id, { type: 'noul', noul: value }])) });
function world(options: { stepCheck?: 'pass' | ((step: string) => number | 'outage'); maxCalls?: number } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'business-steps-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { ...genesis, maxCalls: options.maxCalls ?? genesis.maxCalls });
  const frames: JournalRecord[] = [];
  const append = journal.append;
  journal.append = row => { frames.push(row); append(row); };
  const state = { now: start, sent: [] as string[], models: [] as string[], asked: [] as string[] };
  const score = options.stepCheck === 'pass' ? () => 0.01 : options.stepCheck;
  const worker = createJournalWorker(journal, { now: () => state.now, stopped: () => false, timeZone: zone,
    prepareModel: input => JSON.stringify({ messages: [{ role: 'context', content: input.context }, { role: 'user', content: input.question }] }),
    model: async (input: Input) => { state.models.push(input.id); return decide(input); }, checkOutbound: () => {},
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

it('a reminder is validated (due selection, then its line) before its send; a pass sends it and both steps are validated', async () => {
  const w = world({ stepCheck: 'pass' });
  try {
    w.worker.intake([update(1, priya)]); await w.worker.drain();
    w.state.now = friday9; await w.worker.sendReminders();
    expect(w.state.sent.filter(text => text.startsWith('PREVIEW reminder'))).toHaveLength(1);
    const order = w.kinds();
    expect(order.indexOf('step-check:reminder-due')).toBeGreaterThan(-1);
    expect(order.indexOf('step-check:reminder-send')).toBeLessThan(order.indexOf('requested-reminder-intent'));
    const reminder = stepCoverage(w.journal.view, on)['requested-reminder']!;
    expect(reminder.rows.map(item => [item.boundary, item.state])).toEqual([['select-due', 'validated'], ['send', 'validated']]);
  } finally { w.close(); }
});

it('a reminder whose line is judged unfaithful stays unsent (failed); an unavailable check lets it send (open direction)', async () => {
  const flagged = world({ stepCheck: step => step.startsWith('reminder-send:') ? 0.97 : 0.01 });
  try {
    flagged.worker.intake([update(1, priya)]); await flagged.worker.drain();
    flagged.state.now = friday9; await flagged.worker.sendReminders(); await flagged.worker.sendReminders();
    expect(flagged.state.sent.filter(text => text.startsWith('PREVIEW reminder'))).toEqual([]);
    expect(flagged.state.asked.filter(step => step.startsWith('reminder-'))).toHaveLength(2); // judged once, never re-asked
    expect([...flagged.journal.view.stepChecks].filter(([id]) => id.startsWith('reminder-send:')).map(([, item]) => item.result?.verdict))
      .toEqual(['violation']);
  } finally { flagged.close(); }
  const outage = world({ stepCheck: step => step.startsWith('reminder-') ? 'outage' : 0.01 });
  try {
    outage.worker.intake([update(1, priya)]); await outage.worker.drain();
    outage.state.now = friday9; await outage.worker.sendReminders();
    expect(outage.state.sent.filter(text => text.startsWith('PREVIEW reminder'))).toHaveLength(1);
    const reminder = stepCoverage(outage.journal.view, on)['requested-reminder']!;
    expect(reminder.failureDirection).toBe('open');
    expect(reminder.rows.map(item => item.state)).toEqual(['unavailable', 'unavailable']);
  } finally { outage.close(); }
});

it('with the step supervisor off, a reminder still sends and its steps are missing, never validated', async () => {
  const w = world();
  try {
    w.worker.intake([update(1, priya)]); await w.worker.drain();
    w.state.now = friday9; await w.worker.sendReminders();
    expect(w.state.sent.filter(text => text.startsWith('PREVIEW reminder'))).toHaveLength(1);
    expect(w.frames.some(frame => frame.kind === 'step-open' || frame.kind === 'step-check-start')).toBe(false);
    const reminder = stepCoverage(w.journal.view, { ...on, stepCheck: false })['requested-reminder']!;
    expect(reminder.rows.map(item => item.state)).toEqual(['missing', 'missing']);
  } finally { w.close(); }
});

it("a requested summary's due selection and packet are validated before its model call, and a pass sends it", async () => {
  const w = world({ stepCheck: 'pass' });
  try {
    w.worker.intake([update(1, daily)]); await w.worker.drain();
    w.state.now = sixPm; await w.worker.sendReminders();
    const summary = w.journal.view.order.find(turn => turn.requestedSummary)!;
    expect(summary.sent).toBeDefined();
    // Both judgments are durable before the reservation that precedes the model call.
    const order = w.kinds(), reserveAt = w.frames.findIndex(frame => frame.kind === 'reserve' && frame.id === summary.id);
    expect(order.slice(0, reserveAt)).toEqual(expect.arrayContaining(['step-check:select-due', 'step-check:prepare']));
    const coverage = stepCoverage(w.journal.view, on);
    expect(row(coverage, 'requested-summary', 'select-due')).toMatchObject({ state: 'validated', population: 1 });
    expect(row(coverage, 'requested-summary', 'prepare-packet')).toMatchObject({ state: 'validated', population: 1 });
  } finally { w.close(); }
});

it('a requested summary fails closed: a violation or an unavailable check holds it with no model call', async () => {
  for (const [verdict, reason] of [[0.95, 'step check violation'], ['outage', 'step check unavailable']] as const) {
    const w = world({ stepCheck: step => step.startsWith('select-due:') ? verdict : 0.01 });
    try {
      w.worker.intake([update(1, daily)]); await w.worker.drain();
      w.state.now = sixPm; await w.worker.sendReminders(); await w.worker.sendReminders();
      const summary = w.journal.view.order.find(turn => turn.requestedSummary)!;
      expect(summary).toMatchObject({ held: reason, reserved: false });
      expect(w.state.models.filter(id => id === summary.id)).toEqual([]);
      expect(w.state.asked.filter(step => step.startsWith('select-due:'))).toHaveLength(1);
    } finally { w.close(); }
  }
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

it('an exhausted supervisor budget records the unjudged reminder step unavailable with no call, and the reminder still sends (open direction)', async () => {
  // Astra round-2 MF3: at maxCalls 4 the ordinary steps and the reminder's due selection spend the budget.
  for (const cap of [4, 40]) {
    const w = world({ stepCheck: 'pass', maxCalls: cap });
    try {
      w.worker.intake([update(1, priya)]); await w.worker.drain(); await w.worker.checkSteps();
      w.state.now = friday9; await w.worker.sendReminders(); await w.worker.sendReminders();
      expect(w.state.sent.filter(text => text.startsWith('PREVIEW reminder'))).toHaveLength(1);
      const send = [...w.journal.view.stepChecks].find(([id]) => id.startsWith('reminder-send:'))![1];
      const reminder = stepCoverage(w.journal.view, on)['requested-reminder']!;
      if (cap === 4) {
        expect(send).toMatchObject({ result: { verdict: 'unavailable', reason: STEP_SUPERVISOR_EXHAUSTED } });
        expect(send.reserved).toBeUndefined();
        expect(w.state.asked.filter(step => step.startsWith('reminder-send:'))).toEqual([]);
        expect(row({ 'requested-reminder': reminder }, 'requested-reminder', 'send')).toMatchObject({ state: 'unavailable', population: 1 });
        // The exhausted judgment replays from the durable journal.
        const copy = openPreviewJournal(join(w.root, 'journal.encrypted'), key, undefined, undefined, true);
        try { expect(copy.view.stepChecks.get([...w.journal.view.stepChecks.keys()].find(id => id.startsWith('reminder-send:'))!)?.result?.reason)
          .toBe(STEP_SUPERVISOR_EXHAUSTED); } finally { copy.close(); }
      } else {
        expect(send.result?.verdict).toBe('pass');
        expect(reminder.rows.map(item => [item.boundary, item.state])).toEqual([['select-due', 'validated'], ['send', 'validated']]);
      }
    } finally { w.close(); }
  }
});

it('an exhausted-budget judgment is refused while budget remains, and a requested summary at an exhausted budget still holds (closed direction)', async () => {
  const w = world({ stepCheck: 'pass' });
  try {
    expect(() => { w.journal.append({ kind: 'step-open', step: 'reminder-due:reminder-0123456789', at: start });
      w.journal.append({ kind: 'step-check', step: 'reminder-due:reminder-0123456789', at: start,
        result: { verdict: 'unavailable', reason: STEP_SUPERVISOR_EXHAUSTED, score: null, latencyMs: 0 } }); }).toThrow(/step check result order/u);
  } finally { w.close(); }
  const x = world({ stepCheck: 'pass', maxCalls: 4 });
  try {
    x.worker.intake([update(1, daily)]); await x.worker.drain(); await x.worker.checkSteps();
    x.state.now = sixPm; await x.worker.sendReminders(); await x.worker.sendReminders();
    const summary = x.journal.view.order.find(turn => turn.requestedSummary)!;
    expect(summary.held).toBeDefined();
    expect(summary.reserved).toBe(false);
    expect(x.state.models.filter(id => id === summary.id)).toEqual([]);
  } finally { x.close(); }
});
