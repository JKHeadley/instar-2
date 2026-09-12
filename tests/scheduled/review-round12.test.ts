import { expect, it } from 'vitest';
import { inspectTopLevelJsonStringMemberValues } from '../../src/scheduled/json.js';
import { exerciseP15Round12Proof } from './round12-proof.js';

it('P15-NF-08 retains a decoded scheduled resource kind across later syntax errors', () => {
  for (const bytes of ['{"type":"ScheduledWorkManifest",}',
    '{"type":"ScheduledWorkManifest","schemaVersion":2']) {
    const inspected = inspectTopLevelJsonStringMemberValues(bytes, 'type');
    expect(inspected.values).toEqual(['ScheduledWorkManifest']);
    expect(inspected.error).toBeInstanceOf(Error);
  }
  const support = inspectTopLevelJsonStringMemberValues('export const support = 1;\n', 'type');
  expect(support.values).toEqual([]); expect(support.error).toBeInstanceOf(Error);
});

it('P15-NF-08 P15-NF-10 round-twelve malformed declared scheduled resources remain refused', () => {
  const resources = exerciseP15Round12Proof().resources;
  expect(resources.support.selectedPrimary).toEqual({ status: 'accepted' });
  expect(resources.support.selectedAdditional.status).toBe('refused');
  for (const kind of ['second-valid', 'second-missing-field', 'second-trailing-comma',
    'second-truncated', 'second-duplicate-type'] as const) {
    expect(resources[kind].selectedPrimary.status).toBe('refused');
    expect(resources[kind].selectedAdditional.status).toBe('refused');
  }
  expect(resources['second-trailing-comma'].selectedPrimary.detail).toBe('JSON object member must be a string');
  expect(resources['second-truncated'].selectedPrimary.detail).toBe('JSON object members must be comma-separated');
});
