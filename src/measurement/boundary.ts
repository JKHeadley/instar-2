import { canonical, consumeResult, defineDecoder, deriveThrough } from '../index.js';
import type { BoundaryContext, Json, Refused, Result } from '../index.js';

class Inherited extends Error {
  constructor(readonly refusal: Refused) { super(refusal.detail); }
}

export function take<T>(result: Result<T>): T {
  return consumeResult(result, {
    Success: value => value,
    Refused: refusal => { throw new Inherited(refusal); },
  });
}

export function ensure(value: unknown, detail: string): asserts value {
  if (!value) throw new Error(detail);
}

export function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export function encoding(value: unknown): Readonly<{ bytes: string; hash: `sha256:${string}` }> {
  return take(canonical(value));
}

/** Current Part Three entries bind package-owned record content by canonical digest. */
export function contentRegistrationId(value: unknown): string {
  return `measurement-content:${encoding(value).hash}`;
}

export function json(value: unknown): Json {
  return JSON.parse(encoding(value).bytes) as Json;
}

export function boundary<T>(name: string, input: unknown, context: BoundaryContext, run: () => T): Result<T> {
  let inherited: Refused | undefined;
  const definition = defineDecoder<T, BoundaryContext>({
    name,
    owner: 'part-sixteen',
    currentVersion: 1,
    versions: { 1: { validate: value => ({ ok: true, value }) } },
    migrations: {},
    decodeCurrent: safe => {
      try {
        const envelope = record(safe, ['type', 'schemaVersion', 'input']);
        const captured = encoding(envelope.input).bytes;
        ensure(encoding(input).bytes === captured, 'measurement input changed across canonical admission');
        const value = run();
        ensure(encoding(input).bytes === captured, 'measurement input changed during evaluation');
        return { ok: true, value };
      }
      catch (error) {
        if (error instanceof Inherited) inherited = error.refusal;
        return { ok: false, detail: error instanceof Error ? error.message : 'measurement package boundary failed' };
      }
    },
  }, context.preserved);
  const result = consumeResult(definition, {
    Success: decoder => deriveThrough(decoder, { type: name, schemaVersion: 1, input }, context),
    Refused: refusal => refusal,
  });
  return inherited ?? result;
}

export function record(input: Json, fields: readonly string[]): Record<string, Json> {
  ensure(input !== null && typeof input === 'object' && !Array.isArray(input), 'closed object required');
  const value = input as Record<string, Json>;
  ensure(Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field)), 'undeclared or missing field');
  return value;
}

export function text(input: Json | undefined, field: string): string {
  ensure(typeof input === 'string' && input.trim().length > 0 && input.length <= 4096, `${field} must be bounded substantive text`);
  return input;
}

export function integer(input: Json | undefined, field: string, minimum = 0): number {
  ensure(typeof input === 'number' && Number.isSafeInteger(input) && input >= minimum, `${field} must be a safe integer >= ${minimum}`);
  return input;
}

export function finite(input: Json | undefined, field: string, minimum = 0, maximum = Number.MAX_VALUE): number {
  ensure(typeof input === 'number' && Number.isFinite(input) && input >= minimum && input <= maximum, `${field} must be finite within bounds`);
  return input;
}

export function bool(input: Json | undefined, field: string): boolean {
  ensure(typeof input === 'boolean', `${field} must be boolean`);
  return input;
}

export function list(input: Json | undefined, field: string, maximum = 1024): readonly Json[] {
  ensure(Array.isArray(input) && input.length <= maximum, `${field} must be a bounded array`);
  return input;
}

export function choice<T extends string>(input: Json | undefined, allowed: readonly T[], field: string): T {
  ensure(typeof input === 'string' && allowed.includes(input as T), `${field} outside closed set`);
  return input as T;
}
