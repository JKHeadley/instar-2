import { expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const child = 'tests/preview/journal-handoff-child.mjs';
const lines = (root: string, name: string) => {
  const path = join(root, name);
  return existsSync(path) ? readFileSync(path, 'utf8').trim().split('\n').filter(Boolean) : [];
};
const launch = (root: string, phase: string, old = false) => spawnSync(process.execPath,
  ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', child, root, phase],
  { cwd: process.cwd(), encoding: 'utf8', timeout: 20000,
    env: old && process.env.PREVIEW_OLD_JOURNAL_MODULE
      ? { ...process.env, PREVIEW_JOURNAL_MODULE: process.env.PREVIEW_OLD_JOURNAL_MODULE }
      : process.env });
const run = (root: string, phase: string, old = false): Record<string, unknown> => {
  const result = launch(root, phase, old);
  expect(result.status, `${phase}: ${result.stderr}`).toBe(0);
  return JSON.parse(result.stdout) as Record<string, unknown>;
};
const durableFacts = ({ newFeatures: _newFeatures, ...facts }: Record<string, unknown>) => facts;
const status = (root: string, old = false) => {
  const result = spawnSync(process.execPath,
    ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      old && process.env.PREVIEW_OLD_LAUNCHER || 'tests/preview/journal-agent.mjs', 'status', '--root', root],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 10000,
      env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.alloc(32, 7).toString('hex') } });
  expect(result.status, result.stderr).toBe(0);
  const view = JSON.parse(result.stdout) as Record<string, unknown>;
  return { cursor: view.cursor, turns: view.turns, calls: view.calls, replies: view.replies,
    summaryThrough: view.summaryThrough, holds: view.holds, unknownCalls: view.unknownCalls,
    unknownSends: view.unknownSends, commitments: view.commitments };
};

it('keeps shared durable facts and one-shot effects across build switch and compaction', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-handoff-')));
  try {
    const seeded = run(root, 'seed', true);
    expect(seeded.pending).toEqual(['telegram:12345678:update:3', 'telegram:12345678:update:4',
      'telegram:12345678:update:5']);
    expect(seeded.held).toEqual(['telegram:12345678:update:3']);
    const hasNewFeatures = seeded.newFeatures !== undefined;
    if (hasNewFeatures) expect(((seeded.newFeatures as { questions: unknown[] }).questions)).toHaveLength(2);
    expect((seeded.summaries as unknown[]).length).toBe(1);
    expect((seeded.commitments as unknown[]).length).toBe(1);
    expect((seeded.memory as unknown[]).length).toBe(hasNewFeatures ? 2 : 1);
    expect((seeded.turns as { intent: string | null; sent: number | null }[])[5]).toMatchObject({
      intent: 'PREVIEW — Already prepared.', sent: null,
    });
    expect(JSON.stringify(seeded.probe)).not.toContain('silver key');
    expect(JSON.stringify(seeded.probe)).toContain('brass key');
    const reopened = run(root, 'inspect');
    expect(durableFacts(reopened)).toEqual(durableFacts(seeded));
    expect(((reopened.newFeatures as { questions: unknown[]; preferences: unknown[] }).questions))
      .toHaveLength(hasNewFeatures ? 2 : 1);
    expect(((reopened.newFeatures as { preferences: unknown[] }).preferences))
      .toHaveLength(hasNewFeatures ? 1 : 0);
    expect(status(root)).toEqual(status(root, true));

    const resumed = run(root, 'resume');
    expect(lines(root, 'sends.log').map(line => JSON.parse(line))).toEqual([
      { update: 4, text: 'PREVIEW — Answer for telegram:12345678:update:4' },
    ]);
    expect(lines(root, 'models.log')).toEqual(['telegram:12345678:update:4']);
    expect(run(root, 'inspect')).toEqual(resumed);
    expect(run(root, 'resume')).toEqual(resumed);
    expect(lines(root, 'sends.log')).toHaveLength(1);

    const compacted = run(root, 'compact');
    expect(compacted).toEqual(resumed);
    expect(run(root, 'inspect')).toEqual(resumed);
    expect(status(root)).toMatchObject({ cursor: 7, turns: 6, summaryThrough: 2 });
    const later = run(root, 'after-compact');
    expect(lines(root, 'sends.log').map(line => JSON.parse(line).update)).toEqual([4, 7]);
    expect(lines(root, 'models.log')).toEqual(['telegram:12345678:update:4', 'telegram:12345678:update:7']);
    expect(run(root, 'inspect')).toEqual(later);
    expect(run(root, 'after-compact')).toEqual(later);
    expect(lines(root, 'sends.log')).toHaveLength(2);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120000);

it('starts a successor after SIGKILL with the same pending and UNKNOWN work', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-handoff-kill-')));
  try {
    const killed = launch(root, 'seed-kill', true);
    expect(killed.signal, killed.stderr).toBe('SIGKILL');
    const before = run(root, 'inspect');
    expect(before.cursor).toBe(7);
    expect(before.pending).toEqual(['telegram:12345678:update:3', 'telegram:12345678:update:4',
      'telegram:12345678:update:5']);
    expect(status(root)).toMatchObject({ cursor: 7, turns: 6, unknownSends: 1 });
    const after = run(root, 'resume');
    expect(after.cursor).toBe(7);
    expect(run(root, 'inspect')).toEqual(after);
    expect(lines(root, 'sends.log')).toHaveLength(1);
    expect(lines(root, 'models.log')).toEqual(['telegram:12345678:update:4']);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);
