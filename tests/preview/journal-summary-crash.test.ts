import { expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openPreviewJournal, openQuestionCandidates } from './journal.js';

const child = 'tests/preview/journal-summary-crash-child.mjs';
const key = new Uint8Array(32).fill(7);
const rootFor = () => realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-crash-')));
const lines = (root: string, name: string) => {
  const file = join(root, name);
  return existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').filter(Boolean) : [];
};
const run = (root: string, cut = 'none', phase = 'first') => spawnSync(process.execPath,
  ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', child, root, cut, phase],
  { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
const read = (root: string) => openPreviewJournal(join(root, 'journal.encrypted'), key);

const baselineRoot = rootFor();
let cuts: string[];
let points: string[];
let baselineMemory: string | undefined;
let baselinePeople: string;
let baselineCommitments: string;
try {
  const baseline = run(baselineRoot);
  if (baseline.status !== 0) throw Error(`baseline failed: ${baseline.stderr}`);
  points = lines(baselineRoot, 'points.log');
  if (new Set(points).size !== points.length) throw Error('duplicate crash labels');
  const first = points.indexOf('journal:before:summary-reserve:1');
  const compacted = points.indexOf('journal:compact:after-reopen:1');
  const review = points.indexOf('journal:before:reply-jev-reserve:2');
  const sent = points.indexOf('journal:after:sent:2');
  if (first < 0 || compacted <= first || review <= compacted || sent <= review)
    throw Error('summary or reply review did not run');
  // A kill at a model call's return, or just before a frame that directly follows another frame or
  // a return, leaves the same journal bytes and send log as the preceding point, so only distinct
  // durable states run. A send's return is kept: its send log differs from the send's entry.
  const distinct = (range: string[]) => range.filter((point, index) => index === 0
    || !(/:returning:/.test(point) && !point.startsWith('send:') || point.startsWith('journal:before:')
      && /^journal:after:|:returning:/.test(range[index - 1]!)));
  cuts = [...distinct(points.slice(first, compacted + 1)), ...distinct(points.slice(review, sent + 1))];
  for (const expected of ['summary:call:entered:summary:1:1', 'summary:faithfulness:entered:1',
    'summary:jev:entered:1', 'summary:review:entered:1', 'journal:after:summary:1',
    'journal:compact:after-rename:1', 'reply:review:entered:1', 'journal:after:reply-check:3']) {
    if (!cuts.includes(expected)) throw Error(`missing crash point ${expected}`);
  }
  const journal = read(baselineRoot);
  baselineMemory = journal.view.summaries.at(-1)?.text;
  baselinePeople = JSON.stringify(journal.view.people);
  baselineCommitments = JSON.stringify(journal.view.commitments);
  if (!baselineMemory?.includes('Maya has the ORCHID key 731.') || !journal.view.people.length
    || !journal.view.commitments.length) throw Error('baseline recovered memory is empty');
  if (JSON.stringify(journal.view.summaries.map(item => item.through)) !== '[1,2]') throw Error('baseline summary absent');
  if (JSON.stringify(lines(baselineRoot, 'sends.log').map(line => JSON.parse(line).update)) !== '[1,2]')
    throw Error('baseline send absent');
  journal.close();
} finally { rmSync(baselineRoot, { recursive: true, force: true }); }

it('refuses a summary and recall when their source packet loses the fact', () => {
  const root = rootFor();
  try {
    const runWithoutSource = run(root, 'none', 'missing-context');
    expect(runWithoutSource.status, runWithoutSource.stderr).toBe(0);
    expect(lines(root, 'points.log')).toContain('summary:call:entered:summary:1:1');
    expect(lines(root, 'points.log')).not.toContain('summary:call:returning:summary:1:1');
    expect(lines(root, 'sends.log').map(line => JSON.parse(line).update)).toEqual([1]);
    const journal = read(root);
    try {
      expect(journal.view.summaries).toEqual([]);
      expect(journal.view.order[1]).toMatchObject({ accepted: true, reserved: true });
    } finally { journal.close(); }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it.each(cuts)('recovers from %s', cut => {
  const root = rootFor();
  try {
    const killed = run(root, cut);
    expect(killed.signal, `${cut}: ${killed.stderr}`).toBe('SIGKILL');
    const interrupted = read(root);
    try {
      expect(interrupted.view.order.map(item => item.update), cut).toEqual([1, 2]);
      expect(interrupted.view.order[1]?.accepted, cut).toBe(true);
      if (points.indexOf(cut) <= points.indexOf('journal:compact:after-reopen:1'))
        expect(interrupted.view.order[1]?.sent, cut).toBeUndefined();
    } finally { interrupted.close(); }
    const recovered = run(root, 'none', 'resume');
    expect(recovered.status, `${cut}: ${recovered.stderr}`).toBe(0);
    const sends = lines(root, 'sends.log').map(line => JSON.parse(line) as { update: number; text: string });
    // int11's reply-check budget runs from the durable Jev reservation, so a restart after it
    // finds the budget spent and never repeats the check. Once this fixture's Jev row is durable it is
    // unsure on every rule, credential included, so Rule 86's secrets exception holds the reply. A cut
    // before that row leaves no check decided, and build 3 releases the reply once, recorded unavailable.
    const interruptedReview = points.indexOf(cut) >= points.indexOf('journal:after:reply-jev-reserve:2')
      && points.indexOf(cut) <= points.indexOf('journal:before:reply-check:3');
    const heldBySecretFlag = interruptedReview && points.indexOf(cut) >= points.indexOf('journal:after:reply-check:2');
    const uncertainSend = points.indexOf(cut) >= points.indexOf('journal:after:intent:2')
      && points.indexOf(cut) < points.indexOf('journal:after:sent:2');
    if (!heldBySecretFlag && !uncertainSend) expect(sends.filter(item => item.update === 2), cut).toEqual([
      { update: 2, text: 'PREVIEW — From your note: Maya has the ORCHID key 731.' },
    ]);
    else expect(sends.filter(item => item.update === 2).length, cut).toBeLessThanOrEqual(1);
    expect(new Set(sends.map(item => item.update)).size, cut).toBe(sends.length);
    const journal = read(root);
    try {
      const view = journal.view;
      const frontiers = view.summaries.map(item => item.through);
      expect(new Set(frontiers).size, cut).toBe(frontiers.length);
      expect(view.order.map(item => item.update), cut).toEqual([1, 2]);
      expect(view.order[1]?.accepted, cut).toBe(true);
      if (!heldBySecretFlag && !uncertainSend) {
        expect(frontiers.at(-1), cut).toBe(2);
        expect(view.summaries.at(-1)?.text, cut).toBe(baselineMemory);
        expect(JSON.stringify(view.people), cut).toBe(baselinePeople);
        expect(JSON.stringify(view.commitments), cut).toBe(baselineCommitments);
        expect(view.order[1]?.sent, cut).toBe(2);
        expect(openQuestionCandidates(view).some(item => item.source === view.order[1]?.id), cut).toBe(false);
      } else {
        expect(view.order[1]?.sent, cut).toBeUndefined();
        expect(view.order[1]?.held || view.order[1]?.intent, cut).toBeTruthy();
      }
      expect([...view.summaryReservations.keys()].every(through => through < 2), cut).toBe(true);
      const reserved = points.indexOf(cut) >= points.indexOf('journal:after:summary-reserve:1')
        && points.indexOf(cut) <= points.indexOf('journal:before:summary:1');
      if (reserved) expect(view.summaryReservations.has(1), cut).toBe(true);
      if (points.indexOf(cut) >= points.indexOf('journal:after:summary:1')
        && points.indexOf(cut) <= points.indexOf('journal:compact:after-reopen:1'))
        expect(frontiers, cut).toContain(1);
      if (heldBySecretFlag) {
        expect(['reply check unavailable', 'reply check budget exceeded'], cut).toContain(view.order[1]?.held);
        expect(view.order[1]?.intent, cut).toBeUndefined();
      } else if (interruptedReview) expect(view.order[1]?.release?.review, cut).toBe('unavailable');
    } finally { journal.close(); }
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 15000);
