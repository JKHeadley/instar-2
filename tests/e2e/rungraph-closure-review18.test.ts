import { closeSync, fsyncSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import type { SegmentStoragePort } from '../../src/facts/index.js';
import { appendLegacyCompletion, closeUnreachable, exhaustionFixture } from '../rungraph/closure-fixtures.js';
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

function cold(f: ReturnType<typeof exhaustionFixture>, spine: string) {
  const seed = { context: json({ ...f.ctx, ownedBodies: undefined }), spine, id: f.id,
    opening: f.run.opening, generation: f.generation(), policy: f.deps.groundingPolicy,
    admissions: [...f.admissions], control: ref(f.opening),
    execution: value(f.deps.admission.execution(f.id, f.lease)), lease: f.lease };
  const child = spawnSync(process.execPath, ['tests/e2e/rungraph-closure-cold-reader.mjs'],
    { input: JSON.stringify(seed), encoding: 'utf8' });
  expect(child.status, child.stderr).toBe(0);
  return JSON.parse(child.stdout) as Readonly<{ view: Readonly<{ kind: string; state?: string }> }>;
}

it.each([
  ['P5-SEAM-RC-R18-V61-E2E', 'mixed-successors', 'halted'],
  ['P5-SEAM-RC-R18-V66-E2E', 'exhaustion-only', 'completed'],
  ['P5-SEAM-RC-R18-V67-E2E', 'unwitnessed-unreachable', 'completed'],
] as const)('%s P5-NF-09 P5-NF-17 rebuilds durable closure history without hiding conflict or over-refusing: %s',
  (fixtureId, mode, expectedState) => {
    expect(fixtureId).toMatch(/^P5-SEAM-RC-R18-V(?:61|66|67)-E2E$/);
    const directory = mkdtempSync(join(tmpdir(), `rungraph-review18-${mode}-`));
    const spine = join(directory, 'facts.jsonl');
    try {
      const storage = durableSpine(spine);
      const f = mode === 'exhaustion-only' ? exhaustionFixture(storage) : closeUnreachable(storage);
      if (mode === 'unwitnessed-unreachable') {
        for (const fact of value(f.store.read())) {
          if (fact.kind === 'run-unreachable-exit') f.admissions.delete(fact.id);
        }
      }
      appendLegacyCompletion(f);
      expect(cold(f, spine).view).toMatchObject({ kind: 'accepted', state: expectedState });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 20_000);
