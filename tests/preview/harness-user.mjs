// The preview's Claude Code harness as its own macOS user (desk unit harness-user, plan row #464). The runner's account
// launches the harness through one sudoers rule (`harness-launch`, as the harness user), so every file the harness and
// its in-process file tools open is checked by the kernel as a user with no access to the operator account's files:
// a path swapped between the admission hook's decision and the tool's open can reach only the harness's own area
// (docs/defects/2026-10-03-file-tool-swap-race.md). This module holds the area's layout, its unprivileged setup, the
// readiness check that decides the switch (a refusal names its reason, and the runner then refuses every tool turn), the ACL grants
// a turn's volume and admission state need, and the sudo command line. Machine-local by declaration (Rule 113): each
// machine provisions its own harness user; nothing here is shared.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HARNESS_USER = '_instarharness';
export const HARNESS_BASE = '/Users/Shared/instar-harness';
export const HARNESS_BIN = join(HARNESS_BASE, 'bin');
export const HARNESS_LAUNCHER = join(HARNESS_BIN, 'harness-launch');
export const HARNESS_HOOKS = join(HARNESS_BASE, 'hook');
export const HARNESS_TURNS = join(HARNESS_BASE, 'turns');
export const HARNESS_PROFILE = join(HARNESS_BASE, 'profile');
const HERE = dirname(fileURLToPath(import.meta.url));
export const HARNESS_LAUNCHER_SOURCE = join(HERE, 'harness-launch.mjs');
/** The admission hook and its whole import closure, and the MCP SecretRef launcher (plain Node, no imports outside node:):
 * the harness user reads them from a copy it cannot write. */
export const HARNESS_HOOK_FILES = Object.freeze(['tool-admission-hook.mjs', 'tool-admission.mjs', 'effect-doorway.mjs', 'mcp-launch.mjs']);
export const HARNESS_SOCKETS = join(HARNESS_BASE, 'sock');

/** ACL entries (chmod +a). `full` with inheritance: a directory both identities work in, where whatever either creates
 * stays usable by the other. `search`: traversal only (no listing, no files). `addOnly`: the turn's admission state,
 * where the hook adds its record and slots but can neither modify nor delete nor replace what the runner wrote there.
 * `readOnly`: one runner file the harness reads (its admission config, its MCP launch configuration). */
const FULL = 'list,add_file,search,add_subdirectory,delete_child,readattr,writeattr,readextattr,writeextattr,readsecurity,read,write,append,execute,delete,file_inherit,directory_inherit';
export const harnessAcl = Object.freeze({
  full: user => `user:${user} allow ${FULL}`,
  search: user => `user:${user} allow search`,
  addOnly: user => `user:${user} allow list,search,add_file,add_subdirectory,readattr,readextattr,readsecurity`,
  readOnly: user => `user:${user} allow read,readattr,readextattr,readsecurity`,
});
/** The runner's own identity for the entries that keep harness-created files usable by it. */
export const runnerUser = (exec = execFileSync) => exec('/usr/bin/id', ['-un'], { encoding: 'utf8', timeout: 2000 }).trim();

/** Adds ACL entries to paths, never through a symbolic link (`-h`: a link the harness planted gets the entry itself,
 * its target nothing). Re-adding an identical entry does not duplicate it. */
export function grantAcl(paths, entries, exec = execFileSync) {
  if (!paths.length) return;
  for (const entry of entries)
    for (let at = 0; at < paths.length; at += 256) exec('/bin/chmod', ['-h', '+a', entry, ...paths.slice(at, at + 256)], { stdio: 'ignore', timeout: 60000 });
}

const sha256 = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const ensureDirectory = (path, mode = 0o700) => { mkdirSync(path, { recursive: true, mode }); if (lstatSync(path).isSymbolicLink()) throw Error(`preview: ${path} is a link`); };
/** Installs `source` at `target` when absent or different (by content), through a temporary name and a rename, so a
 * reader never sees a half-written file. */
