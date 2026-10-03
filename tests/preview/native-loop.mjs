// The native harness's agent loop (Rule 115; the native tool rule, Part Thirteen §9 in docs/17-harness-adapters): Instar runs the
// loop itself, with no vendor agent harness. Each step is one text-only model call through a registered doorway (the caller's
// `step`, which the journal records like any other model call); the model proposes tool calls as its answer, and this loop
// admits every call through the SAME admission hook executable a harness tool turn uses (tool-admission-hook.mjs, its config,
// call slots and record in the turn's state directory), runs the admitted ones inside the SAME per-turn boundary (the fixed-size
// scratch volume runToolTurn allocates; the shell under the sandbox below, built from the same read list as the harness sandbox),
// records each result through the hook's post phase, and asks again. It runs as the `invoke` of runToolTurn (tool-turn.mjs), so
// the whole-liability call reservation, the trace journaled after the turn, the consistency check and retention are the tool
// turn's own. It ends on an answer, the step cap (the reserved liability), the operator's stop, or a failed step.
// This file owns process, clock and filesystem for the turn's tools only; nothing here widens a grant.
import { spawn } from 'node:child_process';
import { existsSync, globSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, matchesGlob, relative, resolve, sep } from 'node:path';
import { NATIVE_TOOL_LIMITS, NATIVE_TOOL_NAMES, SUBSCRIPTION_TOOL_RUNTIME_READS } from '../../src/assembly/production-provider.js';

/** The message role that carries the loop's state to the model; the system prompt names it. */
export const NATIVE_STEPS_ROLE = 'tool-steps';
const SAFE_PATH = /^\/[A-Za-z0-9_./@-]+$/u;
const within = (path, root) => path === root || path.startsWith(root + sep);
const clip = (text, chars = NATIVE_TOOL_LIMITS.resultChars) => text.length > chars ? `${text.slice(0, chars)}…[truncated ${text.length - chars} chars]` : text;

/**
 * The shell's sandbox profile (Seatbelt, the mechanism the harness sandbox uses on this platform), from the harness sandbox's
 * own inputs: reads refused from the filesystem root down except the turn's scratch volume and SUBSCRIPTION_TOOL_RUNTIME_READS;
 * writes only to the scratch volume and the null devices; no network, no unix socket, no mach service, no signal or process
 * inspection outside this sandbox. File metadata stays readable (path resolution); contents do not.
 */
