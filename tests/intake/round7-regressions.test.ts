import { expect, it } from 'vitest';
import { hashBytes } from '../../src/facts/index.js';
import { intakeFixture, message, refused, route, value } from './fixtures.js';

it.each([
  ['V30 current base advances', { currentBase: 'base:2' }],
  ['V34 current artifact advances', { artifact: hashBytes('new artifact') }],
])('R7-F1 %s preserves a verified act as valid history without contaminating ordinary receive', (_name, changed) => {
  const f = intakeFixture(), verified = f.verifiedAct();
  const next = f.verifiedAct({ request: { requestId: 'request:after-advance' } });
  const port = f.port();
  value(port.admitVerifiedAct(verified.input));
  Object.assign(f.context, { decode: { ...f.context.decode, ...changed } });
  expect(value(port.receive(message('ordinary after deployment advance'), route)).kind).toBe('admitted');
  refused(port.admitVerifiedAct(next.input), 'current');
});

it('R7-F1 V33 recovery of an already-admitted ordinary message survives a historical approval and base advance', () => {
  const f = intakeFixture(), verified = f.verifiedAct(), port = f.port();
  value(port.receive(message('ordinary before deployment advance'), route));
  const receipt = f.facts().find(row => row.kind === 'intake-receipt')!;
  value(port.admitVerifiedAct(verified.input));
  Object.assign(f.context, { decode: { ...f.context.decode, currentBase: 'base:2' } });
  expect(value(port.recover(receipt.id)).kind).toBe('duplicate');
  expect(value(port.expireHolds())).toBe(0);
});

it('R7-F1 V68 authenticated stop remains reachable after historical approval and base advance', () => {
  const f = intakeFixture(), verified = f.verifiedAct(), port = f.port();
  value(port.admitVerifiedAct(verified.input));
  Object.assign(f.context, { decode: { ...f.context.decode, currentBase: 'base:2' } });
  expect(value(port.receive(JSON.stringify({ schemaVersion: 1, kind: 'stop', command: '/stop' }), route)).kind).toBe('stopped');
});
