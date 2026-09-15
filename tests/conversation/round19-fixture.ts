import type { EffectAssessmentInput, EffectRequest } from '../../src/effects/index.js';
import type { AdmissionReservation } from '../../src/transport/index.js';

export interface Round19AssessmentCase {
  readonly name: string;
  readonly field: string | null;
  mutate(input: EffectAssessmentInput): EffectAssessmentInput;
}

export const round19AssessmentCases: readonly Round19AssessmentCase[] = [
  { name: 'control', field: null, mutate: input => input },
  {
    name: 'request-schema99', field: 'request.schemaVersion',
    mutate: input => ({ ...input,
      request: { ...input.request, schemaVersion: 99 } as unknown as EffectRequest }),
  },
  {
    name: 'request-unrecorded-message', field: 'request.message',
    mutate: input => ({ ...input,
      request: { ...input.request, message: 'never-recorded-message' } as EffectRequest }),
  },
  {
    name: 'reservation-undeclared-id-field', field: 'reservation.id',
    mutate: input => ({ ...input,
      reservation: { ...input.reservation, id: 'never-recorded-reservation' } as unknown as AdmissionReservation }),
  },
  {
    name: 'reservation-schema99', field: 'reservation.schemaVersion',
    mutate: input => ({ ...input,
      reservation: { ...input.reservation, schemaVersion: 99 } as unknown as AdmissionReservation }),
  },
  {
    name: 'reservation-wrong-executor', field: 'reservation.executor',
    mutate: input => ({ ...input,
      reservation: { ...input.reservation, executor: 'other-executor' } as AdmissionReservation }),
  },
  {
    name: 'response-unrecorded-id', field: 'observation.id',
    mutate: input => ({ ...input, observations: input.observations.map(observation =>
      observation.stage === 'response' ? { ...observation, id: 'never-recorded' } : observation) }),
  },
];
