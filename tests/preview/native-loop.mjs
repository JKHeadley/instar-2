// The native harness's agent loop (Rule 115; the native tool rule, Part Thirteen §9 in docs/17-harness-adapters): Instar runs the
// loop itself, with no vendor agent harness. Each step is one text-only model call through a registered doorway (the caller's
// `step`, which the journal records like any other model call); the model proposes tool calls as its answer, and this loop
// admits every call through the SAME admission hook executable a harness tool turn uses (tool-admission-hook.mjs, its config,
// call slots and record in the turn's state directory), runs the admitted ones inside the SAME per-turn boundary (the fixed-size
// scratch volume runToolTurn allocates; the shell under the sandbox below, built from the same read list as the harness sandbox),
// records each result through the hook's post phase, and asks again. Every tool but WebFetch runs as a worker process launched
// through the host resource owner inside that sandbox (runWorker below): the loop's own process never opens a tool path. It runs as the `invoke` of runToolTurn (tool-turn.mjs), so
// the whole-liability call reservation, the trace journaled after the turn, the consistency check and retention are the tool
// turn's own. It ends on an answer, the step cap (the reserved liability), the operator's stop, or a failed step.
// This file owns process, clock and filesystem for the turn's tools only; nothing here widens a grant.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NATIVE_TOOL_LIMITS, NATIVE_TOOL_NAMES, SUBSCRIPTION_TOOL_RUNTIME_READS } from '../../src/assembly/production-provider.js';

/** The message role that carries the loop's state to the model; the system prompt names it. */
export const NATIVE_STEPS_ROLE = 'tool-steps';
const SAFE_PATH = /^\/[A-Za-z0-9_./@-]+$/u;
const within = (path, root) => path === root || path.startsWith(root + sep);
const clip = (text, chars = NATIVE_TOOL_LIMITS.resultChars) => text.length > chars ? `${text.slice(0, chars)}…[truncated ${text.length - chars} chars]` : text;

/**
 * The tools' sandbox profile (Seatbelt, the mechanism the harness sandbox uses on this platform), from the harness sandbox's
 * own inputs: reads refused from the filesystem root down except the turn's scratch volume, SUBSCRIPTION_TOOL_RUNTIME_READS and
 * the one node executable the file worker runs on (`node`, the hook's own runtime);
 * writes only to the scratch volume and the null devices; no network, no unix socket, no mach service, no signal or process
 * inspection outside this sandbox. File metadata stays readable (path resolution); contents do not.
 */
export function nativeShellProfile(scratch, node) {
  const plain = path => typeof path === 'string' && SAFE_PATH.test(path) && !/(?:^|\/)\.\.?(?:\/|$)/u.test(path);
  if (!plain(scratch)) throw Error('native loop: scratch path must be absolute and plain');
  if (!plain(node) || within(node, scratch)) throw Error('native loop: node path must be absolute, plain and outside the scratch volume');
  if (SUBSCRIPTION_TOOL_RUNTIME_READS.some(read => within(scratch, read) || within(read, scratch))) throw Error('native loop: scratch overlaps the runtime reads');
  const reads = [...[scratch, ...SUBSCRIPTION_TOOL_RUNTIME_READS].map(path => `(subpath "${path}")`), `(literal "${node}")`].join(' ');
  return ['(version 1)', '(deny default)', '(allow process-exec process-fork)', '(allow sysctl-read)',
    '(allow file-read-metadata)', '(allow file-read-data (literal "/"))',
    `(allow file-read* file-map-executable ${reads})`,
    `(allow file-write* (subpath "${scratch}") (literal "/dev/null") (literal "/dev/zero") (literal "/dev/tty") (regex #"^/dev/fd/"))`,
    '(allow file-ioctl (literal "/dev/null") (literal "/dev/tty"))',
    '(allow signal (target same-sandbox))', '(allow process-info* (target same-sandbox))',
    '(deny network*)', '(deny mach-lookup (with no-report))', ''].join('\n');
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

/** Runs the turn's admission hook executable (`pre` or `post`) on one call. Any failure of `pre` is a refusal (fail closed). */
export function runHook(hook, stateDirectory, mode, payload, timeoutMs = 30000) {
  return new Promise(done => {
    const child = spawn(hook.node, [hook.script, mode, stateDirectory], { stdio: ['pipe', 'pipe', 'pipe'], env: {} });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* gone */ } }, timeoutMs);
    child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => { clearTimeout(timer); done({ decision: 'deny', reason: `admission hook did not run: ${error.message}` }); });
    child.on('close', code => {
      clearTimeout(timer);
      if (mode === 'post') return done({ recorded: code === 0 });
      if (code !== 0) return done({ decision: 'deny', reason: clip(stderr.trim() || `admission hook exited ${String(code)}`, 512) });
      if (!stdout.trim()) return done({ decision: 'allow', reason: 'admitted' });
      try {
        const output = JSON.parse(stdout).hookSpecificOutput;
        if (output?.permissionDecision === 'deny') return done({ decision: 'deny', reason: String(output.permissionDecisionReason ?? 'refused') });
        if (output?.permissionDecision === 'allow') return done({ decision: 'allow', reason: String(output.permissionDecisionReason ?? 'admitted'),
          ...(output.updatedInput ? { updatedInput: output.updatedInput } : {}) });
      } catch { /* refused below */ }
      return done({ decision: 'deny', reason: 'admission hook output unreadable' });
    });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify(payload));
  });
}

