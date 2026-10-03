import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { activeDated, createJournalWorker, openPreviewJournal, openRequests } from './journal-test-worker.js';

/** Why this file exists. Plan row #410. Live 2026-10-03 10:21-10:58 PDT, proof room one on build cint-L39
 * 9fbc13ca, group A on a fresh root, proof checks RA3 and RA4.
 *
 * "Remind me today at 10:40 am to refill the bird feeder" and "Also remind me today at 10:40 am to call the
 * plumber" were both recorded open. "Actually, cancel the bird feeder one." begins with a memory cue, so the
 * rolling summary decided its memory question before the answer ran. The summary packet listed both reminders
 * but offered no cancel decision (that offer exists only for a held reply's recovery), and the summary model
 * expressed the withdrawal the only way it was given: a memory `forget` of the bird-feeder message. Applied, that
 * forget removed the request from every open list -- yet nothing recorded a cancellation (`cancelled` stayed 0).
 * The answer model then saw only the plumber reminder, wrote that it had no bird-feeder reminder on record, and
 * twice put prose before its JSON (malformed). The runner sent the memory acknowledgement instead: "Forgot the
 * requested information." -- naming nothing. The malformed answer then held the plumber request too, so at 10:40
 * nothing fired (RA4).
 *
 * Every model output below is the recorded one, read from a copy of the failing root's journal. postFixReplays are
 * three real-model calls on the recorded answer packet with only what this fix changes (the bird-feeder request
 * still listed): all three cancel it with the operator's words. The ids are the recorded ones: this journal uses
 * the live bot and update numbers, so the request ids match the recording byte for byte. */
type Withdrawal = { id: string; quote: string };
const fixture = JSON.parse(readFileSync(new URL('./fixtures/cancel3-live-2026-10-03.json', import.meta.url), 'utf8')) as {
  turns: { label: string; update: number; message: string; reply: string }[];
  summaryOutputAtRa3: { reply: string };
  summaryRowMemoryAtRa3: { mode: string; source: string; quote: string }[];
  answerPacketRemindersAtRa3: { id: string; quote: string }[];
  answerOutputsAtRa3: string[];
  answerRowAtRa3: { text: string; failureClass: string };
  requestedActionsAfterRa3: { requested: number; cancelled: number; open: { quote: string }[] };
  postFixReplays: { reply: string; cancelReminders: Withdrawal[] }[] };
const recorded = (label: string) => fixture.turns.find(item => item.label === label)!;
const FEEDER = recorded('ra1').message, PLUMBER = recorded('ra2').message, CANCEL = recorded('ra3').message;
const FEEDER_ID = 'reminder-b09f01c9d3';
const BOT = '8994258214', OPERATOR = 7812716706;
const turnId = (label: string) => `telegram:${BOT}:update:${recorded(label).update}`;

it('records the live forget that stood in for the cancel, and the reply and reminders it left', () => {
  // The summary decided the cancel turn's memory as a forget of the bird-feeder request message.
  const inner = JSON.parse(fixture.summaryOutputAtRa3.reply) as { memory: { mode: string; source: string; quote: string }[] };
  expect(inner.memory).toEqual([expect.objectContaining({ mode: 'forget', source: turnId('ra1'), quote: FEEDER })]);
  expect('cancelReminders' in inner).toBe(false);
  expect(fixture.summaryRowMemoryAtRa3).toEqual([expect.objectContaining({ mode: 'forget', source: turnId('ra1') })]);
  // The answer was then shown only the plumber reminder, and both its attempts were malformed.
  expect(fixture.answerPacketRemindersAtRa3.map(item => item.quote)).toEqual([PLUMBER]);
  for (const output of fixture.answerOutputsAtRa3) {
    expect(output.startsWith('{')).toBe(false);
    expect(output).toContain('"cancelReminders":[]');
  }
  expect(fixture.answerRowAtRa3.failureClass).toBe('malformed');
  // The operator was told "Forgot the requested information", which names no request; nothing was cancelled.
  expect(recorded('ra3').reply.startsWith('PREVIEW — Forgot the requested information.')).toBe(true);
  expect(recorded('ra3').reply).not.toContain('bird feeder');
  expect(fixture.requestedActionsAfterRa3).toMatchObject({ requested: 2, cancelled: 0, open: [{ quote: PLUMBER }] });
  // Shown the bird-feeder request, the same model cancels it with the operator's words, every time.
  for (const replay of fixture.postFixReplays) {
    expect(replay.cancelReminders).toHaveLength(1);
    expect(replay.cancelReminders[0]!.id).toBe(FEEDER_ID);
    expect(CANCEL).toContain(replay.cancelReminders[0]!.quote);
  }
});

