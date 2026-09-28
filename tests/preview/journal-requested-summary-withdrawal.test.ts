// @ts-nocheck -- process-level fixture; physical ports are replaced by its test loader.
// A requested summary is withdrawn by the operator's cancellation however that cancellation arrives:
// queued behind a restart (the summary waits for a successful empty poll, like reminders), or answered
// by a plain model reply (unresolved-decision recovery settles it before any send). Rules 57, 93.
import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { cutoverHarness } from './journal-cutover-harness.mjs';
import { offlineProfile, successiveWorld, OFFLINE_STORAGE_KEY } from './successive-fixture.js';
import { activeSummaryGrants, createJournalWorker, openPreviewJournal } from './journal.ts';
import { prepareJournalEnvelope } from './journal-envelope.ts';

const zone = 'America/Los_Angeles';
const isSummary = text => text.startsWith('PREVIEW summary you asked for');
const tick = async worker => { await worker.drain(); await worker.sendReminders(); };

/** A once summary created and reply-checked just before a crash, then the real launcher with `queued` waiting. */
const resumeWith = async queued => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  const trial = world.state().read().trial;
  let due = Math.floor(Date.now() / 3600_000) * 3600_000 - 3600_000;
  const localHour = at => Number(new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', hourCycle: 'h23' }).format(at));
  if (localHour(due) === 0) due -= 3600_000; // the request and its slot stay on one local day
  const start = due - 30 * 60_000;
  let now = start, crash = false;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: 'numeric', hour12: true }).formatToParts(due);
  const part = name => parts.find(item => item.type === name).value;
  const when = `${part('year')}-${part('month')}-${part('day')} at ${part('hour')} ${part('dayPeriod').toLowerCase()}`;
  const request = `send me a summary of today ${when}`;
  const update = (id, text) => ({ update_id: id, message: { chat: { id: Number(world.configuration.chatId), type: 'private' },
    from: { id: Number(world.configuration.operatorSenderId) }, text, date: Math.floor(start / 1000) + id * 60 } });
  let journal = openPreviewJournal(join(harness.liveRoot, 'journal.encrypted'), OFFLINE_STORAGE_KEY, { kind: 'genesis',
    bot: world.configuration.botId, chat: world.configuration.chatId, operator: world.configuration.operatorSenderId,
    grant: trial.id, configurationDigest: trial.configurationDigest, expires: trial.expiresAt, maxCalls: 16, maxReplies: 16,
    maxTurns: 20, maxBytes: 32768, cursor: 0 }, stage => { if (crash && stage === 'after:reply-check') { crash = false; throw Error('crash'); } });
  try {
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, timeZone: zone, checkOutbound: () => {},
      send: async () => 100, prepareModel: input => prepareJournalEnvelope(input, world.model, trial.id, now, 32768),
      model: async input => JSON.stringify(input.question.startsWith('[Scheduled summary')
        ? { reply: 'Summary: the meeting is at noon.', memory: [], dated: [] }
        : { reply: 'Okay.', memory: [], dated: [], summaries: [{ quote: request, when, period: 'today', repeat: 'once' }] }),
      replyCheck: { elapsedMs: () => 0, escalate: async () => { throw Error('unexpected review'); },
        jev: async () => ({ value: { model: 'jev-1.13.0', answers: Object.fromEntries(['raw_path', 'cli_command', 'config_key',
          'credential', 'api_endpoint', 'quits_on_self', 'claims_blocked', 'parks_on_user'].map(rule => [rule, { type: 'noul', noul: 0.01 }])) },
        latencyMs: 0 }) } });
    worker.intake([update(1, request)]); await worker.drain();
    expect(journal.view.summaryGrants).toHaveLength(1);
    now = due; crash = true;
    // The summary is prepared only at the due-send point, never by an ordinary drain.
    await worker.drain();
    expect(journal.view.order.some(turn => turn.requestedSummary)).toBe(false);
    await expect(worker.sendReminders()).rejects.toThrow('crash');
    const slot = journal.view.order.find(turn => turn.requestedSummary);
    expect(slot.intent).toBeUndefined();
    expect(slot.replyChecks?.at(-1)?.verdict).toBe('pass');
    // No model call is left, so a queued cancellation can be read but not interpreted.
    while (journal.view.calls < 16) journal.append({ kind: 'legacy-call', at: now });
    journal.close();
    harness.setUpdates(queued.map((text, index) => update(2 + index, text)));
    const run = harness.launchLive(2);
    expect(run.status, run.stderr).toBe(0);
    const events = harness.calls().filter(call => call.kind === 'poll' || call.kind === 'send');
    journal = openPreviewJournal(join(harness.liveRoot, 'journal.encrypted'), OFFLINE_STORAGE_KEY);
    return { events, journal };
  } catch (error) { journal.close(); throw error; }
  finally { rmSync(world.directory, { recursive: true, force: true }); }
};

it('regression: a resumed summary never sends before an already queued cancellation is read', async () => {
  const { events, journal } = await resumeWith(['cancel the summary']);
  try {
    expect(events.filter(call => call.kind === 'send' && isSummary(call.text))).toHaveLength(0);
    const cancel = journal.view.order.find(turn => turn.text === 'cancel the summary');
    expect(cancel.held).toBe('call cap');
    expect(journal.view.order.find(turn => turn.requestedSummary).intent).toBeUndefined();
  } finally { journal.close(); }
});

