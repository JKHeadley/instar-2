import { spawnSync } from 'node:child_process';
import { closeSync, fsyncSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import type { Json } from '../../src/index.js';
import type { FactEnvelope, SegmentStoragePort } from '../../src/facts/index.js';
import { factId, signEnvelope } from '../../src/facts/index.js';
import { recordWire } from '../../src/rungraph/index.js';
import { privateKey } from '../facts/fixtures.js';
import { continuityFixture, exhaustionFixture } from '../rungraph/closure-fixtures.js';
import { json, ref, value } from '../rungraph/fixtures.js';

const storageFor = (spine: string) => (fallback: SegmentStoragePort): SegmentStoragePort => ({ owner: 'part-ten',
  read: () => readFileSync(spine, 'utf8').split('\n').filter(Boolean).map(row => JSON.parse(row)),
  append: (bytes, expected) => {
    const rows = readFileSync(spine, 'utf8').split('\n').filter(Boolean).map(row => JSON.parse(row));
    if ((rows.at(-1)?.contentHash ?? null) !== expected) throw new Error('disk CAS');
    const fd = openSync(spine, 'a');
    try { writeFileSync(fd, `${bytes}\n`); fsyncSync(fd); } finally { closeSync(fd); }
    return fallback.append(bytes, expected);
  },
});

const cold = (seed: unknown) => {
  const child = spawnSync(process.execPath, ['tests/e2e/rungraph-closure-cold-reader.mjs'], {
    input: JSON.stringify(seed), encoding: 'utf8',
  });
  expect(child.stderr).toBe('');
  expect(child.status).toBe(0);
  return JSON.parse(child.stdout) as Record<string, { kind: string; detail?: string }>;
};

function appendSigned(spine: string, f: ReturnType<typeof continuityFixture> | ReturnType<typeof exhaustionFixture>,
  kind: string, body: Json, required: readonly string[]): FactEnvelope {
  const previous = value(f.store.read()).at(-1)!;
  const segment = { machine: 'machine-a', epoch: previous.segment.epoch, position: previous.segment.position + 1 };
  const fact = signEnvelope({ type: 'FactEnvelope', envelopeVersion: 1, id: factId(segment), kind, schemaVersion: 1,
    at: f.deps.clock(), machine: 'machine-a', principal: f.bob, provenance: f.bob.provenance, segment,
    prevInSegment: previous.contentHash, predecessors: { inSegment: previous.id, frontier: {}, required }, body }, privateKey);
  const fd = openSync(spine, 'a');
  try { writeFileSync(fd, `${JSON.stringify(fact)}\n`); fsyncSync(fd); } finally { closeSync(fd); }
  return fact as FactEnvelope;
}

const seedFor = (f: ReturnType<typeof continuityFixture> | ReturnType<typeof exhaustionFixture>, spine: string) => ({
  context: json({ ...f.ctx, ownedBodies: undefined }), spine, id: f.id, opening: f.run.opening,
  generation: f.generation(), policy: f.deps.groundingPolicy, admissions: [...f.admissions],
  control: { standing: ref(f.opening), principal: f.owner, scope: f.scope },
  execution: value(f.deps.admission.execution(f.id, f.lease)), lease: f.lease,
});

it('P5-SEAM-RC-R7-E2E-V29 cold signed replay refuses addressed continuity without its durable result', () => {
  const directory = mkdtempSync(join(tmpdir(), 'rungraph-repair7-continuity-'));
  const spine = join(directory, 'facts.jsonl');
  writeFileSync(spine, '');
  try {
    const f = continuityFixture(storageFor(spine));
    const accounting = { ...f.accounting, id: 'repair7:cold-unwitnessed-addressed',
      disposition: { kind: 'addressed' as const, work: ref(f.addressedWork) } };
    const fact = appendSigned(spine, f, 'continuity-accounting',
      json({ run: f.id, record: recordWire(accounting as never) }),
      [f.groundingFact.id, f.disclosure.id, f.addressedWork.id]);
    f.admissions.add(fact.id);
    const result = cold({ ...seedFor(f, spine), admissions: [...f.admissions], accounting });
    expect(result.continuity?.kind).toBe('refused');
    expect(result.continuity?.detail).toMatch(/addressed continuity fields differ/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 20_000);

it('P5-SEAM-RC-R7-E2E-V30 cold signed replay refuses deletion of the current dependency reference', () => {
  const directory = mkdtempSync(join(tmpdir(), 'rungraph-repair7-dependencies-'));
  const spine = join(directory, 'facts.jsonl');
  writeFileSync(spine, '');
  try {
    const f = exhaustionFixture(storageFor(spine));
    const resolved = f.append('run-dependency-observation',
      json({ ...f.dependency.body as object, status: 'resolved' }), [f.dependency.id]).fact;
    const exhaustion = { ...f.exhaustion, id: 'repair7:cold-omitted-dependency', dependencies: [] };
    const fact = appendSigned(spine, f, 'run-exhaustion',
      json({ run: f.id, record: recordWire(exhaustion as never) }), [f.opening.id, resolved.id]);
    f.admissions.add(fact.id);
    const result = cold({ ...seedFor(f, spine), admissions: [...f.admissions], exhaustion });
    expect(result.exhaustion?.kind).toBe('refused');
    expect(result.exhaustion?.detail).toMatch(/complete current dependency inventory/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 20_000);