const key = new Uint8Array(32).fill(71);
// 2026-10-03 10:25 America/Los_Angeles, the live clock of the recorded turns; the requests fall due at 10:40.
const START = Date.UTC(2026, 9, 3, 17, 25);
const DUE = Date.UTC(2026, 9, 3, 17, 40);
const genesis = { kind: 'genesis' as const, bot: BOT, chat: String(OPERATOR), operator: String(OPERATOR),
  grant: 'grant:cancel-not-forget', configurationDigest: 'sha256:cancel-not-forget', expires: Date.UTC(2026, 9, 10),
  maxCalls: 200, maxReplies: 100, maxTurns: 60, maxBytes: 40000, cursor: 0 };
const update = (id: number, text: string, at: number) => ({ update_id: id,
  message: { chat: { id: OPERATOR, type: 'private' }, from: { id: OPERATOR }, text, date: Math.floor(at / 1000) } });
type Input = { id: string; question: string; context: string };
const packetOf = (input: Input) => JSON.parse(input.context) as { reminders?: { id: string; quote: string }[];
  memoryRequest?: { message: string } };

/** One world. The summary on the cancel turn's span replays the recorded summary output; the cancel turn's answer
 * is `answer` given what the packet lists. Other turns get plain recorded-shape answers. */
function world(root: string, answer: (input: Input) => string, clock: { now: number }) {
  const sent: string[] = [];
  let summaryReplayed = false;
  const ports = { now: () => clock.now, stopped: () => false, timeZone: 'America/Los_Angeles',
    model: async (input: Input) => {
      if (input.id.startsWith('summary:')) {
        if (packetOf(input).memoryRequest?.message === CANCEL && !summaryReplayed) {
          summaryReplayed = true; return JSON.stringify(fixture.summaryOutputAtRa3);
        }
        return JSON.stringify({ summary: 'The operator asked for two reminders.', people: [], commitments: [],
          questions: [], memory: [], cancelReminders: [] });
      }
      if (input.question === CANCEL) return answer(input);
      return JSON.stringify({ reply: 'Got it.', memory: [],
        dated: [{ quote: input.question, when: 'today at 10:40 am', remind: true }] });
    },
    checkOutbound: () => {},
    send: async (value: { expectedText: string }) => { sent.push(value.expectedText); return sent.length; } };
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  return { journal, worker: createJournalWorker(journal, ports), sent };
}
const tmp = (name: string) => realpathSync(mkdtempSync(join(tmpdir(), `preview-cancel3-${name}-`)));
const pushes = (sent: string[]) => sent.filter(text => text.startsWith('PREVIEW — You asked on'));
/** The model as recorded: shown the bird-feeder request it cancels it (a real replay); not shown it, it answers as
 * it did live (prose before the JSON, no cancellation). */
const recordedModel = () => {
  let replay = 0, live = 0;
  return (input: Input) => (packetOf(input).reminders ?? []).some(item => item.quote === FEEDER)
    ? JSON.stringify(fixture.postFixReplays[replay++ % fixture.postFixReplays.length])
    : fixture.answerOutputsAtRa3[live++ % fixture.answerOutputsAtRa3.length]!;
};

async function replay(answer: (input: Input) => string, name: string,
  check: (w: ReturnType<typeof world>, clock: { now: number }) => Promise<void>) {
  const root = tmp(name);
  try {
    const clock = { now: START };
    const w = world(root, answer, clock);
    for (const label of ['ra1', 'ra2']) {
      w.worker.intake([update(recorded(label).update, recorded(label).message, clock.now)]); await w.worker.drain();
      clock.now += 60_000;
    }
    expect(openRequests(w.journal.view).map(item => item.quote)).toEqual([FEEDER, PLUMBER]);
    clock.now += 60_000;
    w.worker.intake([update(recorded('ra3').update, CANCEL, clock.now)]);
    await w.worker.drain(); await w.worker.drain();
    await check(w, clock);
    w.journal.close();
    const reopened = openPreviewJournal(join(root, 'journal.encrypted'), key);
    try {
      expect(reopened.view.reminderCancels).toEqual(w.journal.view.reminderCancels);
      expect(openRequests(reopened.view).map(item => item.quote)).toEqual(openRequests(w.journal.view).map(item => item.quote));
    } finally { reopened.close(); }
  } finally { rmSync(root, { recursive: true, force: true }); }
}
const fireDue = async (w: ReturnType<typeof world>, clock: { now: number }) => {
  clock.now = DUE;
  for (let pass = 0; pass < 3; pass++) { await w.worker.drain(); await w.worker.sendRequested(); }
};

