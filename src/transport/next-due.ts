/** Disposable next-due wake. Like 1.x PromiseBeacon.schedule/fire, reconstruct from
 * durable anchors and reread before firing. One coalesced hint feeds the existing
 * bounded lane; that lane alone owns backoff, admission, stop and effect authority.
 * No timer or clock is ambient (NF-52). Refresh after intake/work; close on shutdown. */
export interface NextDueWakePorts {
  now(): number;
  next(): number | null;
  after(milliseconds: number, fire: () => void): () => void;
  wake(): void;
}
export function createNextDueWake(ports: NextDueWakePorts) {
  let cancel: (() => void) | null = null, armed: number | null = null, generation = 0, closed = false;
  const disarm = () => { generation++; cancel?.(); cancel = null; armed = null; };
  const refresh = (): void => {
    if (closed) return;
    const next = ports.next();
    if (next === armed) return;
    disarm();
    if (next === null || !Number.isSafeInteger(next)) return;
    armed = next;
    const ticket = generation;
    // Native timers overflow after ~24.8 days. A distant deadline is re-read, never fired early.
    cancel = ports.after(Math.max(1, Math.min(2_147_483_647, next - ports.now())), () => {
      if (closed || ticket !== generation) return;
      disarm();
      const current = ports.next();
      if (current !== null && Number.isSafeInteger(current) && current <= ports.now()) {
        // Rule 55: consume this deadline before requesting work. A completion refresh
        // after pre-start refusal must not create a 1-ms retry loop. The ordinary
        // periodic cycle still revisits it; a changed deadline gets a fresh wake.
        armed = current;
        ports.wake();
      }
      else refresh();
    });
  };
  return { refresh, close: () => { closed = true; disarm(); } };
}
