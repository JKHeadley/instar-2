import type { MeasurementAmountInput, MeasurementLedgerPort, ResourcePoint } from './contracts.js';
import type { MeasurementDecodeContext } from './decode.js';
import { admitMeasurementAmount, resourceTrend } from './operations.js';

export function createMeasurementLedger(context: MeasurementDecodeContext): MeasurementLedgerPort {
  return Object.freeze({
    owner: 'part-sixteen' as const,
    admitAmount: (input: MeasurementAmountInput) => admitMeasurementAmount(input, context),
    trend: (points: readonly ResourcePoint[], minimumSamples: number) => resourceTrend(points, minimumSamples, context),
  });
}
