import { expect, it } from 'vitest';
import { exerciseP15Round7Proof } from './round7-proof.js';

it('P15-NF-07 P15-NF-08 P15-NF-10 round-seven resource ids are not type discriminators', () => {
  const proof = exerciseP15Round7Proof();
  expect(proof.resources.manifest).toEqual({ status: 'accepted' });
  expect(proof.resources['job-definition']).toEqual({ status: 'accepted' });
  expect(proof.resources['schedule-resource']).toEqual({ status: 'accepted' });
  expect(proof.resources.support).toEqual({ status: 'refused',
    detail: 'complete package resource validation requires a Part Ten owner-issued resource view' });
}, 15_000);

it('round-seven multi-resource content classification remains held for a Part Ten resource view', () => {
  const proof = exerciseP15Round7Proof();
  expect(proof.resources['hidden-second']).toEqual(proof.resources.support);
});

it('round-seven inactive package history remains held for a Part Ten typed activity result', () => {
  const proof = exerciseP15Round7Proof();
  for (const state of ['recorded', 'staged', 'retired', 'inhibited'] as const) {
    expect(proof.activity[state]).toEqual({ status: 'refused',
      detail: 'competing package activity requires a Part Ten owner-issued activity resolution' });
  }
  expect(proof.activity.active).toEqual({ status: 'refused', detail: 'duplicate scheduled job id' });
});
