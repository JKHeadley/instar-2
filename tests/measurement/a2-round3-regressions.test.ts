import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { round3ReviewCases } from './a2-round3-review-cases.js';

const freshPeerWorker = new URL('./a2-peer-fresh-worker.ts', import.meta.url);
const viteNode = join(process.cwd(), 'node_modules', '.bin', 'vite-node');

describe('Part 16 A2 round-three independent review regressions', () => {
  for (const reviewCase of round3ReviewCases) {
    const label = reviewCase.name.startsWith('attribution:')
      ? 'P16-NF-13 [behavior:unattributed-conflicted]'
      : reviewCase.name.startsWith('burn:')
        ? 'P16-NF-33 [behavior:burn-hysteresis] P16-NF-34 [behavior:coverage-debt]'
        : reviewCase.name.startsWith('peer:') || reviewCase.name.startsWith('resource:')
          || reviewCase.name.startsWith('history:late-usage')
          ? 'P16-NF-37 [behavior:peer-union-window] NON-EXECUTABLE-UNTIL-slice-A2b-peer-merge'
          : '';
    it(`${label} ${reviewCase.name}`.trim(), () => {
      expect(reviewCase.pass, JSON.stringify(reviewCase.actual ?? reviewCase, null, 2)).toBe(true);
    });
  }

  it('P16-NF-37 [behavior:peer-union-window] NON-EXECUTABLE-UNTIL-slice-A2b-peer-merge peer:fresh-process-input-is-byte-equal-before-and-after-unrelated-call', () => {
    const output = execFileSync(viteNode, ['--script', freshPeerWorker.pathname], {
      cwd: process.cwd(), encoding: 'utf8',
    });
    const result = JSON.parse(output) as { before: unknown; after: unknown };
    expect(result.before).toEqual(result.after);
    expect(result.before).toMatchObject({ kind: 'Success', value: {
      state: 'complete', members: ['cold:witness'],
    } });
  });
});
