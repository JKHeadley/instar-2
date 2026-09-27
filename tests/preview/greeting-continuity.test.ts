import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { greetingContinuity } from './greeting-continuity.js';
import type { RunLog } from './self-state.js';

const key = new Uint8Array(32).fill(28);
const hour = 3_600_000;
const start = 1_790_000_000_000;
const quote = 'Please remember to revisit the garden plan.';
const update = (id: number, text: string, at: number, from = 7) => ({ update_id: id,
  message: { chat: { id: 7, type: 'private' }, from: { id: from }, text, date: Math.floor(at / 1000) } });

function world(initialQuote = quote, summarize = true) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-greeting-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '8', chat: '7',
    operator: '7', grant: 'trial', configurationDigest: 'sha256:test', expires: start + 100 * hour,
    maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 32768, cursor: 0 });
  const append = (id: number, text: string, at: number, from = 7) => {
    const raw = JSON.stringify(update(id, text, at, from));
    const turnId = `telegram:8:update:${id}`;
    journal.append({ kind: 'intake', id: turnId, update: id, text, raw, accepted: from === 7, cursor: id + 1, at });
    return journal.view.turns.get(turnId)!;
  };
  const previous = append(1, initialQuote, start);
  if (summarize) {
    journal.append({ kind: 'summary-reserve', through: 1, at: start + 1 });
    journal.append({ kind: 'summary', through: 1, text: initialQuote,
      commitments: [{ in: 'message', source: previous.id, quote: initialQuote }], at: start + 2 });
  }
  const close = () => {
    journal.close(); rmSync(root, { recursive: true, force: true });
  };
  return { journal, append, previous, close };
}

it('selects the latest open source turn even when summary commitments are reversed', () => {
  const w = world(quote, false);
  try {
    const kitchen = 'Please remember to revisit the kitchen plan.';
    const later = w.append(2, kitchen, start + hour);
    w.journal.append({ kind: 'summary-reserve', through: 2, at: start + hour + 1 });
    w.journal.append({ kind: 'summary', through: 2, text: `${quote} ${kitchen}`,
      commitments: [{ in: 'message', source: later.id, quote: kitchen },
        { in: 'message', source: w.previous.id, quote }], at: start + hour + 2 });
    const current = w.append(3, 'Hello', start + 8 * hour);
    const hint = greetingContinuity(w.journal.view, { launches: [], unreadable: 0 }, start + 8 * hour, current);
    expect(hint?.topic).toBe(kitchen);
  } finally { w.close(); }
});

it('offers the exact open topic only beyond six hours, and leaves a fresh or exactly six-hour reply alone', () => {
  const w = world();
  try {
    const runs: RunLog = { launches: [], unreadable: 0 };
    const exact = w.append(2, 'Hello', start + 6 * hour);
    expect(greetingContinuity(w.journal.view, runs, start + 6 * hour, exact)).toBeNull();
    const later = w.append(3, 'Hello again', start + 6 * hour + 1000);
    // The preceding operator message is recent, so the gap no longer qualifies.
    expect(greetingContinuity(w.journal.view, runs, start + 6 * hour + 1000, later)).toBeNull();
  } finally { w.close(); }
  const long = world();
  try {
    const current = long.append(2, 'Hello', start + 6 * hour + 1000);
    const hint = greetingContinuity(long.journal.view, { launches: [], unreadable: 0 }, start + 6 * hour + 1000, current);
    expect(hint?.text).toContain(quote);
    expect(hint?.text).toContain('continuity:true');
  } finally { long.close(); }
});

it('offers one first reply after a recorded restart, then suppresses it after an intent even when delivery is UNKNOWN', () => {
  const w = world();
  try {
    const launch = start + hour;
    const runs: RunLog = { launches: [{ at: start - hour, exit: start, reason: 'paused' }, { at: launch }], unreadable: 0 };
    const first = w.append(2, 'Hi', launch + 1000);
    expect(greetingContinuity(w.journal.view, runs, launch + 1000, first, launch)?.text).toContain(quote);
    w.journal.append({ kind: 'reserve', id: first.id, at: launch + 1001 });
    w.journal.append({ kind: 'answer', id: first.id, text: 'Hello', at: launch + 1002 });
    w.journal.append({ kind: 'intent', id: first.id, text: 'PREVIEW — Hello', chat: '7', update: 2,
      grant: 'trial', at: launch + 1003 });
    const second = w.append(3, 'Hi again', launch + 2000);
    expect(greetingContinuity(w.journal.view, runs, launch + 2000, second, launch)).toBeNull();
    expect(greetingContinuity(w.journal.view, { ...runs, unreadable: 1 }, launch + 2000, second, launch)).toBeNull();
  } finally { w.close(); }
});

it('omits closed, corrected, absent and oversized topics', () => {
  const w = world();
  try {
    const current = w.append(2, 'Hi', start + 7 * hour);
    const runs: RunLog = { launches: [], unreadable: 0 };
    w.journal.view.closed.set(0, { id: 0, source: current.id, quote: 'Done' });
    expect(greetingContinuity(w.journal.view, runs, start + 7 * hour, current)).toBeNull();
    w.journal.view.closed.clear();
    w.journal.view.memory.push({ mode: 'forget', source: w.previous.id, quote, trigger: current.id });
    expect(greetingContinuity(w.journal.view, runs, start + 7 * hour, current)).toBeNull();
    w.journal.view.memory.length = 0;
    w.journal.view.commitments.length = 0;
    expect(greetingContinuity(w.journal.view, runs, start + 7 * hour, current)).toBeNull();
    w.journal.view.commitments.push({ in: 'message', source: w.previous.id, quote: 'Please remember an invented topic.' });
    expect(greetingContinuity(w.journal.view, runs, start + 7 * hour, current)).toBeNull();
  } finally { w.close(); }
  const oversized = world(`${quote}${'x'.repeat(150)}`);
  try {
    const current = oversized.append(2, 'Hi', start + 7 * hour);
    expect(greetingContinuity(oversized.journal.view, { launches: [], unreadable: 0 }, start + 7 * hour, current)).toBeNull();
  } finally { oversized.close(); }
});

