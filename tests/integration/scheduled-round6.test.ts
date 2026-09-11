import { expect, it } from 'vitest';
import { exerciseP15Round6Proof } from '../scheduled/round6-proof.js';

it('P15-NF-07 P15-NF-08 P15-NF-10 P15-NF-17 P15-NF-19 round-six full owner-port package proof', () => {
  const proof = exerciseP15Round6Proof();
  expect(proof.competing).toEqual({ recorded: 'refused', staged: 'refused', active: 'refused', retired: 'refused', inhibited: 'refused' });
  expect(new Set(Object.values(proof.support))).toEqual(new Set(['accepted']));
  expect(proof.twoManifests).toEqual(['refused', 'refused']);
});
