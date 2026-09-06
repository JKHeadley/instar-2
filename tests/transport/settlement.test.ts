import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { decode } from '../../src/index.js';
import type { SettlementAccountingInput } from '../../src/transport/index.js';
import { accounting } from '../../src/transport/settlement.js';
import { transportFixture, value } from './fixture.js';

it('P6-NF-02 P6-NF-35 actual eight-owned settlement type composes with six without a local redefinition', () => {
  const child = spawnSync(process.execPath, ['tests/transport/settlement-types.mjs'], { encoding: 'utf8', timeout: 20000 });
  expect(child.status, child.stderr).toBe(0);
}, 25000);

it('P6-NF-14 P6-NF-19 P6-NF-39 accounting keeps maximum exposure at every uncertainty boundary', () => {
  const f = transportFixture(), { reservation } = f.prepared();
  const evidence = f.evidenceInput(); f.evidence.push(value(decode('Evidence', evidence, f.ctx.decode)));
  for (const state of ['happened', 'did-not-happen', 'uncertain']) {
    const outcome = value(decode('Outcome', { type: 'Outcome', schemaVersion: 1, kind: state, evidence: [evidence.id] }, f.ctx.decode));
    for (const finalCharge of [null, 0, 7, 30]) for (const delayedExecutionExcluded of [false, true]) {
      const input = { outcome, finalCharge, delayedExecutionExcluded, retainedExposure: finalCharge ?? 20, retryEligible: false } as SettlementAccountingInput;
      const unresolved = state === 'uncertain' || finalCharge === null || !delayedExecutionExcluded;
      const r = accounting(input, reservation);
      expect(r.exposure).toBe(unresolved ? Math.max(20, finalCharge ?? 0) : finalCharge);
      expect(r.released).toBe(unresolved ? 0 : Math.max(0, 20 - finalCharge!));
      expect(r.actualCharge).toBe(finalCharge ?? -1);
      expect(r.retryEligible).toBe(0);
      expect(r.capViolation).toBe(finalCharge === 30 ? 1 : 0);
    }
  }
});
