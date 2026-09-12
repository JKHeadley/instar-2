import { expect, it } from 'vitest';
import { exerciseP15Round16Zone } from '../scheduled/round16-proof.js';

it('P15-NF-09 round-sixteen full-port package admission refuses Mars/Olympus_Mons and accepts America/New_York', () => {
  expect(exerciseP15Round16Zone('Mars/Olympus_Mons')).toMatchObject({ status: 'refused' });
  expect(exerciseP15Round16Zone('America/New_York')).toEqual({
    status: 'accepted',
    timeZone: 'America/New_York',
  });
});
