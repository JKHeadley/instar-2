import { expect, it } from 'vitest';
import { createOperatorSurface } from '../../src/operator/index.js';
import { value } from '../fixtures.js';
import { operatorFixture } from './fixture.js';

it('R6-F2 V35/V37 presents the exact request-derived standing-grant candidate term', () => {
  const x = operatorFixture({ recurrence: true }), view = value(x.surface().render(x.request.id));
  expect(view.standingGrantCandidate).toEqual({ actions: ['work'], scope: x.f.scope, expiresAt: 400 });
});

it('R6-F3 V38 keeps clean pending work visible and marks every conflicted fact non-approvable', () => {
  const x = operatorFixture();
  x.conflictRequest();
  const clean = x.verifiedAct({ surface: 'phone-surface', request: { requestId: 'clean:round6' } });
  const surface = value(createOperatorSurface({ ...x.composition, maxPending: 10 }));
  const queue = value(surface.pending(10));
  expect(queue.rows.some(row => row.fact === clean.request.id)).toBe(true);
  const conflicts = queue.rows.filter(row => 'approvable' in row);
  expect(conflicts.length).toBeGreaterThan(0);
  expect(conflicts.every(row => row.approvable === false && row.state === 'conflict'
    && row.primaryActions.length === 0 && row.competingFacts.length > 1)).toBe(true);
});
