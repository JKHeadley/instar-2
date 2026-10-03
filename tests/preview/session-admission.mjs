// The delegated session's admission state (Part fifteen §5, docs/19-scheduled-work): one directory per step claim,
// outside the session's working scope, holding the hook's config, its call slots, its record, the confined-shell
// profile and, when a call past the reserved ceiling was refused, the ceiling marker. The same hook as the tool turn
// (tool-admission-hook.mjs) reads it; this module lays it out fresh before each step and reads it back.
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shellSandboxProfile } from './tool-admission.mjs';

/** The same executable hook the tool turn installs (tool-turn.mjs TOOL_HOOK_SCRIPT). */
const TOOL_HOOK_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'tool-admission-hook.mjs');

const claimPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/u;
/** Step admission directories kept for inspection; older ones are removed (the journal's session-work rows are the record). */
export const SESSION_ADMISSION_KEPT = 16;
const stateOf = (base, claim) => {
  if (!claimPattern.test(claim)) throw Error('session admission: exact claim required');
  return join(base, claim);
};
/** The hook command the session runs before (`pre`) and after (`post`) every tool call. Plain paths only. */
export const sessionAdmissionCommand = ({ base, node = process.execPath }) => (claim, phase) =>
  `${node} ${TOOL_HOOK_SCRIPT} ${phase} ${stateOf(base, claim)}`;
/**
 * Lays out one step's admission state, replacing any earlier one for the claim. `maxCalls` is the step's slot count
 * (the reserved liability less the first model call); `harness` names the executable the hook stops at the ceiling.
 * Delegation and network reads are admitted; MCP and other consequential tools go to the effect doorway with
 * `operations`, the installed profile's registered set.
 */
export function prepareSessionAdmission({ base, claim, workspace, harness, maxCalls, operations, maxWriteBytes = 1048576 }) {
  const state = stateOf(base, claim);
  mkdirSync(base, { recursive: true, mode: 0o700 });
  rmSync(state, { recursive: true, force: true });
  mkdirSync(state, { mode: 0o700 });
  const real = realpathSync(workspace), tmp = join(real, '.tmp');
  mkdirSync(tmp, { recursive: true, mode: 0o700 });
  const shellProfile = join(realpathSync(state), 'shell.sb');
  writeFileSync(shellProfile, shellSandboxProfile({ workspace: real, tmp }), { mode: 0o600 });
  writeFileSync(join(state, 'config.json'), JSON.stringify({ workspace: real, tmp, maxCalls, maxWriteBytes,
    operations: [...operations], harness, shellProfile, delegation: true, networkReads: true }), { mode: 0o600 });
  pruneSessionAdmission(base, claim);
  return state;
}
/** Keeps the newest `SESSION_ADMISSION_KEPT` step directories (by modification time), never the current one. */
function pruneSessionAdmission(base, current) {
  const dirs = readdirSync(base).filter(name => name !== current && claimPattern.test(name))
    .map(name => ({ name, at: lstatSync(join(base, name)).mtimeMs })).sort((a, b) => b.at - a.at);
  for (const { name } of dirs.slice(SESSION_ADMISSION_KEPT - 1)) rmSync(join(base, name), { recursive: true, force: true });
}
/** Whether the hook refused a call past the ceiling; null when the state cannot be read. */
export function sessionAdmissionCeiling(base, claim) {
  try {
    const state = stateOf(base, claim);
    if (!existsSync(join(state, 'config.json'))) return null;
    if (!existsSync(join(state, 'ceiling'))) return false;
    JSON.parse(readFileSync(join(state, 'ceiling'), 'utf8'));
    return true;
  } catch { return null; }
}
