/** Eight's narrow worker-input action (D18 §4/§8/§13, P14-NF-56).
 * Reuses the accepted delivery and its journal. The owner resolves authority; Ten supplies fresh
 * same-composer evidence and the confined key driver. No new input or new delivery is created.
 * Rules 26/29/42: an unknown key outcome remains unknown, including across a new observer. */
import { boundary, ensure, freeze } from './boundary.js';
import type { BoundaryContext, Result } from '../index.js';

export interface PendingInputBinding {
  readonly operation: string; readonly identity: string; readonly incarnation: string;
  readonly claim: string; readonly intake: string; readonly digest: string; readonly payloadDigest: string;
  readonly turnStartedAt: number; readonly deadline: number;
}
export interface AuthenticPendingInput extends PendingInputBinding {
  readonly kind: 'worker-input'; readonly action: 'submit-authentic-pending-input';
  /** Stable ordinal within the original delivery; five keys across the four legacy rungs. */
  readonly ordinal: number;
  readonly consumption: 'owner-turn-observation';
}
export interface PendingInputSubmission {
  readonly request: AuthenticPendingInput;
  readonly observation: string;
  readonly at: number;
  readonly state: 'dispatching' | 'accepted' | 'uncertain';
}
export interface PendingInputSubmissionPorts {
  /** Re-resolve accepted delivery, current owner/worker incarnation and open turn. */
  current(): PendingInputBinding;
  history(): readonly PendingInputSubmission[];
  /** Fresh same-pane full-payload, activity, menu and presentation checks; null preserves input. */
  observe(): string | null;
  /** Must durably write into the original delivery journal before returning. */
  save(entry: PendingInputSubmission): void;
  /** Confined driver rechecks stop and worker identity at the leaving point. */
  submit(key: 'Enter' | 'C-m'): void;
  now(): number;
}

/** The action cannot carry arbitrary text or a menu selection. A successful key receipt is
 * acceptance only; the existing owner turn observation still decides consumption/completion. */
export function submitAuthenticPendingInput(request: AuthenticPendingInput, ports: PendingInputSubmissionPorts,
  context: BoundaryContext): Result<Readonly<{ state: 'accepted' | 'uncertain'; duplicate: boolean }>> {
  return boundary('SubmitAuthenticPendingInput', request, context, () => {
    const current = ports.current();
    const expected = { ...current, kind: 'worker-input', action: 'submit-authentic-pending-input',
      ordinal: request.ordinal, consumption: 'owner-turn-observation' };
    ensure(Object.keys(request).length === Object.keys(expected).length
      && Object.entries(expected).every(([key, value]) => request[key as keyof AuthenticPendingInput] === value),
    'pending input action differs from the current accepted delivery');
    ensure(Number.isSafeInteger(request.ordinal) && request.ordinal >= 0 && request.ordinal < 5,
      'pending input key budget exhausted');
    ensure(ports.now() < current.deadline, 'pending input deadline exhausted');
    const history = ports.history();
    if (history.some(entry => entry.state !== 'accepted')) return { state: 'uncertain', duplicate: true };
    const prior = history.find(entry => entry.request.ordinal === request.ordinal);
    if (prior) return { state: 'accepted', duplicate: true };
    ensure(request.ordinal === history.length, 'pending input submission ordinal differs');
    const observation = ports.observe();
    ensure(observation !== null, 'authentic pending composer evidence unavailable; input preserved');
    // Freeze the exact admission before passing it to persistence or the physical driver.
    const entry = freeze({ request: { ...request }, observation, at: ports.now(), state: 'dispatching' as const });
    ports.save(entry);
    try { ports.submit(request.ordinal === 2 ? 'C-m' : 'Enter'); }
    catch {
      ports.save({ ...entry, state: 'uncertain' });
      return { state: 'uncertain', duplicate: false };
    }
    ports.save({ ...entry, state: 'accepted' });
    return { state: 'accepted', duplicate: false };
  });
}
