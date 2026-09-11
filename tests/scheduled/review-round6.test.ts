import { expect, it } from 'vitest';
import { exerciseP15Round6Proof } from './round6-proof.js';

it('P15-NF-07 P15-NF-08 P15-NF-09 P15-NF-10 P15-NF-17 P15-NF-19 round-six package classification and active-collision proof', () => {
  expect(exerciseP15Round6Proof()).toEqual({
    competing: { recorded: 'refused', staged: 'refused', active: 'refused', retired: 'refused', inhibited: 'refused' },
    support: { 'dist/support.js': 'refused', 'data/support.json': 'refused', 'scheduled/support.json': 'refused' },
    twoManifests: ['refused', 'refused'],
  });
});
