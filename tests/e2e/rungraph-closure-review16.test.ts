import { closeSync, fsyncSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import type { FactEnvelope, SegmentStoragePort } from '../../src/facts/index.js';
import { closureRecordWire } from '../../src/rungraph/index.js';
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

function appendSend(f: ReturnType<typeof continuityFixture>, record: Readonly<Record<string, unknown>>,
  accounting: FactEnvelope) {
  const reply = record.firstReply as Readonly<{ operation: string; digest: string }>;
  const disclosure = record.disclosure as Readonly<{ id: string }>;
  const disposition = record.disposition as Readonly<{ kind: string; work?: Readonly<{ id: string }>;
    input?: Readonly<{ id: string }> }>;
  const work = disposition.kind === 'superseded' ? disposition.input! : disposition.work!;
  const send = f.append('continuity-first-reply-send', json({ run: f.id, accounting: accounting.id,
    ...reply, disclosure: disclosure.id, dispositionKind: disposition.kind, disposition: work.id,
    status: 'admitted' }), [accounting.id, disclosure.id, work.id]).fact;
  f.sendWitnesses.add(send.id);
  return send;
}

function cold(f: ReturnType<typeof continuityFixture> | ReturnType<typeof exhaustionFixture>, spine: string,
  extra: Readonly<Record<string, unknown>>) {
  const seed = { context: json({ ...f.ctx, ownedBodies: undefined }), spine, id: f.id,
    opening: f.run.opening, generation: f.generation(), policy: f.deps.groundingPolicy,
    admissions: [...f.admissions], control: ref(f.opening),
    execution: value(f.deps.admission.execution(f.id, f.lease)), lease: f.lease, ...extra };
  const child = spawnSync(process.execPath, ['tests/e2e/rungraph-closure-cold-reader.mjs'],
    { input: JSON.stringify(seed), encoding: 'utf8' });
  expect(child.status, child.stderr).toBe(0);
  return JSON.parse(child.stdout) as Readonly<{ view: Readonly<{ kind: string; state?: string }>;
    send?: Readonly<{ kind: string }>; unreachable?: Readonly<{ kind: string; id?: string }> }>;
}

it.each([
  ['P5-SEAM-RC-R16-F2-RESULT-BINDING-E2E', 'result-binding'],
  ['P5-SEAM-RC-R16-F3-CURRENT-WORK-E2E', 'obsolete-work'],
  ['P5-SEAM-RC-R16-F4-CONFLICT-E2E', 'conflicting-accounting'],
  ['P5-SEAM-RC-R16-F5-ENVELOPE-RUN-E2E', 'envelope-run'],
] as const)('%s P5-NF-46 revalidates signed continuity history in a fresh process: %s', (fixtureId, mode) => {
  expect(fixtureId).toMatch(/^P5-SEAM-RC-R16-/);
  const directory = mkdtempSync(join(tmpdir(), `rungraph-review16-${mode}-`));
  const spine = join(directory, 'facts.jsonl');
  try {
    const f = continuityFixture(durableSpine(spine));
    let record: Readonly<Record<string, unknown>> = f.accounting;
    let accounting: FactEnvelope;
    if (mode === 'result-binding') {
      const unrelated = value(decode('Result', { type: 'Result', schemaVersion: 1, kind: 'Success',
        value: 'unrelated result', capacity: { kind: 'none' } }, f.ctx.decode));
      const unrelatedFact = f.append('result-record', json({ result: unrelated })).fact;
      const work = f.append('continuity-addressed-work', json({ ...f.addressedWork.body as object }),
        [f.disclosure.id, f.addressedResultFact.id]).fact;
      record = { ...f.accounting, id: 'review16:e2e:unbound-result', disposition: { kind: 'addressed',
        work: ref(work), result: { ...f.addressedResultReference, id: 'review16:e2e:unrelated',
          fact: ref(unrelatedFact) } } };
      expect(() => f.append('continuity-accounting', json({ run: f.id,
        record: closureRecordWire(record as never) }))).toThrow(
        'addressed work does not explicitly witness this durable answer or work result');
      expect(cold(f, spine, {}).view).toMatchObject({ kind: 'accepted', state: 'ready' });
      return;
    } else if (mode === 'conflicting-accounting') {
      record = { ...f.accounting, disposition: { kind: 'pending', work: ref(f.opening), reason: 'pending' } };
      accounting = value(f.graph.recordContinuity(record, f.lease));
      const changed = { ...record, disposition: { ...record.disposition as object, reason: 'conflicting' } };
      const conflict = f.append('continuity-accounting', json({ run: f.id,
        record: closureRecordWire(changed as never) })).fact;
      f.admissions.add(conflict.id);
    } else if (mode === 'envelope-run') {
      accounting = f.append('continuity-accounting', json({ run: 'another-run',
        record: closureRecordWire(record as never) })).fact;
      f.admissions.add(accounting.id);
    } else {
      accounting = value(f.graph.recordContinuity(record, f.lease));
    }
    const send = appendSend(f, record, accounting);
    if (mode === 'obsolete-work') f.append('continuity-addressed-work',
      json({ ...f.addressedWork.body as object, status: 'invalid' }), [f.addressedWork.id]);
    const restarted = cold(f, spine, { send: ref(send), sendWitnesses: [send.id],
      verifyAccounting: { owner: 'part-five', name: 'ContinuityAccounting',
        id: String(record.id), fact: ref(accounting) } });
    expect(restarted.send?.kind).toBe('refused');
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 20_000);

it('P5-SEAM-RC-R16-F6-EQUAL-COPIES-E2E P5-NF-17 rebuilds equal close copies and returns the original on cold retry', () => {
  const directory = mkdtempSync(join(tmpdir(), 'rungraph-review16-equal-close-'));
  const spine = join(directory, 'facts.jsonl');
  try {
    const f = exhaustionFixture(durableSpine(spine));
    const proposal = value(f.graph.recordUnreachableExit(f.exit, f.lease));
    const closing = value(f.graph.read(f.id));
    const close = { ...f.exit, id: 'review16:e2e:close', expected: f.exit.id, phase: 'close' as const,
      frontier: closing.source.foldedThrough, proposal: { owner: 'part-five' as const,
        name: 'UnreachableRunExit' as const, id: f.exit.id, fact: ref(proposal) } };
    const original = value(f.graph.recordUnreachableExit(close, f.lease));
    const duplicate = f.append('run-unreachable-exit', json({ run: f.id,
      record: closureRecordWire(close as never) })).fact;
    f.admissions.add(duplicate.id);
    const restarted = cold(f, spine, { unreachable: close });
    expect(restarted.view).toMatchObject({ kind: 'accepted', state: 'unreachable' });
    expect(restarted.unreachable).toEqual({ kind: 'accepted', id: original.id });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 20_000);
