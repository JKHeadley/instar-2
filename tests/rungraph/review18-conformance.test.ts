import { expect, it } from 'vitest';
import { appendLegacyCompletion, closeUnreachable, exhaustionFixture } from './closure-fixtures.js';
import { value } from './fixtures.js';

const runReference = (id: string) => ({ owner: 'part-five' as const, name: 'Run' as const, id });

it('P5-SEAM-RC-R18-V60-UNIT P5-NF-09 P5-NF-17 retains mixed terminal successors as a conflict', () => {
  const f = closeUnreachable();
  appendLegacyCompletion(f);

  const view = value(f.graph.read(f.id));
  expect(view.state).toBe('halted');
  expect(view.conflicts).toContainEqual(expect.objectContaining({
    key: `run-head:${f.id}:${f.ready.head}`,
    detail: 'incompatible legacy transition and unreachable proposal consume the same predecessor',
  }));
  expect(f.graph.readExit(runReference(f.id))).toMatchObject({
    kind: 'Refused', detail: 'conflicting run successors prevent a terminal exit claim',
  });
});

it('P5-SEAM-RC-R18-V66-UNIT P5-NF-17 preserves completion when only an exhaustion record exists', () => {
  const f = exhaustionFixture();
  appendLegacyCompletion(f);

  expect(value(f.graph.read(f.id)).state).toBe('completed');
  expect(value(f.graph.readExit(runReference(f.id))).exit.kind).toBe('completed');
});

it('P5-SEAM-RC-R18-V67-UNIT P5-NF-09 P5-NF-17 ignores unwitnessed unreachable bytes beside a valid completion', () => {
  const f = closeUnreachable();
  for (const fact of value(f.store.read())) {
    if (fact.kind === 'run-unreachable-exit') f.admissions.delete(fact.id);
  }
  appendLegacyCompletion(f);

  expect(value(f.graph.read(f.id)).state).toBe('completed');
  expect(value(f.graph.readExit(runReference(f.id))).exit.kind).toBe('completed');
});
