import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openPreviewJournal } from './journal.js';

const key = new Uint8Array(32).fill(7);
const origin = () => realpathSync(mkdtempSync(join(tmpdir(), 'preview-scale-test-')));
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:offline', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 10, maxReplies: 10, maxTurns: 10, maxBytes: 262144, cursor: 0 };
const id = (n: number) => `telegram:12345678:update:${n}`;

it('replays held turns through a snapshot and clears only eligible holds after a summary', () => {
  const root = origin(), path = join(root, 'journal.encrypted');
  try {
    const writer = openPreviewJournal(path, key, genesis);
    for (let n = 1; n <= 3; n++) writer.append({ kind: 'intake', id: id(n), update: n,
      text: `turn ${n}`, raw: `raw ${n}`, accepted: true, cursor: n + 1, at: 1000 + n });
    writer.append({ kind: 'hold', id: id(1), reason: 'prompt overflow', at: 1010 });
    writer.append({ kind: 'hold', id: id(2), reason: 'summary faithfulness: unsure', at: 1011 });
    writer.append({ kind: 'hold', id: id(3), reason: 'memory correction pending', at: 1012 });
    expect([...writer.view.heldTurns].map(turn => turn.id)).toEqual([id(1), id(2), id(3)]);
    writer.compact(); writer.close();
    const reopened = openPreviewJournal(path, key);
    expect([...reopened.view.heldTurns].map(turn => turn.id)).toEqual([id(1), id(2), id(3)]);
    reopened.append({ kind: 'summary-reserve', through: 2, at: 1020 });
    reopened.append({ kind: 'summary', through: 2, text: 'summary', at: 1021 });
    expect([...reopened.view.heldTurns].map(turn => turn.id)).toEqual([id(3)]);
    expect(reopened.view.order.map(turn => turn.held)).toEqual([undefined, undefined, 'memory correction pending']);
    reopened.append({ kind: 'memory-undecided', id: id(3), reason: 'summary-uncertain', at: 1022 });
    expect(reopened.view.heldTurns.size).toBe(0);
    reopened.append({ kind: 'hold', id: id(1), reason: 'call cap', at: 1023 });
    reopened.append({ kind: 'reserve', id: id(1), at: 1024 });
    expect(reopened.view.heldTurns.size).toBe(0);
    expect(reopened.view.order[0]?.held).toBeUndefined();
    reopened.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('opens 10k compacted turns below the declared time and heap bounds', () => {
  const result = spawnSync(process.execPath, ['--expose-gc', '--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
    'tests/preview/journal-reopen-benchmark.mjs', '10000'], { cwd: process.cwd(), encoding: 'utf8', timeout: 120000 });
  expect(result.status, result.stderr).toBe(0);
  const metric = JSON.parse(result.stdout) as { turns: number; rawMs: number; openMs: number;
    rawHeapDeltaMb: number; heapDeltaMb: number };
  expect(metric.turns).toBe(10000);
  expect(metric.rawMs).toBeLessThan(2000);
  expect(metric.openMs).toBeLessThan(2000);
  expect(metric.rawHeapDeltaMb).toBeLessThan(128);
  expect(metric.heapDeltaMb).toBeLessThan(128);
}, 120000);