function installFile(source, target, mode) {
  const bytes = readFileSync(source);
  try { if (sha256(readFileSync(target)) === sha256(bytes) && (lstatSync(target).mode & 0o7777) === mode) return false; } catch { /* absent */ }
  const temporary = `${target}.${process.pid}.pending`;
  rmSync(temporary, { force: true });
  copyFileSync(source, temporary);
  chmodSync(temporary, mode);
  renameSync(temporary, target);
  return true;
}
/** The launcher, installed where the sudoers rule names it. Returns its digest. */
export function installLauncher() {
  ensureDirectory(HARNESS_BIN, 0o755);
  installFile(HARNESS_LAUNCHER_SOURCE, HARNESS_LAUNCHER, 0o755);
  return sha256(readFileSync(HARNESS_LAUNCHER));
}
/** The admission hook's read-only copy, content-addressed: `<hooks>/<digest>/tool-admission-hook.mjs`. */
export function installHook(from = HERE) {
  const digest = createHash('sha256');
  for (const name of HARNESS_HOOK_FILES) digest.update(name).update('\0').update(readFileSync(join(from, name)));
  const directory = join(HARNESS_HOOKS, digest.digest('hex').slice(0, 16));
  ensureDirectory(HARNESS_HOOKS, 0o755);
  ensureDirectory(directory, 0o755);
  for (const name of HARNESS_HOOK_FILES) installFile(join(from, name), join(directory, name), 0o644);
  return join(directory, HARNESS_HOOK_FILES[0]);
}
/** The pinned harness copy the launcher may run: `<bin>/claude-<version>`, byte-identical to the profile's artifact. */
export const harnessExecutable = version => join(HARNESS_BIN, `claude-${version}`);
export function installExecutable(source, version, artifact) {
  ensureDirectory(HARNESS_BIN, 0o755);
  const target = harnessExecutable(version);
  installFile(source, target, 0o755);
  if (sha256(readFileSync(target)) !== artifact) throw Error('preview: the installed harness copy differs from the pinned artifact');
  return target;
}

/** The unprivileged setup (run once by the desk's account after the root step): the area, its ACLs, the launcher, the
 * hook copy, the pinned harness copy and the harness profile's three directories. Idempotent. */
export function setupHarnessArea({ user = HARNESS_USER, source, version, artifact }) {
  const runner = runnerUser();
  ensureDirectory(HARNESS_BASE, 0o700);
  chmodSync(HARNESS_BASE, 0o700);
  grantAcl([HARNESS_BASE], [harnessAcl.search(user)]);
  installLauncher();
  installHook();
  const executable = installExecutable(source, version, artifact);
  ensureDirectory(HARNESS_TURNS, 0o700);
  grantAcl([HARNESS_TURNS], [harnessAcl.search(user)]);
  ensureDirectory(HARNESS_PROFILE, 0o700);
  grantAcl([HARNESS_PROFILE], [harnessAcl.search(user)]);
  const dirs = ['home', 'config', 'work'].map(name => join(HARNESS_PROFILE, name));
  for (const dir of dirs) { ensureDirectory(dir, 0o700); chmodSync(dir, 0o700); }
  grantAcl(dirs, [harnessAcl.full(user), harnessAcl.full(runner)]);
  return { executable, home: dirs[0], configDirectory: dirs[1], workingDirectory: dirs[2] };
}

/** Effective access as the harness user, read through the launcher's probe: one row per path ({path, mode, ok, code}),
 * or null when the probe could not run (no sudo rule, no user, no launcher). */
