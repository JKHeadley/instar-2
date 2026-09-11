import { decodeMeasurement } from '../index.js';
import type { BoundaryContext, DecodeContext, Measurement, Result } from '../index.js';
import { boundary, ensure, take } from './boundary.js';

/** Decode fresh scheduler telemetry through Part One and bind it to the assessed subject. */
export function decodeScheduledCapacityMeasurement(kind: string, instance: string, input: unknown,
  context: DecodeContext & BoundaryContext): Result<Measurement> {
  return boundary('ScheduledCapacityMeasurement', input, context, () => {
    ensure(typeof kind === 'string' && kind.length > 0 && typeof instance === 'string' && instance.length > 0,
      'capacity measurement subject must be explicit');
    const measurement = take(decodeMeasurement(kind, input, context));
    ensure(measurement.subject.instance === instance, 'capacity measurement is bound to another subject');
    return measurement;
  });
}
