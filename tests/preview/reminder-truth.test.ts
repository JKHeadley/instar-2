import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, openRequests, reminderId } from './journal-test-worker.js';
import { relativeDelay, parseDatedItem } from './dated-memory.js';

const records = JSON.parse(readFileSync(new URL('./fixtures/reminder-truth-1014.json', import.meta.url), 'utf8')) as {
  update: number; request: string; sentAt: number; intakeAt: number; answerAt: number; delivered: string; outputs: string[];
}[];
const key = new Uint8Array(32).fill(67);
const zone = 'America/Los_Angeles';
const make = (record: typeof records[number], output = record.outputs.at(-1)!, fail = false, lifetime = 86400_000) => {
  const root = mkdtempSync(join(tmpdir(), 'reminder-truth-')), path = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '8968100844', chat: '7812716706', operator: '7812716706',
    grant: 'grant:reminder-truth', configurationDigest: 'sha256:reminder-truth', expires: record.intakeAt + lifetime,
    maxCalls: 30, maxReplies: 20, maxTurns: 20, maxBytes: 24000, cursor: 0 });
  const state = { now: record.intakeAt, output, stopped: false, dueCalls: 0, dueOutput: 'Put the library book by the door now.' as string | { state: 'uncertain' }, sent: [] as string[] };
  const ports = { now: () => state.now, stopped: () => state.stopped, timeZone: zone,
    model: async (input: { id: string }) => {
      if (input.id.startsWith('requested-action:')) { state.dueCalls++; return state.dueOutput; }
      return state.output;
    }, send: async (input: { text: string }) => { state.sent.push(input.text); return fail ? null : state.sent.length; }, checkOutbound: () => {} };
  let worker = createJournalWorker(journal, ports);
  const intake = (id = record.update, text = record.request) => worker.intake([{ update_id: id, message: {
    chat: { id: 7812716706, type: 'private' }, from: { id: 7812716706 }, date: Math.floor(record.sentAt / 1000), text } }]);
  return { state, intake, get journal() { return journal; }, get worker() { return worker; },
    reopen() { journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports); },
    close() { journal.close(); rmSync(root, { recursive: true, force: true }); } };
};

it('replays 840342802 with only the host refusal when its deadline is beyond the trial', async () => {
  const record = records.find(row => row.update === 840342802)!, h = make(record, undefined, false, 60_000);
  try {
    h.intake(); await h.worker.drain();
    expect(h.state.sent[0]).toContain('I did not schedule what you asked for');
    expect(h.state.sent[0]).not.toContain("I'll swap that out and remind you");
    expect(openRequests(h.journal.view)).toEqual([]);
  } finally { h.close(); }
});

it.each([false, true])('replays late 840342823 against intake, due on admission and no duplicate after restart (UNKNOWN=%s)', async unknown => {
  const record = records.find(row => row.update === 840342823)!, h = make(record, undefined, unknown);
  try {
    h.intake(); h.state.now = record.answerAt; await h.worker.drain();
    const reminder = h.journal.view.dated[0]!;
    expect(reminder).toMatchObject({ remind: true, day: '2026-10-14', time: '12:13',
      resolution: { at: record.intakeAt, instant: new Date(record.intakeAt + 60_000).toISOString() } });
    expect(h.state.sent[0]).toContain('This reminder is late');
    expect(h.state.sent[0]).not.toContain("I'll remind you here in one minute");
    expect(h.state.sent[0]).not.toContain('I will act on this once');
    expect(h.state.sent[0]).not.toContain('already passed');
    expect(h.state.sent[0]).toContain('2026-10-15'); // separate library-return date retained
    expect(h.state.dueCalls).toBe(1);
    expect(h.state.sent.some(text => text.includes('Put the library book by the door now.'))).toBe(true);
    expect(openRequests(h.journal.view)).toEqual([]);
    const count = h.state.sent.length;
    h.reopen(); await h.worker.sendRequested(); await h.worker.drain();
    expect(h.state.sent).toHaveLength(count); expect(h.state.dueCalls).toBe(1);
  } finally { h.close(); }
});

it('keeps an accepted promise, and cancellation before due prevents a later send', async () => {
  const record = records.find(row => row.update === 840342823)!, h = make(record);
  try {
    h.intake(); await h.worker.drain();
    expect(h.state.sent[0]).toContain("I'll remind you here in one minute");
    const item = openRequests(h.journal.view)[0]!;
    h.state.output = JSON.stringify({ reply: 'Cancelled.', memory: [], dated: [],
      cancelReminders: [{ id: reminderId(item), quote: 'Cancel that reminder.' }] });
    h.intake(record.update + 1, 'Cancel that reminder.'); await h.worker.drain();
    expect(h.state.sent[1]).toContain('Cancelled request');
    h.state.now += 120_000; await h.worker.sendRequested();
    expect(h.state.dueCalls).toBe(0); expect(openRequests(h.journal.view)).toEqual([]);
  } finally { h.close(); }
});

