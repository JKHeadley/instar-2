import { closeSync, fsyncSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import type { SegmentStoragePort } from '../../src/facts/index.js';
import { closureRecordWire } from '../../src/rungraph/index.js';
import { exhaustionFixture } from '../rungraph/closure-fixtures.js';
import { json, ref, value } from '../rungraph/fixtures.js';

function durableSpine(path: string) {
  writeFileSync(path, '');
  return (fallback: SegmentStoragePort): SegmentStoragePort => ({
    owner: 'part-ten',
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

function stop(f: ReturnType<typeof exhaustionFixture>, id: string) {
  return value(f.graph.transition({
    type: 'RunTransition', schemaVersion: 1, id, run: f.id, expected: f.ready.head,
    trigger: ref(f.opening), kind: 'stop', from: 'ready', to: 'halted',
    responsible: f.owner, standing: ref(f.opening), ownership: f.lease,
    generation: f.run.generation, at: f.now,
    blockedOn: { kind: 'stop', reference: 'operator-stop', owner: f.owner,
      nextObservation: f.clock(1000) },
    nextWake: f.run.nextWake,
  }));
}

function cold(f: ReturnType<typeof exhaustionFixture>, spine: string, exhaustion: unknown) {
  const seed = {
    context: json({ ...f.ctx, ownedBodies: undefined }), spine, id: f.id,
    opening: f.run.opening, generation: f.generation(), policy: f.deps.groundingPolicy,
    admissions: [...f.admissions], control: ref(f.opening), stimulusKinds: f.c.stimulusKinds,
    execution: value(f.deps.admission.execution(f.id, f.lease)), lease: f.lease, exhaustion,
  };
  const child = spawnSync(process.execPath, ['tests/e2e/rungraph-closure-cold-reader.mjs'], {
    input: JSON.stringify(seed), encoding: 'utf8',
  });
  expect(child.status, child.stderr).toBe(0);
  return JSON.parse(child.stdout) as Readonly<{
    view: Readonly<{ kind: string; state?: string }>;
    exhaustion: Readonly<{ kind: string; id?: string; detail?: string }>;
  }>;
}

it('P5-SEAM-RC-A-PRIME-R23-F1-E2E P5-NF-17 P5-NF-23 a fresh process refuses exhaustion whose predecessor appeared only after its signed admission', () => {
  const directory = mkdtempSync(join(tmpdir(), 'rungraph-review23-f1-'));
  try {
    const spine = join(directory, 'facts.jsonl');
    const f = exhaustionFixture(durableSpine(spine));
    const bad = { ...f.exhaustion, id: 'review23:e2e:invalid', expected: 'review23:e2e:later-stop' };
    const fact = f.append('run-exhaustion', json({
      run: f.id,
      record: closureRecordWire(bad as never),
    })).fact;
    f.admissions.add(fact.id);
    stop(f, bad.expected);

    const restarted = cold(f, spine, bad);
    expect(restarted.view).toMatchObject({ kind: 'accepted', state: 'halted' });
    expect(restarted.exhaustion.kind).toBe('refused');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 20_000);

it('P5-SEAM-RC-A-PRIME-R23-F2-E2E P5-NF-17 P5-NF-23 a fresh process returns a valid original exhaustion after an unrelated head change', () => {
  const directory = mkdtempSync(join(tmpdir(), 'rungraph-review23-f2-'));
  try {
    const spine = join(directory, 'facts.jsonl');
    const f = exhaustionFixture(durableSpine(spine));
    stop(f, 'review23:e2e:later-stop');

    const restarted = cold(f, spine, f.exhaustion);
    expect(restarted.view).toMatchObject({ kind: 'accepted', state: 'halted' });
    expect(restarted.exhaustion).toEqual({ kind: 'accepted', id: f.exhaustionFact.id });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 20_000);