it('puts a grounded optional source in the ordinary model packet, with no extra call or send', async () => {
  const w = world();
  try {
    const currentAt = start + 7 * hour;
    w.journal.append({ kind: 'reserve', id: w.previous.id, at: start + 3 });
    w.journal.append({ kind: 'answer', id: w.previous.id, text: 'Noted.', at: start + 4 });
    w.journal.append({ kind: 'intent', id: w.previous.id, text: 'PREVIEW — Noted.', chat: '7', update: 1,
      grant: 'trial', at: start + 5 });
    w.journal.append({ kind: 'sent', id: w.previous.id, message: 10, at: start + 6 });
    let packet: { sources?: { id: string; text: string }[]; capability?: string } | undefined;
    const calls: string[] = [];
    const sent: string[] = [];
    const worker = createJournalWorker(w.journal, { now: () => currentAt, stopped: () => false,
      sources: turn => {
        const hint = turn && greetingContinuity(w.journal.view, { launches: [], unreadable: 0 }, currentAt, turn);
        return hint ? [hint] : [];
      },
      prepareModel: input => input.context,
      model: async input => { calls.push(input.id); packet = JSON.parse(input.context) as typeof packet;
        return JSON.stringify({ reply: 'Last time we were on: an invented launch.\nHello.', memory: [], dated: [], continuity: true }); },
      send: async input => { sent.push(input.expectedText); return 11; }, checkOutbound: () => {} });
    worker.intake([update(2, 'Hi', currentAt)]);
    await worker.drain();
    expect(packet?.sources?.find(source => source.id === 'greeting-continuity')?.text).toContain(quote);
    expect(packet?.capability).toContain('Never invent a topic');
    expect(calls.filter(id => id === 'telegram:8:update:2')).toHaveLength(1);
    expect(calls).toEqual(['telegram:8:update:2']);
    expect(w.journal.view.replies).toBe(2);
    expect(sent).toEqual([`PREVIEW — Last time we were on: ${quote}\nHello.`]);
    worker.intake([update(3, 'Hi again', currentAt + 1000)]);
    await worker.drain();
    expect(packet?.sources?.some(source => source.id === 'greeting-continuity')).toBe(false);
    expect(sent.at(-1)).toBe('PREVIEW — Hello.'); // A model opt-in alone cannot invent a topic.
  } finally { w.close(); }
});

it('drops the optional hint before letting it cause a prompt hold', () => {
  const w = world();
  try {
    const now = start + 7 * hour;
    let offer = true;
    const worker = createJournalWorker(w.journal, { now: () => now, stopped: () => false,
      sources: turn => offer && turn ? [greetingContinuity(w.journal.view, { launches: [], unreadable: 0 }, now, turn)!] : [],
      prepareModel: input => input.context, model: async () => 'Hello.', send: async () => 1, checkOutbound: () => {} });
    const withHint = worker.probe('Hi');
    expect('context' in withHint).toBe(true);
    offer = false;
    const withoutHint = worker.probe('Hi');
    expect('context' in withoutHint).toBe(true);
    if (!('context' in withHint) || !('context' in withoutHint)) throw Error('probe did not fit');
    const bound = Buffer.byteLength(withoutHint.context) + 10;
    expect(Buffer.byteLength(withHint.context)).toBeGreaterThan(bound);
    w.journal.view.limits.maxBytes = bound;
    offer = true;
    const fitted = worker.probe('Hi');
    expect('context' in fitted).toBe(true);
    if (!('context' in fitted)) throw Error('optional source blocked reply');
    const packet = JSON.parse(fitted.context) as { sources?: { id: string }[]; capability: string };
    expect(packet.sources?.some(item => item.id === 'greeting-continuity')).toBe(false);
    expect(packet.capability).not.toContain('Never invent a topic');
  } finally { w.close(); }
});

it('lets the model decline a grounded line when the current message closes the topic', async () => {
  const w = world();
  try {
    const now = start + 7 * hour;
    w.journal.append({ kind: 'reserve', id: w.previous.id, at: start + 3 });
    w.journal.append({ kind: 'answer', id: w.previous.id, text: 'Noted.', at: start + 4 });
    w.journal.append({ kind: 'intent', id: w.previous.id, text: 'PREVIEW — Noted.', chat: '7', update: 1,
      grant: 'trial', at: start + 5 });
    w.journal.append({ kind: 'sent', id: w.previous.id, message: 10, at: start + 6 });
    const sent: string[] = [];
    const worker = createJournalWorker(w.journal, { now: () => now, stopped: () => false,
      sources: turn => turn ? [greetingContinuity(w.journal.view, { launches: [], unreadable: 0 }, now, turn)!] : [],
      prepareModel: input => input.context,
      model: async () => JSON.stringify({ reply: 'Glad the garden plan is settled.', memory: [], dated: [], continuity: false }),
      send: async input => { sent.push(input.expectedText); return 11; }, checkOutbound: () => {} });
    worker.intake([update(2, 'The garden plan is settled now.', now)]);
    await worker.drain();
    expect(sent).toEqual(['PREVIEW — Glad the garden plan is settled.']);
  } finally { w.close(); }
});
