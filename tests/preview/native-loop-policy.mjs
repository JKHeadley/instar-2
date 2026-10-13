// Native loop policy and step shapes, independent of host execution. Rule 115.
import { sep } from 'node:path';
import { NATIVE_TOOL_LIMITS, NATIVE_TOOL_NAMES, SUBSCRIPTION_TOOL_RUNTIME_READS } from '../../src/assembly/production-provider.js';
import { SHELL_HOST_CONFIG_READS, SHELL_HOST_RECORD_READS } from './tool-admission.mjs';

/** The message role that carries the loop's state to the model; the system prompt names it. */
export const NATIVE_STEPS_ROLE = 'tool-steps';
const SAFE_PATH = /^\/[A-Za-z0-9_./@-]+$/u;
const within = (path, root) => path === root || path.startsWith(root + sep);

/**
 * The tools' sandbox profile (Seatbelt, the mechanism the harness sandbox uses on this platform), from the harness sandbox's
 * own inputs: reads refused from the filesystem root down except the turn's scratch volume, SUBSCRIPTION_TOOL_RUNTIME_READS,
 * the host configuration a command needs to run (SHELL_HOST_CONFIG_READS, minus the host's own record,
 * SHELL_HOST_RECORD_READS, which a later rule refuses on the resolved path) and
 * the one node executable the file worker runs on (`node`, the hook's own runtime);
 * writes only to the scratch volume and the null devices; no unix socket, no mach service, no signal or process
 * inspection outside this sandbox. File metadata stays readable (path resolution); contents do not. The network is refused,
 * except, when the turn has one (`egress`, runToolTurn's `{port, reads}`), the turn's own checkpoint on its loopback port,
 * the one place the harness sandbox lets a command reach too (egress-proxy.mjs decides every request there); its network
 * tools' locations (`reads`) are then readable, as in the harness sandbox.
 */
export function nativeShellProfile(scratch, node, egress = null) {
  const plain = path => typeof path === 'string' && SAFE_PATH.test(path) && !/(?:^|\/)\.\.?(?:\/|$)/u.test(path);
  if (!plain(scratch)) throw Error('native loop: scratch path must be absolute and plain');
  if (!plain(node) || within(node, scratch)) throw Error('native loop: node path must be absolute, plain and outside the scratch volume');
  if ([...SUBSCRIPTION_TOOL_RUNTIME_READS, ...SHELL_HOST_CONFIG_READS].some(read => within(scratch, read) || within(read, scratch))) throw Error('native loop: scratch overlaps the runtime reads');
  const port = egress?.port, extra = egress ? egress.reads : [];
  if (egress && (!Number.isSafeInteger(port) || port < 1 || port > 65535 || !Array.isArray(extra)
    || !extra.every(read => plain(read) && !within(scratch, read) && !within(read, scratch))))
    throw Error('native loop: the egress checkpoint must name a port and plain reads outside the scratch volume');
  const reads = [...[scratch, ...SUBSCRIPTION_TOOL_RUNTIME_READS, ...SHELL_HOST_CONFIG_READS, ...extra].map(path => `(subpath "${path}")`), `(literal "${node}")`].join(' ');
  return ['(version 1)', '(deny default)', '(allow process-exec process-fork)', '(allow sysctl-read)',
    '(allow file-read-metadata)', '(allow file-read-data (literal "/"))',
    `(allow file-read* file-map-executable ${reads})`,
    // Last rule wins in SBPL: the host's own record is refused on the resolved path whatever the allow above reopened.
    `(deny file-read-data ${SHELL_HOST_RECORD_READS.map(path => `(subpath "${path}")`).join(' ')})`,
    `(allow file-write* (subpath "${scratch}") (literal "/dev/null") (literal "/dev/zero") (literal "/dev/tty") (regex #"^/dev/fd/"))`,
    '(allow file-ioctl (literal "/dev/null") (literal "/dev/tty"))',
    '(allow signal (target same-sandbox))', '(allow process-info* (target same-sandbox))',
    '(deny network*)', ...(egress ? [`(allow network-outbound (remote ip "localhost:${String(port)}"))`] : []),
    '(deny mach-lookup (with no-report))', ''].join('\n');
}

/**
 * Parses one step's conclusion text. A request is exactly an object with a non-empty `calls` array (and no `reply`); anything
 * else the model concluded is its answer, unchanged, for the caller's existing answer path. `null` text is not an answer.
 */
export function parseNativeStep(text) {
  if (typeof text !== 'string' || !text.trim()) return { kind: 'empty' };
  let value = null;
  const bare = text.trim().replace(/^```(?:json)?\s*|\s*```$/gu, '');
  if (bare.startsWith('{')) try { value = JSON.parse(bare); } catch { value = null; }
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.hasOwn(value, 'calls') || Object.hasOwn(value, 'reply'))
    return { kind: 'answer' };
  const calls = value.calls;
  if (!Array.isArray(calls) || calls.length === 0 || calls.length > NATIVE_TOOL_LIMITS.maxCallsPerStep
    || !calls.every(call => call && typeof call === 'object' && typeof call.tool === 'string' && call.tool.length > 0 && call.tool.length <= 64
      && call.input !== null && typeof call.input === 'object' && !Array.isArray(call.input)))
    return { kind: 'malformed', reason: `a tool request must be {"calls":[{"tool":<name>,"input":<object>}]} with 1 to ${NATIVE_TOOL_LIMITS.maxCallsPerStep} calls` };
  return { kind: 'calls', calls: calls.map(call => ({ tool: call.tool, input: call.input })) };
}

/** The step's envelope: the answer's own prepared envelope with the loop state appended as one quoted-data message. Older
 * results are shortened first when the envelope would pass `limit` bytes; null when even that cannot fit. */
export function nativeStepEnvelope(prepared, steps, remaining, limit) {
  const envelope = JSON.parse(prepared);
  if (!envelope || !Array.isArray(envelope.messages)) throw Error('native loop: prepared envelope malformed');
  const state = steps.map(step => ({ step: step.step, calls: step.calls.map(call => ({ ...call })) }));
  const render = () => JSON.stringify({ ...envelope, messages: [...envelope.messages,
    { role: NATIVE_STEPS_ROLE, content: JSON.stringify({ tools: NATIVE_TOOL_NAMES, remaining, steps: state }) }] });
  let bytes = render();
  for (const call of state.flatMap(step => step.calls)) {
    if (Buffer.byteLength(bytes) <= limit) return bytes;
    if (typeof call.result === 'string' && call.result.length > 256) { call.result = `${call.result.slice(0, 256)}…[shortened]`; bytes = render(); }
  }
  return Buffer.byteLength(bytes) <= limit ? bytes : null;
}
