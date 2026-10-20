/** Rule 93: a standing instruction about how replies look is a directive too, not only a reply-style preference.
 *
 * Live group D check D5c failed in 13 of 14 runs from 2026-10-16 (it passed in almost every run before). The operator
 * says "From now on, end every shopping list you write for me with "— K"." and the reply promises to, but
 * `status.directives` stays empty: the answer model recorded the clause only as memory mode "prefer". Commit f1d39060
 * (2026-10-15) shortened the guide's directive slot from "exact clause of this message setting a standing instruction
 * beyond this reply" to "exact operator standing instruction", and the remaining "(reply style stays memory prefer)"
 * then read as an exclusion. The model's own reasoning says so: "a standing reply-style preference ... No other decision
 * fields (... directives ...) apply". A preference is not the directive lifecycle Rule 93 names.
 *
 * Every model output below is recorded bytes (Rule 106; fixture provenance): the live answers of update 46040376
 * (train-89) and 46040368 (train-88), and real claude-sonnet-5 replays of 46040376's exact recorded prompt with only
 * the guide's parenthesis changed: 0 of 4 declared the directive under the current wording, 5 of 5 under the fixed one,
 * and 0 of 5 for a one-off request under the fixed one. The fixed wording is +14 bytes: at the servable floor the full
 * guide still fits beside governingConstraints (default-context-floor.test.ts). */
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
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
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
    const preferences = journal.view.memory.filter(change => change.mode === 'prefer').length;
    clock.now += 3_600_000;
    take(update + 1, 'What is a good name for a small garden blog?');
    await worker.drain();
    const later = openDirectives(journal.view).map(({ note }) => ({ quote: note.quote, at: note.at }));
    journal.close();
    return { first, later, preferences };
  } finally { rmSync(root, { recursive: true, force: true }); }
}

it('the answer guide says a standing reply-style or format instruction is a directive too, on both routes', () => {
  for (const guide of [OBLIGATION_DECISION, OBLIGATION_DECISION_TOOLS]) {
    expect(guide).toContain(fixture.guide.fixed);
    expect(guide).not.toContain(fixture.guide.current);
  }
});

it('reproduces the live failure: the recorded answers save only a preference and leave no directive', async () => {
  for (const item of fixture.live) {
    const run = await directivesOf(item.output, fixture.operatorMessage, item.update);
    expect(run.preferences, String(item.update)).toBe(1);
    expect(run.first, String(item.update)).toEqual([]);
  }
  for (const raw of fixture.replays.current) expect((await directivesOf(raw)).first).toEqual([]);
});

it('under the fixed guide every real replay records the directive, which keeps its original since across a later turn', async () => {
  for (const raw of fixture.replays.fixed) {
    const run = await directivesOf(raw);
    expect(run.first).toHaveLength(1);
    expect(fixture.operatorMessage).toContain(run.first[0]!.quote);
    expect(run.first[0]!.quote).toContain('shopping list');
    expect(run.first[0]!.at).toBe(LIVE_AT);
    expect(run.later).toEqual(run.first);
  }
});

it('a one-off formatting request under the fixed guide records no directive', async () => {
  for (const raw of fixture.replays.oneOff) {
    const run = await directivesOf(raw, fixture.oneOffMessage);
    expect(run.first).toEqual([]);
    expect(run.later).toEqual([]);
  }
});
