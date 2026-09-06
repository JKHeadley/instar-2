// P4-NF-24 / rules 42, 103: only the part-one boundary produces Result.
import { canonical,consumeResult,defineDecoder } from '../index.js';
import type { BoundaryContext,Json,Refused,RefusalReason,Result } from '../index.js';

export class IntakeFailure extends Error {
  constructor(message: string,readonly reason: RefusalReason='decode',readonly original?: Refused) { super(message); }
}
export function requireIntake(condition: unknown,detail: string,reason: RefusalReason='decode'): asserts condition {
  if(!condition) throw new IntakeFailure(detail,reason);
}
export function take<T>(result: Result<T>): T {
  return consumeResult(result,{ Success: value => value,Refused: refusal => { throw new IntakeFailure(refusal.detail,refusal.reason,refusal); } });
}
export function object(input: Json): Record<string,Json> {
  requireIntake(input!==null&&typeof input==='object'&&!Array.isArray(input),'P4-NF-24: expected object');
  return input as Record<string,Json>;
}
export function text(input: Json|undefined,name: string): string {
  requireIntake(typeof input==='string'&&input.length>0,`P4-NF-24: ${name} must be nonempty`); return input;
}
export const json=(input: unknown): Json => JSON.parse(take(canonical(input)).bytes) as Json;
export const same=(a: unknown,b: unknown): boolean => take(canonical(a)).bytes===take(canonical(b)).bytes;
export function boundary<T>(name: string,context: BoundaryContext,run: () => T): Result<T> {
  let original: Refused|undefined;
  const decoder=defineDecoder<T,BoundaryContext>({
    name,owner: 'part-four',currentVersion: 1,
    versions: { 1: { validate: value => ({ ok: true,value }) } },migrations: {},
    decodeCurrent: () => {
      try { return { ok: true,value: Object.freeze(run()) }; }
      catch(e) {
        if(e instanceof IntakeFailure) original=e.original;
        return {
          ok: false,reason: e instanceof IntakeFailure? e.reason:'decode',
          detail: e instanceof Error? e.message:'P4-NF-24: intake dependency failed'
        };
      }
    },
  },context.preserved);
  return consumeResult(decoder,{
    Refused: r => r,Success: d => {
      const result=d.decode({ type: name,schemaVersion: 1 },context);
      return consumeResult(result,{ Success: () => result,Refused: r => original??r });
    }
  });
}
