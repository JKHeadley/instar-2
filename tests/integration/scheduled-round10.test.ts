import { expect, it } from 'vitest';
import { exerciseP15Round10Proof } from '../scheduled/round10-proof.js';

it('P15-NF-08 P15-NF-10 P15-NF-17 P15-NF-19 P15-NF-51 round-ten full-port validation', () => {
  const proof = exerciseP15Round10Proof();
  expect(proof.collisions[4]!.first.detail).toBe('package admission history frontier moved');
  for (const cut of [3, 4, 5]) expect(proof.dependencies[cut]!.first.detail)
    .toBe('package admission history frontier moved');
  expect(Object.entries(proof.legacy).filter(([key]) => key.includes(':array:'))
    .every(([, result]) => result.status === 'refused')).toBe(true);
  expect(proof.legacy['learning:array-script']!.status).toBe('refused');
  expect(proof.legacy['learning:string-script']!.learning).toBe('off');
}, 20_000);
