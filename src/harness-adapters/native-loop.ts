// Rules 2, 30, 55, 60, 115: native worker orchestration. The host owns all I/O,
// admitted model dispatch, tool admission, execution and durable observations.
// This worker grants no authority and imports no private core implementation.
export const NATIVE_STEPS_ROLE = 'tool-steps';
export interface NativeCall { readonly tool: string; readonly input: Record<string, unknown> }
export interface NativeStepResult {
  readonly state: string;
  readonly value?: string;
  readonly failureClass?: string;
  readonly [field: string]: unknown;
}
export interface NativeContainment { readonly cleanup: string; readonly leaked: unknown; readonly membership: string | null }
export interface NativeCallRecord {
  tool: string | null; input?: string; decision: string; reason: string; result: string | null;
  containment?: NativeContainment;
}
export interface NativeStepRecord { step: number; calls: NativeCallRecord[] }
export interface NativeLoopPorts {
  step(envelope: string, index: number): Promise<NativeStepResult | null | undefined>;
  stopped(): boolean;
  admit(call: NativeCall, id: string): Promise<Readonly<{ decision: string; reason: string; updatedInput?: Record<string, unknown> }>>;
  execute(call: NativeCall): Promise<Readonly<{ output: unknown; containment?: NativeContainment }>>;
  record(call: NativeCall, id: string, output: unknown): Promise<unknown>;
}
export interface NativeLoopOptions extends NativeLoopPorts {
  readonly prepared: string;
  readonly promptLimit: number;
  readonly maxSteps: number;
  readonly maxCallsPerStep: number;
  readonly resultChars: number;
  readonly tools: readonly string[];
}
export type NativeParsedStep = { kind: 'empty' | 'answer' } | { kind: 'malformed'; reason: string }
  | { kind: 'calls'; calls: NativeCall[] };
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const clip = (text: string, chars: number) => text.length > chars ? `${text.slice(0, chars)}…[truncated ${text.length - chars} chars]` : text;

/** Preserve the existing native framing: only a calls object without reply is a tool request. */
export function parseNativeStep(text: unknown, maxCallsPerStep: number): NativeParsedStep {
  if (typeof text !== 'string' || !text.trim()) return { kind: 'empty' };
  let value: unknown = null;
  const bare = text.trim().replace(/^```(?:json)?\s*|\s*```$/gu, '');
  if (bare.startsWith('{')) try { value = JSON.parse(bare); } catch { value = null; }
  if (!object(value) || !Object.hasOwn(value, 'calls') || Object.hasOwn(value, 'reply')) return { kind: 'answer' };
  const calls = value.calls;
  if (!Array.isArray(calls) || calls.length === 0 || calls.length > maxCallsPerStep
    || !calls.every((call: unknown) => object(call) && typeof call.tool === 'string' && call.tool.length > 0
      && call.tool.length <= 64 && object(call.input)))
    return { kind: 'malformed', reason: `a tool request must be {"calls":[{"tool":<name>,"input":<object>}]} with 1 to ${maxCallsPerStep} calls` };
  return { kind: 'calls', calls: calls.map(call => ({ tool: String(call.tool), input: call.input as Record<string, unknown> })) };
}

/** Old results shorten first; the caller's original prepared context is retained unchanged. */
export function nativeStepEnvelope(prepared: string, steps: readonly NativeStepRecord[], remaining: Readonly<{ steps: number }>,
  limit: number, tools: readonly string[]): string | null {
  const envelope: unknown = JSON.parse(prepared);
  if (!object(envelope) || !Array.isArray(envelope.messages)) throw Error('native loop: prepared envelope malformed');
  const messages = envelope.messages;
  const state = steps.map(step => ({ step: step.step, calls: step.calls.map(call => ({ ...call })) }));
  const render = () => JSON.stringify({ ...envelope, messages: [...messages,
    { role: NATIVE_STEPS_ROLE, content: JSON.stringify({ tools, remaining, steps: state }) }] });
  const size = (text: string) => new TextEncoder().encode(text).length;
  let bytes = render();
  for (const call of state.flatMap(step => step.calls)) {
    if (size(bytes) <= limit) return bytes;
    if (typeof call.result === 'string' && call.result.length > 256) { call.result = `${call.result.slice(0, 256)}…[shortened]`; bytes = render(); }
  }
  return size(bytes) <= limit ? bytes : null;
}

/** One bounded turn behind the adapter's host. Results are proposals for the owner's reply path,
 * never sends. A restart requires owner-grounded context; this function does not retry effects. */
export async function runNativeLoop(options: NativeLoopOptions) {
  const { prepared, promptLimit, maxSteps, maxCallsPerStep, resultChars, tools, step, stopped, admit, execute, record } = options;
  if (![maxSteps, maxCallsPerStep, resultChars, promptLimit].every(value => Number.isSafeInteger(value) && value > 0))
    throw Error('native loop: finite positive bounds required');
  const steps: NativeStepRecord[] = [], unresolved: Array<NativeContainment & { id: string }> = [];
  let calls = 0, asked = 0;
  const finish = (result: NativeStepResult, ended: string) => ({ ...result,
    native: { models: asked, steps: steps.length, calls, ended, unresolved: [...unresolved] } });
  for (let index = 0; index < maxSteps; index++) {
    if (stopped()) return finish({ state: 'uncertain' }, 'stopped');
    const envelope = nativeStepEnvelope(prepared, steps, { steps: maxSteps - index - 1 }, promptLimit, tools);
    if (envelope === null) return finish({ state: 'complete', failureClass: 'prompt-size' }, 'prompt-size');
    asked++;
    const result = await step(envelope, index);
    if (result?.state !== 'complete' || result.failureClass || typeof result.value !== 'string')
      return finish(result ?? { state: 'uncertain' }, 'step-failed');
    const parsed = parseNativeStep(result.value, maxCallsPerStep);
    if (parsed.kind === 'answer') return finish(result, 'answered');
    if (parsed.kind === 'empty') return finish({ ...result, failureClass: 'empty' }, 'step-failed');
    const row: NativeStepRecord = { step: index + 1, calls: [] };
    steps.push(row);
    if (parsed.kind === 'malformed') { row.calls.push({ tool: null, decision: 'deny', reason: parsed.reason, result: null }); continue; }
    if (parsed.kind !== 'calls') throw Error('native loop: unknown step');
    if (index === maxSteps - 1) return finish({ ...result, failureClass: 'step-cap' }, 'step-cap');
    for (const [position, call] of parsed.calls.entries()) {
      if (stopped()) return finish({ state: 'uncertain' }, 'stopped');
      const id = `native-${String(index + 1)}-${String(position + 1)}`;
      const admission = await admit(call, id);
      const entry: NativeCallRecord = { tool: call.tool, input: clip(JSON.stringify(call.input), 1024),
        decision: admission.decision, reason: admission.reason, result: null };
      row.calls.push(entry);
      if (admission.decision !== 'allow') continue;
      calls++;
      const executed = stopped() ? { output: { error: 'stopped before dispatch', interrupted: 'stopped' } }
        : await execute({ tool: call.tool, input: admission.updatedInput ?? call.input });
      const { output } = executed;
      const containment = 'containment' in executed ? executed.containment : undefined;
      if (containment) {
        entry.containment = containment;
        if (containment.cleanup !== 'not-launched' && (containment.cleanup !== 'verified' || containment.membership !== 'sandbox-joined'))
          unresolved.push({ id, ...containment });
      }
      await record(call, id, output);
      entry.result = clip(JSON.stringify(output), resultChars);
    }
  }
  return finish({ state: 'complete', failureClass: 'step-cap' }, 'step-cap');
}
