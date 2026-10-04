// The delegated session's admission state (Part fifteen §5, docs/19-scheduled-work): one directory per step claim,
// outside the session's working scope, holding the hook's config (with the host checkpoint's address for this claim),
// its tool-call slots, its record and the confined-shell profile. The same hook as the tool turn
// (tool-admission-hook.mjs) reads it; this module lays it out fresh before each step.
import { lstatSync, mkdirSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shellSandboxProfile } from './tool-admission.mjs';
import { prepareHarnessState } from './harness-user.mjs';

/** The same executable hook the tool turn installs (tool-turn.mjs TOOL_HOOK_SCRIPT). */
const TOOL_HOOK_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'tool-admission-hook.mjs');

const claimPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/u;
/** Step admission directories kept for inspection; older ones are removed (the journal's session-work rows are the record). */
export const SESSION_ADMISSION_KEPT = 16;
const stateOf = (base, claim) => {
  if (!claimPattern.test(claim)) throw Error('session admission: exact claim required');
  return join(base, claim);
};
/** The hook command the session runs before (`pre`) and after (`post`) every tool call. Plain paths only. A session run
 * as the harness user runs the hook's read-only copy (`script`, harness-user.mjs harnessHookPath). */
export const sessionAdmissionCommand = ({ base, node = process.execPath, script = TOOL_HOOK_SCRIPT }) => (claim, phase) =>
  `${node} ${script} ${phase} ${stateOf(base, claim)}`;
/**
 * Lays out one step's admission state, replacing any earlier one for the claim. `maxCalls` bounds the step's tool calls
 * (each is followed by a model call, so it never binds before the model-call allowance does); `gate` is the host
 * checkpoint's address for this claim, which decides delegations (a durable child edge first) and consequential tools
 * (the effect owner, by the effect doorway's four tests). Network reads are admitted, except those the operator's effect
 * policy names (`effectPolicy`, with the installation's `operations` and `irreversibleTerm`: the same admission config a
 * tool turn carries), which go to the effect owner. The shell's network checkpoint is attached after this (tool-turn.mjs
 * attachEgress), its trust root and HOME under the step's temporary directory. With `harness` ({user, runner}: the session
 * runs as the harness user) the step's directory is created as a tool turn's is (harness-user.mjs prepareHarnessState:
 * fresh, the runner's entry inherited, add-only for the harness) and the hook's config and shell profile are opened to it
 * read-only, once written.
 */
export function prepareSessionAdmission({ base, claim, workspace, maxCalls, gate, maxWriteBytes = 1048576, operations = [], effectPolicy,
  irreversibleTerm, harness = null, prepare = prepareHarnessState }) {
  if (typeof gate !== 'string' || !/^http:\/\/127\.0\.0\.1:[0-9]+\/[0-9a-f]{32}\/[A-Za-z0-9._-]+$/u.test(gate))
    throw Error('session admission: the host checkpoint address is required');
  const state = stateOf(base, claim);
  mkdirSync(base, { recursive: true, mode: 0o700 });
  rmSync(state, { recursive: true, force: true });
  const opened = harness ? prepare(state, harness.user, harness.runner) : (mkdirSync(state, { mode: 0o700 }), null);
  const real = realpathSync(workspace), tmp = join(real, '.tmp');
  mkdirSync(tmp, { recursive: true, mode: 0o700 });
  const shellProfile = join(realpathSync(state), 'shell.sb');
  writeFileSync(shellProfile, shellSandboxProfile({ workspace: real, tmp }), { mode: 0o600 });
  writeFileSync(join(state, 'config.json'), JSON.stringify({ workspace: real, tmp, maxCalls, maxWriteBytes,
    gate, shellProfile, delegation: true, networkReads: true, operations: [...operations],
    ...(effectPolicy === undefined ? {} : { effectPolicy }), ...(irreversibleTerm === undefined ? {} : { irreversibleTerm }) }), { mode: 0o600 });
  if (opened) opened.open([join(state, 'config.json'), shellProfile]);
  pruneSessionAdmission(base, claim);
  return state;
}
/** Keeps the newest `SESSION_ADMISSION_KEPT` step directories (by modification time), never the current one. */
function pruneSessionAdmission(base, current) {
  const dirs = readdirSync(base).filter(name => name !== current && claimPattern.test(name))
    .map(name => ({ name, at: lstatSync(join(base, name)).mtimeMs })).sort((a, b) => b.at - a.at);
  for (const { name } of dirs.slice(SESSION_ADMISSION_KEPT - 1)) rmSync(join(base, name), { recursive: true, force: true });
}
