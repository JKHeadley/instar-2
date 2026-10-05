// TEST-INFRASTRUCTURE (defect, 2026-10-05): give every SYNCHRONOUS child-process call a test
// makes a finite bound, so a child that blocks forever fails its own test instead of freezing
// the whole run. On 2026-10-05 one `scripts/test-intake-restart.mjs` child of
// tests/e2e/intake.test.ts sat at 0% CPU for 54 minutes and the full suite waited on it: the
// callsite named no `timeout`, and a blocking spawnSync holds the vitest worker's event loop,
// so the runner's own testTimeout timer could not fire either. The child's own bound is the
// only thing that can end such a wait.
//
// One doorway, not 202 edits. 202 of the suite's 402 synchronous child calls named no timeout,
// across ~90 files; `spawnSync`, `execFileSync` and `execSync` all funnel into the single
// `spawn_sync` binding, so bounding that one call bounds every present and future callsite.
// Patching the child_process module's exports instead does NOT work and was tried first: a test
// writes `import { spawnSync } from 'node:child_process'`, and that ESM named binding is taken
// from the builtin's exports at instantiation, so a later property assignment never reaches it
// (proved live — the 600 s probe child outlived a 4 s case). The binding is below every import
// style. `process.binding` is deprecated; if a future Node removes it, the install fails and the
// cases in tests/unit/bound-children.test.ts fail loudly rather than the bound going quiet.
//
// The bound is the enclosing test's OWN declared timeout. That can never turn a passing test
// into a failing one: vitest reports a synchronous case that overruns its declared timeout as a
// timeout once the body returns, so a child that alone exceeds the whole-case budget already
// fails. A call outside any test case (collection time, a hook) gets the fallback below.
//
// A call that names its own `timeout` — including `timeout: 0`, a deliberate "unbounded" — is
// left exactly as written, so each test keeps its meaning. A child that finishes inside its
// bound returns exactly what it returned before; only the previously non-terminating path is
// new, and it both writes the explanation to stderr and raises it as a named error.
//
// The bound is the declared timeout exactly, with no headroom carved out of it: trimming it to
// leave room for the raised error would shorten every legitimate child's budget, and a case
// whose child needs most of its budget is not a defect. The cost is that a hung case is often
// reported as vitest's own "Test timed out in Nms" rather than the raised error, because the
// kill lands on the deadline. That is why the explanation goes to stderr as well — the run
// output then names which child blocked, which is the diagnosis the 54-minute wait lacked.
import { constants } from 'node:os';
import { getCurrentTest } from '@vitest/runner';

// Generous but finite, for a call with no enclosing case: a collection-time `git show` or
// `node -e` takes well under a second, and an unbounded one used to wait forever.
// INSTAR_TEST_CHILD_BOUND_MS overrides it for a host that needs more.
export const FALLBACK_MS = 300_000;

// libuv reports the timeout kill as a negative errno on the raw binding result.
export const TIMED_OUT_ERRNO = -constants.errno.ETIMEDOUT;

export function fallbackBound(env = process.env) {
  const raw = Number(env.INSTAR_TEST_CHILD_BOUND_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : FALLBACK_MS;
}

export function childBound(declared, fallback) {
  return typeof declared === 'number' && Number.isFinite(declared) && declared > 0 ? declared : fallback;
}

// The binding's options object is built fresh per call by normalizeSpawnArguments, so it is
// bounded in place. Returns the bound injected, or null when the caller named a timeout.
export function boundOptions(options, bound, kill = constants.signals.SIGKILL) {
  if (options.timeout !== undefined) return null;
  options.timeout = bound;
  if (options.killSignal === undefined) options.killSignal = kill;
  return bound;
}

export function boundMessage(file, bound) {
  return `[instar tests] the child \`${String(file)}\` was killed after the ${bound} ms bound `
    + `tests/setup/bound-children.mjs gave it (this test's own declared timeout, or the `
    + `collection-time fallback). A test child that blocks must fail its own test, never freeze `
    + `the run. If this child legitimately needs longer, give that callsite its own \`timeout\`.`;
}

const PATCHED = Symbol.for('instar.tests.boundChildren');

export function patchSpawnBinding(binding, currentTimeout, fallback = fallbackBound,
  note = text => process.stderr.write(text)) {
  if (binding[PATCHED] === true) return binding;
  const spawn = binding.spawn;
  binding.spawn = function boundSpawn(options) {
    const bound = boundOptions(options, childBound(currentTimeout(), fallback()));
    const result = spawn.call(this, options);
    if (bound !== null && result.error === TIMED_OUT_ERRNO) {
      const message = boundMessage(options.file, bound);
      // Also to stderr: when the bound lands on the case deadline the runner reports its own
      // timeout and this raised error never reaches the report.
      note(`${message}\n`);
      throw Object.assign(new Error(message),
        { code: 'ETIMEDOUT', errno: TIMED_OUT_ERRNO, syscall: 'spawnSync', path: options.file });
    }
    return result;
  };
  Object.defineProperty(binding, PATCHED, { value: true, enumerable: false });
  return binding;
}

export function install(currentTimeout = () => getCurrentTest()?.timeout) {
  // process.binding is the single doorway below every import style; see the note above.
  patchSpawnBinding(process.binding('spawn_sync'), currentTimeout);
}

install();
