import type { Json, Result, Scope } from '../../src/index.js';
import { consumeResult } from '../../src/index.js';
import type { Validation } from '../../src/decode/framework.js';
import { registerOwnedBody } from '../../src/facts/index.js';
import type { FactEnvelope, FactSchema, OwnedShape } from '../../src/facts/index.js';
import { decodeRegisteredFact } from '../../src/register/index.js';
import type { FactPositionVectorReference, RegisterContext } from '../../src/register/index.js';
import type { factsFixture } from '../facts/fixtures.js';
import { value } from './fixtures.js';

type FactsFixture = ReturnType<typeof factsFixture>;

export function ownedPolicy(input: Json): OwnedShape {
  if (input === null) return { kind: 'null' };
  if (typeof input === 'string') return { kind: 'text', maxLength: Math.max(1, input.length) };
  if (typeof input === 'number') return { kind: 'integer' };
  if (typeof input === 'boolean') return { kind: 'boolean' };
  if (Array.isArray(input)) return { kind: 'array', maxLength: Math.max(1, input.length),
    items: input.length ? ownedPolicy(input[0]!) : { kind: 'null' } };
  return { kind: 'object', fields: Object.fromEntries(Object.entries(input).map(([key, child]) => [key, ownedPolicy(child)])) };
}

const validation = <T>(result: Result<T>): Validation<T> => consumeResult<T, Validation<T>>(result, {
  Success: decoded => ({ ok: true as const, value: decoded }),
  Refused: refusal => ({ ok: false as const, detail: refusal.detail, reason: refusal.reason }),
});

function asJson(input: unknown): Json {
  return JSON.parse(JSON.stringify(input)) as Json;
}

export function generationRegistration(record: unknown, context: RegisterContext, f: FactsFixture) {
  return value(registerOwnedBody({ owner: 'part-three', name: 'GenerationRecord', currentVersion: 1,
    versions: { 1: { validate: input => ({ ok: true as const, value: input }) } }, migrations: {},
    decodeCurrent: input => validation(decodeRegisteredFact('generation-record', input, context)) }, ownedPolicy(asJson(record)), f.c));
}

export function ownedSchema(kind: string, owner: string, name: string, scope: Scope): FactSchema {
  return { kind, version: 1, fields: { record: { kind: 'owned', owner, name } }, machineScope: 'shared',
    standing: 'requester', action: 'work', scope, causallyBound: false, requiredReferences: [], authority: 'none' };
}

export function versionSchema(kind: string, scope: Scope): FactSchema {
  return { kind, version: 1, fields: { record: { kind: 'text', maxLength: 1_000_000 } }, machineScope: 'shared',
    standing: 'requester', action: 'work', scope, causallyBound: false, requiredReferences: [], authority: 'none' };
}

export function vectorAt(fact: FactEnvelope): FactPositionVectorReference {
  return { owner: 'part-two', name: 'FactPositionVector', id: fact.id };
}