/** The worker every native tool except WebFetch runs as (native-tool-worker.mjs), handed to node as source: the sandbox reads no
 * repository file. Its V8 heap is capped; the resource owner holds the rest. */
const WORKER_SOURCE = readFileSync(fileURLToPath(new URL('./native-tool-worker.mjs', import.meta.url)), 'utf8');
/** Per-call bounds the loop owns: a file tool's deadline, the worker's heap, the worker's output, a fetched body. */
export const NATIVE_EXECUTION = Object.freeze({ fileMs: 30000, workerHeapMb: 256, workerOutputBytes: 8 * 1024 * 1024,
  fetchMs: 30000, fetchBodyBytes: 262144 });

/**
 * Runs one admitted call as a worker launch through the host resource owner (Rules 55, 60, 61): `sandbox-exec` with the native
 * profile, then node on the worker source, from the workspace, with an empty environment. The owner admits the launch, holds CPU
 * time and handles per process and the user ID's process headroom in the kernel, samples the tree's memory and process count
 * against its ceilings and ends the tree on the deadline or the operator's stop (its 25 ms poll). Membership is the owner's, held
 * outside the workload (`membership: 'sandbox'`): besides recorded incarnation, group, ancestry and the whole scratch volume
 * (`area`), the owner asks the kernel which processes are in this launch's sandbox instance — the one identity no descendant
 * sheds by a new session, a new parent or a working directory outside the volume. So a daemonized descendant counts against the
 * ceilings while the call runs and is ended by the owner's stop and cleanup, even with the rest of the sandbox suspended. The
 * owner settles on the launch process's exit, so nothing inside the sandbox can stall it, and no file or process the workload
 * can touch is ever read or signalled on the cleanup path. Each call returns the owner's containment evidence (its cleanup
 * verdict and the membership it was proven under). The loop's own process never opens a tool path, so neither a path swapped
 * after admission nor a blocking open can reach it. A launch the owner ended is `interrupted`.
 */
