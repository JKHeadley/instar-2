import { expect, it } from 'vitest';
import { closeSync, fsyncSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { SegmentStoragePort } from '../../src/facts/index.js';
import { continuityFixture, pressureFixture } from '../rungraph/closure-fixtures.js';
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

function cold(f: ReturnType<typeof continuityFixture> | ReturnType<typeof pressureFixture>, spine: string, accounting?: unknown) {
  const execution = value(f.deps.admission.execution(f.id, f.lease));
  const seed = { context: json({ ...f.ctx, ownedBodies: undefined }), spine, id: f.id, opening: f.run.opening,
    generation: f.generation(), policy: f.deps.groundingPolicy, admissions: [...f.admissions],
    control: ref(f.opening), execution, accounting, lease: f.lease };
  const child = spawnSync(process.execPath, ['tests/e2e/rungraph-closure-cold-reader.mjs'], { input: JSON.stringify(seed), encoding: 'utf8' });
  expect(child.stderr).toBe('');
  expect(child.status).toBe(0);
  return JSON.parse(child.stdout) as { view: { kind: string; state: string; blockedOn: { reference?: string } };
    continuity?: { kind: string; id?: string } };
}

it('P5-SEAM-RC-F8-CONTINUITY-E2E revalidates witnessed ContinuityAccounting in a fresh process after fsync restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'rungraph-continuity-restart-')), spine = join(directory, 'facts.jsonl');
  try {
    const f = continuityFixture(durableSpine(spine));
    const fact = value(f.graph.recordContinuity(f.accounting, f.lease));
    const restarted = cold(f, spine, f.accounting);
    expect(restarted.view).toMatchObject({ kind: 'accepted', state: 'ready' });
    expect(restarted.continuity).toEqual({ kind: 'accepted', id: fact.id });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 20_000);

it.each(['queue-full', 'quota-wall', 'safety-ceiling', 'open-breaker'] as const)
('P5-SEAM-RC-F8-PRESSURE-E2E replays fsynced %s pressure in a fresh process without terminal promotion', basis => {
  const directory = mkdtempSync(join(tmpdir(), `rungraph-pressure-${basis}-`)), spine = join(directory, 'facts.jsonl');
  try {
    const f = pressureFixture(basis, durableSpine(spine));
    value(f.graph.transition(f.transition));
    const restarted = cold(f, spine);
    expect(restarted.view, JSON.stringify(restarted)).toMatchObject({
      kind: 'accepted', state: basis === 'safety-ceiling' ? 'halted' : 'waiting',
    });
    expect(restarted.view.blockedOn.reference).toBe(basis === 'safety-ceiling' ? basis : 'step:operation:1');
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 20_000);
