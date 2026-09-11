import { closeSync, fsyncSync, mkdtempSync, openSync, readFileSync, rmSync,
  writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import type { SegmentStoragePort } from '../../src/facts/index.js';
import { closureRecordWire, createRunClosureGraph, recordFromWire,
  recordWire } from '../../src/rungraph/index.js';
import { alteredGroundingContinuityFixture, continuityFixture,
  exhaustionFixture } from '../rungraph/closure-fixtures.js';
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

function cold(f: ReturnType<typeof continuityFixture> | ReturnType<typeof exhaustionFixture>, spine: string,
  extra: Readonly<Record<string, unknown>> = {}) {
  const seed = { context: json({ ...f.ctx, ownedBodies: undefined }), spine, id: f.id,
    opening: f.run.opening, generation: f.generation(), policy: f.deps.groundingPolicy,
    admissions: [...f.admissions], control: ref(f.opening),
    execution: value(f.deps.admission.execution(f.id, f.lease)), lease: f.lease, ...extra };
  const child = spawnSync(process.execPath, ['tests/e2e/rungraph-closure-cold-reader.mjs'],
    { input: JSON.stringify(seed), encoding: 'utf8' });
  expect(child.status, child.stderr).toBe(0);
  return JSON.parse(child.stdout) as Readonly<{
    view: Readonly<{ kind: string; state?: string }>;
    continuity?: Readonly<{ kind: string; id?: string }>;
  }>;
}

it.each([
  ['P5-SEAM-RC-R19-V43-E2E', 'coverage', false],
  ['P5-SEAM-RC-R19-V59-E2E', 'coverage', true],
  ['P5-SEAM-RC-R19-V60-E2E', 'binding', true],
  ['P5-SEAM-RC-R19-V61-E2E', 'pending', true],
  ['P5-SEAM-RC-R19-V62-E2E', 'receipt', true],
  ['P5-SEAM-RC-R19-V63-E2E', 'valid', true],
  ['P5-SEAM-RC-R19-V64-E2E', 'policy', false],
] as const)('%s P5-NF-45 P5-NF-46 revalidates signed continuity after fsync and fresh-process restart: %s unavailable=%s',
  (_fixtureId, mode, unavailable) => {
    const directory = mkdtempSync(join(tmpdir(), `rungraph-review19-${mode}-`));
    const spine = join(directory, 'facts.jsonl');
    try {
      const f = alteredGroundingContinuityFixture(mode, durableSpine(spine));
      if (unavailable) Object.assign(f.ctx.captures['message:1']!, { status: 'missing', bytes: null });
      const accounting = unavailable ? { ...f.alteredAccounting,
        prePauseCapture: { ...f.alteredAccounting.prePauseCapture, status: 'unavailable' as const } }
        : f.alteredAccounting;
      const fact = f.append('continuity-accounting', json({ run: f.id,
        record: closureRecordWire(accounting as never) })).fact;
      f.admissions.add(fact.id);

      const restarted = cold(f, spine, { accounting });
      expect(restarted.continuity?.kind).toBe(mode === 'valid' ? 'accepted' : 'refused');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 20_000);

function conditionalCopyCut(kind: 'continuity' | 'exhaustion', changed: boolean, spine: string) {
  if (kind === 'continuity') {
    const f = continuityFixture(durableSpine(spine));
    const original = recordFromWire((f.groundingFact.body as { record: never }).record) as Record<string, unknown>;
    const graph = value(createRunClosureGraph({ ...f.deps, admission: { ...f.deps.admission,
      commit: (request, write) => {
        const contender = changed ? { ...original, reason: 'recovery' } : original;
        const copy = f.append('session-grounding', json({ run: f.id,
          record: recordWire(contender as never) })).fact;
        f.admissions.add(copy.id);
        return f.deps.admission.commit(request, write);
      },
    } }));
    const result = graph.recordContinuity(f.accounting, f.lease);
    return { f, result, recordCount: value(f.store.read())
      .filter(fact => fact.kind === 'continuity-accounting').length };
  }
  const f = exhaustionFixture(durableSpine(spine));
  const groundingFact = value(f.graph.ground(f.id, 'w', 'h', 'resume', f.lease));
  const original = recordFromWire((groundingFact.body as { record: never }).record) as Record<string, unknown>;
  const graph = value(createRunClosureGraph({ ...f.deps, admission: { ...f.deps.admission,
    commit: (request, write) => {
      const contender = changed ? { ...original, reason: 'recovery' } : original;
      const copy = f.append('session-grounding', json({ run: f.id,
        record: recordWire(contender as never) })).fact;
      f.admissions.add(copy.id);
      return f.deps.admission.commit(request, write);
    },
  } }));
  const result = graph.recordExhaustion({ ...f.exhaustion, id: 'review19:e2e-exhaustion' }, f.lease);
  return { f, result, recordCount: value(f.store.read()).filter(fact => fact.kind === 'run-exhaustion').length };
}

it.each([
  ['P5-SEAM-RC-R19-V68-E2E', 'continuity', true],
  ['P5-SEAM-RC-R19-V69-E2E', 'exhaustion', true],
  ['P5-SEAM-RC-R19-V70-E2E', 'continuity', false],
  ['P5-SEAM-RC-R19-V71-E2E', 'exhaustion', false],
] as const)('%s P5-NF-09 P5-NF-46 preserves the conditional %s conflict decision after restart, changed=%s',
  (_fixtureId, kind, changed) => {
    const directory = mkdtempSync(join(tmpdir(), `rungraph-review19-cut-${kind}-`));
    const spine = join(directory, 'facts.jsonl');
    try {
      const { f, result, recordCount } = conditionalCopyCut(kind, changed, spine);
      expect(result).toMatchObject({ kind: changed ? 'Refused' : 'Success' });
      const expectedCount = kind === 'continuity' ? (changed ? 0 : 1) : (changed ? 1 : 2);
      expect(recordCount).toBe(expectedCount);
      expect(cold(f, spine).view).toMatchObject({ kind: 'accepted', state: changed ? 'halted' : 'ready' });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 20_000);