async function runWorker(tool, input, turn, context) {
  const timeout = tool === 'Bash' ? (Number.isSafeInteger(input.timeout) && input.timeout > 0 ? Math.min(input.timeout, NATIVE_TOOL_LIMITS.bashMs)
    : NATIVE_TOOL_LIMITS.bashMs) : NATIVE_EXECUTION.fileMs;
  const launched = await context.resources.execute({ executable: '/usr/bin/sandbox-exec',
    args: ['-f', context.profilePath, turn.hook.node, `--max-old-space-size=${String(NATIVE_EXECUTION.workerHeapMb)}`, '--input-type=module',
      '-e', WORKER_SOURCE],
    cwd: turn.workspace, area: context.scratch, membership: 'sandbox',
    env: { PATH: '/usr/bin:/bin', HOME: turn.workspace, TMPDIR: join(turn.scratch, 'tmp'), LANG: 'C.UTF-8' },
    stdin: JSON.stringify({ tool, input, workspace: turn.workspace }), timeout, maxBytes: NATIVE_EXECUTION.workerOutputBytes,
    stopped: context.stopped }, 'answer');
  const containment = launched.localLimit === 'capacity' ? { cleanup: 'not-launched', leaked: null, membership: null }
    : { cleanup: launched.resources?.cleanup ?? 'unknown', leaked: launched.resources?.leakedDescendants ?? null,
      membership: launched.resources?.membership ?? null };
  return { output: workerOutput(tool, launched, context.stopped()), containment };
}
function workerOutput(tool, launched, stopped) {
  if (launched.limited) {
    const reason = launched.localLimit ?? (stopped ? 'stopped' : 'ended');
    if (reason === 'capacity') return { error: 'no launch capacity: the host resource owner refused the call' };
    return tool === 'Bash' ? { stdout: '', stderr: '', exitCode: null, interrupted: reason } : { error: `tool call ended: ${reason}`, interrupted: reason };
  }
  let output;
  try { output = JSON.parse(launched.stdout); } catch { return { error: `tool worker failed (exit ${String(launched.code)})` }; }
  if (tool === 'Bash' && output && typeof output.stdout === 'string') return { ...output, stdout: clip(output.stdout), stderr: clip(String(output.stderr ?? '')) };
  return output;
}

/** One GET of an admitted URL in the loop's process (the sandbox has no network): ended by its deadline or the operator's stop,
 * and the body read as a stream up to the byte limit, then cancelled, so no more than the limit is ever held. */
async function webFetch(input, context) {
  const url = new URL(String(input.url));
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { error: 'only http and https URLs' };
  const stop = new AbortController();
  const watch = setInterval(() => { if (context.stopped()) stop.abort(Error('stopped')); }, 25);
  try {
    // Redirects are reported, never followed: a followed redirect would reach a host the admission never saw.
    const response = await context.fetch(url.href, { method: 'GET', redirect: 'manual',
      signal: AbortSignal.any([AbortSignal.timeout(NATIVE_EXECUTION.fetchMs), stop.signal]) });
    const chunks = [];
    let size = 0, truncated = false;
    if (response.body) {
      const reader = response.body.getReader();
      for (;;) {
        if (stop.signal.aborted) { await reader.cancel().catch(() => {}); return { error: 'stopped', interrupted: 'stopped' }; }
        const { done, value } = await reader.read();
        if (done) break;
        const room = NATIVE_EXECUTION.fetchBodyBytes - size;
        chunks.push(value.subarray(0, room)); size += Math.min(value.length, room);
        if (value.length >= room) { truncated = true; await reader.cancel().catch(() => {}); break; }
      }
    }
    const body = Buffer.concat(chunks).toString('utf8');
    return { status: response.status, contentType: response.headers.get('content-type'),
      ...(response.headers.get('location') ? { location: response.headers.get('location') } : {}),
      ...(truncated ? { truncatedAtBytes: NATIVE_EXECUTION.fetchBodyBytes } : {}), body: clip(body, 16384) };
  } catch (error) {
    if (stop.signal.aborted) return { error: 'stopped', interrupted: 'stopped' };
    throw error;
  } finally { clearInterval(watch); }
}

/** Executes one admitted call: `{output, containment?}`, where `containment` is a worker launch's evidence. `input` is the admitted
 * input (the hook may have rewritten it). Errors are results, not throws. */
async function execute(tool, input, turn, context) {
  try {
    if (tool === 'WebFetch') return { output: await webFetch(input, context) };
    if (!NATIVE_TOOL_NAMES.includes(tool)) return { output: { error: `no native executor for ${tool}` } };
    return await runWorker(tool, input, turn, context);
  } catch (error) { return { output: { error: clip(String(error?.message ?? error), 512) } }; }
}

