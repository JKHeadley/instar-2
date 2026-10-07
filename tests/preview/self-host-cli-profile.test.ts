// @ts-nocheck -- only the registered doorway's physical IO is replaced (its captured-frame conformance
// fixture); the command, its argument parsing, its login-descriptor loading point and every owner are
// the shipped path.
import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readDurable } from './self-host-harness.mjs';
import { offlineProfile, successiveWorld } from './successive-fixture.js';

const DOORWAY = 'claude-code-subscription', world = successiveWorld();
/**
 * Rules 2 and 115: the shipped self-host command has to reach its own registered doorway. The provider
 * credential custodian admits only a frozen host-owned login descriptor, so a descriptor the command
 * loaded as a plain mutable object refused the route before any provider call: the native harness could
 * not develop, test or install anything through its own CLI, and the loss showed only as a refusal word.
 * Here the command runs for real, with the doorway's captured-frame fixture as its physical IO, and the
 * doorway's answer is deliberately not a plan — so the run stops immediately after the provider answers.
 * Admission and the first provider call are what this proves; the confined package steps need macOS
 * (`/usr/bin/sandbox-exec`) and belong to the live-proof J5 run.
 */
const ANSWER = 'not a plan';
const temp = () => realpathSync(mkdtempSync(join(tmpdir(), 'self-host-cli-')));

/** One real run of the command, with `profile` written out as its `--login-profile` file. */
const runCommand = (directory: string, profile: unknown) => {
  const root = join(directory, 'root'), calls = join(directory, 'calls.jsonl');
  const activationPath = join(directory, 'activation.json'), profilePath = join(directory, 'profile.json');
  writeFileSync(activationPath, JSON.stringify(world.activation()));
  writeFileSync(profilePath, JSON.stringify(profile));
  const ioPath = join(directory, 'io.mjs'), loaderPath = join(directory, 'loader.mjs');
  // The doorway's own conformance fixture, with every physical execution counted on disk so the
  // parent can tell "the doorway answered once" from "no provider call happened at all".
  writeFileSync(ioPath, `import { appendFileSync } from 'node:fs';
import { DOORWAY_CONFORMANCE } from ${JSON.stringify(pathToFileURL(join(process.cwd(), 'tests/preview/doorway-conformance.ts')).href)};
const state = { outcome: 'complete', calls: 0, stdin: [], answer: () => ${JSON.stringify(ANSWER)} };
export const createSubscriptionProviderIO = () => {
  const io = DOORWAY_CONFORMANCE[${JSON.stringify(DOORWAY)}].io(state);
  return { ...io, execute: async command => { const outcome = await io.execute(command);
    appendFileSync(${JSON.stringify(calls)}, JSON.stringify({ calls: state.calls }) + '\\n'); return outcome; } };
};
export { productionStorageIO } from ${JSON.stringify(pathToFileURL(join(process.cwd(), 'scripts/production-boot-io.mjs')).href)};
`);
  writeFileSync(loaderPath, `export async function resolve(specifier, context, next) {
  if (context.parentURL?.endsWith('/self-host.mjs') && specifier.endsWith('/production-boot-io.mjs'))
    return { url: ${JSON.stringify(pathToFileURL(ioPath).href)}, shortCircuit: true };
  return next(specifier, context);
}`);
  const outcome = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
    '--loader', loaderPath, 'tests/preview/self-host.mjs', 'run', '--task', 'Build a word-count capability.',
    '--root', root, '--activation-record', activationPath, '--login-profile', profilePath, '--model', world.model],
  { cwd: process.cwd(), encoding: 'utf8', timeout: 120_000 });
  const counted = readDurable(calls).map(row => row.calls ?? 0);
  const phases = readDurable(join(root, 'self-host.jsonl'));
  return { outcome, providerCalls: counted.length ? Math.max(...counted) : 0, phases };
};

it('reaches its registered doorway with the login descriptor its own loading point produced (Rules 2, 115)', () => {
  const directory = temp();
  try {
    const { outcome, providerCalls, phases } = runCommand(directory, offlineProfile);
    const stderr = outcome.stderr ?? '';
    // The custody refusal that kept this command away from its doorway must not be the outcome any more.
    expect(stderr).not.toContain('subscription route refused');
    expect(stderr).not.toContain('host-owned frozen subscription descriptor required');
    // The doorway was called exactly once and its answer was recorded before the run read it as a plan.
    expect(providerCalls).toBe(1);
    expect(phases.filter(row => row.phase === 'provider').map(row => row.outcome)).toEqual(['answered']);
    // The run then stops on this fixture's deliberate non-plan answer, past every custody check.
    expect(stderr).toContain('self-host: plan is not one JSON object');
    expect(outcome.status).toBe(1);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 180_000);

it('still refuses a login descriptor the activation does not name, with no provider call (Rules 2, 115)', () => {
  const directory = temp();
  try {
    const { outcome, providerCalls, phases } = runCommand(directory,
      { ...offlineProfile, expectedAccount: 'someone-else@example.invalid' });
    expect(outcome.status).toBe(1);
    expect(outcome.stderr).toContain('self-host refused:');
    expect(providerCalls).toBe(0);
    expect(phases.some(row => row.phase === 'provider' && row.outcome === 'answered')).toBe(false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 180_000);
