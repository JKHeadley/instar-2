// TEST-INFRASTRUCTURE (defect, 2026-10-05): give every SYNCHRONOUS child-process call a test
// makes a finite bound, so a child that blocks forever fails its own test instead of freezing
// the whole run. On 2026-10-05 one `scripts/test-intake-restart.mjs` child of
// tests/e2e/intake.test.ts sat at 0% CPU for 54 minutes and the full suite waited on it: the
// callsite named no `timeout`, and a blocking spawnSync holds the vitest worker's event loop,
// so the runner's own testTimeout timer could not fire either. The child's own bound is the
// only thing that can end such a wait.
//
// One doorway, not 202 edits. 202 of the suite's 402 synchronous child calls named no timeout,
// across ~90 files, so the bound is injected where all of them already pass: the three
// synchronous exports of `node:child_process` — `spawnSync`, `execFileSync` and `execSync` —
// are replaced with wrappers, and then `syncBuiltinESMExports()` from `node:module` republishes
// the builtin's current exports so the replacement reaches `import { spawnSync } from
// 'node:child_process'` as well as `require('node:child_process').spawnSync`. That one line is
// load-bearing and is the whole reason this is the supported route: an ESM named binding is
// taken from the builtin's exports at instantiation, so a bare property assignment never
// reaches it. The first attempt at this fix assigned the exports WITHOUT publishing them, found
// the named imports unbounded (a 600 s probe child outlived a 4 s case), and wrongly concluded
// that no public route could reach them; it then reached for the private `process.binding`
// instead. tests/unit/bound-children-unsynced-probe.mjs is that failed experiment, kept as the
// other side of the evidence: the same assignment with the publish line removed does NOT bound
// a named import, while tests/unit/bound-children-probe.mjs shows that with it, all three calls
// are bounded in a real fresh process. No deprecated or internal API is used.
//
// The bound is the enclosing test's OWN declared timeout. That can never turn a passing test
// into a failing one: vitest reports a synchronous case that overruns its declared timeout as a
// timeout once the body returns, so a child that alone exceeds the whole-case budget already
// fails. A call outside any test case (collection time, a hook) gets the fallback below.
//
// A call that names its own `timeout` — including `timeout: 0`, a deliberate "unbounded" — is
// left exactly as written, arguments and all, so each test keeps its meaning. A child that
// finishes inside its bound returns exactly what it returned before; only the previously
// non-terminating path is new, and it both writes the explanation to stderr and raises it as a
// named error.
//
// The bound is the declared timeout exactly, with no headroom carved out of it: trimming it to
// leave room for the raised error would shorten every legitimate child's budget, and a case
// whose child needs most of its budget is not a defect. The cost is that a hung case is often
// reported as vitest's own "Test timed out in Nms" rather than the raised error, because the
// kill lands on the deadline. That is why the explanation goes to stderr as well — the run
// output then names which child blocked, which is the diagnosis the 54-minute wait lacked.
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { constants } from 'node:os';
import { getCurrentTest } from '@vitest/runner';

// Generous but finite, for a call with no enclosing case: a collection-time `git show` or
// `node -e` takes well under a second, and an unbounded one used to wait forever.
// INSTAR_TEST_CHILD_BOUND_MS overrides it for a host that needs more.
export const FALLBACK_MS = 300_000;

// The three synchronous child-process calls. They are wrapped one by one rather than through a
// shared lower call, because each is a public export with its own documented contract.
export const SYNC_CALLS = ['spawnSync', 'execFileSync', 'execSync'];

export const BOUNDED = Symbol.for('instar.tests.boundChildren');

export function fallbackBound(env = process.env) {
  const raw = Number(env.INSTAR_TEST_CHILD_BOUND_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : FALLBACK_MS;
}

export function childBound(declared, fallback) {
  return typeof declared === 'number' && Number.isFinite(declared) && declared > 0 ? declared : fallback;
}

// Bounds an options object in place. Returns the bound injected, or null when the caller named
// a timeout — including a deliberate `timeout: 0`, which stays unbounded.
export function boundOptions(options, bound, kill = constants.signals.SIGKILL) {
  if (options.timeout !== undefined) return null;
  options.timeout = bound;
  if (options.killSignal === undefined) options.killSignal = kill;
  return bound;
}

// Node's own rule: `spawnSync(file[, args][, options])` and `execFileSync(file[, args][,
// options])` take the options object after an array of arguments, and `execSync(command[,
// options])` has no array, so the options object is the first argument that is not an array.
export function optionsSlot(args) {
  return Array.isArray(args[1]) ? 2 : 1;
}

// The timeout kill as the public API reports it: `spawnSync` returns it on `result.error`, while
// `execFileSync` and `execSync` throw it. Both carry `code: 'ETIMEDOUT'`.
export function timedOut(error) {
  return typeof error === 'object' && error !== null && error.code === 'ETIMEDOUT';
}

export function boundMessage(file, bound) {
  return `[instar tests] the child \`${String(file)}\` was killed after the ${bound} ms bound `
    + `tests/setup/bound-children.mjs gave it (this test's own declared timeout, or the `
    + `collection-time fallback). A test child that blocks must fail its own test, never freeze `
    + `the run. If this child legitimately needs longer, give that callsite its own \`timeout\`.`;
}

function boundError(file, bound, note, cause) {
  const message = boundMessage(file, bound);
  // Also to stderr: when the bound lands on the case deadline the runner reports its own
  // timeout and this raised error never reaches the report.
  note(`${message}\n`);
  return Object.assign(new Error(message, { cause }), { code: 'ETIMEDOUT', path: file });
}

export function bindSyncCall(name, original, currentTimeout, fallback = fallbackBound,
  note = text => process.stderr.write(text)) {
  const bounded = function boundSyncChild(...args) {
    const slot = optionsSlot(args);
    const given = args[slot];
    const options = typeof given === 'object' && given !== null ? { ...given } : {};
    const bound = boundOptions(options, childBound(currentTimeout(), fallback()));
    // A caller that owns its own bound is passed through byte-for-byte, its own options object
    // included, so nothing about that call changes.
    if (bound === null) return original(...args);
    const call = [...args];
    call[slot] = options;
    let result;
    try {
      result = original(...call);
    } catch (error) {
      throw timedOut(error) ? boundError(args[0], bound, note, error) : error;
    }
    if (typeof result === 'object' && result !== null && timedOut(result.error)) {
      throw boundError(args[0], bound, note, result.error);
    }
    return result;
  };
  Object.defineProperty(bounded, 'name', { value: `bound_${name}` });
  Object.defineProperty(bounded, BOUNDED, { value: true, enumerable: false });
  return bounded;
}

export function patchChildProcess(childExports, currentTimeout, fallback = fallbackBound,
  note = text => process.stderr.write(text), publish = syncBuiltinESMExports) {
  if (childExports[BOUNDED] === true) return childExports;
  for (const name of SYNC_CALLS) {
    childExports[name] = bindSyncCall(name, childExports[name], currentTimeout, fallback, note);
  }
  Object.defineProperty(childExports, BOUNDED, { value: true, enumerable: false });
  // Load-bearing: without this the replacements above never reach an ESM named import. See the
  // note at the top of this file and tests/unit/bound-children-unsynced-probe.mjs.
  publish();
  return childExports;
}

export function install(currentTimeout = () => getCurrentTest()?.timeout) {
  patchChildProcess(childProcess, currentTimeout);
}

install();
