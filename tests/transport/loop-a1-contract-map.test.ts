import { expect, it } from 'vitest';
// @ts-expect-error Build checker lives outside the pure TypeScript core.
import { checkTransportSeamEvidence, transportSeamEvidence } from '../../scripts/check-transport-contracts.mjs';

it('SLB-A1-MAP-92 refuses zero tests and the absence of every required A1 fixture id', () => {
  const evidence = transportSeamEvidence as { id: string; tier: 'unit' | 'integration' | 'e2e'; cases: string }[];
  const report = { success: true, testResults: evidence.map(row => ({
    name: `/repo/tests/${row.tier === 'unit' ? 'transport' : row.tier}/fixture.test.ts`,
    assertionResults: [{ fullName: `${row.id} ${row.cases}`, status: 'passed' }],
  })) };
  expect(checkTransportSeamEvidence(report)).toEqual(transportSeamEvidence);
  expect(() => checkTransportSeamEvidence({ ...report, testResults: [] })).toThrow('missing seam evidence');
  for (const row of evidence) expect(() => checkTransportSeamEvidence({ ...report,
    testResults: report.testResults.filter(file => !file.assertionResults[0]!.fullName.includes(row.id)) }))
    .toThrow(`missing seam evidence: ${row.id}`);
});
