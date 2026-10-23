// R4/R35/R103: enforce the operator's reserved-login policy before a test launcher
// starts. Read non-secret profiles, including every fallback, never custody tokens.
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
const refuse = message => { throw Error(`Test login refused: ${message}`); };

export function checkTestLogin(policy, options, readJSON = read, exists = existsSync) {
  if (policy?.version !== 1 || !Array.isArray(policy.reserved) || !policy.reserved.length
    || policy.reserved.some(row => !row || typeof row.account !== 'string' || !row.account
      || typeof row.reason !== 'string' || !row.reason || !Array.isArray(row.usageAccounts)
      || row.usageAccounts.some(id => typeof id !== 'string' || !id)))
    refuse('reserved-login policy is unreadable; ask the desk to repair it.');
  const manifests = [];
  if (options.inventory) manifests.push(options.inventory);
  if (options['login-pool']) manifests.push(options['login-pool']);
  else if (!options['login-profile'] && !options.inventory) {
    if (!options.root) refuse('no root or explicit login was supplied.');
    const path = join(options.root, 'harness-logins.json');
    if (!exists(path)) refuse('no test login is installed; select a separate test account.');
    manifests.push(path);
  }
  const rows = options['login-profile'] ? [{ profile: options['login-profile'] }] : [];
  for (const path of new Set(manifests)) {
    const manifest = readJSON(path);
    if (manifest?.version !== 1 || !Array.isArray(manifest.logins) || !manifest.logins.length)
      refuse('test login inventory is malformed.');
    rows.push(...manifest.logins);
  }
  if (!rows.length) refuse('no test login was selected.');
  for (const row of rows) {
    if (!row || typeof row.profile !== 'string') refuse('test login profile is missing.');
    // Even a held/unavailable fallback is checked: a reset must not unlock a
    // reserved login in a later cycle. Retained admission is checked as well.
    const profiles = [readJSON(row.profile), ...(row.admittedProfile ? [row.admittedProfile] : [])];
    for (const profile of profiles) {
      if (typeof profile?.expectedAccount !== 'string' || !profile.expectedAccount)
        refuse('test login account cannot be established.');
      const reserved = policy.reserved.find(item => item.account.toLowerCase() === profile.expectedAccount.toLowerCase()
        || item.usageAccounts.includes(row.usageAccount));
      if (reserved) refuse(`${reserved.reason} Select a separate test login; no test was started.`);
    }
  }
  return rows.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2), options = {};
    for (let i = 0; i < args.length; i += 2) {
      if (args[i] === '--') { i--; continue; }
      if (!args[i]?.startsWith('--') || args[i + 1] === undefined) refuse('malformed launch arguments.');
      const key = args[i].slice(2);
      if (Object.hasOwn(options, key)) refuse('duplicate launch option.');
      options[key] = args[i + 1];
    }
    checkTestLogin(read(options.policy), options);
  } catch (error) {
    // File/parser errors may contain raw bytes. Only our fixed refusals are safe.
    process.stderr.write(`${error instanceof Error && error.message.startsWith('Test login refused:')
      ? error.message : 'Test login refused: policy or login metadata could not be read; ask the desk to repair it.'}\n`);
    process.exitCode = 2;
  }
}
