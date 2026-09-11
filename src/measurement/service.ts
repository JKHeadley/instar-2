import type { AggregateMeasurementsRequest, AttributionRequest, BurnEpisodeState, BurnPolicy, BurnWindow,
  MeasurementLedgerPort, MeasurementReadQuery, MeasurementReadRow, QuantityOwnerResolution, QuantityWitness,
  ResourcePoint } from './contracts.js';
import type { MeasurementDecodeContext } from './decode.js';
import { aggregateMeasurements, evaluateBurn, renderBoundedRead, resolveAttribution, resolveQuantity, resourceTrend } from './operations.js';

export function createMeasurementLedger(context: MeasurementDecodeContext): MeasurementLedgerPort {
  return Object.freeze({
    owner: 'part-sixteen' as const,
    resolveQuantity: (witnesses: readonly QuantityWitness[], resolution?: QuantityOwnerResolution) => resolveQuantity(witnesses, resolution, context),
    aggregate: (request: AggregateMeasurementsRequest) => aggregateMeasurements(request, context),
    attribute: (request: AttributionRequest) => resolveAttribution(request, context),
    evaluateBurn: (policy: BurnPolicy, previous: BurnEpisodeState, current: BurnWindow, baselines: readonly BurnWindow[]) => evaluateBurn(policy, previous, current, baselines, context),
    trend: (points: readonly ResourcePoint[], minimumSamples: number) => resourceTrend(points, minimumSamples, context),
    read: (query: MeasurementReadQuery, rows: readonly MeasurementReadRow[], timedOut = false) => renderBoundedRead(query, rows, timedOut, context),
  });
}
