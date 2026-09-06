import { expect, it } from 'vitest';
// @ts-expect-error Build checker is a JavaScript host tool.
import { checkJudgmentCoverage, inspectJudgmentCore, judgmentDispositions } from '../../scripts/check-judgment-contracts.mjs';
it('P7-NF-01 every design fixture has an honest slice disposition and missing/red execution cannot count', () => {
  expect(judgmentDispositions).toHaveLength(53);
  expect(() => checkJudgmentCoverage({ success: true, testResults: [] })).toThrow('no executed passing');
  expect(() => checkJudgmentCoverage({ success: false, testResults: [] })).toThrow('successful actual');
  expect(() => checkJudgmentCoverage({ success: true, testResults: [] }, judgmentDispositions.slice(1))).toThrow('missing');
});
it('P7-NF-03 provider bypass and duplicate ownership fail static core checks; owned doorway passes', () => {
  expect(inspectJudgmentCore({ 'src/judgment/bypass.ts': 'import SDK from "provider-sdk"; model.exchange(input); interface AdmissionReservation {}' })).toHaveLength(3);
  expect(inspectJudgmentCore({ 'src/feature.ts': 'model.exchange(input);' })).toHaveLength(1);
  expect(inspectJudgmentCore({ 'src/judgment/doorway.ts': 'import { consumeResult } from "../index.js"; p.model.exchange(input);' })).toEqual([]);
});