it('regression: a cancellation queued behind another update still withholds the resumed summary', async () => {
  const { events, journal } = await resumeWith(['thanks', 'cancel the summary']);
  try {
    expect(events.filter(call => call.kind === 'send' && isSummary(call.text))).toHaveLength(0);
    expect(journal.view.order.find(turn => turn.text === 'cancel the summary').held).toBe('call cap');
  } finally { journal.close(); }
});

it('sends a resumed summary exactly once, after a successful empty poll', async () => {
  const { events, journal } = await resumeWith([]);
  try {
    const sends = events.flatMap((call, index) => call.kind === 'send' && isSummary(call.text) ? [index] : []);
    expect(sends).toHaveLength(1);
    expect(events.findIndex(call => call.kind === 'poll')).toBeLessThan(sends[0]);
    expect(journal.view.order.find(turn => turn.requestedSummary).sent).toBeGreaterThan(0);
  } finally { journal.close(); }
});

const request = 'send me a summary of today every day at 6 pm';
const start = Date.UTC(2026, 8, 26, 17), due = Date.UTC(2026, 8, 27, 1), key = new Uint8Array(32).fill(31);
/** `reply` answers the operator's later message; `recovery` answers the unresolved-decision recovery summary. */
const withdrawal = async ({ later, reply, recovery }) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-withdrawal-'))), path = join(root, 'journal.encrypted');
  let now = start; const sent = [], recoveries = [];
  const ports = { now: () => now, stopped: () => false, timeZone: zone, checkOutbound: () => {},
    summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } }),
    send: async input => { sent.push(input.expectedText); return sent.length; },
    model: async input => {
      if (input.question.startsWith('[Scheduled summary')) return JSON.stringify({ reply: 'Summary: we discussed lunch.', memory: [], dated: [] });
      if (input.question === request) return JSON.stringify({ reply: 'Okay.', memory: [], dated: [],
        summaries: [{ quote: request, when: 'every day at 6 pm', period: 'today', repeat: 'daily' }] });
      const packet = JSON.parse(input.context);
      if (input.question === later) return reply(packet);
      recoveries.push(packet);
      return recovery(packet);
    } };
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:summary', configurationDigest: 'sha256:summary', expires: Date.UTC(2026, 9, 10), maxCalls: 30,
    maxReplies: 30, maxTurns: 30, maxBytes: 32768, cursor: 0 });
  try {
    let worker = createJournalWorker(journal, ports);
    const update = (id, text) => ({ update_id: id, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
      text, date: Math.floor(now / 1000) } });
    worker.intake([update(1, request)]); await worker.drain();
    if (later) { now += 60_000; worker.intake([update(2, later)]); await worker.drain(); await worker.drain(); }
    journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    now = due; await tick(worker); await tick(worker);
    const turn = journal.view.order.find(item => item.text === later);
    return { sent, recoveries, turn, cancelled: journal.view.summaryCancels.length, active: activeSummaryGrants(journal.view).length,
      summaries: sent.filter(isSummary).length };
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
};
const recoverySummary = cancelSummaries => JSON.stringify({ summary: `The operator asked: ${request}.`,
  people: [], memory: [], commitments: [], questions: [], ...(cancelSummaries ? { cancelSummaries } : {}) });

it('regression: a plain "Okay, cancelled." after "cancel the summary" never releases the summary across reopen', async () => {
  const result = await withdrawal({ later: 'cancel the summary', reply: () => 'Okay, cancelled.', recovery: () => 'Okay, cancelled.' });
  expect(result.turn.memoryPending).toBe(true);
  expect(result.cancelled).toBe(0);
  expect(result.summaries).toBe(0);
  expect(result.sent).not.toContain('PREVIEW — Okay, cancelled.');
});

it('settles a plain cancellation through recovery: the recorded cancel withdraws the summary', async () => {
  const result = await withdrawal({ later: 'cancel the summary', reply: () => 'Okay, cancelled.',
    recovery: packet => recoverySummary((packet.summaryRequests ?? []).map(grant => grant.id)) });
  expect(result.recoveries.some(packet => packet.summaryRequests?.length === 1 && packet.summaryCancelDecision)).toBe(true);
  expect(result.cancelled).toBe(1);
  expect(result.active).toBe(0);
  expect(result.summaries).toBe(0);
});

it('releases the summary after recovery records that a benign plain reply cancels nothing', async () => {
  const result = await withdrawal({ later: 'thanks', reply: () => 'You are welcome.', recovery: () => recoverySummary([]) });
  expect(result.turn.memoryPending).toBe(true);
  expect(result.cancelled).toBe(0);
  expect(result.active).toBe(1);
  expect(result.summaries).toBe(1);
});

it('cancels by a structured decision, and sends once with no cancellation', async () => {
  const structured = await withdrawal({ later: 'cancel the summary', recovery: () => { throw Error('no recovery expected'); },
    reply: packet => JSON.stringify({ reply: 'Okay, cancelled.', memory: [], dated: [], cancelSummaries: packet.summaryRequests.map(grant => grant.id) }) });
  expect(structured.cancelled).toBe(1);
  expect(structured.summaries).toBe(0);
  expect(structured.recoveries).toHaveLength(0);
  const control = await withdrawal({ later: undefined, reply: () => '', recovery: () => { throw Error('no recovery expected'); } });
  expect(control.active).toBe(1);
  expect(control.summaries).toBe(1);
});
