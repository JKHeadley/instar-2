import { closeSync, fsyncSync, mkdtempSync, openSync, readFileSync, rmSync,
  writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import type { SegmentStoragePort } from '../../src/facts/index.js';
import { closureRecordWire, recordWire } from '../../src/rungraph/index.js';
import { alteredGroundingContinuityFixture, closeUnreachable, continuityWithLaterInbound,
  exhaustionFixture } from '../rungraph/closure-fixtures.js';
import { digest, json, ref, value } from '../rungraph/fixtures.js';
import { signedNext } from '../rungraph/review20-fixtures.js';

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

type ColdFixture = ReturnType<typeof alteredGroundingContinuityFixture>
  | ReturnType<typeof continuityWithLaterInbound> | ReturnType<typeof exhaustionFixture>
  | ReturnType<typeof closeUnreachable>;

function cold(f: ColdFixture, spine: string, extra: Readonly<Record<string, unknown>>) {
  const seed = { context: json({ ...f.ctx, ownedBodies: undefined }), spine, id: f.id,
    opening: f.run.opening, generation: f.generation(), policy: f.deps.groundingPolicy,
    admissions: [...f.admissions], control: ref(f.opening), stimulusKinds: f.c.stimulusKinds,
    execution: value(f.deps.admission.execution(f.id, f.lease)), lease: f.lease, ...extra };
  const child = spawnSync(process.execPath, ['tests/e2e/rungraph-closure-cold-reader.mjs'],
    { input: JSON.stringify(seed), encoding: 'utf8' });
  expect(child.status, child.stderr).toBe(0);
  return JSON.parse(child.stdout) as Readonly<{
    view: Readonly<{ kind: string; state?: string }>;
    continuity?: Readonly<{ kind: string; id?: string }>;
    unreachable?: Readonly<{ kind: string; id?: string }>;
  }>;
}

function persistedAccounting(f: ColdFixture, accounting: unknown) {
  const fact = f.append('continuity-accounting', json({ run: f.id,
    record: closureRecordWire(accounting as never) })).fact;
  f.admissions.add(fact.id);
  return fact;
}

function appendRaw(path: string, fact: unknown) {
  const fd = openSync(path, 'a');
  try { writeFileSync(fd, JSON.stringify(fact) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
}

it('P5-SEAM-RC-R20-F1-V49-V50-E2E P5-NF-45 P5-NF-46 enforces grounding envelope run binding after fsync and fresh-process restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'rungraph-review20-f1-'));
  try {
    const badSpine = join(directory, 'bad.jsonl');
    const bad = alteredGroundingContinuityFixture('valid', durableSpine(badSpine));
    const grounding = bad.append('session-grounding', json({ run: 'other-run',
      record: recordWire(bad.alteredGrounding as never) })).fact;
    bad.admissions.add(grounding.id);
    const firstReply = { operation: 'review20:e2e-envelope', digest: digest('review20:e2e-envelope') };
    const proposal = bad.append('continuity-reply-proposal', json({ run: bad.id, expected: bad.ready.head,
      grounding: grounding.id, inbound: bad.opening.id, ...firstReply,
      status: 'proposed', permission: 'none' })).fact;
    const disclosure = bad.append('continuity-disclosure', json({ run: bad.id, grounding: grounding.id,
      inbound: bad.opening.id, ...firstReply }), [proposal.id]).fact;
    const badAccounting = { ...bad.alteredAccounting, id: 'review20:e2e-envelope-accounting',
      grounding: { ...bad.alteredAccounting.grounding, fact: ref(grounding) }, firstReply,
      disclosure: ref(disclosure) };
    const history = value(bad.store.read());
    const badFact = signedNext(bad, history.at(-1)!, 'continuity-accounting', json({ run: bad.id,
      record: closureRecordWire(badAccounting as never) }));
    appendRaw(badSpine, badFact);
    bad.admissions.add(badFact.id);
    expect(cold(bad, badSpine, { accounting: badAccounting }).continuity?.kind).toBe('refused');

    const goodSpine = join(directory, 'good.jsonl');
    const good = alteredGroundingContinuityFixture('valid', durableSpine(goodSpine));
    const goodFact = persistedAccounting(good, good.alteredAccounting);
    expect(cold(good, goodSpine, { accounting: good.alteredAccounting }).continuity)
      .toEqual({ kind: 'accepted', id: goodFact.id });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 20_000);

it('P5-SEAM-RC-R20-F2-V51-V52-E2E P5-NF-45 P5-NF-46 enforces ancestral grounding admission after fsync and fresh-process restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'rungraph-review20-f2-'));
  try {
    const badSpine = join(directory, 'bad.jsonl');
    const bad = continuityWithLaterInbound(durableSpine(badSpine));
    persistedAccounting(bad, bad.currentAccounting);
    bad.admissions.delete(bad.groundingFact.id);
    expect(cold(bad, badSpine, { accounting: bad.currentAccounting }).continuity?.kind).toBe('refused');

    const goodSpine = join(directory, 'good.jsonl');
    const good = continuityWithLaterInbound(durableSpine(goodSpine));
    const goodFact = persistedAccounting(good, good.currentAccounting);
    expect(cold(good, goodSpine, { accounting: good.currentAccounting }).continuity)
      .toEqual({ kind: 'accepted', id: goodFact.id });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 20_000);

it('P5-SEAM-RC-R20-F3-V53-V54-E2E P5-NF-17 re-resolves exhaustion admission on proposal replay after restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'rungraph-review20-f3-proposal-'));
  try {
    const badSpine = join(directory, 'bad.jsonl');
    const bad = exhaustionFixture(durableSpine(badSpine));
    value(bad.graph.recordUnreachableExit(bad.exit, bad.lease));
    bad.admissions.delete(bad.exhaustionFact.id);
    expect(cold(bad, badSpine, { unreachable: bad.exit }).unreachable?.kind).toBe('refused');

    const goodSpine = join(directory, 'good.jsonl');
    const good = exhaustionFixture(durableSpine(goodSpine));
    const proposal = value(good.graph.recordUnreachableExit(good.exit, good.lease));
    expect(cold(good, goodSpine, { unreachable: good.exit }).unreachable)
      .toEqual({ kind: 'accepted', id: proposal.id });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 20_000);

it('P5-SEAM-RC-R20-F3-V55-V56-E2E P5-NF-17 re-resolves proposal admission on close replay after restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'rungraph-review20-f3-close-'));
  try {
    const badSpine = join(directory, 'bad.jsonl');
    const bad = closeUnreachable(durableSpine(badSpine));
    const proposal = value(bad.store.read()).find(fact => fact.kind === 'run-unreachable-exit'
      && fact.id !== bad.closeFact.id)!;
    bad.admissions.delete(proposal.id);
    expect(cold(bad, badSpine, { unreachable: bad.terminalExit }).unreachable?.kind).toBe('refused');

    const goodSpine = join(directory, 'good.jsonl');
    const good = closeUnreachable(durableSpine(goodSpine));
    expect(cold(good, goodSpine, { unreachable: good.terminalExit }).unreachable)
      .toEqual({ kind: 'accepted', id: good.closeFact.id });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 20_000);
