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
      try {
        writeFileSync(fd, bytes + '\n');
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      return fallback.append(bytes, expected);
    },
  });
}

type ColdFixture = ReturnType<typeof exhaustionFixture> | ReturnType<typeof closeUnreachable>;

function cold(f: ColdFixture, spine: string, extra: Readonly<Record<string, unknown>>) {
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
    ...extra,
  };
  const child = spawnSync(process.execPath, ['tests/e2e/rungraph-closure-cold-reader.mjs'], {
    input: JSON.stringify(seed),
    encoding: 'utf8',
  });
  expect(child.status, child.stderr).toBe(0);
  return JSON.parse(child.stdout) as Readonly<{
    view: Readonly<{ kind: string; state?: string }>;
    exhaustion?: Readonly<{ kind: string; id?: string; detail?: string }>;
    unreachable?: Readonly<{ kind: string; id?: string; detail?: string }>;
  }>;
}

it('P5-SEAM-RC-A-PRIME-F1-E2E P5-NF-17 P5-NF-23 rejects invalid proposal and close origins after fsync and fresh-process reconstruction', () => {
  const directory = mkdtempSync(join(tmpdir(), 'rungraph-review22-f1-'));
  try {
    const proposalSpine = join(directory, 'proposal.jsonl');
    const proposalFixture = exhaustionFixture(durableSpine(proposalSpine));
    const badProposal = {
      ...proposalFixture.exit,
      id: 'review22:e2e:bad-proposal',
      frontier: {},
    };
    const badProposalFact = proposalFixture.append('run-unreachable-exit', json({
      run: proposalFixture.id,
      record: closureRecordWire(badProposal as never),
    })).fact;
    proposalFixture.admissions.add(badProposalFact.id);
    const proposalRestart = cold(proposalFixture, proposalSpine, { unreachable: badProposal });
    expect(proposalRestart.view).toMatchObject({ kind: 'accepted', state: 'ready' });
    expect(proposalRestart.unreachable?.kind).toBe('refused');

    const closeSpine = join(directory, 'close.jsonl');
    const closeFixture = exhaustionFixture(durableSpine(closeSpine));
    const proposal = value(closeFixture.graph.recordUnreachableExit(closeFixture.exit, closeFixture.lease));
    const badClose = {
      ...closeFixture.exit,
      id: 'review22:e2e:bad-close',
      expected: closeFixture.exit.id,
      phase: 'close' as const,
      frontier: {},
      proposal: {
        owner: 'part-five' as const,
        name: 'UnreachableRunExit' as const,
        id: closeFixture.exit.id,
        fact: ref(proposal),
      },
    };
    const badCloseFact = closeFixture.append('run-unreachable-exit', json({
      run: closeFixture.id,
      record: closureRecordWire(badClose as never),
    })).fact;
    closeFixture.admissions.add(badCloseFact.id);
    const closeRestart = cold(closeFixture, closeSpine, { unreachable: badClose });
    expect(closeRestart.view).toMatchObject({ kind: 'accepted', state: 'closing' });
    expect(closeRestart.unreachable?.kind).toBe('refused');

    const validSpine = join(directory, 'valid.jsonl');
    const valid = closeUnreachable(durableSpine(validSpine));
    const validRestart = cold(valid, validSpine, { unreachable: valid.terminalExit });
    expect(validRestart.view).toMatchObject({ kind: 'accepted', state: 'unreachable' });
    expect(validRestart.unreachable).toEqual({ kind: 'accepted', id: valid.closeFact.id });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 20_000);

it('P5-SEAM-RC-A-PRIME-F2-E2E P5-NF-23 fresh-process public admission returns the typed refusal for excluded grounding input', () => {
  const directory = mkdtempSync(join(tmpdir(), 'rungraph-review22-f2-'));
  try {
    const spine = join(directory, 'facts.jsonl');
    const f = exhaustionFixture(durableSpine(spine));
    const unsupported = {
      ...f.exhaustion,
      id: 'review22:e2e:grounding',
      grounding: ref(f.opening),
    };
    const restarted = cold(f, spine, { exhaustion: unsupported });
    expect(restarted.view).toMatchObject({ kind: 'accepted', state: 'ready' });
    expect(restarted.exhaustion).toEqual({
      kind: 'refused',
      detail: 'unsupported-in-slice-a-prime',
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 20_000);

