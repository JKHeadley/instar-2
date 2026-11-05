import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { decode } from '../../src/index.js';
import { hashBytes } from '../../src/facts/index.js';
import type { CapturedContent, FactContext } from '../../src/facts/index.js';
import { createEffectDoorway, decodeProcessControlPayload } from '../../src/effects/index.js';
import type { ProcessControlTarget } from '../../src/effects/index.js';
import { createProcessControlAdapter } from '../../src/assembly/process-control-driver.js';
import type { ProcessControlKernelPort } from '../../src/assembly/process-control-driver.js';
import { createEffectAssessmentPort, createVerificationRuntime, createVerificationSpine,
  registerVerificationBodies, verificationSchemas } from '../../src/verification/index.js';
import type { VerificationHost } from '../../src/verification/index.js';
import { effectFixture, value } from './fixture.js';
import { privateKey } from '../facts/fixtures.js';
import { verificationInput } from '../verification/fixture.js';
// @ts-expect-error physical host runs outside the ambient-I/O-free core.
import { createKernelProcessControl, readExactProcessIdentity } from '../../scripts/process-control-kernel.mjs';

export async function startOwnProcessFixture(incarnation = 'worker:fixture', args: readonly string[] = []) {
  const child = spawn(process.execPath, ['-e', "process.stdout.write('ready\\n'); process.stdin.resume()", '--', ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
  await once(child.stdout, 'data');
  if (!child.pid) throw Error('fixture child missing PID');
  const read = readExactProcessIdentity(child.pid);
  if (read.state !== 'observed') { child.kill('SIGKILL'); throw Error(read.detail); }
  const target: ProcessControlTarget = { ...read.identity, machine: 'machine-a', incarnation };
  const root = readExactProcessIdentity(process.pid);
  if (root.state !== 'observed') { child.kill('SIGKILL'); throw Error(root.detail); }
  const workerRoot = { pid: process.pid, startIdentity: root.identity.startIdentity };
  const kernel: ProcessControlKernelPort = createKernelProcessControl({ machine: target.machine, incarnation: target.incarnation, workerRoot });
  const exit = once(child, 'exit') as Promise<[number | null, NodeJS.Signals | null]>;
  return { child, target, kernel, exit, close: () => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); } };
}
export const staticTarget: ProcessControlTarget = { machine: 'machine-a', incarnation: 'worker:fixture', pid: 2001,
  parentPid: 2000, startIdentity: 'boot:20', parentStartIdentity: 'boot:10', executable: '/fixture/child', argvDigest: `sha256:${'a'.repeat(64)}` };

/** A fixture authority and durable peer directory, labelled as such. Eight, Six,
 * and Nine below are the real owners. No fake assessor returns a desired verdict. */
