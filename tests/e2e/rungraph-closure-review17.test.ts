import { closeSync, fsyncSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import type { SegmentStoragePort } from '../../src/facts/index.js';
import { continuityFixture, exhaustionFixture } from '../rungraph/closure-fixtures.js';
import { json, ref, value } from '../rungraph/fixtures.js';

function durableSpine(path: string) {
  writeFileSync(path, '');
  return (fallback: SegmentStoragePort): SegmentStoragePort => ({ owner: 'part-ten',
    read: () => readFileSync(path, 'utf8').split('\n').filter(Boolean).map(row => JSON.parse(row)),
    append: (bytes, expected) => {
      const rows = readFileSync(path, 'utf8').split('\n').filter(Boolean).map(row => JSON.parse(row));
      if ((rows.at(-1)?.contentHash ?? null) !== expected) throw new Error('disk CAS');
      const fd = openSync(path, 'a');
      try { writeFileSync(fd, bytes + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
      return fallback.append(bytes, expected);
    },
  });
}

it.each([
  ['P5-SEAM-RC-R17-V50', 'exhaustion'],
  ['P5-SEAM-RC-R17-V52', 'continuity'],
] as const)('%s P5-NF-17 P5-NF-46 returns the original record after cold replay with equal Run openings',
  (fixtureId, kind) => {
    expect(fixtureId).toMatch(/^P5-SEAM-RC-R17-V(?:50|52)$/);
    const directory = mkdtempSync(join(tmpdir(), `rungraph-review17-${kind}-`));
    const spine = join(directory, 'facts.jsonl');
    try {
      const setup = kind === 'exhaustion' ? (() => {
        const f = exhaustionFixture(durableSpine(spine));
        return { f, original: f.exhaustionFact, record: { exhaustion: f.exhaustion } };
      })() : (() => {
        const f = continuityFixture(durableSpine(spine));
        return { f, original: value(f.graph.recordContinuity(f.accounting, f.lease)),
          record: { accounting: f.accounting } };
      })();
      const { f, original, record } = setup;
      const opening = value(f.store.read()).find(fact => fact.kind === 'run-opening')!;
      const duplicate = f.append('run-opening', json(opening.body)).fact;
      f.admissions.add(duplicate.id);
      const seed = { context: json({ ...f.ctx, ownedBodies: undefined }), spine, id: f.id,
        opening: f.run.opening, generation: f.generation(), policy: f.deps.groundingPolicy,
        admissions: [...f.admissions], control: ref(f.opening),
        execution: value(f.deps.admission.execution(f.id, f.lease)), lease: f.lease, ...record };
      const child = spawnSync(process.execPath, ['tests/e2e/rungraph-closure-cold-reader.mjs'],
        { input: JSON.stringify(seed), encoding: 'utf8' });
      expect(child.status, child.stderr).toBe(0);
      const restarted = JSON.parse(child.stdout) as Readonly<Record<string, Readonly<Record<string, unknown>>>>;
      expect(restarted.view).toMatchObject({ kind: 'accepted', state: 'ready' });
      expect(restarted[kind]).toEqual({ kind: 'accepted', id: original.id });
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }, 20_000);
