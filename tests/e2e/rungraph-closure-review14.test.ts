import { closeSync, fsyncSync, mkdtempSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { createRunClosureGraph } from '../../src/rungraph/index.js';
import { closeUnreachable, completedFixture, continuityFixture, exhaustionFixture } from '../rungraph/closure-fixtures.js';
import { json, ref, value } from '../rungraph/fixtures.js';

function disk() {
  const path = join(mkdtempSync(join(tmpdir(), 'rungraph-review14-')), 'spine.jsonl');
  writeFileSync(path, '');
  const rows = () => readFileSync(path, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
  const factory = (fallback: any) => ({ owner: 'part-ten' as const, read: rows,
    append: (bytes: string, expected: string) => {
      if ((rows().at(-1)?.contentHash ?? null) !== expected) throw new Error('disk CAS');
      const fd = openSync(path, 'a');
      try { writeFileSync(fd, `${bytes}\n`); fsyncSync(fd); } finally { closeSync(fd); }
      return fallback.append(bytes, expected);
    } });
  return { path, rows, factory };
}

for (const kind of ['addressed', 'pending'] as const) {
  it(`P5-SEAM-RC-R14-V18-${kind.toUpperCase()} cold verification refuses obsolete work status`, () => {
    const d = disk();
    const f = continuityFixture(d.factory);
    const work = kind === 'pending'
      ? f.append('continuity-pending-work', json({ run: f.id, inbound: f.opening.id, status: 'open' })).fact
      : f.addressedWork;
    const record = kind === 'pending'
      ? { ...f.accounting, disposition: { kind: 'pending' as const, work: ref(work), reason: 'answer pending' } }
      : f.accounting;
    const accounting = value(f.graph.recordContinuity(record, f.lease));
    f.append(kind === 'pending' ? 'continuity-pending-work' : 'continuity-addressed-work',
      json({ ...work.body as object, status: kind === 'pending' ? 'closed' : 'invalid' }), [work.id]);
    const send = f.append('continuity-first-reply-send', json({ run: f.id, accounting: accounting.id,
      ...record.firstReply, disclosure: f.disclosure.id, dispositionKind: kind,
      disposition: work.id, status: 'admitted' }), [accounting.id, f.disclosure.id, work.id]).fact;
    const seed = { context: json({ ...f.ctx, ownedBodies: undefined }), spine: d.path, id: f.id,
      opening: f.run.opening, generation: f.generation(), policy: f.deps.groundingPolicy,
      admissions: [...f.admissions], control: ref(f.opening),
      execution: value(f.deps.admission.execution(f.id, f.lease)), lease: f.lease,
      send: ref(send), sendWitnesses: [send.id],
      verifyAccounting: { owner: 'part-five', name: 'ContinuityAccounting', id: record.id, fact: ref(accounting) } };
    writeFileSync(`${d.path}.seed.json`, JSON.stringify(seed));
    const child = spawnSync(process.execPath, ['tests/e2e/rungraph-closure-cold-reader.mjs'],
      { input: JSON.stringify(seed), encoding: 'utf8' });
    expect(child.status, child.stderr).toBe(0);
    expect(JSON.parse(child.stdout).send.kind).toBe('refused');
  });
}

for (const arm of ['completed', 'unreachable'] as const) {
  for (const stage of ['proposal', 'close'] as const) {
    it(`P5-SEAM-RC-R14-V16-${arm.toUpperCase()}-${stage.toUpperCase()} accepts an exact retry after fsynced acknowledgment loss`, () => {
      const d = disk();
      const f = arm === 'completed' ? completedFixture(d.factory) : exhaustionFixture(d.factory);
      let graph = value(createRunClosureGraph(f.deps));
      const proposal: any = 'proposal' in f ? f.proposal : f.exit;
      let input: any = proposal;
      if (stage === 'close') {
        if (arm === 'completed') value(graph.transition(proposal));
        else value(graph.recordUnreachableExit(proposal, f.lease));
        const view = value(graph.read(f.id));
        const proposalFact = d.rows().at(-1);
        const exit = arm === 'completed'
          ? { ...proposal.exit, id: 'review14:close-exit', expected: view.head }
          : { ...proposal, id: 'review14:close-exit', expected: proposal.id, phase: 'close',
            frontier: view.source.foldedThrough,
            proposal: { owner: 'part-five', name: 'UnreachableRunExit', id: proposal.id, fact: ref(proposalFact) } };
        input = arm === 'completed'
          ? { ...proposal, id: 'review14:close', expected: view.head, from: 'closing', to: 'completed', kind: 'close', exit }
          : exit;
      }
      let cut: 'before' | 'after' | undefined = 'before';
      const deps = { ...f.deps, admission: { ...f.deps.admission, commit: (request: any, write: any) => {
        if (request.operation === input.id && cut === 'before') throw new Error('review14 cut before append');
        const result = f.deps.admission.commit(request, write);
        if (request.operation === input.id && cut === 'after') throw new Error('review14 cut after append');
        return result;
      } } };
      graph = value(createRunClosureGraph(deps));
      const submit = () => arm === 'completed' ? graph.transition(input) : graph.recordUnreachableExit(input, f.lease);
      const before = d.rows().length;
      expect(submit().kind).toBe('Refused');
      expect(d.rows()).toHaveLength(before);
      expect(value(value(createRunClosureGraph(f.deps)).read(f.id)).state).toBe(stage === 'proposal' ? 'ready' : 'closing');
      cut = 'after';
      expect(submit().kind).toBe('Refused');
      expect(d.rows()).toHaveLength(before + 1);
      cut = undefined;
      graph = value(createRunClosureGraph(f.deps));
      expect(value(graph.read(f.id)).state).toBe(stage === 'proposal' ? 'closing' : arm);
      expect(submit().kind).toBe('Success');
      expect(d.rows()).toHaveLength(before + 1);
    });
  }
}

for (const kind of ['exhaustion', 'continuity'] as const) {
  it(`P5-SEAM-RC-R14-V17-${kind.toUpperCase()} accepts exact record retry across fsynced cuts`, () => {
    const d = disk();
    const f = kind === 'exhaustion' ? exhaustionFixture(d.factory) : continuityFixture(d.factory);
    const record: any = { ...('exhaustion' in f ? f.exhaustion : f.accounting), id: 'review14:record-cut' };
    let cut: 'before' | 'after' | undefined = 'before';
    const deps = { ...f.deps, admission: { ...f.deps.admission, commit: (request: any, write: any) => {
      if (request.operation === record.id && cut === 'before') throw new Error('review14 before record');
      const result = f.deps.admission.commit(request, write);
      if (request.operation === record.id && cut === 'after') throw new Error('review14 after record');
      return result;
    } } };
    let graph = value(createRunClosureGraph(deps));
    const submit = () => kind === 'exhaustion'
      ? graph.recordExhaustion(record, f.lease) : graph.recordContinuity(record, f.lease);
    const before = d.rows().length;
    expect(submit().kind).toBe('Refused');
    expect(d.rows()).toHaveLength(before);
    cut = 'after';
    expect(submit().kind).toBe('Refused');
    expect(d.rows()).toHaveLength(before + 1);
    const original = d.rows().at(-1);
    cut = undefined;
    graph = value(createRunClosureGraph(f.deps));
    expect(value(submit())).toEqual(original);
    expect(d.rows()).toHaveLength(before + 1);
    expect(value(graph.read(f.id)).state).toBe('ready');
  });
}

it('P5-SEAM-RC-R14-V20-REPLAY uses signed admission clocks when a cold reader clock advances', () => {
  const f = closeUnreachable();
  f.setClock(20_000);
  const graph = value(createRunClosureGraph(f.deps));
  expect(value(graph.read(f.id)).state).toBe('unreachable');
  expect(value(graph.readExit({ owner: 'part-five', name: 'Run', id: f.id }))).toEqual({
    fact: ref(f.closeFact), exit: f.terminalExit,
  });
});
