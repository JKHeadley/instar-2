/** Fixed protocol paths only: arbitrary request paths can contain credentials or profile names. */
export const MODEL_REQUEST_PATHS = ['/v1/messages', '/backend-api/codex/responses',
  '/backend-api/codex/responses/compact', '/v1/responses', '/responses', '[omitted]'] as const;
export const MODEL_REQUEST_DIAGNOSTIC_LIMIT = 64;
const modelRequestResults = ['admitted', 'allowance-exhausted', 'reservation-unavailable', 'closed-or-stopped'] as const;
/** Content-free observations on the existing encrypted journal, never admission evidence.
 * One record per send attempt or checked phase; failures cannot change the observed operation. */
export type PhaseTiming = {
  kind: 'phase-timing'; id: string; phase: 'acknowledgement' | 'send' | 'audience' | 'version' | 'auth' | 'jev-disclosure' | 'jev-admission' | 'jev' | 'model-request';
  request?: { path: typeof MODEL_REQUEST_PATHS[number]; result: typeof modelRequestResults[number] };
  measurements: Record<string, number | boolean>; at: number;
  forward: { generation: 4; additive: true };
  /** Compacted idle samples represented by this row, excluding the separately kept tail. */
  observations?: { count: number; firstAt: number; lastAt: number };
};
const fields = new Set(['scheduledDueAt', 'callbackEnteredAt', 'timerCallback', 'sendEnteredAt',
  'audienceAdmittedAt', 'transportBegunAt', 'transportReturnedAt', 'attempt', 'provedNotSentAttempts',
  'cacheHit', 'elapsedMs', 'accepted', 'failed']);
const requestFields = new Set(['ordinal', 'admittedCalls', 'admitted', 'limitReached']);
export function checkPhaseTiming(row: PhaseTiming): void {
  if (!['acknowledgement', 'send', 'audience', 'version', 'auth', 'jev-disclosure', 'jev-admission', 'jev', 'model-request'].includes(row.phase)
    || typeof row.id !== 'string' || row.id.length > 256
    || !row.measurements || typeof row.measurements !== 'object' || Array.isArray(row.measurements)
    || !Object.entries(row.measurements).every(([key, value]) => (row.phase === 'model-request' ? requestFields : fields).has(key)
      && (typeof value === 'boolean' || typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)))
    throw Error('preview journal: invalid phase timing');
  if (row.phase === 'model-request') {
    const m = row.measurements, r = row.request;
    if (!r || !MODEL_REQUEST_PATHS.includes(r.path) || !modelRequestResults.includes(r.result)
      || Object.keys(r).some(key => !['path', 'result'].includes(key))
      || Object.keys(m).length !== 4 || !Number.isSafeInteger(m.ordinal) || Number(m.ordinal) < 1
      || Number(m.ordinal) > MODEL_REQUEST_DIAGNOSTIC_LIMIT || !Number.isSafeInteger(m.admittedCalls)
      || Number(m.admittedCalls) < 0 || m.admitted !== (r.result === 'admitted')
      || m.limitReached !== (m.ordinal === MODEL_REQUEST_DIAGNOSTIC_LIMIT))
      throw Error('preview journal: invalid model request observation');
  } else if (row.request !== undefined) throw Error('preview journal: request outside model request observation');
  if (row.observations && (!isIdleAudienceTiming(row)
    || !Number.isSafeInteger(row.observations.count) || row.observations.count < 1
    || !Number.isSafeInteger(row.observations.firstAt) || row.observations.firstAt < 0
    || !Number.isSafeInteger(row.observations.lastAt) || row.observations.firstAt > row.at
    || row.observations.lastAt < row.at)) throw Error('preview journal: invalid phase timing aggregate');
}

/** Match only the idle observer's shape. Other audience measurements may describe real work. */
export const isIdleAudienceTiming = (row: PhaseTiming): boolean => row.phase === 'audience' && row.id === 'group-disclosure'
  && typeof row.measurements.accepted === 'boolean'
  && Object.keys(row.measurements).every(field => ['accepted', 'cacheHit', 'elapsedMs'].includes(field));

export const IDLE_AUDIENCE_TIMINGS_KEPT = 100;
/** Rules 7/9/13: retain each verdict transition, summarize older repeated checks and keep
 * the latest 100 raw samples per verdict run. Counts exclude that tail, so another
 * compaction or restart cannot double-count it. Send/ack/auth/Jev evidence is never sampled.
 * Port the 1.x JsonlStore bounded-diagnostics pattern into the existing snapshot archive. */
export function retainedIdleAudienceTimings(rows: readonly PhaseTiming[]): Map<PhaseTiming, PhaseTiming> {
  const kept = new Map<PhaseTiming, PhaseTiming>();
  let first: PhaseTiming | undefined;
  let recent: PhaseTiming[] = [];
  for (const row of rows) {
    if (!isIdleAudienceTiming(row)) {
      if (row.phase === 'audience' && row.id === 'group-disclosure') first = undefined;
      continue;
    }
    if (!first || row.measurements.accepted !== first.measurements.accepted) {
      first = row; recent = []; kept.set(row, row); continue;
    }
    recent.push(row); kept.set(row, row);
    if (recent.length <= IDLE_AUDIENCE_TIMINGS_KEPT) continue;
    const old = recent.shift()!;
    const aggregate = kept.get(first)!.observations ?? { count: 1, firstAt: first.at, lastAt: first.at };
    const added = old.observations ?? { count: 1, firstAt: old.at, lastAt: old.at };
    kept.set(first, { ...first, observations: { count: aggregate.count + added.count,
      firstAt: Math.min(aggregate.firstAt, added.firstAt), lastAt: Math.max(aggregate.lastAt, added.lastAt) } });
    kept.delete(old);
  }
  return kept;
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
