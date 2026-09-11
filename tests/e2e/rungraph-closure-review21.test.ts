import { closeSync, fsyncSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import type { SegmentStoragePort } from '../../src/facts/index.js';
import { closureRecordWire } from '../../src/rungraph/index.js';
import { closeUnreachable, exhaustionFixture } from '../rungraph/closure-fixtures.js';
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

type ColdFixture = ReturnType<typeof exhaustionFixture> | ReturnType<typeof closeUnreachable>;

function cold(f: ColdFixture, spine: string, unreachable?: unknown) {
  const seed = {
    context: json({ ...f.ctx, ownedBodies: undefined }),
    spine,
    id: f.id,
    opening: f.run.opening,
    generation: f.generation(),
    policy: f.deps.groundingPolicy,
    admissions: [...f.admissions],
    control: ref(f.opening),
    stimulusKinds: f.c.stimulusKinds,
    execution: value(f.deps.admission.execution(f.id, f.lease)),
    lease: f.lease,
    ...(unreachable ? { unreachable } : {}),
  };
  const child = spawnSync(process.execPath, ['tests/e2e/rungraph-closure-cold-reader.mjs'], {
    input: JSON.stringify(seed),
    encoding: 'utf8',
  });
  expect(child.status, child.stderr).toBe(0);
  return JSON.parse(child.stdout) as Readonly<{
    view: Readonly<{ kind: string; state?: string }>;
    unreachable?: Readonly<{ kind: string; id?: string }>;
  }>;
}

it('P5-SEAM-RC-R21-V53-E2E P5-SEAM-RC-R21-V54-E2E P5-NF-17 P5-NF-23 refuses unsupported signed exhaustion history after fsync and fresh-process replay while preserving the valid neighbor', () => {
  const directory = mkdtempSync(join(tmpdir(), 'rungraph-review21-'));
  try {
    const badSpine = join(directory, 'bad.jsonl');
    const bad = exhaustionFixture(durableSpine(badSpine));
    const invalidExhaustion = {
      ...bad.exhaustion,
      id: 'review21:durable-invalid-exhaustion',
      expected: 'missing-head',
    };
    const exhaustionFact = bad.append('run-exhaustion', json({
      run: bad.id,
      record: closureRecordWire(invalidExhaustion as never),
    })).fact;
    bad.admissions.add(exhaustionFact.id);
    const proposal = {
      ...bad.exit,
      id: 'review21:durable-invalid-proposal',
      exhaustion: { ...bad.exit.exhaustion, id: invalidExhaustion.id, fact: ref(exhaustionFact) },
      frontier: value(bad.graph.read(bad.id)).source.foldedThrough,
    };
    const proposalFact = bad.append('run-unreachable-exit', json({
      run: bad.id,
      record: closureRecordWire(proposal as never),
    })).fact;
    bad.admissions.add(proposalFact.id);
    const close = {
      ...proposal,
      id: 'review21:durable-invalid-close',
      expected: proposal.id,
      phase: 'close' as const,
      frontier: value(bad.graph.read(bad.id)).source.foldedThrough,
      proposal: {
        owner: 'part-five' as const,
        name: 'UnreachableRunExit' as const,
        id: proposal.id,
        fact: ref(proposalFact),
      },
    };
    const closeFact = bad.append('run-unreachable-exit', json({
      run: bad.id,
      record: closureRecordWire(close as never),
    })).fact;
    bad.admissions.add(closeFact.id);

    const restartedBad = cold(bad, badSpine, proposal);
    expect(restartedBad.view).toMatchObject({ kind: 'accepted', state: 'ready' });
    expect(restartedBad.unreachable?.kind).toBe('refused');

    const goodSpine = join(directory, 'good.jsonl');
    const good = closeUnreachable(durableSpine(goodSpine));
    const restartedGood = cold(good, goodSpine, good.terminalExit);
    expect(restartedGood.view).toMatchObject({ kind: 'accepted', state: 'unreachable' });
    expect(restartedGood.unreachable).toEqual({ kind: 'accepted', id: good.closeFact.id });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 20_000);
