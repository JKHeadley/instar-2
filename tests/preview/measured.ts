// Rule 13 on the live path: a live quantity the preview compares or renders is a
// constitutional Measurement carrying its subject, instance and unit. Numbers stay
// readable on the wire; they are decoded once here, with an explicit subject, and
// compared only through compareMeasurements, which refuses a mismatched subject.
import { compareMeasurements, consumeResult, decodeMeasurement } from '../../src/index.js';
import type { Clock, DecodeContext, Measurement, Result } from '../../src/index.js';

/** Every live measured subject and its only admitted unit. */
export const LIVE_SUBJECTS = Object.freeze({
  clock: ['unix-ms'],
  'owned-process-memory': ['bytes'],
  'owned-process-count': ['processes'],
  'owned-process-cpu': ['ms'],
  'doorway-verification-age': ['ms'],
  'credential-remaining': ['ms'],
} as const);
export type LiveSubject = Exclude<keyof typeof LIVE_SUBJECTS, 'clock'>;
const PRODUCER = 'preview-host', CLOCK = 'preview-host-clock';
const context: DecodeContext = { preserved: 'preview:measured', captures: {}, register: {
  generation: { owner: 'part-three', name: 'RegisterGeneration', id: 'preview:measured' },
  entries: [CLOCK], producers: [PRODUCER], methods: [], actions: {}, subjects: LIVE_SUBJECTS, sites: {}, keys: {},
  allowRedelegation: false, conflictStanding: { ordinary: 'delegate', authority: 'operator' } } };
const take = <T>(result: Result<T>): T =>
  consumeResult(result, { Success: value => value, Refused: refused => { throw Error(`measured: ${refused.detail}`); } });

export function liveClock(at: number): Clock {
  return take(decodeMeasurement('clock', { type: 'Measurement', schemaVersion: 1,
    subject: { kind: 'clock', instance: CLOCK }, value: at, unit: 'unix-ms', at, by: PRODUCER }, context));
}
/** A live quantity bound to what it measured. The unit must be the subject's registered unit. */
export function liveMeasurement(kind: LiveSubject, instance: string, value: number, at: number): Measurement {
  return take(decodeMeasurement(kind, { type: 'Measurement', schemaVersion: 1, subject: { kind, instance },
    value, unit: LIVE_SUBJECTS[kind][0], at: liveClock(at), by: PRODUCER }, context));
}
/** left − right; refuses different subjects, instances or units. */
export function compareLive(left: Measurement, right: Measurement, crossInstance = false): number {
  return take(compareMeasurements<'live'>(left as Measurement<'live'>, right as Measurement<'live'>,
    'preview:measured', crossInstance));
}
/** The elapsed time between two clock readings of the same host clock. */
export function clockDifference(later: number, earlier: number): number {
  return take(compareMeasurements<'clock'>(liveClock(later), liveClock(earlier), 'preview:measured'));
}
/** A rendered claim names what was measured, never a bare number. */
export function renderMeasured(m: Measurement): string {
  return `${m.value} ${m.unit} of ${m.subject.kind} (${m.subject.instance})`;
}
/** The compare port handed to the host resource owner: its plain observations are decoded here. */
export function resourceCompare(left: { subject: { kind: string; instance: string }; unit: string; value: number; at: number },
  right: typeof left): number {
  const decode = (row: typeof left) => {
    if (!Object.hasOwn(LIVE_SUBJECTS, row.subject.kind) || row.subject.kind === 'clock'
      || (LIVE_SUBJECTS[row.subject.kind as LiveSubject] as readonly string[])[0] !== row.unit)
      throw Error('measured: unregistered subject or unit');
    return liveMeasurement(row.subject.kind as LiveSubject, row.subject.instance, row.value, row.at);
  };
  return compareLive(decode(left), decode(right));
}
