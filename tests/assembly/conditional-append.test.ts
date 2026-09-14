import { expect, it } from 'vitest';
import type { SegmentStoragePort } from '../../src/facts/index.js';
import { boundary } from '../../src/facts/boundary.js';
import { createConditionalAssemblyAppendPort } from '../../src/assembly/index.js';
import { privateKey, value } from '../facts/fixtures.js';
import { assemblyInput } from './fixture.js';
import { assemblyRuntimeFixture } from './runtime-fixture.js';

const subject = (adapter: string) => ({ type: 'AdapterConformance' as const, field: 'adapter', value: adapter });
const conformance = (id: string, adapter: string, mode: string) => ({
  ...assemblyInput('AdapterConformance'), id, adapter, mode,
});

function port(f: ReturnType<typeof assemblyRuntimeFixture>, storage: SegmentStoragePort = f.storage) {
  return createConditionalAssemblyAppendPort({ host: f.host, author: { context: f.context, privateKey }, storage });
}

function refusalDetail(result: ReturnType<ReturnType<typeof port>['appendIfSubjectFrontier']>): string {
  expect(result.kind).toBe('Refused');
  return result.kind === 'Refused' ? result.detail : '';
}

it('P10-SEAM-CONDITIONAL-APPEND-58 [behavior:appendIfSubjectFrontier] equal subject frontier appends one signed record', () => {
  const f = assemblyRuntimeFixture();
  const appended = value(port(f).appendIfSubjectFrontier(
    'AdapterConformance', conformance('conformance:long-poll', 'native', 'long-poll'),
    { subject: subject('native'), facts: [] },
  ));
  expect(appended).toMatchObject({ id: 'conformance:long-poll', adapter: 'native', mode: 'long-poll' });
  expect(value(f.runtime.inspect()).filter(row => row.record.type === 'AdapterConformance')).toHaveLength(1);
});

it('P10-SEAM-CONDITIONAL-APPEND-58 [behavior:appendIfSubjectFrontier] stale refusal is typed and names the current subject frontier', () => {
  const f = assemblyRuntimeFixture();
  value(f.runtime.record('AdapterConformance', conformance('conformance:webhook', 'native', 'webhook')));
  const winner = value(f.runtime.inspect()).find(row => row.record.id === 'conformance:webhook')!.fact.id;
  const result = port(f).appendIfSubjectFrontier(
    'AdapterConformance', conformance('conformance:long-poll', 'native', 'long-poll'),
    { subject: subject('native'), facts: [] },
  );
  expect(result).toMatchObject({ kind: 'Refused', reason: 'decode', failDirection: 'closed' });
  if (result.kind === 'Refused') {
    expect(result.detail).toContain('conditional append subject frontier changed; current=');
    expect(result.detail).toContain(winner);
    expect(result.detail).toContain('AdapterConformance');
    expect(result.detail).toContain('native');
  }
  expect(value(f.runtime.inspect()).filter(row => row.record.type === 'AdapterConformance')).toHaveLength(1);
});

it('P10-SEAM-CONDITIONAL-APPEND-58 [behavior:appendIfSubjectFrontier] unrelated-subject head movement retries without widening the named subject', () => {
  const f = assemblyRuntimeFixture();
  let injected = false;
  const racingStorage: SegmentStoragePort = {
    owner: 'part-ten', read: f.storage.read,
    append(bytes, expectedHead) {
      if (!injected) {
        injected = true;
        value(f.runtime.record('AdapterConformance', conformance('conformance:other', 'other-adapter', 'webhook')));
      }
      return f.storage.append(bytes, expectedHead);
    },
  };
  const appended = value(port(f, racingStorage).appendIfSubjectFrontier(
    'AdapterConformance', conformance('conformance:native', 'native', 'long-poll'),
    { subject: subject('native'), facts: [] },
  ));
  expect(appended.id).toBe('conformance:native');
  expect(value(f.runtime.inspect()).filter((row): row is typeof row & { record: import('../../src/assembly/index.js').AdapterConformance } => row.record.type === 'AdapterConformance')
    .map(row => row.record.adapter)).toEqual(['other-adapter', 'native']);
});

