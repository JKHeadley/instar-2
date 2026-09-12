import { expect, it } from 'vitest';
import { exerciseP15Round12Proof } from '../scheduled/round12-proof.js';

it('P15-NF-08 P15-NF-10 round-twelve full-port malformed-resource validation', () => {
  const resources = exerciseP15Round12Proof().resources;
  expect(resources.support.selectedPrimary.status).toBe('accepted');
  for (const kind of ['second-valid', 'second-missing-field', 'second-trailing-comma',
    'second-truncated', 'second-duplicate-type'] as const) {
    expect(resources[kind].selectedPrimary.status).toBe('refused');
    expect(resources[kind].selectedAdditional.status).toBe('refused');
  }
});
