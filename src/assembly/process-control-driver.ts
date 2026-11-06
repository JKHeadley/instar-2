// Rules 26, 42, 55, 60, 63, 86. This driver consumes Eight's one-use Six handoff,
// not an inventory selection. The host pins kernel process identity before every
// action; a PID-only fallback is not a supported implementation of this port.
import type { BoundaryContext, Result } from '../index.js';
import { consumeProcessControlInvocation } from '../effects/index.js';
import type { OperationAdapterPort, ProcessControlTarget, ProcessControlPayload } from '../effects/index.js';
import { boundary, encoded, ensure } from './boundary.js';
export interface ProcessControlKernelPort {
  readonly workerRoot: Readonly<{ pid: number; startIdentity: string }>;
  signal(target: ProcessControlTarget, signal: ProcessControlPayload['signal']): Readonly<{
    state: 'signalled' | 'refused' | 'unknown'; detail: string;
    actuatorExit?: Readonly<{ pid: number; code: number | null; signal: string | null }> }>;
  observe(target: ProcessControlTarget): Readonly<{ state: 'running' | 'exited' | 'unknown'; detail: string }>;
}
export interface ProcessControlDriverBinding {
  readonly adapter: string; readonly machine: string; readonly conversation: string;
  readonly incarnation: string; readonly timeout: number; readonly maxCharge: number;
  /** Trusted owner-selected target from its accepted supervision, never request supplied. */
  readonly target: ProcessControlTarget; readonly sourceResult: string; readonly run: string;
  /** Digest of the complete payload selected by the accepted supervisor result. */
  readonly payloadDigest: string;
  readonly workerRoot: Readonly<{ pid: number; startIdentity: string }>;
}
/** The exact target check happens inside signal's kernel identity pin. A return
 * says only what this driver observed. Nine independently assesses occurrence,
 * quiescence and charge; Eight settles it. */
export function createProcessControlAdapter(inputBinding: ProcessControlDriverBinding,
  kernel: ProcessControlKernelPort, context: BoundaryContext): OperationAdapterPort {
  // Snapshot the accepted selection: later caller mutations cannot retarget a
  // composed actuator. Authority/stop remain live checks in Eight and Six.
  const binding = Object.freeze({ ...inputBinding, target: Object.freeze({ ...inputBinding.target }),
    workerRoot: Object.freeze({ ...inputBinding.workerRoot }) });
  const check = (payload: ProcessControlPayload) => {
    ensure(/^sha256:[a-f0-9]{64}$/u.test(binding.payloadDigest)
      && encoded(payload).hash === binding.payloadDigest, 'process payload differs from accepted supervision');
    ensure(Number.isSafeInteger(binding.workerRoot.pid) && binding.workerRoot.pid > 1
      && binding.workerRoot.startIdentity.length > 0 && payload.target.pid !== binding.workerRoot.pid
      && encoded(kernel.workerRoot).bytes === encoded(binding.workerRoot).bytes, 'registered worker root differs');
    ensure(payload.target.machine === binding.machine && payload.account === binding.machine
      && payload.target.incarnation === binding.incarnation && payload.conversation === binding.conversation
      && encoded(payload.target).bytes === encoded(binding.target).bytes
      && payload.sourceResult === binding.sourceResult && payload.run === binding.run,
    'process target differs from configured owner');
  };
  return Object.freeze({ owner: 'part-ten' as const, id: binding.adapter,
    describe: () => Object.freeze({ contract: 'exact-process-control-v1', account: binding.machine,
      conversation: binding.conversation, maxCharge: binding.maxCharge, timeout: binding.timeout,
      hiddenRetries: 0 as const, processControl: true as const }),
    invoke: (input: Parameters<OperationAdapterPort['invoke']>[0]): Result<string> =>
      boundary('ProcessControlWrongPayload', input, context, () => { throw Error('process driver does not accept messages'); }),
    observe: (input: Parameters<OperationAdapterPort['observe']>[0]): Result<string> =>
      boundary('ProcessControlMissingTarget', input, context, () => { throw Error('process observation requires original decoded payload'); }),
    invokeProcess: (input: Parameters<NonNullable<OperationAdapterPort['invokeProcess']>>[0]) =>
      consumeProcessControlInvocation(input, context, current => {
        check(current.payload);
        ensure(encoded(current.payload).hash === current.digest, 'process payload digest changed');
        let result: ReturnType<ProcessControlKernelPort['signal']>;
        try {
          const observed = kernel.signal(current.payload.target, current.payload.signal);
          result = ['signalled', 'refused', 'unknown'].includes(observed.state) && typeof observed.detail === 'string'
            ? observed : { state: 'unknown', detail: 'invalid kernel signal observation' };
        } catch { result = { state: 'unknown', detail: 'kernel signal ended without a conclusive response' }; }
        return encoded({ type: 'process-control-observation', operation: current.operation, claim: current.claim,
          digest: current.digest, target: current.payload.target, signal: current.payload.signal,
          state: result.state, detail: result.detail,
          ...(result.actuatorExit ? { actuatorExit: result.actuatorExit } : {}) }).bytes;
      }),
    observeProcess: (input: Parameters<NonNullable<OperationAdapterPort['observeProcess']>>[0]) =>
      boundary('ProcessControlObservation', input, context, () => {
        check(input.payload); ensure(encoded(input.payload).hash === input.digest, 'process observation digest changed');
        const observed = kernel.observe(input.payload.target);
        ensure(['running', 'exited', 'unknown'].includes(observed.state), 'invalid kernel process observation');
        return encoded({ type: 'process-control-lookup', operation: input.operation, digest: input.digest,
          target: input.payload.target, state: observed.state, detail: observed.detail }).bytes;
      }),
  });
}
