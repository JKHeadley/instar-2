import { expect, it } from 'vitest';
import { exerciseP15Round8Proof } from '../scheduled/round8-proof.js';

it('P15-NF-03 P15-NF-07 P15-NF-08 P15-NF-10 P15-NF-17 P15-NF-19 round-eight full-port validation', () => {
  const proof = exerciseP15Round8Proof();
  expect(Object.fromEntries(Object.entries(proof.dependencies).map(([key, value]) => [key, value.status])))
    .toEqual({ none: 'accepted', missing: 'refused', matching: 'accepted',
      'wrong-digest': 'refused', self: 'refused' });
  expect(Object.fromEntries(Object.entries(proof.resources).map(([key, value]) => [key, value.status])))
    .toEqual({ support: 'accepted', 'second-manifest': 'refused',
      'missing-bytes': 'refused', 'changed-bytes': 'refused' });
  expect(new Set(['recorded', 'staged', 'retired', 'inhibited'].map(key => proof.activity[key]!.detail)))
    .toEqual(new Set(['competing package activity requires a Part Ten owner-issued activity resolution']));
}, 15_000);
