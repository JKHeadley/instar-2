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
