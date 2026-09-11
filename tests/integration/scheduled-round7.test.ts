import { expect, it } from 'vitest';
import { exerciseP15Round7Proof } from '../scheduled/round7-proof.js';

it('P15-NF-03 P15-NF-07 P15-NF-08 P15-NF-10 round-seven full-port owner boundary', () => {
  const proof = exerciseP15Round7Proof();
  expect(Object.fromEntries(Object.entries(proof.resources).map(([key, value]) => [key, value.status]))).toEqual({
    manifest: 'accepted', 'job-definition': 'accepted', 'schedule-resource': 'accepted',
    support: 'refused', 'hidden-second': 'refused',
  });
  expect(new Set(['recorded', 'staged', 'retired', 'inhibited'].map(key => proof.activity[key]!.detail)))
    .toEqual(new Set(['competing package activity requires a Part Ten owner-issued activity resolution']));
  expect(proof.activity.active).toEqual({ status: 'refused', detail: 'duplicate scheduled job id' });
});
