import { expect, it } from 'vitest';
import { exerciseP15Round9Proof } from '../scheduled/round9-proof.js';

it('P15-NF-08 P15-NF-09 P15-NF-10 P15-NF-16 P15-NF-17 P15-NF-19 round-nine full-port validation', () => {
  const proof = exerciseP15Round9Proof();
  expect(proof.retirement[3]!.admitted.status).toBe('refused');
  expect(proof.retirement[4]!.admitted.status).toBe('refused');
  expect(proof.retirement[20]!.admitted.status).toBe('accepted');
  expect(proof.resources.support!.selectedOriginal.status).toBe('accepted');
  expect(proof.resources['normal-second']!.selectedOriginal.status).toBe('refused');
  for (const kind of ['repeated-type', 'repeated-type-overridden', 'repeated-display-name', 'repeated-at'] as const) {
    expect(proof.resources[kind]!.selectedOriginal.status).toBe('refused');
    expect(proof.resources[kind]!.selectedExtra.status).toBe('refused');
  }
});