export function nativeShellProfile(scratch) {
  if (typeof scratch !== 'string' || !SAFE_PATH.test(scratch) || /(?:^|\/)\.\.?(?:\/|$)/u.test(scratch)) throw Error('native loop: scratch path must be absolute and plain');
  if (SUBSCRIPTION_TOOL_RUNTIME_READS.some(read => within(scratch, read) || within(read, scratch))) throw Error('native loop: scratch overlaps the runtime reads');
  const reads = [scratch, ...SUBSCRIPTION_TOOL_RUNTIME_READS].map(path => `(subpath "${path}")`).join(' ');
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

/** A file path the hook admitted, resolved against the workspace. */
const at = (workspace, path) => resolve(workspace, String(path));
/** Whether a path (following every link) stays in the workspace; results that leave it are dropped, never shown. */
const stays = (workspace, path) => { try { return within(realpathSync(path), workspace); } catch { return false; } };

/** Bounded walk of regular files under `base` that never follows a link. */
function walkFiles(base, limit = 5000) {
  const files = [];
  const walk = dir => {
    for (const name of readdirSync(dir).sort()) {
      if (files.length >= limit) return;
      const path = join(dir, name), stat = lstatSync(path);
      if (stat.isDirectory()) walk(path); else if (stat.isFile()) files.push(path);
    }
  };
  walk(base);
  return files;
}

/** Runs one admitted shell command inside the sandbox, from the workspace, with an empty environment and per-process CPU and
 * handle limits; ends it (its own process group, by its exact pid) on its time bound or the operator's stop. */
function runShell({ command, workspace, tmp, profilePath, timeoutMs, stopped }) {
  return new Promise(done => {
    const child = spawn('/usr/bin/sandbox-exec', ['-f', profilePath, '/bin/sh', '-c', `ulimit -t ${String(Math.ceil(timeoutMs / 1000))}; ulimit -n 256; ${command}`],
      { cwd: workspace, env: { PATH: '/usr/bin:/bin', HOME: workspace, TMPDIR: tmp, LANG: 'C.UTF-8' }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', interrupted = null;
    const cap = 1024 * 1024;
    child.stdout.on('data', chunk => { if (stdout.length < cap) stdout += chunk; });
    child.stderr.on('data', chunk => { if (stderr.length < cap) stderr += chunk; });
    const end = reason => { if (interrupted) return; interrupted = reason; try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ } };
    const timer = setTimeout(() => end('timeout'), timeoutMs);
    const watch = setInterval(() => { if (stopped()) end('stopped'); }, 25);
    child.on('error', error => { stderr += String(error.message); });
    child.on('close', code => { clearTimeout(timer); clearInterval(watch);
      done({ stdout: clip(stdout), stderr: clip(stderr), exitCode: code, ...(interrupted ? { interrupted } : {}) }); });
  });
}

/** Executes one admitted call. `input` is the admitted input (the hook may have rewritten it). Errors are results, not throws. */
async function execute(tool, input, turn, context) {
  const { workspace } = turn;
  try {
    if (tool === 'Read') {
      const lines = readFileSync(at(workspace, input.file_path), 'utf8').split('\n');
      const offset = Number.isSafeInteger(input.offset) && input.offset > 0 ? input.offset - 1 : 0;
      const limit = Number.isSafeInteger(input.limit) && input.limit > 0 ? input.limit : 2000;
      return { content: clip(lines.slice(offset, offset + limit).join('\n'), 65536) };
    }
    if (tool === 'Write') {
      const path = at(workspace, input.file_path);
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      writeFileSync(path, String(input.content ?? ''), { mode: 0o600 });
      return { type: 'written', filePath: relative(workspace, path), bytes: Buffer.byteLength(String(input.content ?? '')) };
    }
    if (tool === 'Edit') {
      const path = at(workspace, input.file_path), text = readFileSync(path, 'utf8');
      const from = String(input.old_string ?? ''), to = String(input.new_string ?? '');
      const count = from ? text.split(from).length - 1 : 0;
      if (count === 0) return { error: 'old_string not found' };
      if (count > 1 && input.replace_all !== true) return { error: `old_string occurs ${count} times; set replace_all or give more context` };
      writeFileSync(path, input.replace_all === true ? text.split(from).join(to) : text.replace(from, () => to));
      return { type: 'edited', filePath: relative(workspace, path), replacements: input.replace_all === true ? count : 1 };
    }
    if (tool === 'Glob') {
      const base = at(workspace, input.path ?? '.');
      const found = globSync(String(input.pattern ?? ''), { cwd: base }).map(name => join(base, name))
        .filter(path => stays(workspace, path)).slice(0, 1000).map(path => relative(workspace, path));
      return { files: found };
    }
    if (tool === 'Grep') {
      let pattern; try { pattern = new RegExp(String(input.pattern ?? '')); } catch (error) { return { error: `invalid pattern: ${error.message}` }; }
      const base = at(workspace, input.path ?? '.'), mode = input.output_mode ?? 'files_with_matches';
      const candidates = lstatSync(base).isFile() ? [base] : walkFiles(base);
      const out = [];
      for (const path of candidates) {
        const name = relative(workspace, path);
        if (typeof input.glob === 'string' && !matchesGlob(relative(base, path) || name, input.glob)) continue;
        if (lstatSync(path).size > 1024 * 1024) continue;
        const lines = readFileSync(path, 'utf8').split('\n'), hits = lines.flatMap((line, i) => pattern.test(line) ? [`${name}:${String(i + 1)}:${line}`] : []);
        if (!hits.length) continue;
        if (mode === 'content') out.push(...hits); else if (mode === 'count') out.push(`${name}:${String(hits.length)}`); else out.push(name);
      }
      return { matches: clip(out.join('\n'), 65536) };
    }
    if (tool === 'Bash') {
      const timeoutMs = Number.isSafeInteger(input.timeout) && input.timeout > 0 ? Math.min(input.timeout, NATIVE_TOOL_LIMITS.bashMs) : NATIVE_TOOL_LIMITS.bashMs;
      return await runShell({ command: String(input.command), workspace, tmp: join(turn.scratch, 'tmp'), profilePath: context.profilePath,
        timeoutMs, stopped: context.stopped });
    }
    if (tool === 'WebFetch') {
      const url = new URL(String(input.url));
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return { error: 'only http and https URLs' };
      // Redirects are reported, never followed: a followed redirect would reach a host the admission never saw.
      const response = await context.fetch(url.href, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(30000) });
      const body = (await response.text()).slice(0, 262144);
      return { status: response.status, contentType: response.headers.get('content-type'),
        ...(response.headers.get('location') ? { location: response.headers.get('location') } : {}), body: clip(body, 16384) };
    }
    return { error: `no native executor for ${tool}` };
  } catch (error) { return { error: clip(String(error?.message ?? error), 512) }; }
}

/**
 * One native tool turn. `turn` is runToolTurn's allocation ({scratch, workspace, stateDirectory, hook}); `prepared` is the
 * answer's prepared envelope; `step(envelope, index)` makes one model call and returns the caller's answer shape
 * ({state, value?, reason?, failureClass?, usage?}). Returns the last step's result (the answer, or the failure that ended the
 * loop), with `native: {models, steps, calls, ended}`. Every call is admitted by the hook before it runs, and recorded by it after.
 */
export async function runNativeLoop({ turn, prepared, step, stopped, promptLimit, maxSteps = NATIVE_TOOL_LIMITS.maxSteps,
  fetch: fetcher = globalThis.fetch }) {
  for (const path of [turn.scratch, turn.workspace, turn.stateDirectory]) if (!existsSync(path)) throw Error('native loop: turn allocation absent');
  const profilePath = join(turn.stateDirectory, 'shell.sb');
  writeFileSync(profilePath, nativeShellProfile(realpathSync(turn.scratch)), { mode: 0o600 });
  const steps = [], context = { profilePath, stopped, fetch: fetcher };
  let calls = 0, asked = 0;
  // `models`: model calls made (at most maxSteps, the reserved liability); `steps`: those that requested tools; `calls`: tools run.
  const finish = (result, ended) => ({ ...result, native: { models: asked, steps: steps.length, calls, ended } });
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
      const output = await execute(call.tool, admission.updatedInput ?? call.input, turn, context);
      await runHook(turn.hook, turn.stateDirectory, 'post', { tool_name: call.tool, tool_input: call.input, tool_use_id: id, tool_response: output });
      entry.result = clip(JSON.stringify(output));
    }
  }
  return finish({ state: 'complete', failureClass: 'step-cap' }, 'step-cap');
}
