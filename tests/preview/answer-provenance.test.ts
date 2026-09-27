import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { unlabeledRecall } from './answer-provenance.js';
import { openPreviewJournal } from './journal.js';

it('signals only when reply wording repeats an unlabeled remembered fact', () => {
  const fact = 'The studio launch code is CYAN 47';
  const packet = (sourceLabel?: string) => JSON.stringify({ history: [
    { user: fact, ...(sourceLabel ? { sourceLabel } : {}) }] });
  expect(unlabeledRecall(packet(), 'The studio launch code is CYAN 47.')).toBe(true);
  expect(unlabeledRecall(packet('conversation: operator / main chat / 2026-09-21T13:13Z / #8'),
    'The studio launch code is CYAN 47.')).toBe(false);
  expect(unlabeledRecall(packet(), 'I cannot verify the code.')).toBe(false);
  expect(unlabeledRecall(JSON.stringify({ history: [] }), 'The studio launch code is CYAN 47.')).toBe(false);
});

it('checks summaries, corrections and imports as remembered material', () => {
  expect(unlabeledRecall(JSON.stringify({ summary: { text: 'The cedar trail starts at West Pier.' } }),
    'The cedar trail starts at West Pier.')).toBe(true);
  expect(unlabeledRecall(JSON.stringify({ memory: [{ replacement: 'The cedar trail starts at West Pier.',
    sourceLabel: 'correction: operator / main chat / 2026-09-21T13:13Z / #9' }] }),
  'The cedar trail starts at West Pier.')).toBe(false);
  expect(unlabeledRecall(JSON.stringify({ channelMemory: [{ quote: 'The cedar trail starts at West Pier.' }] }),
    'The cedar trail starts at West Pier.')).toBe(true);
  expect(unlabeledRecall(JSON.stringify({ memoryCandidates: [{ message: 'The cedar trail starts at West Pier.' }] }),
    'The cedar trail starts at West Pier.')).toBe(true);
  expect(unlabeledRecall(JSON.stringify({ memorySummary: { sourceLabel: 'summary:all conversations/2026-09-21T13:13Z/through #8',
    text: 'The cedar trail starts at West Pier.' } }), 'The cedar trail starts at West Pier.')).toBe(false);
});

it('counts only actual reply intents with the signal, across journal replay', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-provenance-')));
  const key = new Uint8Array(32).fill(7);
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, {
      kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'trial',
      configurationDigest: 'sha256:test', expires: 9999999999999, maxCalls: 16, maxReplies: 16,
      maxTurns: 20, maxBytes: 32768, cursor: 0 });
    for (const [update, flagged, body] of [[1, true, 'The studio launch code is CYAN 47.'],
      [2, true, 'A holding reply.'], [3, false, 'The code is unknown.']] as const) {
      const id = `telegram:12345678:update:${update}`;
      journal.append({ kind: 'intake', id, update, text: `question ${update}`,
        raw: JSON.stringify({ message: { from: { id: 7654321 } } }), accepted: true, cursor: update + 1, at: 1000 });
      journal.append({ kind: 'reserve', id, at: 1000 });
      journal.append({ kind: 'answer', id, text: update === 2 ? 'The studio launch code is CYAN 47.' : body,
        ...(flagged ? { unlabeledRecall: true } : {}), at: 1000 });
      journal.append({ kind: 'intent', id, text: `PREVIEW — ${body}`, chat: '7654321', update, grant: 'trial', at: 1000 });
    }
    journal.close();
    const status = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      'tests/preview/journal-agent.mjs', 'status', '--root', root], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 10000,
      env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });
    expect(status.status, status.stderr).toBe(0);
    expect(JSON.parse(status.stdout).answerProvenance).toEqual({ unlabeledRecallReplies: 1 });
  } finally { rmSync(root, { recursive: true, force: true }); }
});
