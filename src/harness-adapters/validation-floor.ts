import { consumeResult, defineDecoder } from '../index.js';
import type { BoundaryContext, Hash, Json, Result, VersionedDecoder } from '../index.js';

declare const harnessValidationFloorOwned: unique symbol;
interface HarnessValidationFloorOwned {
  readonly [harnessValidationFloorOwned]: 'part-thirteen-validation-floor';
}

export interface HarnessValidationFloor extends HarnessValidationFloorOwned {
  readonly type: 'HarnessValidationFloor';
  readonly schemaVersion: 1;
  readonly id: string;
  readonly purpose: 'transcript-poison';
  readonly adapter: string;
  readonly artifact: Hash;
  readonly platform: string;
  readonly machine: string;
  readonly launch: string;
  readonly incarnation: string;
  readonly processIdentity: string;
  readonly subject: string;
  readonly event: string;
  readonly eventHash: Hash;
  readonly observation: string;
  readonly observationFact: string;
  readonly observationWitness: string;
  readonly plan: string;
  readonly planFact: string;
  readonly planVersion: string;
  readonly probe: string;
  readonly probeFact: string;
  readonly generation: string;
  readonly confirmedAt: number;
}

const fields = [
  'type', 'schemaVersion', 'id', 'purpose', 'adapter', 'artifact', 'platform', 'machine',
  'launch', 'incarnation', 'processIdentity', 'subject', 'event', 'eventHash', 'observation',
  'observationFact', 'observationWitness', 'plan', 'planFact', 'planVersion', 'probe', 'probeFact',
  'generation', 'confirmedAt',
] as const;
const hashPattern = /^sha256:[a-f0-9]{64}$/;
const decodeContext: BoundaryContext = Object.freeze({
  preserved: 'harness-validation-floor://input',
  site: 'harness-validation-floor.decode',
  register: Object.freeze({
    generation: Object.freeze({
      owner: 'part-three' as const,
      name: 'RegisterGeneration' as const,
      id: 'generation:harness-validation-floor',
    }),
    entries: Object.freeze(['harness-validation-floor.decode']),
    sites: Object.freeze({ 'harness-validation-floor.decode': 'closed' as const }),
  }),
});

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as object)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 16 * 1024 || value.includes('\0')) {
    throw new Error(`${label}: invalid text`);
  }
  return value;
}

function hash(value: unknown, label: string): Hash {
  const candidate = text(value, label);
  if (!hashPattern.test(candidate)) throw new Error(`${label}: malformed SHA-256`);
  return candidate as Hash;
}

function validate(value: unknown): HarnessValidationFloor {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('HarnessValidationFloor: expected object');
  }
  const row = value as Record<string, unknown>;
  const actual = Object.keys(row);
  if (actual.length !== fields.length || actual.some(field => !fields.includes(field as typeof fields[number]))) {
    throw new Error('HarnessValidationFloor: closed fields required');
  }
  if (row.type !== 'HarnessValidationFloor' || row.schemaVersion !== 1) {
    throw new Error('HarnessValidationFloor: type/version');
  }
  if (row.purpose !== 'transcript-poison') throw new Error('purpose: unsupported value');
  for (const field of [
    'id', 'adapter', 'platform', 'machine', 'launch', 'incarnation', 'processIdentity', 'subject',
    'event', 'observation', 'observationFact', 'observationWitness', 'plan', 'planFact', 'planVersion',
    'probe', 'probeFact', 'generation',
  ] as const) text(row[field], field);
  const artifact = hash(row.artifact, 'artifact');
  const eventHash = hash(row.eventHash, 'eventHash');
  if (row.id !== `validation-floor:${eventHash}`) {
    throw new Error('id: validation floor identity does not match eventHash');
  }
  if (!Number.isSafeInteger(row.confirmedAt) || (row.confirmedAt as number) < 0) {
    throw new Error('confirmedAt: finite nonnegative safe integer required');
  }
  return deepFreeze({ ...row, artifact, eventHash } as unknown as HarnessValidationFloor);
}

function decoder(): VersionedDecoder<HarnessValidationFloor, BoundaryContext> {
  const result = defineDecoder<HarnessValidationFloor, BoundaryContext>({
    name: 'HarnessValidationFloor',
    owner: 'part-thirteen',
    currentVersion: 1,
    versions: { 1: { validate: (value: Json) => ({ ok: true, value }) } },
    migrations: {},
    decodeCurrent: value => {
      try {
        return { ok: true, value: validate(value) };
      } catch (error) {
        return { ok: false,
          detail: error instanceof Error ? error.message : 'HarnessValidationFloor: decode failed' };
      }
    },
  }, decodeContext.preserved);
  return consumeResult(result, {
    Success: value => value,
    Refused: refusal => { throw new Error(refusal.detail); },
  });
}

/** Closed, total decoder for the package-local immutable confirmation record. */
export function decodeHarnessValidationFloor(input: unknown): Result<HarnessValidationFloor> {
  return decoder().decode(input, decodeContext);
}
