import { expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openPreviewJournal } from './journal.js';

const child = 'tests/preview/journal-continuity-child.mjs';
const lines = (root: string, name: string) => {
  const file = join(root, name);
  return existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').filter(Boolean) : [];
};
const run = (root: string, cut = 'none', probe = '') => spawnSync(process.execPath,
  ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', child, root, cut, probe],
  { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
const rootFor = () => realpathSync(mkdtempSync(join(tmpdir(), 'preview-continuity-')));

const baseline = rootFor();
let boundaries: string[];
try {
  const result = run(baseline);
  if (result.status !== 0) throw Error(`baseline failed: ${result.stderr}`);
  boundaries = lines(baseline, 'boundaries.log');
} finally { rmSync(baseline, { recursive: true, force: true }); }

it('covers every append kind in the multi-turn fixture', () => {
  expect(new Set(boundaries).size).toBe(boundaries.length);
  for (const kind of ['intake', 'reserve', 'answer', 'reply-jev-reserve', 'reply-check', 'intent', 'sent',
    'coherence', 'summary-reserve', 'summary']) {
    expect(boundaries.some(point => point.startsWith(`before:${kind}:`)), kind).toBe(true);
    expect(boundaries.some(point => point.startsWith(`after:${kind}:`)), kind).toBe(true);
  }
});

it.each(boundaries)('restarts after %s without duplicate sends or lost memory', cut => {
    const root = rootFor();
    try {
      const killed = run(root, cut);
      expect(killed.signal, `${cut}: ${killed.stderr}`).toBe('SIGKILL');
      const resumed = run(root, 'none', 'probe');
      expect(resumed.status, `${cut}: ${resumed.stderr}`).toBe(0);
      const sends = lines(root, 'sends.log').map(line => JSON.parse(line) as { update: number; text: string });
      expect(new Set(sends.map(send => send.update)).size, cut).toBe(sends.length);
      expect(sends.filter(send => send.update === 4), cut).toEqual([
        { update: 4, text: 'PREVIEW — Silver otter 731' },
      ]);
      const calls = lines(root, 'models.log');
      expect(new Set(calls).size, cut).toBe(calls.length);
      const uninvokedTurn = /^after:reserve:(\d+)$/u.exec(cut);
      if (uninvokedTurn) expect(calls, cut).not.toContain(`telegram:12345678:update:${uninvokedTurn[1]}`);
      if (cut === 'after:summary-reserve:1') expect(calls, cut).not.toContain('summary:1');
      const unsentTurn = /^after:intent:(\d+)$/u.exec(cut);
      if (unsentTurn) expect(sends.some(send => send.update === Number(unsentTurn[1])), cut).toBe(false);
      const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(7));
      try {
        expect(journal.view.order.map(turn => turn.update), cut).toEqual([1, 2, 3, 4]);
        expect(journal.view.cursor, cut).toBe(5);
        expect(journal.view.replies, cut).toBe(sends.length + journal.view.order.filter(turn => turn.intent && !sends.some(send => send.update === turn.update)).length);
        expect(journal.view.summaryReservations.size, cut).toBeLessThanOrEqual(1);
        expect(journal.view.order[3]?.answer, cut).toBe('Silver otter 731');
      } finally { journal.close(); }
    } finally { rmSync(root, { recursive: true, force: true }); }
}, 20000);
