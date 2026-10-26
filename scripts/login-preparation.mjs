// Installer preparation only. Parts 08/14/15 require verified enrollment before
// P-02 can grant a subscription. This record is never activation or custody.
import { lstatSync, mkdirSync, realpathSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { assertAgentPaths } from './agent-paths.mjs';
import { publishSetupRecord, readSetupRecord, syncDirectory } from './onboarding-state.mjs';

export class LoginPreparationRefused extends Error {}
const refuse = message => { throw new LoginPreparationRefused(message); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// No caller-supplied write paths. Reject links in every existing ancestor before
// writing, including a symlinked root. This is path containment, NOT OS custody.
function checkPath(path) {
  const parent = dirname(path);
  if (parent !== path) checkPath(parent);
  try {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink() || (!stat.isDirectory() && (!stat.isFile() || stat.nlink !== 1)))
      refuse('Login preparation refused: unsafe installation path. Use a real, private installation directory.');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

export function prepareLogin(rootInput, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).sort().join() !== 'account,provider'
    || !['anthropic', 'openai'].includes(input.provider)
    || typeof input.account !== 'string' || !input.account.trim() || input.account !== input.account.trim()
    || input.account.length > 254 || /[\x00-\x20\x7f]/u.test(input.account))
    refuse('Login preparation refused: invalid account selection. Supply only provider and account; never credentials.');
  const root = resolve(rootInput), state = join(root, '.onboarding');
  assertAgentPaths({ root, state });
  checkPath(root); checkPath(state);
  const identityPath = join(state, 'identity.json'), completionPath = join(state, 'completed.json');
  checkPath(identityPath); checkPath(completionPath);
  const identity = readSetupRecord(identityPath), completion = readSetupRecord(completionPath);
  if (!identity || !/^agent:[a-f0-9-]{36}$/u.test(identity.agentId) || completion?.agentId !== identity.agentId)
    refuse('Login preparation paused: role setup is incomplete. Run setup for this installation.');
  // The role receipt identifies this request only. It supplies no operator standing.
  const directory = join(root, 'login-preparation');
  const path = join(directory, 'request.json');
  const request = { version: 1, agentId: identity.agentId, provider: input.provider, account: input.account,
    state: 'awaiting-verified-enrollment', authority: null, custody: null,
    profile: { home: 'login-preparation/profile/home', configDirectory: 'login-preparation/profile/config',
      workingDirectory: 'login-preparation/profile/work' } };
  const directories = [directory, join(directory, 'profile'), ...Object.values(request.profile).map(value => join(root, value))];
  // Validate the whole write set before creating any directory.
  for (const entry of directories) {
    checkPath(entry);
    try { if (!lstatSync(entry).isDirectory()) refuse('Login preparation refused: profile path is occupied. Use a fresh installation directory.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  checkPath(path);
  const previous = readSetupRecord(path);
  if (previous && !same(previous, request))
    refuse('Login preparation refused: a different account request is already saved. Resume the saved enrollment.');
  for (const entry of directories) {
    if (!entry.startsWith(`${realpathSync(root)}${sep}`))
      refuse('Login preparation refused: path is outside the installation. Use its original directory.');
    try { mkdirSync(entry, { mode: 0o700 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    syncDirectory(dirname(entry));
  }
  const recorded = publishSetupRecord(path, request);
  if (!same(recorded, request))
    refuse('Login preparation refused: another account request was saved. Resume the saved enrollment.');
  return recorded;
}
