import { expect, it } from 'vitest';
import { exerciseP15Round8Proof } from './round8-proof.js';

it('P15-NF-08 P15-NF-10 refuses inconsistent dependencies through Part Ten staging', () => {
  const proof = exerciseP15Round8Proof();
  expect(Object.fromEntries(Object.entries(proof.dependencies).map(([key, value]) => [key, value.status])))
    .toEqual({ none: 'accepted', missing: 'refused', matching: 'accepted',
      'wrong-digest': 'refused', self: 'refused' });
  expect(proof.dependencies.missing!.detail).toBe('missing or mutable package dependency');
  expect(proof.dependencies['wrong-digest']!.detail).toBe('missing or mutable package dependency');
  expect(proof.dependencies.self!.detail).toBe('cyclic package dependency');
}, 15_000);

it('P15-NF-03 P15-NF-07 P15-NF-08 P15-NF-10 validates complete archive bytes and resource roles', () => {
  const proof = exerciseP15Round8Proof();
  expect(Object.fromEntries(Object.entries(proof.resources).map(([key, value]) => [key, value.status])))
    .toEqual({ support: 'accepted', 'second-manifest': 'refused',
      'missing-bytes': 'refused', 'changed-bytes': 'refused' });
  expect(proof.resources['second-manifest']!.detail).toBe('package contains multiple scheduled work manifests');
}, 15_000);

it('P15-NF-17 P15-NF-19 holds inactive competing definitions on the exact Part Ten activity grant', () => {
  const proof = exerciseP15Round8Proof();
  for (const state of ['recorded', 'staged', 'retired', 'inhibited'] as const) {
    expect(proof.activity[state]).toEqual({ status: 'refused',
      detail: 'competing package activity requires a Part Ten owner-issued activity resolution' });
  }
  expect(proof.activity.active!.status).toBe('refused');
}, 15_000);