export function probeAccess(specs, { user = HARNESS_USER, launcher = HARNESS_LAUNCHER, exec = execFileSync } = {}) {
  let text;
  try { text = exec('/usr/bin/sudo', ['-n', '-u', user, launcher, '--probe', ...specs], { encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { return null; }
  const rows = text.split('\n').filter(Boolean).map(line => { try { return JSON.parse(line); } catch { return null; } });
  return rows.length === specs.length && rows.every(row => row && typeof row.ok === 'boolean') ? rows : null;
}

/**
 * Whether the launches of `profile` can run as the harness user, decided from live state, never from the switch alone.
 * Ready: `{ ready: true, user, uid, hookScript }`. Otherwise `{ ready: false, reason }`, and the runner refuses every tool
 * turn, loudly (plan #473: never the operator's account). Ready means: the user exists and is not the runner; the launcher and the hook copy are installed
 * (installed here when the repo's copy differs); the profile's executable is the installed copy of its artifact; the
 * profile's directories sit in the harness area; and the probe shows the harness CAN read and write its profile and
 * CANNOT read any of `denied` (the root, the operator home, the runner's state), checked as that user by the kernel.
 */
export function harnessReadiness({ user = HARNESS_USER, profile, denied, exec = execFileSync, probe = probeAccess,
  install = { launcher: installLauncher, hook: installHook }, digestOf = path => sha256(readFileSync(path)) }) {
  const no = reason => ({ ready: false, reason });
  let uid;
  try { uid = Number(exec('/usr/bin/id', ['-u', user], { encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] }).trim()); }
  catch { return no(`no user ${user}`); }
  if (!Number.isSafeInteger(uid) || uid <= 0 || uid === process.getuid()) return no(`user ${user} is not a separate identity`);
  if (!profile || typeof profile.executable !== 'string' || profile.executable !== harnessExecutable(profile.version))
    return no('the login profile does not run the installed harness copy');
  if (![profile.home, profile.configDirectory, profile.workingDirectory].every(dir => typeof dir === 'string' && dir.startsWith(`${HARNESS_PROFILE}/`)))
    return no('the login profile does not live in the harness area');
  let hookScript;
  try {
    install.launcher(); hookScript = install.hook();
    if (digestOf(profile.executable) !== profile.artifact) return no('the installed harness copy differs from the pinned artifact');
  } catch { return no('the launcher, hook or harness copy cannot be installed'); }
  const own = [profile.home, profile.configDirectory, profile.workingDirectory, HARNESS_LAUNCHER, hookScript, profile.executable];
  const rows = probe([...own.map(path => `r:${path}`), ...[profile.home, profile.configDirectory].map(path => `w:${path}`),
    ...denied.map(path => `r:${path}`)], { user, exec });
  if (rows === null) return no('the harness launch is not permitted (sudo rule, user or launcher missing)');
  const allowedCount = own.length + 2;
  const missing = rows.slice(0, allowedCount).find(row => !row.ok);
  if (missing) return no(`the harness user cannot ${missing.mode === 'w' ? 'write' : 'read'} ${missing.path}`);
  const exposed = rows.slice(allowedCount).find(row => row.ok);
  if (exposed) return no(`the harness user can read ${exposed.path}`);
  return { ready: true, user, uid, hookScript };
}

/** A turn's scratch volume, usable by both identities: the mount point gets the two inherited `full` entries, and once
 * per volume (its mark written last, so an interrupted walk repeats) every directory and file already on it that is not
 * a link gets them too: a kept workspace may hold files from turns that ran as the runner's account. Bounded walk. */
export const HARNESS_VOLUME_MARK = 'harness-acl.json';
export function grantVolume(mounted, user, runner, limit = 20000, grant = grantAcl) {
  const entries = [harnessAcl.full(user), harnessAcl.full(runner)];
  grant([mounted], entries);
  const mark = join(mounted, HARNESS_VOLUME_MARK);
  try { if (JSON.parse(readFileSync(mark, 'utf8'))?.user === user) return { walked: 0 }; } catch { /* first grant */ }
  const paths = [];
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      if (paths.length >= limit) throw Error('preview: the workspace volume holds too many entries to grant');
      const path = join(dir, name), stat = lstatSync(path);
      if (stat.isSymbolicLink()) continue;
      paths.push(path);
      if (stat.isDirectory()) walk(path);
    }
  };
  walk(mounted);
  grant(paths, entries);
  writeFileSync(mark, JSON.stringify({ v: 1, user }), { mode: 0o600 });
  return { walked: paths.length };
}

/** The per-root directory of the turns' harness-side admission state: `<turns>/<digest of the root's real path>`. The
 * harness may only traverse it; each turn's directory under it is opened to the harness by `prepareHarnessState`. */
export function harnessRootState(root, user, base = HARNESS_TURNS) {
  const directory = join(base, createHash('sha256').update(realpathSync(root), 'utf8').digest('hex').slice(0, 12));
  ensureDirectory(directory, 0o700);
  grantAcl([directory], [harnessAcl.search(user)]);
  return directory;
}
/** One turn's harness-side admission state: created fresh (an existing one refuses: nothing the harness could have
 * placed there is ever trusted), the runner's own entry inherited so what the hook writes stays readable and removable
 * by the runner, and the harness given add-only access. `readable` (the runner's files there the harness must read:
 * the admission config and the MCP launch configuration) get the read-only entry. */
export function prepareHarnessState(directory, user, runner, grant = grantAcl) {
  mkdirSync(directory, { mode: 0o700 });
  grant([directory], [harnessAcl.full(runner)]);
  return { open: readable => { grant(readable, [harnessAcl.readOnly(user)]); grant([directory], [harnessAcl.addOnly(user)]); } };
}
/** A fresh directory for one turn's MCP credential socket (tool-turn.mjs serveMcpSecrets): the runner's, 0700, and
 * traversable by the harness user, whose MCP launcher connects to the socket in it. Short, for the socket path's bound.
 * The runner removes it when the turn ends. */
export function harnessSocketDirectory(user, base = HARNESS_SOCKETS, grant = grantAcl) {
  ensureDirectory(base, 0o700);
  grant([base], [harnessAcl.search(user)]);
  const directory = realpathSync(mkdtempSync(join(base, 'm-')));
  grant([directory], [harnessAcl.search(user)]);
  return directory;
}
/** Removes one turn's harness-side state (a turn directory's `state` link points there). Only a directory inside `base`. */
export function removeHarnessState(link, base = HARNESS_TURNS) {
  let target, within;
  try { if (!lstatSync(link).isSymbolicLink()) return false; target = realpathSync(link); within = realpathSync(base); } catch { return false; }
  if (!target.startsWith(`${within}/`)) return false;
  rmSync(target, { recursive: true, force: true });
  return !existsSync(target);
}

