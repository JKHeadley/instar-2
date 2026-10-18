import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, openRequests, declaredObligations } from './journal-test-worker.js';
import { parseDatedItem, resolvedDatedItem } from './dated-memory.js';
import { REPLY_RULES, DECLARED_OBLIGATIONS_GUIDE, replyReviewContext } from './reply-check.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/reminder-relative-1013.json', import.meta.url), 'utf8'));
const frame = (number: number) => fixture.frames.find((item: { frame: number }) => item.frame === number);
const original = JSON.parse(frame(404).output);
const intake = frame(399);
const at = JSON.parse(intake.raw).message.date * 1000;
const zone = 'America/Los_Angeles';
const resolution = { instant: new Date(at + 12 * 60_000).toISOString(), at, zone };
const genesis = { kind: 'genesis' as const, bot: '8989505249', chat: '7812716706', operator: '7812716706',
  grant: 'grant:relative-replay', configurationDigest: 'sha256:relative-replay', expires: at + 86400_000,
  maxCalls: 30, maxReplies: 20, maxTurns: 20, maxBytes: 24000, cursor: 0 };
const key = new Uint8Array(32).fill(41);

it('replays raw 404 with intake duration arithmetic, admitted review evidence, due work and restart without a duplicate', async () => {
  const root = mkdtempSync(join(tmpdir(), 'relative-replay-')), path = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, genesis), now = intake.at, calls = 0;
  const sent: string[] = [];
  const ports = { now: () => now, stopped: () => false, timeZone: zone,
    model: async (input: { id: string; context: string }) => {
      if (input.id.startsWith('requested-action:')) return frame(983).output;
      calls++;
      const packet = JSON.parse(input.context);
      expect(packet.datedClock).toEqual({ at, zone });
      return frame(404).output;
    }, send: async (input: { text: string }) => { sent.push(input.text); return sent.length; }, checkOutbound: () => {} };
  try {
    let worker = createJournalWorker(journal, ports);
    worker.intake([JSON.parse(intake.raw)]); await worker.drain();
    expect(calls).toBe(1);
    expect(openRequests(journal.view)).toMatchObject([{ quote: original.dated[0].quote, when: 'in about 12 minutes',
      day: '2026-10-13', time: '09:12', zone, remind: true }]);
    const declared = declaredObligations(journal.view, intake.id, now);
    expect(declared.loops).toEqual([]);
    expect(declared.dated).toHaveLength(1);
    const review = JSON.parse(replyReviewContext(frame(400).prompt, sent[0]!, ['defers_work'], declared));
    expect(review.declaredObligations.dated[0].quote).toBe(original.dated[0].quote);
    journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    const dueAt = Date.parse(journal.view.dated[0]!.resolution!.instant);
    now = dueAt - 1; await worker.sendRequested();
    expect(sent).toHaveLength(1);
    now = dueAt; await worker.sendRequested();
    expect(sent).toHaveLength(2);
    expect(sent[1]).toContain('bread');
    journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    await worker.sendRequested(); await worker.drain();
    expect(sent).toHaveLength(2);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('replays explicit 595/597 and supplies the evidence missing from recorded 603/609; unresolved 406 remains unrecorded', async () => {
  const root = mkdtempSync(join(tmpdir(), 'dated-review-replay-'));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  try {
    const worker = createJournalWorker(journal, { now: () => frame(579).at, stopped: () => false,
      model: async () => frame(595).output, send: async () => 1, checkOutbound: () => {} });
    worker.intake([JSON.parse(frame(579).raw)]); await worker.drain();
    const declared = declaredObligations(journal.view, frame(597).id, frame(597).at);
    expect(declared.dated).toEqual(frame(597).dated);
    expect(frame(603).result.ruleIds).toContain('defers_work');
    expect(JSON.stringify(frame(609))).toContain('defers_work');
    const review = JSON.parse(replyReviewContext(frame(587).prompt, frame(597).text, ['defers_work'], declared));
    expect(review.declaredObligations.dated).toEqual(frame(597).dated);
    expect(REPLY_RULES.defers_work).toContain('packet.declaredObligations.dated');
    expect(DECLARED_OBLIGATIONS_GUIDE).toContain('unrecorded scheduling claim');
    expect(declaredObligations(journal.view, frame(406).id, frame(406).at).dated).toEqual([]);
    expect(frame(406).dated[0].remind).toBeUndefined();
    expect(JSON.stringify(frame(438))).toContain('violation');
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('preserves ambiguous/invalid time refusals and rejects stale clock, zone, malformed and past resolutions', () => {
  const item = parseDatedItem(intake.id, original.dated[0].quote, original.dated[0].when, at, zone);
  for (const changed of [{ ...resolution, at: at + 1 }, { ...resolution, zone: 'UTC' },
    { ...resolution, instant: '2026-02-30T16:12:00.000Z' }, { ...resolution, instant: new Date(at).toISOString() },
    { ambiguity: 'About which day and time?' }]) {
    expect(resolvedDatedItem(item, changed, at).ambiguity).toBeTruthy();
    expect(resolvedDatedItem(item, changed, at).day).toBeUndefined();
  }
  for (const when of ['Thursday or Friday', 'February 30', 'tomorrow at 3', 'tomorrow at 25:00']) {
    const ambiguous = parseDatedItem('other', when, when, at, zone);
    expect(resolvedDatedItem(ambiguous, resolution, at)).toEqual(ambiguous);
    expect(ambiguous.ambiguity).toBeTruthy();
  }
});

it.each(['stop', 'cap', 'wrong-sender'] as const)('keeps the %s floor for the recorded relative proposal', async floor => {
  const root = mkdtempSync(join(tmpdir(), 'relative-floor-'));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { ...genesis, maxCalls: floor === 'cap' ? 1 : 30 });
  let stopped = false, calls = 0, sends = 0, now = intake.at;
  try {
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => stopped,
      model: async () => { calls++; if (floor === 'stop') stopped = true; return frame(404).output; },
      send: async () => ++sends, checkOutbound: () => {} });
    const raw = JSON.parse(intake.raw); if (floor === 'wrong-sender') raw.message.from.id = 1234;
    worker.intake([raw]);
    if (floor === 'stop') await expect(worker.drain()).rejects.toThrow('preview stopped');
    else await worker.drain();
    expect(calls).toBeLessThanOrEqual(1);
    expect(openRequests(journal.view)).toHaveLength(floor === 'wrong-sender' ? 0 : 1);
    const before = sends;
    now += 13 * 60_000;
    await worker.sendRequested();
    expect(sends).toBe(before); // admission is allowed; stop/cap still prevent the due effect
    expect(calls).toBeLessThanOrEqual(1);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it.each([
  { sent: '2026-10-14T06:55:00.000Z', instant: '2026-10-14T07:07:00.000Z', day: '2026-10-14', time: '00:07', admitted: true },
  { sent: '2026-11-01T08:55:00.000Z', instant: '2026-11-01T09:07:00.000Z', day: '2026-11-01', time: '01:07', admitted: false },
])('keeps local calendar conversion and refuses an unrepresentable repeated minute: $instant', async row => {
  const root = mkdtempSync(join(tmpdir(), 'relative-zone-')), clock = Date.parse(row.sent);
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { ...genesis, expires: clock + 86400_000 });
  try {
    const proposed = { ...original, dated: [{ ...original.dated[0],
      resolution: { at: clock, zone, instant: row.instant } }] };
    const worker = createJournalWorker(journal, { now: () => clock, stopped: () => false,
      model: async () => JSON.stringify(proposed), send: async () => 1, checkOutbound: () => {} });
    const raw = JSON.parse(intake.raw); raw.message.date = clock / 1000;
    worker.intake([raw]); await worker.drain();
    expect(journal.view.dated[0]).toMatchObject({ day: row.day, time: row.time, resolution: { at: clock, instant: row.instant } });
    expect(openRequests(journal.view)).toHaveLength(row.admitted ? 1 : 0);
    if (!row.admitted) expect(journal.view.order[0]!.answer).toContain('which occurrence do you mean?');
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
