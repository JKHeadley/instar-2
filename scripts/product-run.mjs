// Rules 2/4/44/95/116: compose the existing runner from installation records;
// this is configuration, never a grant or a replacement admission checkpoint.
import { readFileSync, statSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertAgentPaths } from './agent-paths.mjs';

export class RunRefused extends Error {
  constructor(label) { super(`Run refused: ${label}. Keep the records and complete installation before retrying.`); }
}
const refuse = label => { throw new RunRefused(label); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 4096 && !/[\x00-\x1f\x7f]/u.test(value);
const read = (path, label) => {
  try {
    if (!statSync(path).isFile() || statSync(path).size > 1024 * 1024) return refuse(`${label} is not a bounded record`);
    const value = JSON.parse(readFileSync(path, 'utf8'));
    if (!object(value)) return refuse(`${label} is malformed`);
    return value;
  } catch { return refuse(`${label} is missing or unreadable`); }
};
const pathRecord = (path, label) => {
  if (!text(path) || !isAbsolute(path)) refuse(`${label} needs an absolute record path`);
  read(path, label);
};
const defaults = Object.freeze({ 'max-calls': 16, 'max-replies': 16, 'max-turns': 20, 'max-context-bytes': 32768 });
const required = ['bot-id', 'bot-username', 'operator-sender-id', 'chat-id', 'forum', 'grant-reference',
  'configuration-digest', 'expires-at', 'operator-records', 'explicit-yes-installation', 'review-repository',
  'harness-user', 'conversation-session'];

/** Read-only translation. Existing runtime still checks sealed authority, model/login
 * compatibility, journal agreement, stop, custody, caps and send ownership. Missing
 * inventory must not silently become the runner's legacy single-login fallback. */
export function buildRunArgv(directory) {
  const root = resolve(directory);
  assertAgentPaths({ root });
  const config = read(resolve(root, 'run-config.json'), 'run-config.json');
  if (config.version !== 1 || Object.keys(config).some(key => !['version', 'options'].includes(key)) || !object(config.options))
    refuse('run-config.json has an unknown format');
  const o = config.options;
  if (Object.keys(o).some(key => ![...required, ...Object.keys(defaults)].includes(key))) refuse('run-config.json contains an unknown option');
  for (const name of required) {
    if (name === 'forum') { if (typeof o[name] !== 'boolean') refuse('forum must be true or false'); }
    else if (!text(o[name]) || o[name].startsWith('--')) refuse(`run-config.json needs ${name}`);
  }
  for (const name of ['bot-id', 'operator-sender-id']) if (!/^[1-9][0-9]*$/u.test(o[name])) refuse(`${name} is malformed`);
  if (!/^-?[1-9][0-9]*$/u.test(o['chat-id']) || !/^@[a-zA-Z0-9_]+$/u.test(o['bot-username'])) refuse('chat or bot identity is malformed');
  if (!/^sha256:[a-f0-9]{64}$/u.test(o['configuration-digest']) || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/u.test(o['expires-at']))
    refuse('configuration digest or expiry is malformed');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(o['review-repository']) || !/^[A-Za-z_][A-Za-z0-9_-]*$/u.test(o['harness-user']))
    refuse('review repository or harness user is malformed');
  if (!['on', 'off'].includes(o['conversation-session'])) refuse('conversation-session must be on or off');
  if (!isAbsolute(o['operator-records'])) refuse('operator-records needs an absolute directory');
  try { if (!statSync(o['operator-records']).isDirectory()) refuse('operator records directory is missing'); }
  catch { refuse('operator records directory is missing'); }
  pathRecord(o['explicit-yes-installation'], 'explicit yes installation');
  const setting = read(resolve(root, 'model-setting.json'), 'model-setting.json');
  // Same exact record shape as the existing model-setting.py reader, with no environment fallback.
  if (Object.keys(setting).length !== 1 || typeof setting.model !== 'string' || !/^claude-[a-z0-9][a-z0-9.-]{0,62}$/u.test(setting.model))
    refuse('model-setting.json must contain one valid model setting');
  const inventory = read(resolve(root, 'harness-logins.json'), 'harness-logins.json');
  if (inventory.version !== 1 || !Array.isArray(inventory.logins) || inventory.logins.length < 1 || inventory.logins.length > 8)
    refuse('harness-logins.json has an unknown format');
  for (const login of inventory.logins) {
    if (!object(login)) refuse('installed login is malformed');
    for (const field of ['profile', 'activation', 'authority']) pathRecord(login[field], `installed login ${field}`);
    for (const field of ['toolsActivation', 'sessionActivation']) if (login[field] !== undefined) pathRecord(login[field], `installed login ${field}`);
  }
  const primary = inventory.logins[0];
  if (o['conversation-session'] === 'on' && !primary.sessionActivation) refuse('conversation sessions need their installed activation record');
  const limits = { ...defaults };
  for (const name of Object.keys(defaults)) {
    if (o[name] !== undefined) {
      if (!Number.isSafeInteger(o[name]) || o[name] < 1) refuse(`${name} must be a positive finite integer`);
      limits[name] = o[name];
    }
  }
  try { if (!statSync(resolve(root, 'journal.encrypted')).isFile()) refuse('installed journal is missing'); }
  catch { refuse('installed journal is missing'); }
  const argv = ['run', '--root', root];
  const add = (name, value) => argv.push(`--${name}`, String(value));
  for (const name of required.slice(0, 8)) add(name, o[name]);
  add('activation-record', primary.activation); add('authority-record', primary.authority);
  for (const name of required.slice(8, 12)) add(name, o[name]);
  add('model', setting.model);
  if (primary.toolsActivation) add('tools-activation', primary.toolsActivation);
  add('conversation-session', o['conversation-session']);
  if (primary.sessionActivation) add('session-work-activation', primary.sessionActivation);
  for (const [name, value] of Object.entries(limits)) add(name, value);
  return argv;
}

export async function runProduct(root) {
  const argv = buildRunArgv(root);
  // Import the same entry in this process: signals and exit status remain the runner's.
  // The runner resolves its shipped code from cwd, never the caller's unrelated directory.
  process.chdir(fileURLToPath(new URL('../', import.meta.url)));
  process.argv = [process.execPath, fileURLToPath(new URL('../tests/preview/journal-agent.mjs', import.meta.url)), ...argv];
  await import('../tests/preview/journal-agent.mjs');
}
