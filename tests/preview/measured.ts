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
  'answer-latency': ['ms'],
  'reply-check-latency': ['ms'],
  'send-latency': ['ms'],
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

type Distribution = { count: number; p50Ms: number | null; p95Ms: number | null };
/** The status timing projection with each percentile rendered as a subject-bound claim, and the
 * Jev reply-check p95 compared with its budget as the same subject (Rule 13). */
export function measuredTimings<T extends { budgetMs: number; answer: Distribution; jev: Distribution;
  fallback: Distribution; send: Distribution }>(timings: T, at: number) {
  const subjects = { answer: 'answer-latency', jev: 'reply-check-latency', fallback: 'reply-check-latency', send: 'send-latency' } as const;
  const claims = Object.fromEntries((Object.keys(subjects) as (keyof typeof subjects)[]).map(part => {
    const d = timings[part], instance = `preview-replies/${part}`;
    return [part, { p50: d.p50Ms === null ? null : renderMeasured(liveMeasurement(subjects[part], instance, d.p50Ms, at)),
      p95: d.p95Ms === null ? null : renderMeasured(liveMeasurement(subjects[part], instance, d.p95Ms, at)) }];
  }));
  const jevWithinBudget = timings.jev.p95Ms === null ? null
    : compareLive(liveMeasurement('reply-check-latency', 'preview-replies/jev', timings.jev.p95Ms, at),
      liveMeasurement('reply-check-latency', 'preview-replies/jev', timings.budgetMs, at)) <= 0;
  return { ...timings, claims, jevWithinBudget };
}