it('cancels the request through the cancel decision, names it, and fires only the other one', async () => {
  await replay(recordedModel(), 'cancelled', async (w, clock) => {
    // The recorded summary ran on the cancel turn and its forget of the request message was not applied.
    expect(w.journal.view.summaries.some(summary => summary.memoryFor?.includes(turnId('ra3')))).toBe(true);
    expect(w.journal.view.memory.some(change => change.source === turnId('ra1'))).toBe(false);
    const turn = w.journal.view.order.find(item => item.text === CANCEL)!;
    expect(turn.reminderDecided).toBe(true);
    expect(turn.failureClass).toBeUndefined();
    // Recorded as a cancellation, so it is counted as one; only the plumber stays open.
    expect(w.journal.view.reminderCancels).toHaveLength(1);
    expect(openRequests(w.journal.view).map(item => item.quote)).toEqual([PLUMBER]);
    const reply = w.sent.at(-1)!;
    expect(reply).toContain(`Cancelled request: "${FEEDER}".`);
    expect(reply).not.toContain('Forgot the requested information');
    await fireDue(w, clock);
    expect(pushes(w.sent)).toHaveLength(1);
    expect(pushes(w.sent)[0]).toContain('call the plumber');
    expect(pushes(w.sent)[0]).not.toContain('bird feeder');
  });
}, 60000);

it('keeps the request open when the answer reads no withdrawal, and the forget alone never ends it', async () => {
  // Other side: shown both requests, the answer withdraws none. The summary's forget still does not end the
  // bird-feeder request, so both stand and both fire; nothing is counted cancelled.
  const none = fixture.postFixReplays[0]!;
  await replay(() => JSON.stringify({ reply: none.reply, cancelReminders: [] }), 'kept', async (w, clock) => {
    expect(w.journal.view.reminderCancels).toHaveLength(0);
    expect(openRequests(w.journal.view).map(item => item.quote)).toEqual([FEEDER, PLUMBER]);
    expect(w.sent.at(-1)!).not.toContain('Forgot the requested information');
    await fireDue(w, clock);
    expect(pushes(w.sent).join('\n')).toContain('bird feeder');
    expect(pushes(w.sent).join('\n')).toContain('call the plumber');
  });
}, 60000);

it('still applies a summary forget of a fact that carries no open request', async () => {
  // The guard is narrow: forgetting an ordinary remembered fact works exactly as before.
  const FACT = 'My garden shed padlock code is 2958.';
  const FORGET = 'Actually, forget my garden shed padlock code.';
  const root = tmp('fact');
  try {
    const clock = { now: START };
    const sent: string[] = [];
    let factId = '';
    const ports = { now: () => clock.now, stopped: () => false, timeZone: 'America/Los_Angeles',
      model: async (input: Input) => {
        if (input.id.startsWith('summary:')) {
          const forgetting = packetOf(input).memoryRequest?.message === FORGET;
          return JSON.stringify({ summary: 'The operator stated a padlock code, then asked to forget it.', people: [],
            commitments: [], questions: [], cancelReminders: [],
            memory: forgetting ? [{ mode: 'forget', source: factId, quote: FACT }] : [] });
        }
        return JSON.stringify({ reply: 'Noted.', memory: [] });
      },
      checkOutbound: () => {},
      send: async (value: { expectedText: string }) => { sent.push(value.expectedText); return sent.length; } };
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, ports);
    worker.intake([update(1, FACT, clock.now)]); await worker.drain();
    factId = journal.view.order[0]!.id;
    clock.now += 60_000;
    worker.intake([update(2, FORGET, clock.now)]); await worker.drain(); await worker.drain();
    expect(journal.view.memory).toEqual([expect.objectContaining({ mode: 'forget', source: factId, quote: FACT })]);
    expect(activeDated(journal.view)).toHaveLength(0);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);
