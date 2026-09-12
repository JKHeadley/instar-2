import { compareMeasurements, decodeMeasurement } from '../index.js';
import type { BoundaryContext, DecodeContext, Measurement, Result } from '../index.js';
import { boundary, ensure, take } from './boundary.js';

/** Local evidence-classification bound; resource allocation remains owned by Part Six. */
export const SCHEDULED_CAPACITY_MAX_AGE_MS = 999_999;

/** Decode fresh scheduler telemetry through Part One and bind it to the assessed subject. */
export function decodeScheduledCapacityMeasurement(kind: string, instance: string, input: unknown,
  context: DecodeContext & BoundaryContext): Result<Measurement> {
  return boundary('ScheduledCapacityMeasurement', input, context, () => {
    ensure(typeof kind === 'string' && kind.length > 0 && typeof instance === 'string' && instance.length > 0,
      'capacity measurement subject must be explicit');
    const measurement = take(decodeMeasurement(kind, input, context));
    ensure(measurement.subject.instance === instance, 'capacity measurement is bound to another subject');
    ensure(measurement.unit === 'percent' && measurement.value >= 0 && measurement.value <= 100,
      'capacity percentage must be within the closed range 0..100');
    ensure(context.actAt !== undefined, 'capacity evidence is unknown without an explicit action clock');
    const action = take(decodeMeasurement('clock', context.actAt, context));
    ensure(typeof measurement.at !== 'number', 'capacity evidence is missing its observed clock');
    const age = take(compareMeasurements<'clock'>(action, measurement.at, context.preserved));
    ensure(age >= 0 && age <= SCHEDULED_CAPACITY_MAX_AGE_MS,
      'capacity evidence is stale or observed after the explicit action clock');
    return measurement;
  });
}
