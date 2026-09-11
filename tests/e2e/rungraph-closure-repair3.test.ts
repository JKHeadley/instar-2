import { spawnSync } from 'node:child_process';
import { closeSync, fsyncSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import type { SegmentStoragePort } from '../../src/facts/index.js';
import { exhaustionFixture } from '../rungraph/closure-fixtures.js';
import { json, ref, value } from '../rungraph/fixtures.js';

it('P5-SEAM-RC-R3-E2E-REPLAY fresh-process reconstruction refuses an exit supported by a superseded signed observation', () => {
  const directory = mkdtempSync(join(tmpdir(), 'rungraph-repair3-replay-')), spine = join(directory, 'facts.jsonl');
  writeFileSync(spine, '');
  const storage = (fallback: SegmentStoragePort): SegmentStoragePort => ({ owner: 'part-ten',
    read: () => readFileSync(spine, 'utf8').split('\n').filter(Boolean).map(row => JSON.parse(row)),
    append: (bytes, expected) => {
      const rows = readFileSync(spine, 'utf8').split('\n').filter(Boolean).map(row => JSON.parse(row));
      if ((rows.at(-1)?.contentHash ?? null) !== expected) throw new Error('disk CAS');
      const fd = openSync(spine, 'a');
      try { writeFileSync(fd, bytes + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
      return fallback.append(bytes, expected);
    },
  });
  try {
    const f = exhaustionFixture(storage);
    f.append('run-exit-evaluation', json({ ...f.blocker.body as object, status: 'satisfied' }), [f.blocker.id]);
    const seed = { context: json({ ...f.ctx, ownedBodies: undefined }), spine, id: f.id, opening: f.run.opening,
      generation: f.generation(), policy: f.deps.groundingPolicy, admissions: [...f.admissions],
      control: { standing: ref(f.opening), principal: f.owner, scope: f.scope },
      execution: value(f.deps.admission.execution(f.id, f.lease)), unreachable: f.transition, lease: f.lease };
    const child = spawnSync(process.execPath, ['tests/e2e/rungraph-closure-cold-reader.mjs'], {
      input: JSON.stringify(seed), encoding: 'utf8',
    });
    expect(child.stderr).toBe('');
    expect(child.status).toBe(0);
    const result = JSON.parse(child.stdout) as { view: { kind: string; state: string }; unreachable: { kind: string; detail: string } };
    expect(result.view).toMatchObject({ kind: 'accepted', state: 'ready' });
    expect(result.unreachable.kind).toBe('refused');
    expect(result.unreachable.detail).toContain('stale, superseded, or conflicted');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 20_000);
