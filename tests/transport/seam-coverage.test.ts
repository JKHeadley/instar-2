import { expect, it } from 'vitest';
// @ts-expect-error Build checker lives outside pure TypeScript core.
import { checkTransportSeamEvidence, transportSeamEvidence } from '../../scripts/check-transport-contracts.mjs';

it('SLB-MAP-24 seam coverage rejects every absent fixture and a zero-test report', () => {
  const evidence = transportSeamEvidence as { id: string; tier: 'unit' | 'integration' | 'e2e'; cases: string }[];
  const report = { success: true, testResults: evidence.map(row => ({
    name: `/repo/tests/${row.tier === 'unit' ? 'transport' : row.tier}/fixture.test.ts`,
    assertionResults: [{ fullName: `${row.id} ${row.cases}`, status: 'passed' }],
  })) };
  expect(checkTransportSeamEvidence(report)).toEqual(transportSeamEvidence);
  expect(() => checkTransportSeamEvidence({ ...report, testResults: [] })).toThrow('missing seam evidence');
  for (const row of evidence) {
    expect(() => checkTransportSeamEvidence({ ...report,
      testResults: report.testResults.filter(file => !file.assertionResults[0]!.fullName.includes(row.id)) }))
      .toThrow(`missing seam evidence: ${row.id}`);
  }
  expect(() => checkTransportSeamEvidence({ ...report, success: false })).toThrow('successful actual');
});
