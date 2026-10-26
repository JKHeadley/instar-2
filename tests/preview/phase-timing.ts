/** Content-free observations on the existing encrypted journal, never admission evidence.
 * One record per send attempt or checked phase; failures cannot change the observed operation. */
export type PhaseTiming = {
  kind: 'phase-timing'; id: string; phase: 'acknowledgement' | 'send' | 'audience' | 'version' | 'auth' | 'jev-disclosure' | 'jev-admission' | 'jev';
  measurements: Record<string, number | boolean>; at: number;
  forward: { generation: 4; additive: true };
};
const fields = new Set(['scheduledDueAt', 'callbackEnteredAt', 'timerCallback', 'sendEnteredAt',
  'audienceAdmittedAt', 'transportBegunAt', 'transportReturnedAt', 'attempt', 'provedNotSentAttempts',
  'cacheHit', 'elapsedMs', 'accepted', 'failed']);
export function checkPhaseTiming(row: PhaseTiming): void {
  if (!['acknowledgement', 'send', 'audience', 'version', 'auth', 'jev-disclosure', 'jev-admission', 'jev'].includes(row.phase)
    || typeof row.id !== 'string' || row.id.length > 256
    || !row.measurements || typeof row.measurements !== 'object' || Array.isArray(row.measurements)
    || !Object.entries(row.measurements).every(([key, value]) => fields.has(key)
      && (typeof value === 'boolean' || typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)))
    throw Error('preview journal: invalid phase timing');
}
export function recordPhaseTiming(append: (row: PhaseTiming) => void, id: string, phase: PhaseTiming['phase'],
  measurements: PhaseTiming['measurements'], at: number): void {
  try { append({ kind: 'phase-timing', id, phase, measurements: { ...measurements }, at, forward: { generation: 4, additive: true } }); }
  catch { /* Observation never changes admission, delivery or retry. */ }
}

/** Polls still perform every audience check. Record the first result and real verdict
 * transitions, not another diagnostic for every idle drain/cache refresh. Send attempts
 * retain their own latency measurements. This process-local cache has no admission role. */
export function createAudienceTimingObserver(append: (row: PhaseTiming) => void, elapsed: () => number, now: () => number) {
  let previous: boolean | undefined;
  return async (check: (observe: (cacheHit: boolean) => void) => Promise<boolean>): Promise<boolean> => {
    const started = elapsed(); let cacheHit: boolean | undefined, accepted = false;
    try { accepted = await check(hit => { cacheHit = hit; }); return accepted; }
    finally {
      if (accepted !== previous) {
        recordPhaseTiming(append, 'group-disclosure', 'audience', {
          ...(cacheHit === undefined ? {} : { cacheHit }), accepted, elapsedMs: Math.max(0, Math.round(elapsed() - started)),
        }, now());
        previous = accepted;
      }
    }
  };
}

/** Repeated timer checks and send preflights can run indefinitely without a transport
 * attempt (live held turns 969390340/417/465/624). Retain their phase transitions;
 * every actual transport attempt keeps its own timing. State is worker-local diagnostics. */
export function createPhaseTimingRecorder(append: (row: PhaseTiming) => void) {
  const previous = new Map<string, string>();
  return (id: string, phase: PhaseTiming['phase'], measurements: PhaseTiming['measurements'], at: number): void => {
    const key = `${phase}:${id}${phase === 'acknowledgement' ? `:${String(measurements.timerCallback)}` : ''}`;
    if (phase === 'acknowledgement' || phase === 'send' && measurements.transportBegunAt === undefined) {
      const state = JSON.stringify(phase === 'acknowledgement'
        ? [measurements.scheduledDueAt, measurements.timerCallback]
        : [measurements.audienceAdmittedAt !== undefined, measurements.attempt, measurements.provedNotSentAttempts]);
      if (previous.get(key) === state) return;
      previous.set(key, state);
    } else previous.delete(key);
    recordPhaseTiming(append, id, phase, measurements, at);
  };
}
