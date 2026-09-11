import { expect, it } from 'vitest';
import { createRunClosureGraph } from '../../src/rungraph/index.js';
import { appendLegacyCompletion, closeUnreachable, exhaustionFixture } from '../rungraph/closure-fixtures.js';
import { value } from '../rungraph/fixtures.js';

const runReference = (id: string) => ({ owner: 'part-five' as const, name: 'Run' as const, id });

it('P5-SEAM-RC-R18-V60-INTEGRATION P5-NF-09 P5-NF-17 re-resolves mixed signed successors through a rebuilt owner', () => {
  const f = closeUnreachable();
  appendLegacyCompletion(f);
  const rebuilt = value(createRunClosureGraph(f.deps));

  const view = value(rebuilt.read(f.id));
  expect(view.state).toBe('halted');
  expect(view.conflicts.map(conflict => conflict.key)).toContain(`run-head:${f.id}:${f.ready.head}`);
  expect(rebuilt.readExit(runReference(f.id))).toMatchObject({
    kind: 'Refused', detail: 'conflicting run successors prevent a terminal exit claim',
  });
});

it('P5-SEAM-RC-R18-V66-INTEGRATION P5-NF-17 preserves the legacy completion through a rebuilt owner when no unreachable proposal exists', () => {
  const f = exhaustionFixture();
  appendLegacyCompletion(f);
  const rebuilt = value(createRunClosureGraph(f.deps));

  expect(value(rebuilt.read(f.id)).state).toBe('completed');
  expect(value(rebuilt.readExit(runReference(f.id))).exit.kind).toBe('completed');
});

it('P5-SEAM-RC-R18-V67-INTEGRATION P5-NF-09 P5-NF-17 preserves the legacy completion through a rebuilt owner when unreachable bytes lack witnesses', () => {
  const f = closeUnreachable();
  for (const fact of value(f.store.read())) {
    if (fact.kind === 'run-unreachable-exit') f.admissions.delete(fact.id);
  }
  appendLegacyCompletion(f);
  const rebuilt = value(createRunClosureGraph(f.deps));

  expect(value(rebuilt.read(f.id)).state).toBe('completed');
  expect(value(rebuilt.readExit(runReference(f.id))).exit.kind).toBe('completed');
});
