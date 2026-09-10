import { closeSync, fsyncSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import type { SegmentStoragePort } from '../../src/facts/index.js';
import { exhaustionFixture } from '../rungraph/closure-fixtures.js';
import { transitionedContinuity, unknownDependencyExhaustion } from '../rungraph/review15-fixtures.js';
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

function cold(f: ReturnType<typeof exhaustionFixture> | ReturnType<typeof transitionedContinuity>
  | ReturnType<typeof unknownDependencyExhaustion>, spine: string,
  extra: Readonly<Record<string, unknown>> = {}) {
  const currentClock = f.deps.clock();
  const context = json({ ...f.ctx, ownedBodies: undefined,
    genesis: { ...f.ctx.genesis, clock: currentClock } });
  const seed = { context, spine, id: f.id, opening: f.run.opening, generation: f.generation(),
    policy: f.deps.groundingPolicy, admissions: [...f.admissions], control: ref(f.opening),
    execution: value(f.deps.admission.execution(f.id, f.lease)), lease: f.lease, ...extra };
  const child = spawnSync(process.execPath, ['tests/e2e/rungraph-closure-cold-reader.mjs'],
    { input: JSON.stringify(seed), encoding: 'utf8' });
  expect(child.status, child.stderr).toBe(0);
  return JSON.parse(child.stdout) as {
    view: { kind: string; state?: string; detail?: string };
    continuity?: { kind: string; id?: string; detail?: string };
    exhaustion?: { kind: string; id?: string; detail?: string };
  };
}

it('P5-SEAM-RC-R15-F1-CLOCK-E2E P5-NF-17 rebuilds an unreachable close whose signed clock advanced after proposal', () => {
  const directory = mkdtempSync(join(tmpdir(), 'rungraph-review15-clock-'));
  const spine = join(directory, 'facts.jsonl');
  try {
    const f = exhaustionFixture(durableSpine(spine));
    const proposalFact = value(f.graph.recordUnreachableExit(f.exit, f.lease));
    f.setClock(f.now.value + 51);
    const close = { ...f.exit, id: 'review15:e2e-close', expected: f.exit.id, phase: 'close' as const,
      at: f.deps.clock(), frontier: value(f.graph.read(f.id)).source.foldedThrough,
      proposal: { owner: 'part-five' as const, name: 'UnreachableRunExit' as const,
        id: f.exit.id, fact: ref(proposalFact) } };
    value(f.graph.recordUnreachableExit(close, f.lease));
    expect(cold(f, spine).view).toEqual({ kind: 'accepted', state: 'unreachable',
      blockedOn: expect.anything() });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 20_000);

it('P5-SEAM-RC-R15-F2-CAPTURE-E2E P5-NF-46 revalidates transitioned unavailable pending accounting after fsynced restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'rungraph-review15-capture-'));
  const spine = join(directory, 'facts.jsonl');
  try {
    const f = transitionedContinuity(false, durableSpine(spine));
    const accountingFact = value(f.graph.recordContinuity(f.accounting, f.lease));
    const restarted = cold(f, spine, { accounting: f.accounting });
    expect(restarted.view).toMatchObject({ kind: 'refused', detail: 'conflicted or tainted authority' });
    expect(restarted.continuity).toEqual({ kind: 'accepted', id: accountingFact.id });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 20_000);

it('P5-SEAM-RC-R15-F3-PARTIAL-E2E P5-NF-23 P5-NF-24 revalidates the original partial unknown-dependency record after fsynced restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'rungraph-review15-partial-'));
  const spine = join(directory, 'facts.jsonl');
  try {
    const f = unknownDependencyExhaustion(durableSpine(spine));
    const exhaustionFact = value(f.graph.recordExhaustion(f.partial, f.lease));
    const restarted = cold(f, spine, { exhaustion: f.partial });
    expect(restarted.view).toMatchObject({ kind: 'accepted', state: 'ready' });
    expect(restarted.exhaustion).toEqual({ kind: 'accepted', id: exhaustionFact.id });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 20_000);
