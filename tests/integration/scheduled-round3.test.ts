import { expect, it } from 'vitest';
import { exerciseP15Round3Proof } from '../scheduled/round3-proof.js';

it('P15-NF-10 P15-NF-17 P15-NF-29 P15-NF-31 P15-NF-34 P15-NF-51 round-three integration proof executes real owner paths', () => {
  const proof = exerciseP15Round3Proof();
  expect(proof.signedCollisions).toEqual(['refused', 'refused']);
  expect(proof.planeAfterRefusal).toBe('accepted');
  expect(proof.invalidCapacity).toEqual(['refused', 'refused']);
  expect(proof.legacyCaptured).toMatchObject({ sourceKind: 'legacy-job-declaration', duration: 1 });
});
