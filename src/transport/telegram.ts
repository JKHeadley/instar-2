import type { Result } from '../index.js';
import type { AdmissionReservation, DispatchClaim, FenceToken } from './contracts.js';

// Deliberately thin: no Telegram networking, timers, effect classification, execution,
// Outcome construction or retries here. M is five's envelope, imported by composition.
export interface TelegramEffectDoorway<M> {
  readonly owner: 'part-eight';
  send(input: { readonly message: M; readonly reservation: AdmissionReservation;
    readonly claim: DispatchClaim; readonly fence: FenceToken }): Result<unknown>;
}
export function telegramReferenceAdapter<M>(doorway: TelegramEffectDoorway<M>) {
  return Object.freeze({
    dispatch(message: M, reservation: AdmissionReservation, claim: DispatchClaim, fence: FenceToken): Result<unknown> {
      return doorway.send({ message, reservation, claim, fence });
    },
  });
}
