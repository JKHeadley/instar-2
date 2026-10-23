/** Recorded reply-format instructions remain durable preferences. The historical guide requested
 * a second directive; correction-sticks now coalesces identical same-turn clauses so a later
 * preference correction cannot leave a stale governing copy. Keep the captured bytes unchanged:
 * live updates 46040376/46040368 and their original real-model replays remain provenance,
 * not a claim that those replays were generated with today's guide. Standalone directives
 * still retain the Rule 93 lifecycle. */
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readAnswer } from './answer-reading.js';
import { createJournalWorker, openDirectives, openPreviewJournal, OBLIGATION_DECISION, OBLIGATION_DECISION_TOOLS } from './journal-test-worker.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/directive-reply-format-2026-10-20.json', import.meta.url), 'utf8')) as {
  operatorMessage: string; oneOffMessage: string; guide: { current: string; fixed: string };
  live: { update: number; model: string; output: string }[];
  replays: { current: string[]; fixed: string[]; oneOff: string[] } };

const key = new Uint8Array(32).fill(41);
/** The live turn's own time (update 46040376, 2026-10-20 00:31:38 PDT). */
const LIVE_AT = 1792481498931;
const UPDATE = 46040376;
const genesis = { kind: 'genesis' as const, bot: '8993213212', chat: '7812716706', operator: '7812716706',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes: 409600, cursor: 0 };

/** The operator's message answered with what the runner's reader makes of one recorded output, then one unrelated
 * later message an hour on; the directives are read after each. */
async function directivesOf(raw: string, message = fixture.operatorMessage, update = UPDATE) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-directive-format-')));
  try {
    const path = join(root, 'journal.encrypted');
    let journal = openPreviewJournal(path, key, genesis);
    const clock = { now: LIVE_AT };
    const worker = createJournalWorker(journal, { now: () => clock.now, stopped: () => false, timeZone: 'America/Los_Angeles',
      prepareModel: input => input.context,
      model: async input => {
        if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'Earlier turns.', people: [], commitments: [], closed: [] });
        if (input.id !== `telegram:${genesis.bot}:update:${String(update)}`) return 'Sure, noted.';
        const reading = readAnswer(raw, { wrapped: 'accept', evidence: [input.id] });
        if (!reading.ok) throw Error('recorded output refused');
        return reading.value;
      },
      send: async () => 1, checkOutbound: () => {} });
    const take = (update: number, text: string) => worker.intake([{ update_id: update, message: { chat: { id: 7812716706, type: 'private' },
      from: { id: 7812716706 }, text, date: Math.floor(clock.now / 1000) } }]);
    take(update, message);
    await worker.drain();
    const first = openDirectives(journal.view).map(({ note }) => ({ quote: note.quote, at: note.at }));
    const savedPreferences = journal.view.memory.filter(change => change.mode === 'prefer');
    const preferences = savedPreferences.length;
    clock.now += 3_600_000;
    take(update + 1, 'What is a good name for a small garden blog?');
    await worker.drain();
    const later = openDirectives(journal.view).map(({ note }) => ({ quote: note.quote, at: note.at }));
    journal.close();
    journal = openPreviewJournal(path, key);
    const reopenedPreferences = journal.view.memory.filter(change => change.mode === 'prefer');
    const reopenedDirectives = openDirectives(journal.view).map(({ note }) => ({ quote: note.quote, at: note.at }));
    journal.close();
    return { first, later, preferences, savedPreferences, reopenedPreferences, reopenedDirectives };
  } finally { rmSync(root, { recursive: true, force: true }); }
}

it('both answer routes direct reply-style or format instructions to durable preferences', () => {
  for (const guide of [OBLIGATION_DECISION, OBLIGATION_DECISION_TOOLS]) {
    expect(guide).toContain('(reply style/format uses memory prefer)');
    expect(guide).not.toContain(fixture.guide.fixed);
    expect(guide).not.toContain(fixture.guide.current);
  }
});

it('the historical live answers and preference-only replays retain one preference without a duplicate directive', async () => {
  for (const item of fixture.live) {
    const run = await directivesOf(item.output, fixture.operatorMessage, item.update);
    expect(run.preferences, String(item.update)).toBe(1);
    expect(run.first, String(item.update)).toEqual([]);
  }
  for (const raw of fixture.replays.current) {
    const run = await directivesOf(raw);
    expect(run.preferences).toBe(1);
    expect(run.first).toEqual([]);
    expect(run.reopenedPreferences).toEqual(run.savedPreferences);
  }
});

it('historical identical-clause replays retain one preference across turns and restart', async () => {
  for (const index of [0, 3]) {
    const raw = fixture.replays.fixed[index]!;
    const run = await directivesOf(raw);
    expect(run.preferences).toBe(1);
    expect(fixture.operatorMessage).toContain(run.savedPreferences[0]!.quote);
    expect(run.savedPreferences[0]!.quote).toContain('shopping list');
    expect(run.first).toEqual([]);
    expect(run.later).toEqual([]);
    expect(run.reopenedDirectives).toEqual([]);
    expect(run.reopenedPreferences).toEqual(run.savedPreferences);
  }
});

it('historical distinct-clause replays keep the directive rather than guessing semantic equivalence', async () => {
  for (const index of [1, 2, 4]) {
    const raw = fixture.replays.fixed[index]!;
    const captured = JSON.parse(raw);
    expect(captured.directives[0].quote).not.toBe(captured.memory[0].quote);
    const run = await directivesOf(raw);
    expect(run.preferences).toBe(1);
    expect(run.first).toEqual([{ quote: captured.directives[0].quote, at: LIVE_AT }]);
    expect(run.later).toEqual(run.first);
    expect(run.reopenedDirectives).toEqual(run.first);
    expect(run.reopenedPreferences).toEqual(run.savedPreferences);
  }
});

it('a standalone directive retains its original since across a later turn and restart', async () => {
  // Constructed boundary neighbor of the captured output, not a fresh model result.
  const output = JSON.parse(fixture.replays.fixed[0]!);
  output.memory = [];
  const run = await directivesOf(JSON.stringify(output));
  expect(run.preferences).toBe(0);
  expect(run.first).toHaveLength(1);
  expect(fixture.operatorMessage).toContain(run.first[0]!.quote);
  expect(run.first[0]!.at).toBe(LIVE_AT);
  expect(run.later).toEqual(run.first);
  expect(run.reopenedDirectives).toEqual(run.first);
});

it('a one-off formatting request under the fixed guide records no directive', async () => {
  for (const raw of fixture.replays.oneOff) {
    const run = await directivesOf(raw, fixture.oneOffMessage);
    expect(run.first).toEqual([]);
    expect(run.later).toEqual([]);
  }
});
