import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { resolve } from 'node:path';
import { createProgram } from '../../scripts/check-architecture.mjs';

const prelude = `
import { compare, compareMeasurements, consumeResult, decode, decodeMeasurement, grantLiveness, isFresh } from '../src/index.js';
import type { Authorization, Clock, Decision, Directive, Evidence, HistoricalRead, Measurement, Provenance, Result, Scope, SecretRef, StandingGrant, UnresolvedInput, VerifiedIntent, VerifiedPrincipal } from '../src/index.js';
type Fields<T> = Pick<T, Extract<keyof T, string>>;
declare const principal: VerifiedPrincipal, otherPrincipal: VerifiedPrincipal, provenance: Provenance;
declare const grant: StandingGrant, now: Clock, scope: Scope, evidence: Evidence, unresolved: UnresolvedInput;
declare const authorization: Authorization, decision: Decision, directive: Directive;
import { fixture } from './fixtures.js';
const f = fixture();
function decoded<T>(result: Result<T>): T { return consumeResult(result, { Success: v => v, Refused: r => { throw new Error(r.detail); } }); }
const latencyInput = { type: 'Measurement', schemaVersion: 1, subject: { kind: 'detection-latency', instance: 'machine-a' }, value: 5, unit: 'ms', at: f.now, by: 'probe' };
const remainingInput = { ...latencyInput, subject: { kind: 'time-remaining', instance: 'machine-a' } };
const latency = decoded(decodeMeasurement('detection-latency', latencyInput, f.ctx));
const remaining = decoded(decodeMeasurement('time-remaining', remainingInput, f.ctx));
const decodedClock = decoded(decodeMeasurement('clock', f.clockRaw(), f.ctx));
declare const result: Result<string>;
declare const archived: HistoricalRead<VerifiedPrincipal>;
declare function needsPrincipal(p: VerifiedPrincipal): void;
declare function needsIntent(i: VerifiedIntent): void;
`;
const cases = {
  'NF-01': ['needsPrincipal("Alice in a message");', 'needsPrincipal(principal);'],
  'NF-02': ['needsPrincipal({ sender: "alice", authenticated: false });', 'needsPrincipal(principal);'],
  'NF-10': ['grantLiveness(grant, []);', 'grantLiveness(grant, [], now);'],
  'NF-11': ['const x: Fields<Directive> = { ...directive, closedBy: { kind: "Expired" } };', 'const x: Fields<Directive> = { ...directive, closedBy: { kind: "Superseded", by: "next" } };'],
  'NF-19': ['compareMeasurements(latency, remaining, "capture");', 'compareMeasurements(latency, latency, "capture");'],
  'NF-19-unrefined': ['const broad = decoded(decode("Measurement", latencyInput, f.ctx)); compareMeasurements(broad, broad, "capture");', 'grantLiveness(grant, [], decodedClock); isFresh(evidence, decodedClock);'],
  'NF-27': ['const { source, observedAt, capture, strength, ...missing } = evidence; const x: Fields<Evidence> = missing;', 'const x: Fields<Evidence> = evidence;'],
  'NF-31': ['isFresh(evidence);', 'isFresh(evidence, now);'],
  'NF-32': ['const { reason, ...missing } = decision; const x: Fields<Decision> = missing; const y: Fields<Decision> = { ...decision, reason: decision.conclusion };', 'const x: Fields<Decision> = decision;'],
  'NF-35': ['const x: Authorization = { timeout: true }; const y: Authorization = undefined;', 'const x: Authorization = authorization;'],
  'NF-36': ['const { base, artifact, ...missing } = authorization; const x: Fields<Authorization> = missing;', 'const x: Fields<Authorization> = authorization;'],
  'NF-44': ['const x: Fields<Authorization> = { ...authorization, kind: { kind: "declined" } };', 'const x: Fields<Authorization> = { ...authorization, kind: { kind: "approval" } };'],
  'NF-47': ['const x: Fields<SecretRef> = { type: "SecretRef", schemaVersion: 1, vault: "vault", name: "token", secretBytes: new Uint8Array() };', 'const x: Fields<SecretRef> = { type: "SecretRef", schemaVersion: 1, vault: "vault", name: "token" };'],
  'NF-51': ['const x: VerifiedPrincipal = { type: "VerifiedPrincipal", schemaVersion: 1, id: "alice", kind: "person", provenance };', 'const x: VerifiedPrincipal = principal;'],
  'NF-53': ['needsPrincipal(unresolved); needsIntent(unresolved);', 'needsPrincipal(principal);'],
  'NF-62': ['consumeResult(result, { Success: value => value });', 'consumeResult(result, { Success: value => value, Refused: r => r.reason });'],
  'NF-67': ['compare("VerifiedPrincipal", principal, evidence, "value", scope, "capture");', 'compare("VerifiedPrincipal", principal, otherPrincipal, "value", scope, "capture");'],
  'NF-71': ['const { ...fields }: Fields<Provenance> = provenance; const forged: Provenance = fields;', 'const x: Provenance = provenance;'],
  'NF-51-spread': ['const x: VerifiedPrincipal = { ...principal, kind: "system" };', 'const x: VerifiedPrincipal = principal;'],
  'historical-standing': ['needsPrincipal(archived.view);', 'const originalClass = archived.view.provenance.class;'],
} as const;
const sources = Object.fromEntries(Object.entries(cases).flatMap(([id, [invalid, valid]]) => [
  [`tests/virtual-${id}-invalid.ts`, prelude + invalid], [`tests/virtual-${id}-valid.ts`, prelude + valid],
]));
const program = createProgram(sources);
const errors = ts.getPreEmitDiagnostics(program).filter(d => d.category === ts.DiagnosticCategory.Error);
describe('compiler executes negative programs and positive counterparts', () => {
  for (const [id] of Object.entries(cases)) it(`${id} rejects the forbidden program only`, () => {
    const forPath = (kind: string) => errors.filter(d => d.file?.fileName === resolve(`tests/virtual-${id}-${kind}.ts`));
    expect(forPath('invalid').map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).not.toEqual([]);
    expect(forPath('valid').map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
  });
});
