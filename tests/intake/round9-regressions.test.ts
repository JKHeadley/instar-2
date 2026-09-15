import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('R9-F5 preserves the original Part Four registration source chain beside the additive verified-act registration', () => {
  const source = readFileSync('src/intake/port.ts', 'utf8');
  expect(source).toContain('[],workRegistration,stopRegistration]');
  expect(source).toContain('...ordinaryRegistrations,...verifiedActRegistration? [verifiedActRegistration]:[]');
});
