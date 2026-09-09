import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';
// @ts-expect-error Build checker lives outside pure TypeScript core.
import { checkTransportCoverage, inspectTransportCore, transportDispositions } from '../../scripts/check-transport-contracts.mjs';

it('P6-NF-01 P6-NF-37 coverage checker rejects missing executions and unsupported held claims', () => {
  const dispositions = transportDispositions as { id: string; status: string; reason: string }[];
  const report = { success: true, testResults: [{ name: 'mapping-unit-positive-control', assertionResults:
    dispositions.filter(r => r.status === 'partial').map(r => ({ fullName: `${r.id} mapping fixture`, status: 'passed' })) }] };
  expect(checkTransportCoverage(report)).toHaveLength(40);
  expect(() => checkTransportCoverage({ ...report, testResults: [] })).toThrow('no executed');
  expect(() => checkTransportCoverage({ ...report, success: false })).toThrow('successful actual');
  expect(() => checkTransportCoverage(report, dispositions.map(r => r.id === 'P6-NF-01' ? { ...r, status: 'held' } : r))).toThrow('held claim');
  const declarations = JSON.parse(readFileSync('src/transport/transport.declarations.json', 'utf8')) as { kind: string; status: string; holds: unknown[] }[];
  const manifest = JSON.parse(readFileSync('src/transport/slice-manifest.json', 'utf8')) as { status: string; inheritedDeferrals: unknown[]; forwardContracts: object };
  expect(manifest.status).toBe('dark');
  expect(manifest.inheritedDeferrals).toEqual([]);
  expect(Object.keys(manifest.forwardContracts)).toHaveLength(10);
  expect(declarations.some(d => d.kind === 'features')).toBe(false);
  expect(declarations.every(d => d.holds.length === 0)).toBe(true);
});

it('P6-NF-02 P6-NF-16 static core inspection rejects timers, protocol branches and sibling-owned definitions', () => {
  const sources = Object.fromEntries(readdirSync('src/transport').filter(p => p.endsWith('.ts')).map(p => [`src/transport/${p}`, readFileSync(`src/transport/${p}`, 'utf8')]));
  expect(inspectTransportCore(sources)).toEqual([]);
  for (const bad of ['setTimeout(() => {}, 1);', 'export interface EffectSettlement {}', "fetch('https://api.telegram.org/sendMessage');"]) {
    expect(inspectTransportCore({ ...sources, 'src/transport/bypass.ts': bad }).length).toBeGreaterThan(0);
  }
});
