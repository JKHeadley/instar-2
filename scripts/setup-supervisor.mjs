// Installer-side port of 1.x setup-wizard: validate -> action -> validate -> next.
// No general workflow engine and no production route is enabled by this module.
import { randomUUID } from 'node:crypto';
import { lstatSync, mkdirSync, readlinkSync, rmdirSync, unlinkSync } from 'node:fs';
import { hostname } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { prepareLogin } from './login-preparation.mjs';
import { publishSetupRecord, readSetupRecord, syncDirectory } from './onboarding-state.mjs';
import { PROFILE_3B_3GIB } from './setup-qualification.mjs';
import { SCHEMA, CHECKS, boundedId, projectSetupChecks, decodeSetupDecision, checkText } from './setup-supervisor-protocol.mjs';

const hold = (reason, checks = '') => ({ state: 'hold', reason, checks,
  message: 'Setup is paused. Your progress is saved. The installer must repair the named check before resuming.' });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function safePath(path) {
  if (dirname(path) !== path) safePath(dirname(path));
  try {
    const s = lstatSync(path);
    if (s.isSymbolicLink() || (!s.isDirectory() && (!s.isFile() || s.nlink !== 1))) throw Error('unsafe-path');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
function directory(path) {
  safePath(path);
  try { mkdirSync(path, { mode: 0o700 }); syncDirectory(dirname(path)); }
  catch (error) { if (error.code !== 'EEXIST' || !lstatSync(path).isDirectory()) throw error; }
}
function read(path) { safePath(path); return readSetupRecord(path); }
function publish(path, value) {
  safePath(path);
  const result = publishSetupRecord(path, value);
  if (!same(result, value)) throw Error('checkpoint-conflict');
  return result;
}
// Same exclusive-writer/dead-PID recovery shape as judgment-captures. Unknown
// ownership holds; elapsed time never authorizes stealing a live setup attempt.
function lock(root) {
  const path = join(root, 'writer'), marker = join(path, 'owner.json');
  const namespace = process.platform === 'linux' ? readlinkSync('/proc/self/ns/pid') : 'host';
  safePath(path); safePath(marker);
  try { mkdirSync(path, { mode: 0o700 }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const owner = read(marker);
    if (owner?.host !== hostname() || owner.namespace !== namespace || !/^[a-f0-9-]{36}$/.test(owner.id)
      || !Number.isSafeInteger(owner.pid) || owner.pid <= 0) throw Error('setup-busy');
    try { process.kill(owner.pid, 0); throw Error('setup-busy'); }
    catch (probe) { if (probe.code !== 'ESRCH') throw probe; }
    // Only a proved-dead writer's unique marker may be removed. A concurrent
    // recovery cannot mistake a new writer for the observed one.
    const unique = join(path, owner.id);
    safePath(unique); unlinkSync(unique); unlinkSync(marker); rmdirSync(path);
    mkdirSync(path, { mode: 0o700 });
  }
  const id = randomUUID();
  publish(join(path, id), { id }); publish(marker, { id, pid: process.pid, host: hostname(), namespace });
  return () => { unlinkSync(join(path, id)); unlinkSync(marker); rmdirSync(path); syncDirectory(root); };
}

/** Trusted owner ports are supplied by Ten's installer composition, never JSON or
 * model output. inspect/authenticate use current custodian and One/Two receipts;
 * reconcile/execute consume the SAME operation id and enforce GP versus GE/A0.
 * route.admit rechecks signed release/qualification pins; route.validate is Seven.
 * Each explicit invocation is a finite attempt, never an automatic model retry.
 */
export async function runSetupSupervisor(input) {
  const allowed = ['root', 'login', 'binding', 'owners', 'route', 'clock', 'stopped'];
  if (!input || Object.keys(input).some(k => !allowed.includes(k))
    || typeof input.root !== 'string' || !input.binding
    || Object.keys(input.binding).sort().join(',') !== 'authority,installation,session,subject'
    || !Object.values(input.binding).every(boundedId) || !/^[a-f0-9]{64}$/.test(input.binding.subject)
    || typeof input.clock !== 'function' || typeof input.stopped !== 'function') return hold('invalid-input');
  const root = resolve(input.root), state = join(root, 'setup-supervision');
  let release, outcomePath;
  try {
    // Check the entire fixed supervisor path before prepare-login writes anything.
    safePath(root); safePath(state);
    const login = prepareLogin(root, input.login);
    if (login.agentId !== input.binding.installation) return hold('binding-changed');
    directory(state); release = lock(state);
    const saved = read(join(state, 'binding.json'));
    if (saved && !same(saved, input.binding)) return hold('binding-changed');
    publish(join(state, 'binding.json'), input.binding);
    const attempt = randomUUID(), work = join(state, attempt);
    directory(work);
    const started = input.clock();
    if (!Number.isSafeInteger(started) || started < 0) return hold('invalid-clock');
    const deadline = started + PROFILE_3B_3GIB.attemptMs;
    publish(join(work, 'attempt.json'), { attempt, binding: input.binding, started, deadline, profile: PROFILE_3B_3GIB });
    const stopFile = join(work, 'stop.json');
    // A persisted stop precedes any dispatch. Stop remains independently readable
    // by the Linux runner even if the caller vanishes during inference.
    publish(stopFile, { stopped: Boolean(input.stopped()) });
    const stopped = () => input.stopped() || read(stopFile)?.stopped !== false;
    const guard = () => {
      const now = input.clock();
      if (stopped()) return 'stopped';
      if (!Number.isSafeInteger(now) || now < started || now >= deadline) return 'attempt-deadline';
      return null;
    };
    outcomePath = join(work, 'outcome.json');
    const finish = result => { publish(outcomePath, result); return result; };
    if (guard()) return finish(hold(guard()));
    const admission = await input.route?.admit?.({ root, binding: input.binding });
    if (admission?.qualified !== true || !/^[a-f0-9]{64}$/.test(admission.digest)) return finish(hold('route-unqualified'));
    const owners = input.owners;
    if (['inspect', 'authenticate', 'execute', 'reconcile'].some(name => typeof owners?.[name] !== 'function')) return finish(hold('owners-unavailable'));
    publish(join(work, 'route.json'), admission);
    let validations = 0;
    const inspect = async checkpoint => {
      const record = await owners.inspect(checkpoint);
      const projection = projectSetupChecks(record, checkpoint);
      if (await owners.authenticate(record, checkpoint) !== true) throw Error('owner-evidence');
      return { record, projection };
    };
    const validate = async checkpoint => {
      if (guard()) return hold(guard());
      const current = await input.route.admit({ root, binding: input.binding });
      if (!same(current, admission)) return hold('route-changed');
      const { record, projection } = await inspect(checkpoint);
      const text = checkText(projection), prefix = `${checkpoint.step}-${checkpoint.phase}`;
      publish(join(work, `${prefix}-owners.json`), record);
      if (validations >= PROFILE_3B_3GIB.validationsPerAttempt) return hold('validation-bound', text);
      if (guard()) return hold(guard(), text);
      validations++;
      const before = input.clock();
      let response;
      try {
        response = await input.route.validate(record, { root: work, stopFile, stopped, projection,
          deadlineMs: Math.min(PROFILE_3B_3GIB.deadlineMs, deadline - before) });
      } catch { return hold('model-unavailable', text); }
      // Full raw/scrubbed response and accounting live in Seven's captures. This
      // local checkpoint retains only the bounded closed result, never diagnostics.
      const elapsed = input.clock() - before;
      if (guard()) return hold(guard(), text);
      if (elapsed < 0 || elapsed >= PROFILE_3B_3GIB.deadlineMs) return hold('model-timeout', text);
      if (response?.state !== 'complete' || response.cleanup !== 'verified' || response.usage?.charge !== 0) return hold('model-unavailable', text);
      const decision = decodeSetupDecision(response.bytes);
      publish(join(work, `${prefix}-decision.json`), { decision, checks: text, elapsed, usage: { inputTokens: Number.isSafeInteger(response.usage.inputTokens) ? response.usage.inputTokens : null,
        outputTokens: Number.isSafeInteger(response.usage.outputTokens) ? response.usage.outputTokens : null, charge: 0 },
        capture: typeof response.capture?.hash === 'string' && /^sha256:[a-f0-9]{64}$/.test(response.capture.hash) ? response.capture.hash : null });
      if (decision !== 'accept') return hold('model-hold', text);
      if (projection.checks.some(row => !row.observed || !row.passed)) return hold('owner-check-failed', text);
      // No asynchronous gap may authorize stale evidence or a changed frontier.
      const fresh = await inspect(checkpoint);
      if (!same(fresh.record, record)) return hold('owner-evidence-changed', text);
      if (!same(await input.route.admit({ root, binding: input.binding }), admission)) return hold('route-changed', text);
      return null;
    };
    for (const step of Object.keys(CHECKS)) {
      const checkpoint = { ...input.binding, step, phase: 'pre', operation: `${input.binding.session}:${step}`, schema: SCHEMA };
      const intentPath = join(state, `${step}-dispatch.json`), prior = read(intentPath);
      if (prior && !same(prior.checkpoint, checkpoint)) return finish(hold('binding-changed'));
      if (guard()) return finish(hold(guard()));
      const actual = await owners.reconcile(checkpoint);
      if (!['absent', 'executed'].includes(actual) || (prior && actual !== 'executed')) return finish(hold('effect-uncertain'));
      if (actual === 'absent') {
        const failed = await validate(checkpoint); if (failed) return finish(failed);
        if (guard()) return finish(hold(guard()));
        publish(intentPath, { checkpoint, attempt });
        try { if (await owners.execute(checkpoint, { root, deadline, stopped }) !== 'executed') return finish(hold('effect-uncertain')); }
        catch { return finish(hold('effect-uncertain')); }
      }
      const post = { ...checkpoint, phase: 'post' };
      const failed = await validate(post); if (failed) return finish(failed);
      publish(join(work, `${step}-validated.json`), { checkpoint: post });
    }
    return finish({ state: 'complete', message: 'The four preparation steps passed owner checks and model validation. Enrollment authority remains with its owners.' });
  } catch (error) {
    const result = hold(['unsafe-path', 'setup-busy', 'checkpoint-conflict'].includes(error.message) ? error.message : 'owner-evidence');
    if (outcomePath) { try { publish(outcomePath, result); } catch { /* Existing refusal remains; no overwrite. */ } }
    return result;
  } finally { release?.(); }
}