it.each(['in one minute', 'in an hour'])('uses durable intake even if the model omits the resolution: %s', async when => {
  const record = records.find(row => row.update === 840342823)!;
  const request = `Please remind me ${when} to put it by the door.`;
  const h = make({ ...record, request }, JSON.stringify({ reply: "I'll remind you.", memory: [], dated: [{ quote: request, when, remind: true }] }));
  try {
    h.intake(); h.state.now += relativeDelay(when)! + 1000; await h.worker.drain();
    expect(h.journal.view.dated[0]!.resolution!.instant).toBe(new Date(record.intakeAt + relativeDelay(when)!).toISOString());
    expect(h.state.dueCalls).toBe(1); expect(h.state.sent[0]).toContain('late');
  } finally { h.close(); }
});

it.each(['in zero minutes', 'in -1 minutes', 'in one minute or an hour', 'one day', 'in 999999999999999999 hours'])('leaves unsupported duration unresolved: %s', when => {
  expect(relativeDelay(when)).toBeUndefined();
});

it.each([840342802, 840342792])('replays the recorded Portland clock request %s without trusting a stale model clock', async update => {
  const record = records.find(row => row.update === update)!, h = make(record);
  try {
    h.intake(); h.state.now = record.answerAt; await h.worker.drain();
    expect(openRequests(h.journal.view)).toMatchObject([{ day: '2026-10-14', time: '16:40', zone, remind: true }]);
    expect(h.state.sent[0]).not.toContain('I did not schedule');
    expect(h.state.sent[0]).toContain('remind you');
  } finally { h.close(); }
});

it('does not interpret a Portland clock in another configured zone or an ambiguous clock', () => {
  expect(parseDatedItem('x', 'today at 4:40 pm, Portland time', 'today at 4:40 pm, Portland time', records[0]!.intakeAt, 'UTC').ambiguity).toBeDefined();
  expect(parseDatedItem('x', 'today at 4:40, Portland time', 'today at 4:40, Portland time', records[0]!.intakeAt, zone).ambiguity).toBe('AM or PM unspecified');
});

it.each([
  { when: 'in one minute or an hour', remind: true, refusal: true },
  { when: 'in 2400000000 hours', remind: true, refusal: true },
  { when: 'in one minute', remind: false, refusal: false },
])('does not grant an ambiguous, out-of-range or unrequested duration: $when / $remind', async row => {
  const record = records.find(item => item.update === 840342823)!;
  const request = `The book goes by the door ${row.when}.`;
  const h = make({ ...record, request }, JSON.stringify({ reply: 'I will remind you later.', memory: [],
    dated: [{ quote: request, when: row.when, remind: row.remind }] }));
  try {
    h.intake(); h.state.now += 120_000; await h.worker.drain();
    expect(openRequests(h.journal.view)).toEqual([]); expect(h.state.dueCalls).toBe(0);
    if (row.refusal) {
      expect(h.state.sent[0]).toContain('I did not schedule');
      expect(h.state.sent[0]).not.toContain('I will remind you later.');
    }
  } finally { h.close(); }
});

it('drives late admission through real recorded summary, Jev, review, delivered and empty shapes once', async () => {
  const captured = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json',
    import.meta.url), 'utf8')) as { otherShapes: { kind: string; id: string; raw: string }[] };
  expect(captured.otherShapes.map(row => row.id)).toEqual(['summary:715672480', '715672483', '715672482', '969389570',
    '969389923', 'telegram:8994258214:update:715672479', 'telegram:8994258214:update:715672550']);
  for (const shape of captured.otherShapes) {
    const record = records.find(row => row.update === 840342823)!, h = make(record);
    try {
      h.state.dueOutput = shape.kind === 'summary-uncertain' ? JSON.parse(shape.raw) as { state: 'uncertain' } : shape.raw;
      h.intake(); h.state.now = record.answerAt; await h.worker.drain();
      expect(h.state.sent[0], shape.id).toContain('This reminder is late');
      expect(h.state.dueCalls, shape.id).toBe(1);
      expect(h.journal.view.order.filter(turn => turn.requestedAction), shape.id).toHaveLength(1);
      expect(h.state.sent.every(text => text.trim().length > 0), shape.id).toBe(true);
      const count = h.state.sent.length;
      h.reopen(); await h.worker.sendRequested(); await h.worker.drain();
      expect(h.state.dueCalls, shape.id).toBe(1);
      expect(h.state.sent, shape.id).toHaveLength(count);
    } finally { h.close(); }
  }
});

it('resolves Portland today from intake even when Telegram sent it on the previous local day', async () => {
  const record = records.find(row => row.update === 840342802)!;
  const h = make({ ...record, sentAt: record.sentAt - 86400_000 });
  try {
    h.intake(); await h.worker.drain();
    expect(openRequests(h.journal.view)).toMatchObject([{ day: '2026-10-14', time: '16:40', remind: true }]);
  } finally { h.close(); }
});

it('removes a promise even when the requested date proposal fails citation validation', async () => {
  const record = records.find(row => row.update === 840342823)!;
  const h = make(record, JSON.stringify({ reply: { answer: "I'll remind you tomorrow." }, memory: [],
    dated: [{ quote: record.request, when: 'next Thursday at 3 pm', remind: true }] }));
  try {
    h.intake(); await h.worker.drain();
    expect(h.state.sent[0]).toContain('I have not saved a dated item.');
    expect(h.state.sent[0]).not.toContain("I'll remind you tomorrow.");
    expect(openRequests(h.journal.view)).toEqual([]);
  } finally { h.close(); }
});