/**
 * One native tool turn. `turn` is runToolTurn's allocation ({scratch, workspace, stateDirectory, hook}); `prepared` is the
 * answer's prepared envelope; `step(envelope, index)` makes one model call and returns the caller's answer shape
 * ({state, value?, reason?, failureClass?, usage?}); `resources` is the host resource owner (its `execute`) every tool launch
 * passes. Returns the last step's result (the answer, or the failure that ended the
 * loop), with `native: {models, steps, calls, ended, unresolved}`. Every call is admitted by the hook before it runs, and recorded by it after.
 */
export async function runNativeLoop({ turn, prepared, step, stopped, promptLimit, resources, maxSteps = NATIVE_TOOL_LIMITS.maxSteps,
  fetch: fetcher = globalThis.fetch }) {
  for (const path of [turn.scratch, turn.workspace, turn.stateDirectory]) if (!existsSync(path)) throw Error('native loop: turn allocation absent');
  if (typeof resources?.execute !== 'function') throw Error('native loop: no host resource owner to launch tools through');
  const profilePath = join(turn.stateDirectory, 'shell.sb');
  writeFileSync(profilePath, nativeShellProfile(realpathSync(turn.scratch), realpathSync(turn.hook.node)), { mode: 0o600 });
  const steps = [], context = { profilePath, scratch: realpathSync(turn.scratch), stopped, fetch: fetcher, resources };
  let calls = 0, asked = 0;
  const unresolved = [];
  // `models`: model calls made (at most maxSteps, the reserved liability); `steps`: those that requested tools; `calls`: tools run;
  // `unresolved`: the worker launches whose end the owner did not prove (its cleanup not verified under the sandbox join).
  const finish = (result, ended) => ({ ...result, native: { models: asked, steps: steps.length, calls, ended, unresolved: [...unresolved] } });
  for (let index = 0; index < maxSteps; index++) {
    if (stopped()) return finish({ state: 'uncertain' }, 'stopped');
    const envelope = nativeStepEnvelope(prepared, steps, { steps: maxSteps - index - 1 }, promptLimit);
    if (envelope === null) return finish({ state: 'complete', failureClass: 'prompt-size' }, 'prompt-size');
    asked++;
    const result = await step(envelope, index);
    if (result?.state !== 'complete' || result.failureClass || typeof result.value !== 'string') return finish(result ?? { state: 'uncertain' }, 'step-failed');
    const parsed = parseNativeStep(result.value);
    if (parsed.kind === 'answer') return finish(result, 'answered');
    if (parsed.kind === 'empty') return finish({ ...result, failureClass: 'empty' }, 'step-failed');
    const record = { step: index + 1, calls: [] };
    steps.push(record);
    if (parsed.kind === 'malformed') { record.calls.push({ tool: null, decision: 'deny', reason: parsed.reason, result: null }); continue; }
    if (index === maxSteps - 1) return finish({ ...result, failureClass: 'step-cap' }, 'step-cap');
    for (const [position, call] of parsed.calls.entries()) {
      if (stopped()) return finish({ state: 'uncertain' }, 'stopped');
      const id = `native-${String(index + 1)}-${String(position + 1)}`;
      const admission = await runHook(turn.hook, turn.stateDirectory, 'pre', { tool_name: call.tool, tool_input: call.input, tool_use_id: id });
      const entry = { tool: call.tool, input: clip(JSON.stringify(call.input), 1024), decision: admission.decision, reason: admission.reason, result: null };
      record.calls.push(entry);
      if (admission.decision !== 'allow') continue;
      calls++;
      // A stop latched while the hook decided: the admitted call is recorded as stopped and never dispatched.
      const { output, containment } = stopped() ? { output: { error: 'stopped before dispatch', interrupted: 'stopped' } }
        : await execute(call.tool, admission.updatedInput ?? call.input, turn, context);
      if (containment) {
        entry.containment = containment;
        if (containment.cleanup !== 'not-launched' && (containment.cleanup !== 'verified' || containment.membership !== 'sandbox-joined'))
          unresolved.push({ id, ...containment });
      }
      await runHook(turn.hook, turn.stateDirectory, 'post', { tool_name: call.tool, tool_input: call.input, tool_use_id: id, tool_response: output });
      entry.result = clip(JSON.stringify(output));
    }
  }
  return finish({ state: 'complete', failureClass: 'step-cap' }, 'step-cap');
}
