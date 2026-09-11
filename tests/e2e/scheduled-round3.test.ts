import { expect, it } from 'vitest';
import { exerciseP15Round3Proof } from '../scheduled/round3-proof.js';

it('P15-NF-10 P15-NF-17 P15-NF-29 P15-NF-31 P15-NF-33 P15-NF-34 P15-NF-38 P15-NF-45 P15-NF-51 round-three lifecycle proof executes real owner paths', () => {
  const proof = exerciseP15Round3Proof();
  expect(proof.currentNeighbor).toBe('accepted');
  expect(proof.signedCollisions).toEqual(['refused', 'refused']);
  expect(proof.planeAfterRefusal).toBe('accepted');
  expect(proof.freshCapacity).toBe('accepted');
  expect(proof.staleCapacity).toBe('refused');
  expect(proof.unknownCapacity).toBe('refused');
  expect(proof.legacyOmittedModel).toBe('sonnet');
  expect(proof.retainedRun).toBe('ready');
  expect(proof.unreachableExit).toBe('unreachable');
});