/** Plan #473: a Claude Code tool route never runs as the operator's account. With no `--harness-user` at all, or a harness
 * user that is not ready, every tool turn is refused (the answer runs text only) and says why: stderr at launch, the
 * status line below, and a notice under each answer whose tools were refused (`harnessRefusedNotice`). */
export const HARNESS_OFF_REASON = 'no --harness-user was given';
/** The operator's status line for the harness identity (Rule 84). */
export const harnessStatusLine = harness => harness?.ready
  ? `Harness identity: Claude Code runs as its own macOS user (${harness.user}); the kernel refuses its reads and writes of the operator account's files.`
  : harness?.reason ? `Harness identity: REFUSED, tool turns are not run, because Claude Code would run as the operator's account (${harness.reason}); `
    + 'answers are text only until the separate harness user is ready.'
    : null;
/** The line under an answer whose tool turn was refused for the harness identity (Rule 84: never a silent text-only answer). */
export const harnessRefusedNotice = reason => `Tools: not run for this answer, because Claude Code would have run as the operator's account (${reason}). `
  + 'Answers are text only until the separate harness user is ready.';

/** Plan #473 (2): the harness's own Claude login, as exact values the reply floor and the outbound check withhold. With no
 * keychain of its own, Claude Code keeps it in `<config>/.credentials.json`; every string in it of 16 characters or more
 * is held (an absent or unreadable file holds nothing: no login is there). */
export const HARNESS_CREDENTIAL_FILE = '.credentials.json';
export function harnessCredentialValues(configDirectory, read = path => readFileSync(path, 'utf8')) {
  let parsed;
  try { parsed = JSON.parse(read(join(configDirectory, HARNESS_CREDENTIAL_FILE))); } catch { return []; }
  const values = [];
  const walk = value => {
    if (typeof value === 'string') { if (value.length >= 16) values.push(value); }
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(parsed);
  return values;
}
/** The forms of a held value a text may carry: as written, JSON-escaped, and (a provider key) without its kind prefix,
 * which the shape floor alone would no longer recognise. */
const heldForms = value => [...new Set([value, JSON.stringify(value).slice(1, -1),
  ...(/^sk-[a-z]+-[a-z]+\d*-/u.test(value) ? [value.replace(/^sk-[a-z]+-[a-z]+\d*-/u, '')] : [])])].filter(form => form.length >= 16);
/** Whether `text` carries any held value (exact, never a guess). */
export const heldSecretIn = (text, values) => values.some(value => heldForms(value).some(form => text.includes(form)));
/** `text` with every held value replaced by the redaction mark. */
export const scrubHeld = (text, values) => values.reduce((out, value) => heldForms(value).reduce((acc, form) => acc.split(form).join('[redacted credential]'), out), text);

/** The harness profile derived from the operator-run one (`source`): the same account, organization, plan and pinned
 * artifact, with the harness copy as its executable and the harness area's three directories, its login-profile
 * identity and managed-configuration digest observed by the same inspection every launch repeats. It names a new
 * reference, so it needs its own activation. Its login is established separately (PLAN: a fresh login through the
 * launcher, or the one move of the old login), never a second live copy of one refresh token. */
export async function harnessProfile(source, area, reference = 'preview-harness-profile-v1') {
  const { createSubscriptionProviderIO } = await import('../../scripts/production-boot-io.mjs');
  const draft = { ...source, reference, activationReference: `${reference}-activation`, executable: area.executable,
    home: area.home, configDirectory: area.configDirectory, workingDirectory: area.workingDirectory };
  const observed = createSubscriptionProviderIO({ repository: process.cwd(), stopped: () => false, runAs: { user: HARNESS_USER, launcher: HARNESS_LAUNCHER } })
    .inspectSubscriptionProfile(draft);
  return Object.freeze({ ...draft, loginProfileIdentity: observed.loginProfileIdentity, managedConfigurationDigest: observed.managedConfigurationDigest });
}

// `node tests/preview/harness-user.mjs setup <source profile.json> <out profile.json>`: the unprivileged setup after the
// root step (lanes/harness-user/root-steps.sh), then the harness profile. Prints only paths and digests.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv[2] === 'setup') {
  const [source, out] = process.argv.slice(3);
  if (!source || !out) throw Error('usage: harness-user.mjs setup <source profile.json> <out profile.json>');
  const profile = JSON.parse(readFileSync(source, 'utf8'));
  const area = setupHarnessArea({ source: profile.executable, version: profile.version, artifact: profile.artifact });
  const derived = await harnessProfile(profile, area);
  writeFileSync(out, `${JSON.stringify(derived, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ out, executable: derived.executable, loginProfileIdentity: derived.loginProfileIdentity,
    managedConfigurationDigest: derived.managedConfigurationDigest })}\n`);
}