it.each([
  ['unknown', (f: ReturnType<typeof assemblyRuntimeFixture>) => ({ ...f.host, principal: { ...f.host.principal, id: 'principal:intruder' } })],
  ['forged', (f: ReturnType<typeof assemblyRuntimeFixture>) => ({ ...f.host, principal: { ...f.host.principal,
    provenance: { ...f.host.principal.provenance, captureHash: `sha256:${'0'.repeat(64)}` } } })],
  ['missing', (f: ReturnType<typeof assemblyRuntimeFixture>) => ({ ...f.host, principal: undefined })],
] as const)('P10-SEAM-CONDITIONAL-APPEND-58 [behavior:appendIfSubjectFrontier] [case:replay-authentication] unauthenticated-existing-%s refuses behind Part Two', (_variant, invalidHost) => {
  const f = assemblyRuntimeFixture();
  const record = conformance('conformance:replay', 'native', 'webhook');
  value(port(f).appendIfSubjectFrontier('AdapterConformance', record, { subject: subject('native'), facts: [] }));
  const frontier = value(f.runtime.inspect()).find(row => row.record.id === record.id)!.fact.id;
  const replay = createConditionalAssemblyAppendPort({
    host: invalidHost(f) as typeof f.host,
    author: { context: f.context, privateKey },
    storage: f.storage,
  }).appendIfSubjectFrontier('AdapterConformance', record, { subject: subject('native'), facts: [frontier] });
  refusalDetail(replay);
  expect(value(f.runtime.inspect()).filter(row => row.record.type === 'AdapterConformance')).toHaveLength(1);
});

it('P10-SEAM-CONDITIONAL-APPEND-58 [behavior:appendIfSubjectFrontier] [case:stop-inhibition] conditional append shares the ordinary assembly stop refusal', () => {
  const f = assemblyRuntimeFixture();
  f.stop();
  const record = conformance('conformance:stopped', 'native', 'webhook');
  const ordinary = f.runtime.record('AdapterConformance', record);
  const conditional = port(f).appendIfSubjectFrontier('AdapterConformance', record, { subject: subject('native'), facts: [] });
  expect(refusalDetail(ordinary)).toBe('stop inhibits new assembly work');
  expect(refusalDetail(conditional)).toBe('stop inhibits new assembly work');
  expect(value(f.runtime.inspect()).filter(row => row.record.type === 'AdapterConformance')).toHaveLength(0);
});

it.each([
  ['extra-current-claim', { subject: subject('native'), facts: [], current: true }],
  ['extra-current-facts', { subject: subject('native'), facts: [], currentFrontier: [] }],
  ['extra-subject-key', { subject: { ...subject('native'), current: true }, facts: [] }],
] as const)('P10-SEAM-CONDITIONAL-APPEND-58 [behavior:appendIfSubjectFrontier] [case:closed-shape-refusal] %s is a malformed token', (_caseId, expected) => {
  const f = assemblyRuntimeFixture();
  const result = port(f).appendIfSubjectFrontier('AdapterConformance', conformance('conformance:closed', 'native', 'webhook'),
    expected as Parameters<ReturnType<typeof port>['appendIfSubjectFrontier']>[2]);
  expect(refusalDetail(result)).toBe('conditional append frontier token is malformed');
  expect(value(f.runtime.inspect()).filter(row => row.record.type === 'AdapterConformance')).toHaveLength(0);
});

it('P10-SEAM-CONDITIONAL-APPEND-58 [behavior:appendIfSubjectFrontier] [case:held-lock-contention] held physical lock refusal names the subject and current frontier', () => {
  const f = assemblyRuntimeFixture();
  const storage: SegmentStoragePort = {
    owner: 'part-ten', read: f.storage.read,
    append: () => boundary('HeldLockFixture', null, f.c, () => {
      throw new Error("EEXIST: file already exists, mkdir '/fixture/append.lock'");
    }),
  };
  const result = port(f, storage).appendIfSubjectFrontier('AdapterConformance',
    conformance('conformance:contender', 'native', 'long-poll'), { subject: subject('native'), facts: [] });
  const detail = refusalDetail(result);
  expect(detail).toContain('conditional append physical storage contended; current=');
  expect(detail).toContain('AdapterConformance');
  expect(detail).toContain('native');
});
