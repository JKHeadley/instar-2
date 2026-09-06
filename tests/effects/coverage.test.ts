import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';
// @ts-expect-error Build audit is JavaScript outside pure core.
import { checkEffectCoverage, effectDispositions, inspectEffects } from '../../scripts/check-effect-contracts.mjs';

it('P8-NF-01 P8-NF-02 P8-NF-10 exact owner inventory and actual-run mapper reject false held claims and private sibling bypass', () => {
  const source = Object.fromEntries(readdirSync('src/effects').filter(f => f.endsWith('.ts')).map(f => [f, readFileSync(`src/effects/${f}`, 'utf8')]));
  expect(inspectEffects(source)).toEqual([]);
  expect(inspectEffects({ bad: "import { claims } from '../transport/authority.js'; export interface DispatchClaim {}" })).toHaveLength(2);
  const types = source['contracts.ts']!;
  for (const name of ['OperationDefinition', 'EffectRequest', 'EffectValidation', 'OperationObservation', 'EffectSettlement', 'OutboundMessage', 'OperationAdapterPort'])
    expect(types.match(new RegExp(`export interface ${name}\\b`, 'g'))).toHaveLength(1);
  expect(() => checkEffectCoverage({ success: true, testResults: [] })).toThrow('missing executed fixture');
  expect(() => checkEffectCoverage({ success: false, testResults: [] })).toThrow('actual test run');
  expect(effectDispositions).toHaveLength(49);
  expect(effectDispositions.every((r: { status: string }) => r.status !== 'held')).toBe(true);
});

it('P8-NF-09 P8-NF-46 Telegram-shaped evidence matrix declares unsupported guarantees without production activation', () => {
  const contract = JSON.parse(readFileSync('src/effects/telegram-fixture-contract.json', 'utf8')) as {
    productionActivation: string; hiddenRetries: number; capabilities: Record<string, { status: string; reason?: string; limit?: string }>;
  };
  expect(contract.productionActivation).toBe('dark'); expect(contract.hiddenRetries).toBe(0);
  expect(Object.keys(contract.capabilities)).toHaveLength(6);
  for (const key of ['stableOperationAndReceiptLookup', 'decisiveNonOccurrence', 'exclusionOfDelayedExecution', 'finalCharge'])
    expect(contract.capabilities[key]).toMatchObject({ status: 'unsupported', reason: expect.any(String) });
  expect(contract.capabilities.prerequisiteDurability!.limit).toContain('second directory');
  const declarations = JSON.parse(readFileSync('src/effects/effect.declarations.json', 'utf8')) as { kind: string; holds: unknown[] }[];
  expect(declarations.every(d => d.kind === 'protected artifacts' && d.holds.length === 0)).toBe(true);
});
