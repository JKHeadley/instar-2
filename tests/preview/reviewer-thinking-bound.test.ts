import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openPreviewJournal } from './journal.js';
import { replyReviewDiagnostics } from './reply-check.js';

const key = new Uint8Array(32).fill(7);

it.each([
  ['complete near cap', 'complete', 2048],
  ['uncertain without usage', 'uncertain', null],
] as const)('%s: reviewer diagnostics survive replay and appear in status and inspect', (_name, state, count) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-review-diagnostics-')));
  try {
    const id = 'telegram:12345678:update:1';
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis',
      bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
      configurationDigest: 'sha256:offline', expires: 9999999999999,
      maxCalls: 2, maxReplies: 2, maxTurns: 2, maxBytes: 32768, cursor: 0 });
    journal.append({ kind: 'intake', id, update: 1, text: 'question', raw: '{}', accepted: true, cursor: 2, at: 1000 });
    journal.append({ kind: 'reserve', id, at: 1000 });
    journal.append({ kind: 'answer', id, text: 'candidate', state: 'complete', at: 1000 });
    journal.append({ kind: 'reply-review-reserve', id, candidate: 'PREVIEW — candidate', at: 1000 });
    const diagnostics = replyReviewDiagnostics(count === null ? undefined : { outputTokens: count });
    journal.append({ kind: 'reply-review-state', id, state, diagnostics, at: 1000 });
    journal.append({ kind: 'hold', id, reason: 'reply check unavailable', at: 1000 });
    journal.close();

    const replay = openPreviewJournal(join(root, 'journal.encrypted'), key);
    expect(replay.view.order[0]?.reviewDiagnostics).toEqual({ outputTokens: count, thinkingPresent: 'unobservable' });
    expect(replay.view.order[0]?.intent).toBeUndefined();
    replay.close();

    for (const command of ['status', 'inspect']) {
      const result = spawnSync(process.execPath,
        ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs',
          command, '--root', root], { cwd: process.cwd(), encoding: 'utf8', timeout: 10000,
          env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout).lastReplyReview).toEqual({ update: 1, state,
        diagnostics: { outputTokens: count, thinkingPresent: 'unobservable' } });
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