export function processControlFixture(target: ProcessControlTarget = staticTarget,
  kernel: Omit<ProcessControlKernelPort, 'workerRoot'> & Partial<Pick<ProcessControlKernelPort, 'workerRoot'>> = { signal: () => ({ state: 'unknown', detail: 'fixture no process' }),
    observe: () => ({ state: 'unknown', detail: 'fixture no process' }) },
  payloadOverrides: Readonly<{ episode?: string; deadline?: number; signal?: 'SIGINT' | 'SIGTERM' | 'SIGKILL' }> = {}) {
  const scopedKernel: ProcessControlKernelPort = { workerRoot: { pid: target.parentPid, startIdentity: target.parentStartIdentity }, ...kernel };
  const f = effectFixture(undefined, 'executor:1', { feature: 'process-control', adapter: 'process-control-fixture',
    account: target.machine, conversation: 'worker:conversation', maxCharge: 0 });
  const payload = value(decodeProcessControlPayload({ type: 'ProcessControlPayload', schemaVersion: 1,
    id: 'process:1', purpose: 'process-control', semanticMessage: 'intervention:fixture:1', run: f.run.id,
    speaker: f.host.principal.id, account: target.machine, conversation: f.definition.conversation,
    sourceResult: f.pending.id, target, action: payloadOverrides.signal === 'SIGINT' ? 'interrupt' : 'terminate', signal: 'SIGTERM',
    generation: f.host.current().decode.register.generation.id, episode: 'episode:fixture', step: 'step:fixture', deadline: 500, ...payloadOverrides }, f.host));
  const binding = { adapter: f.definition.adapter, machine: target.machine, incarnation: target.incarnation,
    conversation: payload.conversation, timeout: f.definition.timeout, maxCharge: 0, target,
    sourceResult: payload.sourceResult, run: payload.run, workerRoot: scopedKernel.workerRoot };
  const adapter = createProcessControlAdapter(binding, scopedKernel, f.host.boundary);
  const originalCaptures = Object.getOwnPropertyDescriptor(f.ctx, 'captures')!.get!;
  Object.defineProperty(f.ctx, 'captures', { configurable: true, get: () => ({ ...originalCaptures(),
    ...Object.fromEntries(Object.entries(f.captures).map(([reference, bytes]) => [reference,
      { hash: hashBytes(bytes), bytes, status: 'available', byteLength: Buffer.byteLength(bytes) } satisfies CapturedContent])) }) });
  const host: VerificationHost = { machine: f.host.machine, principal: f.host.principal, scope: f.host.scope, boundary: f.host.boundary,
    current: () => ({ decode: f.ctx.decode, clock: f.host.current().clock, generation: f.host.current().decode.register.generation.id,
      stopped: f.host.current().stopped, facts: { ...f.ctx, facts: value(f.store.read()) }, evidence: f.evidence }) };
  Object.assign(f.ctx, { schemas: [...f.ctx.schemas, ...verificationSchemas(host)],
    ownedBodies: [...f.ctx.ownedBodies ?? [], ...value(registerVerificationBodies(host))] } satisfies Partial<FactContext>);
  const runtime = createVerificationRuntime(host, createVerificationSpine(host, { context: f.ctx, privateKey }, f.store));
  value(runtime.record('VerificationPlan', { ...verificationInput('VerificationPlan'), id: 'process-verification-plan',
    subject: { ...verificationInput('VerificationPlan').subject, generation: host.current().generation },
    bar: { ...verificationInput('VerificationPlan').bar, version: f.d.verificationBar, sources: ['probe'] } }));
  const assessment = createEffectAssessmentPort(host, runtime);
  const composition = { ...f.composition, adapter, assessment };
  const api = createEffectDoorway(composition);
  const prepare = () => value(api.prepare({ definition: f.d.id, message: payload, run: f.run, pending: f.pending.id,
    attempt: 'process-attempt:1', verificationOwner: 'process-verifier', obligation: f.obligation, closure: [], fence: f.fence }));
  const recordIndependentEvidence = (operation: string, digest: string, exitSignal: NodeJS.Signals | null) => {
    // These bytes come from the parent-owned wait/exit observation plus a new,
    // independent kernel query. A signal syscall return alone is insufficient.
    const observed = kernel.observe(target);
    if (observed.state !== 'exited' || exitSignal !== payload.signal) throw Error('independent exit/quiescence proof missing');
    for (const [id, predicate, amount] of [['occurred', 'operation-occurred', undefined],
      ['quiescent', 'old-executor-quiescent', undefined], ['charged', 'charge-settled', 0]] as const) {
      f.evidence.push(value(decode('Evidence', f.evidenceInput({ id: `process:${operation}:${id}`,
        claim: { subject: operation, predicate, value: { digest, ...(amount === undefined ? {} : { amount }) } },
        source: 'probe', observedAt: f.clock(100), freshFor: 100, strength: 'observation' }), f.ctx.decode)));
    }
  };
  return { ...f, payload, adapter, api, composition, prepare, runtime, assessment, recordIndependentEvidence };
}
