import { expect, it } from 'vitest';
import type { AssemblySubjectFrontier } from '../../src/assembly/index.js';
import { createConditionalAssemblyAppendPort } from '../../src/assembly/index.js';
import { privateKey, value } from '../facts/fixtures.js';
import { assemblyInput } from './fixture.js';
import { assemblyRuntimeFixture } from './runtime-fixture.js';

// Additive row-127 unit evidence for the exclusive `validUntil` precondition on
// appendIfSubjectFrontier. The runtime fixture's commit clock is 100, so a bound of 150 is in
// the future, 100 sits exactly on the commit clock, and 50 is already past. These cases pin the
// F1 boundary: an OMITTED validUntil is the legacy no-expiry input (append succeeds), while a
// PRESENT validUntil that is null, a string, negative, or non-integer is malformed data that is
// refused before anything is appended — a present null must never be conflated with omission.

const subject = (adapter: string) => ({ type: 'AdapterConformance' as const, field: 'adapter', value: adapter });
const conformance = (id: string, adapter: string) => ({ ...assemblyInput('AdapterConformance'), id, adapter, mode: 'long-poll' });
const frontier = (adapter: string, extra: Readonly<Record<string, unknown>> = {}) =>
  ({ subject: subject(adapter), facts: [] as readonly string[], ...extra }) as unknown as AssemblySubjectFrontier;

function attempt(f: ReturnType<typeof assemblyRuntimeFixture>, adapter: string, extra: Readonly<Record<string, unknown>>) {
  const port = createConditionalAssemblyAppendPort({ host: f.host, author: { context: f.context, privateKey }, storage: f.storage });
  return port.appendIfSubjectFrontier('AdapterConformance', conformance(`conformance:${adapter}`, adapter), frontier(adapter, extra));
}

function conformanceCount(f: ReturnType<typeof assemblyRuntimeFixture>, adapter: string): number {
  return value(f.runtime.inspect()).filter(row => row.record.type === 'AdapterConformance'
    && (row.record as { adapter: string }).adapter === adapter).length;
}

it('P10-SEAM-CONDITIONAL-APPEND-127 [behavior:appendIfSubjectFrontier] [case:evidence-expiry] omitted-legacy retains no-expiry append unit', () => {
  const f = assemblyRuntimeFixture();
  const result = attempt(f, 'telegram:v1:bot:omitted', {});
  expect(result.kind).toBe('Success');
  expect(conformanceCount(f, 'telegram:v1:bot:omitted')).toBe(1);
});

it('P10-SEAM-CONDITIONAL-APPEND-127 [behavior:appendIfSubjectFrontier] [case:evidence-expiry] present-null is malformed and appends nothing unit', () => {
  const f = assemblyRuntimeFixture();
  const result = attempt(f, 'telegram:v1:bot:null', { validUntil: null });
  expect(result).toMatchObject({ kind: 'Refused', detail: 'conditional append validUntil precondition is malformed' });
  expect(conformanceCount(f, 'telegram:v1:bot:null')).toBe(0);
});

it('P10-SEAM-CONDITIONAL-APPEND-127 [behavior:appendIfSubjectFrontier] [case:evidence-expiry] present-string is malformed and appends nothing unit', () => {
  const f = assemblyRuntimeFixture();
  const result = attempt(f, 'telegram:v1:bot:string', { validUntil: '150' });
  expect(result).toMatchObject({ kind: 'Refused', detail: 'conditional append validUntil precondition is malformed' });
  expect(conformanceCount(f, 'telegram:v1:bot:string')).toBe(0);
});

it('P10-SEAM-CONDITIONAL-APPEND-127 [behavior:appendIfSubjectFrontier] [case:evidence-expiry] present-negative is malformed and appends nothing unit', () => {
  const f = assemblyRuntimeFixture();
  const result = attempt(f, 'telegram:v1:bot:negative', { validUntil: -1 });
  expect(result).toMatchObject({ kind: 'Refused', detail: 'conditional append validUntil precondition is malformed' });
  expect(conformanceCount(f, 'telegram:v1:bot:negative')).toBe(0);
});

it('P10-SEAM-CONDITIONAL-APPEND-127 [behavior:appendIfSubjectFrontier] [case:evidence-expiry] present-non-integer is malformed and appends nothing unit', () => {
  const f = assemblyRuntimeFixture();
  const result = attempt(f, 'telegram:v1:bot:fraction', { validUntil: 150.5 });
  expect(result).toMatchObject({ kind: 'Refused', detail: 'conditional append validUntil precondition is malformed' });
  expect(conformanceCount(f, 'telegram:v1:bot:fraction')).toBe(0);
});

it('P10-SEAM-CONDITIONAL-APPEND-127 [behavior:appendIfSubjectFrontier] [case:evidence-expiry] expired-below-commit refuses without appending unit', () => {
  const f = assemblyRuntimeFixture();
  const result = attempt(f, 'telegram:v1:bot:expired', { validUntil: 50 });
  expect(result).toMatchObject({ kind: 'Refused', detail: 'evidence-expired: validUntil=50; commitClock=100' });
  expect(conformanceCount(f, 'telegram:v1:bot:expired')).toBe(0);
});

it('P10-SEAM-CONDITIONAL-APPEND-127 [behavior:appendIfSubjectFrontier] [case:evidence-expiry] at-commit-clock refuses without appending unit', () => {
  const f = assemblyRuntimeFixture();
  const result = attempt(f, 'telegram:v1:bot:at-bound', { validUntil: 100 });
  expect(result).toMatchObject({ kind: 'Refused', detail: 'evidence-expired: validUntil=100; commitClock=100' });
  expect(conformanceCount(f, 'telegram:v1:bot:at-bound')).toBe(0);
});

it('P10-SEAM-CONDITIONAL-APPEND-127 [behavior:appendIfSubjectFrontier] [case:evidence-expiry] future-bound appends one signed record unit', () => {
  const f = assemblyRuntimeFixture();
  const result = attempt(f, 'telegram:v1:bot:future', { validUntil: 150 });
  expect(result.kind).toBe('Success');
  expect(conformanceCount(f, 'telegram:v1:bot:future')).toBe(1);
});
