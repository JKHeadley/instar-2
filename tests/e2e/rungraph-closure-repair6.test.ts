import { spawnSync } from 'node:child_process';
import { closeSync, fsyncSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import type { SegmentStoragePort } from '../../src/facts/index.js';
import { appendImpossibleHistoryAccounting, impossibleHistoryContinuityFixture } from '../rungraph/closure-fixtures.js';
import { json, ref, value } from '../rungraph/fixtures.js';

const storageFor = (spine: string) => (fallback: SegmentStoragePort): SegmentStoragePort => ({ owner: 'part-ten',
  read: () => readFileSync(spine, 'utf8').split('\n').filter(Boolean).map(row => JSON.parse(row)),
  append: (bytes, expected) => {
    const rows = readFileSync(spine, 'utf8').split('\n').filter(Boolean).map(row => JSON.parse(row));
    if ((rows.at(-1)?.contentHash ?? null) !== expected) throw new Error('disk CAS');
    const fd = openSync(spine, 'a');
    try { writeFileSync(fd, `${bytes}\n`); fsyncSync(fd); } finally { closeSync(fd); }
    return fallback.append(bytes, expected);
  },
});

it('P5-SEAM-RC-R6-V39-REPLAY-E2E cold signed replay refuses impossible continuity and its first reply send', () => {
  const directory = mkdtempSync(join(tmpdir(), 'rungraph-repair6-continuity-'));
  const spine = join(directory, 'facts.jsonl');
  writeFileSync(spine, '');
  try {
    const f = impossibleHistoryContinuityFixture(storageFor(spine));
    const admitted = appendImpossibleHistoryAccounting(f);
    const seed = { context: json({ ...f.ctx, ownedBodies: undefined }), spine, id: f.id, opening: f.run.opening,
      generation: f.generation(), policy: f.deps.groundingPolicy, admissions: [...f.admissions],
      control: { standing: ref(f.opening), principal: f.owner, scope: f.scope },
      execution: value(f.deps.admission.execution(f.id, f.lease)), lease: f.lease,
      accounting: f.invalidAccounting, send: ref(admitted.send), verifyAccounting: admitted.reference,
      sendWitnesses: [...f.sendWitnesses] };
    const child = spawnSync(process.execPath, ['tests/e2e/rungraph-closure-cold-reader.mjs'], {
      input: JSON.stringify(seed), encoding: 'utf8',
    });
    expect(child.stderr).toBe('');
    expect(child.status).toBe(0);
    const result = JSON.parse(child.stdout) as Record<string, { kind: string; detail?: string }>;
    expect(result.view?.kind, JSON.stringify(result)).toBe('refused');
    expect(result.view?.detail).toMatch(/conflicted or tainted authority/);
    for (const key of ['continuity', 'send']) {
      expect(result[key]?.kind, JSON.stringify(result)).toBe('refused');
      expect(result[key]?.detail).toMatch(/conflicted or tainted authority/);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 20_000);
