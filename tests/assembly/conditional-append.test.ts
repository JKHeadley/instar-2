import { expect, it } from 'vitest';
import type { SegmentStoragePort } from '../../src/facts/index.js';
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
