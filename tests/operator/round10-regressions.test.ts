import { expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import { value } from '../fixtures.js';
import { operatorFixture } from './fixture.js';

it('P11-NF-05 P11-NF-14 R10-F2 rereview8 V90 a clean request naming no blocked work renders exactly as intake accepts it', () => {
  const f = operatorFixture();
  const verified = f.verifiedAct({ surface: 'phone-surface', request: { requestId: 'nothing-blocked', blockedWork: '' } });
  expect(value(f.port().admitVerifiedAct(verified.input)).kind).toBe('approved');
  expect(value(f.surface().render(verified.request.id)).blockedWork).toBe('');
});

it('P11-NF-05 P11-NF-14 R10-F2 rereview8 V91 nonempty blocked work remains unchanged', () => {
  const f = operatorFixture();
  expect(value(f.surface().render(f.request.id)).blockedWork).toBe('operator-authorized work');
});

it('P11-NF-13 R10-F3 rereview8 V92 unavailable broker posture yields an explicitly unprotected diagnosis', () => {
  const f = operatorFixture();
  f.composition.broker.posture = () => decode('Scope',
    { type: 'Scope', schemaVersion: 1, kind: 'project', members: [] }, f.context.decode) as never;
  const view = value(f.surface().protection('op', '/policy'));
  expect(view.posture).toBe('unprotected');
  expect(view.uncertainty).toContain('broker-posture-unavailable:scope.members: empty or duplicate members');
});

it('P11-NF-13 R10-F3 rereview8 V93 available unprotected broker posture remains an honest unprotected diagnosis', () => {
  const f = operatorFixture();
  const view = value(f.surface().protection('op', '/policy'));
  expect(view.posture).toBe('unprotected');
  expect(view.uncertainty).toContain('broker-posture-unprotected');
});
