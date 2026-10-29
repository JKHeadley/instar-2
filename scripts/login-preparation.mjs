// Installer preparation only. Parts 08/14/15 require verified enrollment before
// P-02 can grant a subscription. This record is never activation or custody.
import { lstatSync, mkdirSync, realpathSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { assertAgentPaths } from './agent-paths.mjs';
import { publishSetupRecord, readSetupRecord, syncDirectory } from './onboarding-state.mjs';

export class LoginPreparationRefused extends Error {}
const refuse = message => { throw new LoginPreparationRefused(message); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const LOGIN_PREPARATION_SAVED = 'Login preparation saved. No login is connected or authorized.\n'
  + 'Protected operator enrollment and phone confirmation are not implemented in this build.\n';

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

function validateSelection(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).sort().join() !== 'account,provider'
    || !['anthropic', 'openai'].includes(input.provider)
    || typeof input.account !== 'string' || !input.account.trim() || input.account !== input.account.trim()
    || input.account.length > 254 || /[\x00-\x20\x7f]/u.test(input.account))
    refuse('Login preparation refused: invalid account selection. Supply only provider and account; never credentials.');
}

function installation(rootInput) {
  const root = resolve(rootInput), state = join(root, '.onboarding');
  assertAgentPaths({ root, state });
  checkPath(root); checkPath(state);
  const identityPath = join(state, 'identity.json'), completionPath = join(state, 'completed.json');
  checkPath(identityPath); checkPath(completionPath);
  const identity = readSetupRecord(identityPath), completion = readSetupRecord(completionPath);
  if (!identity || !/^agent:[a-f0-9-]{36}$/u.test(identity.agentId) || completion?.agentId !== identity.agentId)
    refuse('Login preparation paused: role setup is incomplete. Run setup for this installation.');
  return { root, identity };
}

/** The 1.x wizard's fixed prompt/validate/action shape, using the existing 2.0
 * publication boundary. This collects a selection, never a provider credential. */
export async function promptLoginPreparation(rootInput, io) {
  const { root } = installation(rootInput);
  const path = join(root, 'login-preparation/request.json');
  checkPath(path);
  const saved = readSetupRecord(path);
  if (saved !== null) {
    // Revalidate the complete record through the writer; a marker is not success.
    prepareLogin(root, { provider: saved.provider, account: saved.account });
    io.write(LOGIN_PREPARATION_SAVED);
    return 0;
  }
  io.write('Prepare a subscription account. This does not sign you in.\n'
    + 'Enter only the provider and account name. Never enter passwords, tokens or authorization codes.\n'
    + 'Provider (anthropic or openai):\n> ');
  const provider = await io.read();
  const pause = () => {
    io.write('\nPreparation paused. No account selection was saved. Run prepare-login again.\n');
    return 2;
  };
  if (provider === null) return pause();
  if (!['anthropic', 'openai'].includes(provider))
    refuse('Login preparation refused: choose anthropic or openai.');
  io.write('Account name or email (not a credential):\n> ');
  const account = await io.read();
  if (account === null) return pause();
  prepareLogin(root, { provider, account });
  io.write(LOGIN_PREPARATION_SAVED);
  return 0;
}

export function prepareLogin(rootInput, input) {
  validateSelection(input);
  const { root, identity } = installation(rootInput);
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
