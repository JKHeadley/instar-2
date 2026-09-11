import { expect, it } from 'vitest';
import { exerciseP15Round3Proof } from './round3-proof.js';

it('P15-NF-08 P15-NF-09 P15-NF-10 P15-NF-17 P15-NF-29 P15-NF-31 P15-NF-33 P15-NF-34 P15-NF-51 round-three unit proof executes real owner paths', () => {
  expect(exerciseP15Round3Proof()).toMatchObject({
    currentNeighbor: 'accepted', invalidJob: 'refused', planeAfterRefusal: 'accepted',
    signedCollisions: ['refused', 'refused'], freshCapacity: 'accepted', invalidCapacity: ['refused', 'refused'],
    staleCapacity: 'refused', unknownCapacity: 'refused', unobservableFramework: 'refused',
    lowerTimestamp: 'accepted', subMillisecondTimestamp: 'refused',
    representationMismatch: expect.stringContaining('Part One Clock whole-millisecond rule'),
    legacyCaptured: { sourceKind: 'legacy-job-declaration', schedule: '*/5 * * * *', priority: 'critical', duration: 1, model: 'haiku' },
    legacyOmittedModel: 'sonnet', arbitraryModel: 'refused',
  });
});
