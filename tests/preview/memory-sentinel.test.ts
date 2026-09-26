import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { bm25, terms } from '../../src/recall/lexical.js';
import { namedWindow, selectRecall } from './memory-sentinel.js';
import { createJournalWorker, openPreviewJournal } from './journal.js';

const now = 1790000000000, hour = 3_600_000, day = 24 * hour;
const filler = (i: number) => ({ text: `ordinary turn ${i}: weather, errands and plans for the week noted`, at: now - 10 * day + i * 60000 });
/** The recall this sentinel replaces: BM25 on the new message alone, coverage first. */
const wordMatch = (message: string, candidates: readonly { text: string }[]) =>
  bm25(terms(message), candidates.map(turn => terms(turn.text)))
    .sort((a, b) => b.matched - a.matched || b.score - a.score).slice(0, 5).map(hit => hit.index);

it('resolves a pronoun through the turn it continues, which message-only word match misses', () => {
  const candidates = [filler(0), filler(1), { text: 'My sister Maya loves ranunculus flowers. noted', at: now - 9 * day }, ...[3, 4, 5, 6].map(filler)];
  const message = "Any idea what she'd actually want?";
  const previous = "Maya's birthday is next Saturday and I'm stuck on a gift. Birthdays are hard.";
  expect(wordMatch(message, candidates)).not.toContain(2);
  expect(selectRecall({ message, previous, candidates, now, limit: 5 })[0]).toBe(2);
  // Other side: with no earlier turn to continue, the same vague message recalls nothing.
  expect(selectRecall({ message, candidates, now, limit: 5 })).toEqual([]);
});

it('bridges a paraphrase through the summary sentence that still names the topic', () => {
  const candidates = [filler(0), { text: 'The locker combination is QUASAR-7731. noted', at: now - 9 * day }, ...[2, 3, 4].map(filler)];
  const summary = 'Early on the operator shared the code for their gym locker. Later turns were ordinary chat about weather.';
  const message = "What's the code for my cabinet at the gym?";
  expect(wordMatch(message, candidates)).toEqual([]);
  expect(selectRecall({ message, summary, candidates, now, limit: 5 })[0]).toBe(1);
  // Other side: a summary that never touches the message's words bridges nothing.
  expect(selectRecall({ message, summary: 'Ordinary chat about weather.', candidates, now, limit: 5 })).toEqual([]);
});

it('selects turns sent on the day the message names and nothing outside it', () => {
  const candidates = [{ text: 'Parked on level 4, row K. noted', at: now - 30 * hour },
    { text: 'The dentist moved to Thursday. noted', at: now - 5 * day }, filler(2)];
  expect(wordMatch('What did I tell you yesterday?', candidates)).toEqual([]);
  expect(selectRecall({ message: 'What did I tell you yesterday?', candidates, now, limit: 5 })).toEqual([0]);
  expect(selectRecall({ message: 'What did I say 5 days ago?', candidates, now, limit: 5 })).toEqual([1]);
  expect(namedWindow('How was the weather?', now)).toBeNull();
  const saturday = namedWindow('What did I send on Saturday?', now)!;
  // 1790000000000 is a Monday (UTC); the most recent Saturday began two days before today.
  expect(Math.floor(now / day) * day - (saturday.from + 12 * hour)).toBe(2 * day);
});

it('keeps direct word matches first and caps the result', () => {
  const candidates = Array.from({ length: 12 }, (_, i) => ({ text: `tomato note ${i}`, at: now - day }));
  candidates.push({ text: 'Tomato seedlings go in the north bed. noted', at: now - day });
  const picked = selectRecall({ message: 'where do the tomato seedlings go', candidates, now, limit: 5 });
  expect(picked).toHaveLength(5);
  expect(picked[0]).toBe(12);
});

it('grounds a later pronoun question in an early summarized turn across a restart, with bounded overhead', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'memory-sentinel-')));
  const key = new Uint8Array(32).fill(9), samples: number[] = [];
  const initial = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
    configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 400, maxReplies: 200, maxTurns: 200,
    maxBytes: 8192, cursor: 0 };
  const fact = 'Note for later: my sister Maya loves ranunculus flowers.';
  let asked: string | undefined;
  const open = () => {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key);
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      model: async input => {
        if (input.id.startsWith('summary:')) return 'An ordinary conversation about weather, errands and plans.';
        if (input.question.startsWith('Any idea')) asked = input.context;
        return 'noted';
      }, send: async () => 1, checkOutbound: () => {} });
    return { journal, worker };
  };
  try {
    openPreviewJournal(join(root, 'journal.encrypted'), key, initial).close();
    let current = open();
    for (let i = 1; i <= 200; i++) {
      if (i === 100 || i === 200) { current.journal.close(); current = open(); }
      const text = i === 3 ? fact : i === 199 ? "Maya's birthday is next Saturday and I'm stuck on a gift."
        : i === 200 ? "Any idea what she'd actually want?" : `ordinary turn ${i}: weather, errands and plans ${'x'.repeat(60)}`;
      const incoming = { update_id: i, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
        date: 1780000000 + i * 60 } };
      const start = performance.now();
      current.worker.intake([incoming]); await current.worker.drain(); await current.worker.summarizeIfNeeded();
      samples.push(performance.now() - start);
    }
    const packet = JSON.parse(asked!);
    expect(packet.historyMode).toBe('summary-plus-recent');
    expect(packet.summary.through).toBeGreaterThan(3);
    expect(packet.summary.text).not.toContain('Maya');
    expect(packet.history.some((turn: { user: string }) => turn.user.includes('ranunculus'))).toBe(false);
    expect(packet.recalled.map((turn: { user: string }) => turn.user)).toContain(fact);
    expect(packet.capability).toContain('memory sentinel');
    // The step on its own, at ten times this run's history.
    const big = Array.from({ length: 2000 }, (_, i) => ({ text: `ordinary turn ${i}: weather, errands and plans ${'x'.repeat(60)} noted`, at: now - i * 60000 }));
    const step: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t = performance.now();
      selectRecall({ message: "Any idea what she'd actually want?", previous: "Maya's birthday gift", summary: 'Ordinary chat.', candidates: big, now, limit: 5 });
      step.push(performance.now() - t);
    }
    const p95 = (values: number[]) => values.slice().sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1]!;
    process.stdout.write(`memory sentinel: 200-turn non-model p95=${p95(samples).toFixed(1)} ms, first-ten=${p95(samples.slice(0, 10)).toFixed(1)} ms, `
      + `final-ten=${p95(samples.slice(190)).toFixed(1)} ms; sentinel step over 2000 turns p95=${p95(step).toFixed(1)} ms\n`);
    expect(p95(samples)).toBeLessThanOrEqual(5000);
    expect(p95(samples.slice(190)) - p95(samples.slice(0, 10))).toBeLessThanOrEqual(1000);
    expect(p95(step)).toBeLessThanOrEqual(250);
    current.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps content words that also name a time, so a title or band name is still recalled', () => {
  const candidates = [filler(0), { text: 'Night by Elie Wiesel is the book I chose for our reading group. noted', at: now - 9 * day },
    { text: 'Thursday is the band playing the club on Friday. noted', at: now - 9 * day }, filler(3)];
  expect(wordMatch('What did I say about Night?', candidates)).toContain(1);
  expect(selectRecall({ message: 'What did I say about Night?', candidates, now, limit: 5 })).toEqual([1]);
  expect(selectRecall({ message: 'What did I say about Thursday?', candidates, now, limit: 5 })).toEqual([2]);
});
