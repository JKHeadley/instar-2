// Runner side of a tool turn (Part Thirteen §9 in docs/17-harness-adapters, the preview tool rule): the conversation's
// persistent workspace on its own fixed-size volume under the root's `workspaces` directory, the conversation's kept
// harness session (a cache subordinate to the journal, MF5), the per-turn hook state directory, the trace read back after
// the turn, and bounded retention. Workspaces, session records and traces are machine-local by declaration (Rule 113): this
// runner's working state; the journal row is the durable record, and nothing here is shared or resumed on another machine.
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, realpathSync, renameSync, rmdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUBSCRIPTION_SUBAGENT_TYPE, SUBSCRIPTION_TOOL_LIMITS, SUBSCRIPTION_TOOL_NAMES, SUBSCRIPTION_TOOL_RUNTIME_READS, SUBSCRIPTION_TOOLS_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import { nestedSessionWorkClose } from '../../src/assembly/production-session-work.js';
import { credentialSpans } from '../../src/recall/redact.js';
import { secretForms, secretMaterialIn } from './reply-check.js';
import { HELD_CHECK_MAX_BYTES, shellSandboxProfile, toolTrace } from './tool-admission.mjs';
import { readEgressRecord, startEgressProxy } from './egress-proxy.mjs';
import { grantVolume, harnessRootState, harnessSocketDirectory, prepareHarnessState, removeHarnessState } from './harness-user.mjs';

export const TOOL_TURNS_DIRECTORY = 'tool-turns';
/** A turn directory's runner-only part when the harness runs as its own user (the egress checkpoint's state, and the MCP
 * launch configuration the harness receives only through the launcher's hand-off). */
export const TOOL_TURN_PRIVATE = 'private';
/** Where a root keeps the tools activation the runner derived by default (its live withdrawal handle; machine-local). */
export const TOOLS_DEFAULT_ACTIVATION = 'tools-activation.json';
/** Finished turn directories kept for inspection; older ones are removed (the journal keeps their trace). */
export const TOOL_TURNS_KEPT = 16;
/** Checkpoint decisions journaled per turn (the first ones; the trace counts them all). */
export const TOOL_EGRESS_RECORDED = 64;
export const TOOL_HOOK_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'tool-admission-hook.mjs');
/** Starts an MCP server whose environment names a credential by SecretRef (`readRootMcp`, `serveTurnSocket`). */
export const TOOL_MCP_LAUNCHER = join(dirname(fileURLToPath(import.meta.url)), 'mcp-launch.mjs');
/** Answer turns and scheduled obligation work run with tools; reviews, summaries and benchmark reruns never do. */
export const toolTurnEligible = id => /^telegram:[0-9]+:update:[0-9]+$/u.test(id) || /^obligation:/u.test(id);

/** The fixed size of one conversation's workspace volume. Every byte a tool can write (the workspace, the shell's
 * temporary files) lands on it, so a conversation can never take more than this from the disk that holds the journal
 * (Rule 60); with at most `TOOL_WORKSPACES_KEPT` conversations kept, a root's tool storage is bounded by their product. */
export const TOOL_SCRATCH_BYTES = 128 * 1024 * 1024;
const HDIUTIL = '/usr/bin/hdiutil';
const SCRATCH_IMAGE = 'scratch.sparseimage', SCRATCH_LINK = 'vol';
/** Where scratch volumes mount. The mount point doubles as the harness's temporary directory (CLAUDE_CODE_TMPDIR), and
 * Claude Code 2.1.280 keeps its per-user directory under it only while that path stays within 44 bytes (else it falls
 * back to the shared /tmp/claude-<uid>, outside the volume), so the mount point is short: `/private/tmp/itw-` (a
 * conversation's workspace, its 12 hex digits fixed) or `itt-` (a one-turn volume, random), 29 bytes. The owning
 * directory links to it as `vol`, so the next attach or prune finds a volume a crash left mounted. */
export const TOOL_SCRATCH_MOUNTS = '/private/tmp';
const mountOf = turn => { try { return readlinkSync(join(turn, SCRATCH_LINK)); } catch { return null; } };
/** Whether a turn directory's scratch volume is still mounted (its mount point sits on another device). */
export function scratchMounted(turn) {
  const mount = mountOf(turn);
  try { return mount !== null && lstatSync(mount).dev !== lstatSync(dirname(mount)).dev; } catch { return false; }
}
/** Mounts a directory's fixed-size scratch volume (a sparse disk image: it takes only the bytes written, and refuses
 * writes past `bytes`), linked from `<dir>/vol`, creating the image on first use and reusing it afterwards, so its files
 * persist between mounts. `name` is the mount point's name under `mounts` (a conversation's is fixed, so its harness
 * session finds the same working directory every turn); a volume a crash left mounted is unmounted first. Returns the
 * mount point's real path. */
export function attachScratch(dir, name = `itt-${randomBytes(6).toString('hex')}`, bytes = TOOL_SCRATCH_BYTES, mounts = TOOL_SCRATCH_MOUNTS) {
  if (!/^it[tw]-[0-9a-f]{12}$/u.test(name)) throw Error('preview: tool scratch mount name');
  if (!unmountScratch(dir)) throw Error('preview: a tool scratch volume left mounted will not unmount');
  const image = join(dir, SCRATCH_IMAGE), mount = join(realpathSync(mounts), name);
  mkdirSync(mount, { recursive: true, mode: 0o700 });
  // Another directory's volume already at this mount point (a second root on the host, or one a crash left stuck): an
  // attach on top of it attaches the image unmounted while the mount check sees the other volume, so refuse instead.
  if (lstatSync(mount).dev !== lstatSync(dirname(mount)).dev) throw Error('preview: a tool scratch mount point is held by another volume');
  rmSync(join(dir, SCRATCH_LINK), { force: true });
  symlinkSync(mount, join(dir, SCRATCH_LINK));
  if (!existsSync(image)) execFileSync(HDIUTIL, ['create', '-quiet', '-size', `${String(Math.ceil(bytes / 1048576))}m`, '-type', 'SPARSE',
    '-fs', 'HFS+', '-volname', 'instar-tool-turn', image], { stdio: 'ignore', timeout: 60000 });
  execFileSync(HDIUTIL, ['attach', '-quiet', '-nobrowse', '-noautoopen', '-owners', 'on', '-mountpoint', mount, image],
    { stdio: 'ignore', timeout: 60000 });
  if (!scratchMounted(dir)) throw Error('preview: tool scratch volume did not mount');
  chmodSync(mount, 0o700);
  return realpathSync(mount);
}
/** The fixed size of the delegated session's volume (Rule 60). Every byte a session step's tools write (its workspace
 * and its shells' temporary files) lands on it, so session work can never take more than this from the disk that holds
 * the journal, however many files it writes. */
export const SESSION_VOLUME_BYTES = 2 * 1024 * 1024 * 1024;
/** Mounts the delegated session's persistent volume at `<root>/<name>` (a sparse disk image beside it, created once and
 * kept, so the workspace persists across steps and restarts) and returns its real path. Already mounted, it is reused.
 * `bytes` exists so a test can prove the bound with a small volume. */
export function attachSessionVolume(root, { bytes = SESSION_VOLUME_BYTES, name = 'session-work', at = null } = {}) {
  // `at`: a mount point outside the root (a session run as the harness user, harness-user.mjs harnessSessionLayout); the
  // image stays beside the root's own mount point, so the workspace is the same one.
  const real = realpathSync(root), mount = at ?? join(real, name), image = join(real, `${name}.sparseimage`);
  mkdirSync(mount, { recursive: true, mode: 0o700 });
  const mounted = () => { try { return lstatSync(mount).dev !== lstatSync(dirname(mount)).dev; } catch { return false; } };
  if (!mounted()) {
    let created = true;
    try { lstatSync(image); } catch { created = false; }
    if (!created) execFileSync(HDIUTIL, ['create', '-quiet', '-size', `${String(Math.ceil(bytes / 1048576))}m`, '-type', 'SPARSE', '-fs', 'HFS+',
      '-volname', 'instar-session-work', image], { stdio: 'ignore', timeout: 60000 });
    execFileSync(HDIUTIL, ['attach', '-quiet', '-nobrowse', '-noautoopen', '-owners', 'on', '-mountpoint', mount, image],
      { stdio: 'ignore', timeout: 60000 });
    if (!mounted()) throw Error('preview: the session volume did not mount');
  }
  chmodSync(mount, 0o700);
  return realpathSync(mount);
}
/** Unmounts the session volume (a test's cleanup; the runner keeps it mounted). */
export function detachSessionVolume(mount) {
  try { execFileSync(HDIUTIL, ['detach', '-quiet', '-force', mount], { stdio: 'ignore', timeout: 60000 }); } catch { /* checked by the caller */ }
}
/** How many unmount attempts, and how long between them. A volume just written is briefly busy (its own indexer, the
 * disk arbitration daemon), and `hdiutil detach -force` refuses while it is, so one refusal is not a stuck volume: in
 * the sb-w4-selfdesc gate run of 2026-10-05 the detach immediately after the burst of writes that filled an 8 MB
 * volume left it mounted, and the very next call — the same code, milliseconds later — detached it. Unretried that
 * costs the conversation its next turn, because `attachScratch` refuses a volume it cannot unmount first.
 * What the retry costs, measured rather than guessed (Rule 13): the pauses total 2,000 ms (five waits of 400 ms
 * between six attempts), but each attempt is its own synchronous forced detach carrying the 60,000 ms timeout below,
 * so attempts that all reach that timeout block the calling thread for up to 362,000 ms against the one attempt's
 * 60,000 ms. A detach that completes at all returns in milliseconds, so the ordinary cost is the pauses. */
const UNMOUNT_ATTEMPTS = 6, UNMOUNT_WAIT_MS = 400;
const forceDetach = mount => {
  try { execFileSync(HDIUTIL, ['detach', '-quiet', '-force', mount], { stdio: 'ignore', timeout: 60000 }); } catch { /* the mount decides, below */ }
};
/** The bounded unmount wait, kept apart from the volume it unmounts so the retry itself is provable: `attempt` is
 * tried while `mounted()` still says the volume is there, at most `attempts` times, pausing between tries. Returns
 * whether it ended unmounted; an attempt's own exit status is never read as success. */
export function unmountWithin(mounted, attempt, attempts = UNMOUNT_ATTEMPTS,
  pause = ms => { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }) {
  for (let tried = 0; mounted(); tried++) {
    if (tried >= attempts) return false;
    if (tried) pause(UNMOUNT_WAIT_MS);
    attempt();
  }
  return true;
}
/** Unmounts a directory's scratch volume and removes its mount point, keeping its image (and so its files). A volume
 * that refuses is retried inside the bounded wait above. Returns false when it is still mounted after `tries` forced
 * detaches (the next attach or a later prune retries). `tries`, `force` and `mounted` exist so a test can prove both
 * sides of the retry through this function too, without a real volume. */
export function unmountScratch(dir, { tries = UNMOUNT_ATTEMPTS, force = forceDetach, mounted = scratchMounted } = {}) {
  const mount = mountOf(dir);
  if (!unmountWithin(() => mounted(dir), () => force(mount), tries)) return false;
  if (mount !== null) try { rmdirSync(mount); } catch { /* already gone */ }
  return true;
}
/** Unmounts a scratch volume and removes its image: everything on it is gone. Returns false when it stays mounted. */
export function detachScratch(dir) {
  if (!unmountScratch(dir)) return false;
  rmSync(join(dir, SCRATCH_IMAGE), { force: true });
  return true;
}

/** The Claude doorway's tool-turn admission: its harness bounds model turns itself (`--max-turns`) and sandboxes Bash.
 * A doorway whose admission names a `harness` has no such limit of its own, so its turns run through the host's
 * admission checkpoint (admission-gate.mjs): every model call takes the turn's reserved allowance before dispatch. */
export const CLAUDE_TOOL_ADMISSION = Object.freeze({ maxCalls: SUBSCRIPTION_TOOL_LIMITS.maxToolCalls, harness: null, confinedShell: false });
/** A turn directory's name: its operation's digest and its attempt (the journal's `id#attempt` key, filesystem-safe). */
export const toolTurnSlug = (operation, attempt) => `${createHash('sha256').update(operation, 'utf8').digest('hex').slice(0, 16)}-${String(attempt)}`;

/** Allocates a turn: a fresh `<root>/tool-turns/<digest>-<attempt>/state` and the hook's config, and mounts the volume
 * holding `ws` and `tmp`, all 0700 (`scratch(dir, name)` mounts it; tests may pass a stand-in). `volume` is the
 * conversation's workspace ({directory, name} from `conversationWorkspace`), whose files persist across turns; absent,
 * the turn gets its own fresh volume in its turn directory. `children` is the number of subagents this turn's
 * reservation covers; `mcp` is the root's MCP configuration ({servers, reads, secrets}) or null. The servers' launch
 * configuration is written into the state directory with no secret value: a server whose environment names a SecretRef
 * is launched through `mcp-launch.mjs`, which takes the resolved values from the turn's socket (`serveTurnSocket`); with
 * the harness as its own user, the launcher is its read-only copy beside the hook and the socket lies in the harness
 * area (`harnessSocketDirectory`). The config also carries the effect doorway's policy and the register's irreversible
 * term (Part Twelve; absent policy: nothing outward by default). `admission` is the doorway's tool-turn layout: its call
 * slots, the harness the hook stops past them, and whether the hook confines the shell; `gate` is the host checkpoint's
 * address for this turn when the doorway's harness runs through it (w4-sessiondriver). */
export function prepareToolTurn({ root, operation, attempt, operations, effectPolicy, irreversibleTerm, children = 0, mcp = null,
  node = process.execPath, scratch = attachScratch, volume = null, authority = 'unrecorded', admission = CLAUDE_TOOL_ADMISSION, gate = null,
  harness = null, grant = { volume: grantVolume, state: prepareHarnessState, socket: harnessSocketDirectory } }) {
  const base = join(realpathSync(root), TOOL_TURNS_DIRECTORY);
  mkdirSync(base, { recursive: true, mode: 0o700 });
  const slug = toolTurnSlug(operation, attempt);
  const turn = join(base, slug);
  mkdirSync(turn, { mode: 0o700 });
  // The harness as its own user (harness-user.mjs): the hook it runs reads and writes this turn's admission state, so
  // the state lives in the harness area (the turn directory's `state` links to it), add-only for the harness; the
  // runner's private material for the turn (the egress checkpoint's trust root and record) stays under the root.
  let opened = null;
  if (harness) {
    const shared = join(harness.rootState, slug);
    opened = grant.state(shared, harness.user, harness.runner);
    symlinkSync(shared, join(turn, 'state'));
    mkdirSync(join(turn, TOOL_TURN_PRIVATE), { mode: 0o700 });
  } else mkdirSync(join(turn, 'state'), { mode: 0o700 });
  const mounted = volume ? scratch(volume.directory, volume.name) : scratch(turn);
  // Both identities work on the volume (workspace, tmp, shell HOME, the harness's temporary directory), never through a link.
  if (harness) grant.volume(mounted, harness.user, harness.runner);
  // The shell's HOME (w4-shellnet) is per turn even in a kept volume: only the workspace and its temporary directory carry
  // files between turns, and those are what the forget reconciliation walks, so nothing a command left in HOME outlives it.
  rmSync(join(mounted, 'home'), { recursive: true, force: true });
  for (const name of ['ws', 'tmp', 'home']) { mkdirSync(join(mounted, name), { recursive: true, mode: 0o700 }); chmodSync(join(mounted, name), 0o700); }
  const workspace = realpathSync(join(mounted, 'ws')), tmp = realpathSync(join(mounted, 'tmp')), home = realpathSync(join(mounted, 'home'));
  const stateDirectory = realpathSync(join(turn, 'state'));
  const privateDirectory = harness ? realpathSync(join(turn, TOOL_TURN_PRIVATE)) : stateDirectory;
  const servers = mcp ? Object.keys(mcp.servers) : [];
  const shellProfile = admission.confinedShell ? join(stateDirectory, 'shell.sb') : null;
  if (shellProfile) writeFileSync(shellProfile, shellSandboxProfile({ workspace, tmp }), { mode: 0o600 });
  // The turn's runner socket (serveTurnSocket): the held-secret check every outward tool request asks before it is
  // dispatched, and each SecretRef-bearing MCP server's credentials. A short private directory (a Unix socket path is
  // limited to about 100 bytes); with the harness as its own user it lies in the harness area, traversable by that user
  // alone besides the runner.
  const socket = join(harness ? grant.socket(harness.user) : realpathSync(mkdtempSync(join(tmpdir(), 'itm-'))), 's');
  // A gated turn (`gate`, the checkpoint's address for this turn) has the harness's full tool set behind the checkpoint:
  // delegation becomes a child edge, network reads are admitted, consequential tools pass the effect owner.
  writeFileSync(join(stateDirectory, 'config.json'), JSON.stringify({ workspace, tmp, reads: [...SUBSCRIPTION_TOOL_RUNTIME_READS], maxCalls: admission.maxCalls, heldCheck: socket,
    maxWriteBytes: SUBSCRIPTION_TOOL_LIMITS.maxWriteBytes, operations: [...operations],
    ...(shellProfile ? { shellProfile } : {}), ...(gate ? { gate, delegation: true, networkReads: true } : {}),
    children: { max: children, type: SUBSCRIPTION_SUBAGENT_TYPE }, mcpReads: mcp ? [...mcp.reads] : [], authority,
    ...(effectPolicy === undefined ? {} : { effectPolicy }), ...(irreversibleTerm === undefined ? {} : { irreversibleTerm }) }), { mode: 0o600 });
  let mcpTurn;
  if (servers.length) {
    const secretServers = servers.filter(name => Object.keys(mcp.secrets?.[name] ?? {}).length > 0);
    // With the harness as its own user the launcher is its read-only copy beside its hook (the repository is out of that
    // user's reach). The launch configuration holds no credential; as its own user the harness still never gets a file of
    // it: it stays runner-private and reaches the harness through the launcher's hand-off (harnessCommand).
    const launcher = harness ? join(dirname(harness.hookScript), 'mcp-launch.mjs') : TOOL_MCP_LAUNCHER;
    const nonces = Object.fromEntries(secretServers.map(name => [name, randomBytes(16).toString('hex')]));
    const launch = Object.fromEntries(servers.map(name => {
      const server = mcp.servers[name];
      if (!nonces[name]) return [name, server];
      const { command, args = [], env = {}, ...rest } = server;
      const plain = Object.fromEntries(Object.entries(env).filter(([, value]) => typeof value === 'string'));
      return [name, { ...rest, command: node, args: [launcher, socket, name, nonces[name], command, ...args],
        ...(Object.keys(plain).length ? { env: plain } : {}) }];
    }));
    const config = join(privateDirectory, 'mcp.json');
    writeFileSync(config, JSON.stringify({ mcpServers: launch }), { mode: 0o600 });
    mcpTurn = { config, servers, launch, ...(Object.keys(nonces).length ? { nonces } : {}) };
  }
  // Only now may the harness enter its state: it reads the runner's config, adds its own files, and replaces none.
  if (opened) opened.open([join(stateDirectory, 'config.json')]);
  return { slug, directory: turn, volumeDirectory: volume ? volume.directory : turn, scratch: mounted, workspace, tmp, home, stateDirectory,
    privateDirectory, hook: { node, script: harness ? harness.hookScript : TOOL_HOOK_SCRIPT }, socket: { path: socket, shared: harness !== null },
    ...(mcpTurn ? { mcp: mcpTurn } : {}) };
}

/** Where the shell's network tools live, read-only inside the sandbox: the runner's own node (its directory goes first on
 * the shell's PATH) and the npm beside it, and the system's developer tools (git and python3 in /usr/bin hand over to them).
 * A location under /Users or /Volumes is left out (those stay unreadable), so on such an install npm is simply absent. */
export function networkToolReads(execPath = process.execPath, exists = existsSync, real = realpathSync) {
  const node = real(execPath), bin = dirname(node), prefix = dirname(bin), npm = join(prefix, 'lib', 'node_modules', 'npm');
  const readable = path => /^\/[A-Za-z0-9_./@-]+$/u.test(path) && !/^\/(?:Users|Volumes)(?:\/|$)/u.test(path) && exists(path);
  const developer = '/Library/Developer/CommandLineTools';
  const reads = [bin, npm, developer].filter(readable);
  // DEVELOPER_DIR names the developer tools directly: xcrun otherwise reads the system's selection link, outside the sandbox.
  return { reads, path: reads.includes(bin) ? bin : undefined, developer: reads.includes(developer) ? developer : undefined };
}
/** Starts the turn's network checkpoint and records it in the hook's config, so every admitted shell command is pointed at
 * it (tool-admission.mjs toolShellPrefix). The checkpoint decides with the same admission config the hook reads (the
 * installed operations, the operator's effect policy and the irreversible term), so a shell request and a tool call meet
 * one effect doorway. Returns the proxy and the part of the turn the provider's sandbox settings need. `start` stands in
 * for startEgressProxy in tests. */
export async function attachEgress(turn, start = undefined, tools = networkToolReads(), held = null) {
  const configPath = join(turn.stateDirectory, 'config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const admission = { operations: config.operations, ...(config.effectPolicy === undefined ? {} : { effectPolicy: config.effectPolicy }),
    ...(config.irreversibleTerm === undefined ? {} : { irreversibleTerm: config.irreversibleTerm }) };
  const ca = join(turn.scratch, 'egress-ca.pem'), input = { stateDirectory: turn.privateDirectory ?? turn.stateDirectory, caPath: ca, admission,
    ...(held ? { held } : {}) };
  const proxy = start ? await start(input) : await startEgressProxy(input);
  try {
    mkdirSync(turn.home, { recursive: true, mode: 0o700 });
    // A confined shell (its own sandbox profile) reaches the network only through this checkpoint: its profile now allows
    // exactly the checkpoint's loopback port, reads of the trust root and the network tools, and writes to its HOME.
    if (config.shellProfile) writeFileSync(config.shellProfile, shellSandboxProfile({ workspace: config.workspace, tmp: config.tmp,
      egress: { port: proxy.port, reads: [...tools.reads, ca], writes: [turn.home] } }), { mode: 0o600 });
    writeFileSync(configPath, JSON.stringify({ ...config, egress: { port: proxy.port, ca, home: turn.home, ...(tools.path ? { path: tools.path } : {}),
      ...(tools.developer ? { developer: tools.developer } : {}) } }),
      { mode: 0o600 });
  } catch (error) { await proxy.close(); throw error; }
  return { proxy, egress: { port: proxy.port, reads: tools.reads } };
}

/** The root's MCP configuration, read from `<root>/mcp.json` (the operator's file; absent means no MCP servers):
 * `{"mcpServers": {name: {command, args?, env?, ...}}, "reads": ["mcp__name__tool", ...]}`. A tool the file lists in
 * `reads` is ordinary work; every other MCP tool is a consequential effect for the effect doorway. A malformed file
 * refuses (thrown) rather than guessing. An `env` value is either a plain string, kept as written, or
 * `{"secretRef": "<name>"}`, a credential in the runner's custody vault: the runner resolves it at the turn and hands it to
 * that server alone (`serveTurnSocket`), so the launch configuration holds no SecretRef value. The checkpoint (Rule 100): a
 * credential in a recognised format written literally in a command, an argument or an env value is refused, with the
 * SecretRef form named as the way to give it; an opaque literal (one no pattern recognises) is not detected and is kept
 * in the launch configuration as written.
 * `secrets` maps each server to its env names and the SecretRef names they resolve from. */
export const TOOL_MCP_CONFIG = 'mcp.json';
export function readRootMcp(root, read = path => readFileSync(path, 'utf8')) {
  let text;
  try { text = read(join(root, TOOL_MCP_CONFIG)); } catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
  const data = JSON.parse(text), servers = data?.mcpServers;
  if (!servers || typeof servers !== 'object' || Array.isArray(servers)) throw Error('preview: root MCP configuration has no mcpServers object');
  const names = Object.keys(servers);
  if (!names.length) return null;
  if (!names.every(name => /^[A-Za-z0-9_-]{1,64}$/u.test(name) && servers[name] && typeof servers[name].command === 'string'))
    throw Error('preview: root MCP server names must be plain and each must name a command');
  const literal = text => typeof text === 'string' && credentialSpans(text).length > 0;
  const secrets = {};
  for (const name of names) {
    const server = servers[name], args = server.args ?? [], env = server.env ?? {};
    if (!Array.isArray(args) || !args.every(arg => typeof arg === 'string')) throw Error(`preview: root MCP server ${name} args must be strings`);
    if (!env || typeof env !== 'object' || Array.isArray(env)) throw Error(`preview: root MCP server ${name} env must be an object`);
    secrets[name] = {};
    for (const [key, value] of Object.entries(env)) {
      if (typeof value === 'string') { if (literal(value)) throw Error(`preview: root MCP server ${name} env ${key} holds a credential literally; give it as {"secretRef": "<name>"}`); continue; }
      if (!value || typeof value !== 'object' || Object.keys(value).length !== 1 || typeof value.secretRef !== 'string' || !/^[A-Za-z0-9_.-]{1,128}$/u.test(value.secretRef))
        throw Error(`preview: root MCP server ${name} env ${key} must be a string or {"secretRef": "<name>"}`);
      secrets[name][key] = value.secretRef;
    }
    if ([server.command, ...args].some(literal))
      throw Error(`preview: root MCP server ${name} holds a credential literally in its command or args; give it as an env {"secretRef": "<name>"}`);
  }
  const reads = data.reads ?? [];
  if (!Array.isArray(reads) || !reads.every(tool => typeof tool === 'string' && names.some(name => tool.startsWith(`mcp__${name}__`))))
    throw Error('preview: root MCP reads must name tools of the configured servers');
  return { servers, reads, secrets, digest: `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}` };
}

/** Plan #507 (Rules 4, 95, 100): the runner's held secret values, every value once read kept for the runner's life.
 * `sources` maps a name to a reader returning that source's current values; a reader that throws makes the source
 * unavailable now (custody that cannot be read), which is not the same as a source that read and holds nothing (an
 * established absence). Returns a function giving `{ values, unavailable }`: every value ever read, and why a source
 * cannot be read now (null when every source read). Values already held are never dropped when a source later changes,
 * empties or becomes unreadable: a credential a context may already hold stays withheld. */
export function createHeldSecrets(sources) {
  const kept = new Set();
  return () => {
    const failing = [];
    for (const [name, read] of Object.entries(sources)) {
      try { for (const value of read()) if (typeof value === 'string' && value.length > 0) kept.add(value); }
      catch (error) { failing.push(`${name}: ${String(error?.message ?? error)}`); }
    }
    return { values: [...kept], unavailable: failing.length ? failing.join('; ') : null };
  };
}
/** Plan #507 (Rule 95): the held-set readers over the runner's custody (`custody`, createSecretCustody) — `vault`, every
 * registered preview-vault credential, and `mcp`, every credential the root's MCP servers reference (`mcpSecrets()`, server
 * name to env name to secret name). A credential that cannot be resolved now throws, so its source reads unavailable and
 * every outward request refuses: custody that cannot be opened is not an established absence, since a context kept from an
 * earlier runner may still hold the value. No registered or referenced credential reads as an established absence. */
export function custodyHeldSources(custody, mcpSecrets) {
  const ref = name => ({ type: 'SecretRef', schemaVersion: 1, vault: 'preview', name });
  return {
    vault: () => custody.records().flatMap(record => record.custody === 'preview-vault' ? [custody.resolve(ref(record.name))] : []),
    mcp: () => Object.values(mcpSecrets()).flatMap(refs => Object.values(refs).map(name => custody.resolve(ref(name)))),
  };
}
/** The held-secret check one outward request asks before it is dispatched (the admission hook through the turn socket or
 * the host checkpoint, and the shell's network checkpoint): `held` when `text` carries a held value in any recognised form
 * (reply-check.ts secretMaterialIn, also case-folded), `unavailable` when a held source cannot be read now (Rule 95: this consumer fails
 * closed, its miss being a secret leaving), else `clear`. `extra` adds values held for one turn (its served MCP
 * credentials). A held set that cannot be read at all is unavailable. */
export const heldVerdict = (heldSecrets, extra = []) => text => {
  let state;
  try { state = heldSecrets ? heldSecrets() : { values: [], unavailable: null }; } catch { return 'unavailable'; }
  const values = [...state.values, ...extra], plain = String(text);
  // Also case-folded: a host name is case-insensitive (a lowercased value in a name still reaches a resolver).
  if (secretMaterialIn(plain, values) || secretMaterialIn(plain.toLowerCase(), values.map(value => value.toLowerCase()))) return 'held';
  return state.unavailable === null ? 'clear' : 'unavailable';
};
/** The longest form of any held value, in bytes: how much of a streamed request body the network checkpoint holds back
 * so a value split across two chunks is seen whole before any of it is forwarded. */
export const heldSpan = (heldSecrets, extra = []) => {
  let values;
  try { values = [...(heldSecrets ? heldSecrets().values : []), ...extra]; } catch { values = extra; }
  return values.flatMap(secretForms).reduce((max, form) => Math.max(max, Buffer.byteLength(form, 'utf8')), 0);
};
/** Serves the turn's runner socket: the held-secret check (`check <base64 text>` answers `clear`, `held` or
 * `unavailable`, plan #507), and each SecretRef-bearing MCP server its resolved environment, once, to a launcher
 * presenting that server's name and nonce (Rule 100: the launch configuration holds no SecretRef value). Returns a
 * `close()` that stops serving and removes the socket's directory. */
export async function serveTurnSocket(socket, { nonces = {}, values = {}, shared = false, check = () => 'unavailable' } = {}) {
  const pending = new Map(Object.entries(values));
  const server = createServer({ allowHalfOpen: true }, link => {
    let text = '', over = false;
    link.setEncoding('utf8');
    link.on('data', chunk => { if (text.length + chunk.length > HELD_CHECK_MAX_BYTES * 2) over = true; else text = `${text}${chunk}`; });
    link.on('end', () => {
      const line = text.trim();
      if (line.startsWith('check ')) {
        if (over) { link.end('held'); return; }
        let verdict;
        try { verdict = check(Buffer.from(line.slice(6), 'base64').toString('utf8')); } catch { verdict = 'unavailable'; }
        link.end(verdict === 'clear' || verdict === 'held' ? verdict : 'unavailable');
        return;
      }
      const [name, nonce] = line.slice(0, 512).split(' ');
      const env = pending.get(name);
      if (env && nonces[name] === nonce) { pending.delete(name); link.end(JSON.stringify(env)); } else link.end('');
    });
    link.on('error', () => {});
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(socket, resolve); });
  // The harness's own user connects too (`shared`): the socket is writable by every identity that can reach it, and its
  // directory is traversable only by the runner and that user (harness-user.mjs harnessSocketDirectory).
  if (shared) chmodSync(socket, 0o666);
  return () => new Promise(resolve => server.close(() => { rmSync(dirname(socket), { recursive: true, force: true }); resolve(); }));
}

/** Rewrites the turn's admission record with each served credential value replaced by its SecretRef marker and every
 * recognised credential redacted (`redactText`), so the record a turn leaves holds no value (scrubbed when the turn ends;
 * a tool result may carry one while the turn runs). */
export function scrubAdmissionRecord(stateDirectory, served, redactText) {
  const path = join(stateDirectory, 'admission.jsonl');
  let text;
  try { text = readFileSync(path, 'utf8'); } catch { return; }
  const clean = value => {
    if (typeof value === 'string') {
      let out = value;
      for (const [secret, marker] of served) for (const form of [secret, JSON.stringify(secret).slice(1, -1)]) out = out.split(form).join(marker);
      return redactText(out);
    }
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clean(v)]));
    return value;
  };
  const lines = text.split('\n').filter(line => line.length > 0).map(line => {
    let row; try { row = JSON.parse(line); } catch { return clean(line); }
    return JSON.stringify(clean(row));
  });
  writeFileSync(`${path}.scrub`, lines.length ? `${lines.join('\n')}\n` : '', { mode: 0o600 });
  renameSync(`${path}.scrub`, path);
}

/** The trace of one finished turn, read from the hook's record. An absent record is an empty trace. */
export function readToolTrace(stateDirectory) {
  let text = '';
  try { text = readFileSync(join(stateDirectory, 'admission.jsonl'), 'utf8'); } catch { text = ''; }
  return toolTrace(text.split('\n').filter(line => line.length > 0));
}

/** Bytes the turn left in its workspace (regular files, symlinks not followed, bounded walk). */
export function workspaceBytes(workspace, limit = 10000) {
  let bytes = 0, seen = 0;
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      if (++seen > limit) return;
      const path = join(dir, name), stat = lstatSync(path);
      if (stat.isDirectory()) walk(path); else if (stat.isFile()) bytes += stat.size;
    }
  };
  try { walk(workspace); } catch { return null; }
  return seen > limit ? null : bytes;
}

/** Conversation workspaces a root keeps (Rule 60: with the volume size, the root's whole tool storage). A workspace is kept
 * for the root's life and never deleted to make room (Rule 7): past this count a further conversation's turns each run in a
 * fresh one-turn volume, removed after the turn, without a kept session, and the journal records that overflow. */
export const TOOL_WORKSPACES_DIRECTORY = 'workspaces';
export const TOOL_WORKSPACES_KEPT = 4;
/** The conversation's workspace: `<root>/workspaces/<key>` holding its volume image, the `vol` link and the kept-session
 * record, mounted at the fixed `itw-<key>`. The key is derived from the root's real path and the conversation, so two
 * roots or two conversations never share a workspace. Null when the root already keeps its bound of other workspaces. */
export function conversationWorkspace(root, conversation, keep = TOOL_WORKSPACES_KEPT) {
  if (typeof conversation !== 'string' || !conversation.length) throw Error('preview: tool workspace needs its conversation');
  const real = realpathSync(root);
  const key = createHash('sha256').update(`${real}\0${conversation}`, 'utf8').digest('hex').slice(0, 12);
  const base = join(real, TOOL_WORKSPACES_DIRECTORY), directory = join(base, key);
  if (!existsSync(directory)) {
    let kept = [];
    try { kept = readdirSync(base).filter(name => /^[0-9a-f]{12}$/u.test(name)); } catch { kept = []; }
    if (kept.length >= keep) return { key, directory: null, name: null };
    mkdirSync(directory, { recursive: true, mode: 0o700 });
  }
  return { key, directory, name: `itw-${key}` };
}

/** The journal's forgotten and corrected clauses (Rule 33: the journal is the authority on what the agent knows): the
 * quote of every `forget` and `correct` memory change, those under four characters excluded so a stray word is never
 * stripped from unrelated notes. A kept workspace must not hand back what the journal no longer holds. */
export const forgottenQuotes = view => [...new Set((view.memory ?? []).filter(change => change.mode === 'forget' || change.mode === 'correct')
  .map(change => String(change.quote).trim()).filter(quote => quote.length >= 4))].sort();
const VOLUME_MARK = 'kept.json';
/** The note a replacement workspace carries, so the turn that finds it is told plainly what was lost (constraint 2). */
export const WORKSPACE_LOST_NOTE = 'WORKSPACE-LOST.txt';
/** The note a kept workspace carries while its last reconciliation could not finish, naming what still may disagree with
 * the journal; removed once a pass completes. */
export const WORKSPACE_STALE_NOTE = 'WORKSPACE-STALE.txt';
/** How many held files a note names (each name clipped), so the note, which is also delivered in the turn's input, stays
 * within its bound (NOTICE_TEXT_MAX). */
const STALE_NAMED = 16;
/** A held file's name can itself hold a forgotten clause, so the note masks every forgotten quote in the names it gives
 * (the accurate paths stay in the mark only); the agent still finds the file by the rest of its name. */
const FORGOTTEN_MASK = '[forgotten]';
const named = (paths, quotes) => `${paths.slice(0, STALE_NAMED)
  .map(path => quotes.reduce((name, quote) => quote.length ? name.split(quote).join(FORGOTTEN_MASK) : name, path))
  .map(path => path.length > 96 ? `${path.slice(0, 93)}...` : path).join(', ')}`
  + `${paths.length > STALE_NAMED ? ` and ${String(paths.length - STALE_NAMED)} more` : ''}`;
/** The room a turn's packet keeps for the workspace notice delivered with it (the stale and lost notes, both bounded): the
 * notice's own text is held to three quarters of it, the rest covers its escaping inside the packet's JSON. */
export const TOOL_NOTICE_MAX_BYTES = 4096;
const NOTICE_TEXT_MAX = 3072;
const strip = (buffer, needle) => {
  const parts = []; let from = 0, at;
  while ((at = buffer.indexOf(needle, from)) >= 0) { parts.push(buffer.subarray(from, at)); from = at + needle.length; }
  if (!parts.length) return null;
  parts.push(buffer.subarray(from));
  return Buffer.concat(parts);
};
const UTF8 = new TextDecoder('utf-8', { fatal: true });
/** The formats whose every byte is prose, so removing a clause leaves a valid file of the same format: a plain note or a
 * Markdown file, by its name, that is valid UTF-8 without a NUL byte. Any other file (JSON, code, an archive, a database)
 * has structure a splice can break, so it is kept intact and named to the agent, which rewrites it with its own tools. */
export const PROSE_EXTENSIONS = Object.freeze(['.txt', '.text', '.md', '.markdown']);
const prose = (path, buffer) => {
  if (!PROSE_EXTENSIONS.some(extension => path.toLowerCase().endsWith(extension)) || buffer.includes(0)) return false;
  try { UTF8.decode(buffer); return true; } catch { return false; }
};
/** Whether `a` comes after `b` in the walk's order (component by component; a directory before what it holds). */
const after = (a, b) => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] > b[i];
  return a.length > b.length;
};
const prefixOf = (a, b) => a.length < b.length && a.every((part, i) => part === b[i]);
/** Writes a file in place, keeping its mode: a read-only file the agent left is made writable for the edit only. */
function rewrite(path, data, mode) {
  try { writeFileSync(path, data); return; } catch (error) { if (error?.code !== 'EACCES' && error?.code !== 'EPERM') throw error; }
  chmodSync(path, mode | 0o200);
  try { writeFileSync(path, data); } finally { chmodSync(path, mode); }
}
/**
 * Removes every forgotten or corrected clause from the prose regular files under `dirs` (symlinks not followed);
 * files without one are left byte-for-byte. The walk visits at most `limit` entries, starting after `from` (a position a
 * bounded earlier pass stopped at), so a large workspace is covered over several passes. Returns the files changed,
 * the files still holding a clause (unreadable, unwritable, or not prose: kept intact, never half-edited), and
 * `cursor`: where the walk stopped at its bound, or null when it reached the end.
 */
export function removeForgotten(dirs, quotes, limit = 10000, from = null) {
  const needles = quotes.map(quote => Buffer.from(quote, 'utf8'));
  let changed = 0, seen = 0, stopped = false, cursor = null, last = null;
  const held = [];
  const visit = (path, stat) => {
    let original;
    try { original = readFileSync(path); } catch { held.push(path); return; }
    let next = original;
    for (const needle of needles) next = strip(next, needle) ?? next;
    if (next === original) return;
    if (!prose(path, original)) { held.push(path); return; }
    try { rewrite(path, next, stat.mode & 0o7777); changed++; } catch { held.push(path); }
  };
  const walk = (dir, position) => {
    let names;
    try { names = readdirSync(dir).sort(); } catch { held.push(dir); return; }
    for (const name of names) {
      if (stopped) return;
      const child = [...position, name];
      if (from !== null && !prefixOf(child, from) && !after(child, from)) continue;
      if (++seen > limit) { stopped = true; cursor = last ?? from ?? []; return; }
      last = child;
      const path = join(dir, name);
      let stat;
      try { stat = lstatSync(path); } catch { held.push(path); continue; }
      if (stat.isDirectory()) walk(path, child);
      else if (stat.isFile()) visit(path, stat);
    }
  };
  dirs.forEach((dir, index) => { if (!stopped) walk(dir, [index]); });
  return { changed, held, cursor };
}
/** Reconciles a mounted kept workspace with the journal before any tool of the turn can read it. `used` says whether the
 * journal records an earlier turn in this workspace: then a volume without its mark and with an empty workspace is a lost
 * volume (its image gone), not a first allocation, and the replacement carries a note saying so. Whenever the journal's
 * forgotten clauses changed since the volume last completed a pass over them, a pass removes them from its files. The
 * mark records them as reconciled only when a whole walk (possibly over several bounded passes) left no file holding
 * one; until then every turn repeats the check, and the workspace carries a note naming what may still disagree. */
export function reconcileWorkspace({ mounted, workspace, tmp, used, quotes, limit = 10000 }) {
  const mark = join(mounted, VOLUME_MARK);
  let recorded = null;
  try { recorded = JSON.parse(readFileSync(mark, 'utf8')); } catch { recorded = null; }
  const lost = used && recorded === null && readdirSync(workspace).length === 0;
  const forgotten = digestOf(JSON.stringify(quotes));
  let reconciled = 0, held = [], unchecked = false, pending = null, done = recorded?.forgotten ?? null;
  if (recorded?.forgotten === forgotten || !quotes.length) done = forgotten;
  else {
    const prior = recorded?.pending?.digest === forgotten && Array.isArray(recorded.pending.cursor) ? recorded.pending : null;
    const pass = removeForgotten([workspace, tmp], quotes, limit, prior?.cursor ?? null);
    reconciled = pass.changed; unchecked = pass.cursor !== null;
    // The files an earlier bounded pass of this same walk held stay named until the walk completes clean.
    const earlier = Array.isArray(prior?.held) ? prior.held.filter(path => typeof path === 'string') : [];
    held = [...new Set([...earlier, ...pass.held.map(path => relative(mounted, path))])];
    const clean = (prior ? prior.clean === true : true) && !held.length;
    // A walk that reached the end clean completes the forget; one that held a file starts over next turn.
    if (unchecked) pending = { digest: forgotten, cursor: pass.cursor, clean, held: held.slice(0, STALE_NAMED) };
    else if (clean) done = forgotten;
  }
  const note = join(workspace, WORKSPACE_STALE_NOTE);
  if (held.length || unchecked) writeFileSync(note, 'Some of this workspace may still disagree with this conversation\'s memory: it has '
    + 'since forgotten or corrected statements these files may still hold. The memory is the authority; do not rely on them '
    + 'for anything it no longer holds, and rewrite them without it if you use them. The check repeats every turn until it '
    + `completes.\n${held.length ? `Files that still hold such a statement and were not changed automatically (kept intact): ${named(held, quotes)}\n` : ''}`
    + `${unchecked ? 'Part of the workspace has not been checked yet (past this turn\'s bound); the next turn continues.\n' : ''}`, { mode: 0o600 });
  else rmSync(note, { force: true });
  if (lost) writeFileSync(join(workspace, WORKSPACE_LOST_NOTE), 'This conversation\'s earlier workspace was lost: its volume was '
    + `missing when this turn started. Files written on earlier turns are gone; this workspace started empty. `
    + 'The conversation\'s journal still holds every answer and tool trace.\n', { mode: 0o600 });
  writeFileSync(mark, JSON.stringify({ v: 1, forgotten: done, ...(pending ? { pending } : {}) }), { mode: 0o600 });
  return { lost, reconciled, ...(held.length ? { held: held.length } : {}), ...(unchecked ? { unchecked } : {}) };
}
/** What the turn's input carries about its workspace (Rules 33, 84): the stale note while reconciliation is unfinished and
 * the lost note on the turn that found the loss, so the agent is told, not left to discover a file. Empty when neither. */
export function workspaceNotice(workspace, volume) {
  const read = name => { try { return readFileSync(join(workspace, name), 'utf8'); } catch { return ''; } };
  const parts = [...(volume.held || volume.unchecked ? [read(WORKSPACE_STALE_NOTE)] : []), ...(volume.lost ? [read(WORKSPACE_LOST_NOTE)] : [])]
    .filter(text => text.length);
  if (!parts.length) return '';
  const text = `Workspace notice (from this conversation's kept workspace, before this turn):\n${parts.join('')}`;
  return Buffer.byteLength(text) > NOTICE_TEXT_MAX ? `${Buffer.from(text).subarray(0, NOTICE_TEXT_MAX - 4).toString('utf8').replace(/\uFFFD$/u, '')}...\n` : text;
}

/** The kept harness session (MF5): a disposable cache of one conversation's harness context, subordinate to the journal.
 * It is resumed only while it is bound to the same tools authority, harness and model, and the journal's facts it may
 * hold are unchanged; any correction, forgetting, undo, closure, grant change or stop rotates it, as do its bounds, a
 * compaction, a lost transcript, and any turn that did not end cleanly. Every turn is still grounded by the full current
 * journal packet; the session is never the only copy of accepted work (the journal holds every answer and tool trace). */
export const TOOL_SESSION_LIMITS = Object.freeze({ maxTurns: 6, maxTranscriptBytes: 512 * 1024 });
const SESSION_FILE = 'session.json';
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const digestOf = text => `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
const plain = (_key, value) => value instanceof Map ? [...value.entries()] : value instanceof Set ? [...value] : value;
/** The journal facts a kept session may hold: memory changes and their undos, dated items, people, commitments and
 * their closures, directives and blockers, conflicts, grants and authorities (reminders, summaries, caps, expiry,
 * operator requests and their verdicts) and the stop. A change to any of them rotates the session. */
export function sessionFactsDigest(view) {
  return digestOf(JSON.stringify({ memory: view.memory, dated: view.dated, changes: view.changeHistory, undos: view.undos,
    people: view.people, attributes: view.personAttributes, merges: view.personMerges, commitments: view.commitments, closed: view.closed,
    directives: view.directives, blockers: view.blockers, conflicts: view.conflicts, reminderGrant: view.reminderGrant,
    reminderCancels: view.reminderCancels, summaryGrants: view.summaryGrants, requests: view.operatorRequests,
    caps: [view.limits, view.capAuthority], expiry: [view.expires, view.expiryAuthority], stop: view.stop, sourceStop: view.sourceStop }, plain));
}
/** Where the harness keeps a session's transcript: `<config>/projects/<cwd with every non-alphanumeric as ->/<id>.jsonl`
 * (Claude Code 2.1.280, observed). Its subagents' transcripts sit in `<id>/` beside it. */
export const sessionTranscript = (store, workspace, id) => join(store, workspace.replace(/[^A-Za-z0-9]/gu, '-'), `${id}.jsonl`);
/** Removes one kept session's harness files, and only those: the transcript and its subagent directory, by exact id. */
export function removeSessionFiles(store, workspace, id) {
  if (typeof store !== 'string' || typeof workspace !== 'string' || !SESSION_ID.test(String(id))) return false;
  const transcript = sessionTranscript(store, workspace, id);
  rmSync(transcript, { force: true });
  rmSync(transcript.slice(0, -'.jsonl'.length), { recursive: true, force: true });
  return true;
}
/** Removes every harness session file of one workspace's projects directory (UUID-named transcripts and their subagent
 * directories, nothing else). The workspace path is the conversation's own (`itw-<key>`), so these are exactly its kept
 * sessions; used when a new session starts, so a session whose record was lost is never stranded outside retention. */
export function removeWorkspaceSessions(store, workspace) {
  if (typeof store !== 'string' || typeof workspace !== 'string') return 0;
  const directory = dirname(sessionTranscript(store, workspace, 'x'));
  let names;
  try { names = readdirSync(directory); } catch { return 0; }
  let removed = 0;
  for (const name of names) {
    const id = name.endsWith('.jsonl') ? name.slice(0, -'.jsonl'.length) : name;
    if (SESSION_ID.test(id)) { rmSync(join(directory, name), { recursive: true, force: true }); removed++; }
  }
  return removed;
}
/** The kept-session record of a workspace: `present` (with its value), `absent`, or `unreadable` (treated as lost). */
export function readSession(dir) {
  let text;
  try { text = readFileSync(join(dir, SESSION_FILE), 'utf8'); } catch (error) { return error?.code === 'ENOENT' ? { state: 'absent' } : { state: 'unreadable' }; }
  try {
    const value = JSON.parse(text);
    return value?.v === 1 && SESSION_ID.test(value.id) && typeof value.binding === 'string' && typeof value.facts === 'string'
      && typeof value.workspace === 'string' && Number.isSafeInteger(value.turns) ? { state: 'present', value } : { state: 'unreadable' };
  } catch { return { state: 'unreadable' }; }
}
function writeSession(dir, value) {
  const path = join(dir, SESSION_FILE), temporary = `${path}.${randomBytes(4).toString('hex')}.pending`;
  writeFileSync(temporary, JSON.stringify(value), { mode: 0o600 });
  renameSync(temporary, path);
}
/** What this turn does with the conversation's kept session: resume it, or start a new one with the reason the old one
 * (if any) was not resumed. Pure apart from the transcript reads, which are bounded by the size limit. */
export function planSession({ record, binding, facts, store, workspace, stat = path => statSync(path).size,
  read = path => readFileSync(path, 'utf8'), newId = randomUUID, volumeLost = false }) {
  const fresh = (reason, previous = null) => ({ id: newId(), resume: false, reason, turn: 1, previous });
  // A session is never resumed against a replacement of the workspace it worked in.
  if (volumeLost) return fresh('lost: the workspace volume is missing', record.state === 'present' ? record.value : null);
  if (record.state === 'absent') return fresh('new');
  if (record.state === 'unreadable') return fresh('lost: the session record is unreadable');
  const r = record.value, previous = r;
  if (r.ended) return fresh(r.ended, previous);
  if (r.open) return fresh('interrupted: the last turn did not settle', previous);
  if (r.binding !== binding || r.workspace !== workspace) return fresh('authority, harness or model changed', previous);
  if (r.facts !== facts) return fresh('the journal changed a fact', previous);
  if (r.turns >= TOOL_SESSION_LIMITS.maxTurns) return fresh('turn bound', previous);
  let size;
  try { size = stat(sessionTranscript(store, workspace, r.id)); } catch { return fresh('lost: the transcript is missing', previous); }
  if (size >= TOOL_SESSION_LIMITS.maxTranscriptBytes) return fresh('size bound', previous);
  let text;
  try { text = read(sessionTranscript(store, workspace, r.id)); } catch { return fresh('lost: the transcript is unreadable', previous); }
  if (text.includes('"compact_boundary"')) return fresh('compacted', previous);
  return { id: r.id, resume: true, reason: 'resumed', turn: r.turns + 1, previous: null };
}

/** The directory names of the turns the journal still holds open (reserved, no trace yet): running now, or interrupted. */
export const openToolTurnSlugs = view => new Set((view.toolTurns?.open ?? []).map(key => {
  const at = key.lastIndexOf('#'); return toolTurnSlug(key.slice(0, at), Number(key.slice(at + 1)));
}));
/** Keeps the newest `keep` turn directories (by modification time); a failed removal is reported, not thrown.
 * A volume left mounted (a turn interrupted by a crash) is unmounted first; one that will not unmount is kept.
 * A directory in `open` (a turn the journal has no trace for yet) is never removed: its hook record is the only
 * evidence of what that turn admitted and which subagents it started, until `reconcileToolTurns` journals it. */
export function pruneToolTurns(root, keep = TOOL_TURNS_KEPT, detach = detachScratch, open = new Set(), stateBase = undefined) {
  const base = join(root, TOOL_TURNS_DIRECTORY);
  let names;
  try { names = readdirSync(base); } catch { return { removed: 0, failed: 0 }; }
  const dirs = names.filter(name => !open.has(name)).map(name => ({ name, at: lstatSync(join(base, name)).mtimeMs })).sort((a, b) => b.at - a.at);
  let removed = 0, failed = 0;
  for (const { name } of dirs.slice(keep)) {
    try {
      if (!detach(join(base, name))) { failed++; continue; }
      // A harness-user turn's admission state lives in the harness area; it goes with its turn.
      removeHarnessState(join(base, name, 'state'), stateBase);
      rmSync(join(base, name), { recursive: true, force: true }); removed++;
    } catch { failed++; }
  }
  return { removed, failed };
}

/** The journal row recording a turn's trace (its admitted calls and Rule 114 child edges). `ended` is the state of an
 * edge with no returned result: `cancelled` when the operator's stop or a withdrawal ended it, else `unknown`. `extra`
 * carries the kept workspace's `volume` and `session` facts (w4-persist), when the turn had them. */
function traceRow({ id, attempt, trace, egress, authority, ended, redactText, workspace, at, extra = {} }) {
  return { kind: 'tool-turn', phase: 'trace', id, attempt, consistent: trace.consistent,
    // The shell's network checkpoint: every request it decided (a CONNECT opens a tunnel; each request in it is its own row).
    ...(egress && (egress.requests.length || egress.limited) ? { egress: egress.requests.slice(0, TOOL_EGRESS_RECORDED).map(entry => ({ ...entry,
      path: redactText(entry.path), reason: redactText(entry.reason), ...(entry.error ? { error: redactText(entry.error) } : {}) })),
    egressRequests: egress.requests.length, ...(egress.limited ? { egressLimited: egress.limited } : {}) } : {}),
    calls: trace.calls.slice(0, 64).map(call => ({ ...call, input: redactText(call.input),
      result: call.result === null ? null : redactText(call.result) })),
    // `parent` is the turn that owns the edge and its reservation; `parentAgent` the subagent that started it (null: the turn).
    edges: trace.children.slice(0, SUBSCRIPTION_TOOL_LIMITS.maxChildren).map(edge => ({ child: edge.toolUse, agent: edge.agent,
      parent: `${id}#${String(attempt)}`, parentAgent: edge.parentAgent ?? null, authority, budget: { modelTurns: SUBSCRIPTION_TOOL_LIMITS.childMaxTurns,
        toolCalls: `shared ${String(SUBSCRIPTION_TOOL_LIMITS.maxToolCalls)} per turn` },
      exitTest: 'returns its final message as the subagent tool result', placement: 'in the turn\'s harness process on this machine',
      transport: 'claude-code Agent tool',
      resultDestination: edge.parentAgent ? `the tool result of subagent ${edge.parentAgent}` : 'the parent turn\'s tool result', cancellation: 'ends with the turn\'s process group',
      state: edge.state === 'returned' ? 'returned' : ended, result: edge.result === null ? null : redactText(edge.result) })),
    workspaceBytes: workspace === null ? null : workspaceBytes(workspace), ...extra, at };
}

/** Rule 114 recovery, run at launch before any tool turn starts (the process owner makes this runner the root's only
 * one, so no open turn is still running): each turn the journal holds open whose directory survives an interrupted run
 * gets its trace journaled from the hook's synced record, under the authority its admission config recorded, with every
 * child that did not return marked `unknown` (its outcome was never observed; nothing is re-run). A turn with no
 * surviving directory stays open (its outcome unknown, as status says). A kept session such a turn left `open` is
 * rotated by the next turn as interrupted (planSession). Returns the keys it closed. */
export function reconcileToolTurns({ journal, root, redactText, now }) {
  const closed = [];
  for (const key of [...(journal.view.toolTurns?.open ?? [])]) {
    const at = key.lastIndexOf('#'), id = key.slice(0, at), attempt = Number(key.slice(at + 1));
    const stateDirectory = join(root, TOOL_TURNS_DIRECTORY, toolTurnSlug(id, attempt), 'state');
    let config;
    try { config = JSON.parse(readFileSync(join(stateDirectory, 'config.json'), 'utf8')); } catch { continue; }
    const authority = typeof config?.authority === 'string' && config.authority ? config.authority : 'unrecorded';
    const own = join(root, TOOL_TURNS_DIRECTORY, toolTurnSlug(id, attempt), TOOL_TURN_PRIVATE);
    journal.append(traceRow({ id, attempt, trace: readToolTrace(stateDirectory), egress: readEgressRecord(existsSync(own) ? own : stateDirectory), authority,
      ended: 'unknown', redactText, workspace: null, at: now() }));
    closed.push(key);
  }
  return closed;
}

/**
 * One tool turn, as the runner runs it (Part Thirteen §9, docs/17-harness-adapters). Its whole liability, every model turn the policy
 * allows beyond the answer's own reserved attempt, is reserved against the operator's call cap before
 * dispatch and retained (MF4). A short allowance, or a packet the longer tool system prompt would overflow,
 * answers this turn without tools (`fallback`), recorded. The reservation is durable before anything is
 * allocated or launched, so a crash leaves it open and visible. The hook's trace is journaled after the
 * turn whatever its outcome; a tool result with no admitted call before it (a tool that ran past the hook)
 * refuses the answer instead of trusting it. `invoke(toolTurn, notice)` runs the admitted route with the workspace notice; `redactText` scrubs
 * recorded excerpts.
 */
/** Whether the call allowance holds a tool turn's whole liability. The packet that names the tools and the turn's own
 * reservation use this one predicate, so an answer is told it has tools only when its turn will run with them. The packet
 * is prepared before its base call is reserved, so it passes that call as `unreserved`; dispatch runs after it. */
export const toolTurnFits = (view, unreserved = 0) => view.calls + unreserved + SUBSCRIPTION_TOOL_LIMITS.maxTurns - 1 <= view.limits.maxCalls;
/** The packet's side of `toolTurnFits`: its own base call is not reserved yet when it is prepared. */
export const toolPacketFits = view => toolTurnFits(view, 1);
/** How many subagents the allowance holds (Rule 114 budget share): each reserves its whole `childMaxTurns` before dispatch,
 * taken only from allowance beyond this turn's own liability AND one further plain tool turn (its base call and its
 * liability), so a subagent budget never costs the next answer (a format re-ask, a replacement, the next message) its
 * tools. Zero means the turn runs with tools but the hook refuses Agent for budget. */
export const toolChildrenFit = (view, unreserved = 0) => Math.max(0, Math.min(SUBSCRIPTION_TOOL_LIMITS.maxChildren,
  Math.floor((view.limits.maxCalls - view.calls - unreserved - 2 * (SUBSCRIPTION_TOOL_LIMITS.maxTurns - 1) - 1)
    / SUBSCRIPTION_TOOL_LIMITS.childMaxTurns)));

/**
 * One tool turn. `authority` names the activation the tools run under (its reference and tools policy digest); each
 * subagent edge carries it. `mcp` is `readRootMcp(root)`; `resolveSecret(name)` opens a SecretRef its servers name from the
 * runner's custody (a server's credential that cannot be opened refuses the tool turn). `stopped()` reports whether the operator's stop or a withdrawal
 * ended the turn, so an edge without a result is recorded `cancelled` (else `unknown`).
 */
export async function runToolTurn(options) {
  const { journal, root, id, prepared, promptLimit, deniedRoots, operations, effectPolicy, irreversibleTerm, invoke,
  fallback, now, redactText, authority = 'unrecorded', mcp = null, resolveSecret = null, stopped = () => false, scratch = attachScratch, detach = detachScratch, unmount = unmountScratch,
  conversation = `${String(journal.view.genesis?.bot)}:${String(journal.view.genesis?.chat)}`, session = null,
  completed = result => result?.state === 'complete', egress = undefined, networkTools = networkToolReads,
  system = SUBSCRIPTION_TOOLS_SYSTEM_PROMPT, admission = CLAUDE_TOOL_ADMISSION, gate = null, owner = 'this machine', harness = null, heldSecrets = null,
  recoveringResume = false } = options;
  const extra = SUBSCRIPTION_TOOL_LIMITS.maxTurns - 1;
  const refuse = reason => { journal.append({ kind: 'tool-turn', phase: 'refused', id, reason, at: now() }); return fallback(); };
  // Plan #473: a Claude Code turn with no harness user (`{ready: false, refused: true, reason}`, journal-agent.mjs
  // identityRefusalOf) is refused and answered text only, never run as the operator's account.
  if (!admission.harness && harness?.refused === true) return refuse('harness identity unavailable');
  // Any other harness user that is not ready never runs a turn, nor lets one fall back to the runner's own account.
  if (harness && harness.ready !== true) throw Error(`preview: the harness identity is unavailable (${String(harness.reason ?? 'not ready')})`);
  // A recovery needs its own base call too; only the first base was reserved by the worker.
  if (!toolTurnFits(journal.view, recoveringResume ? 1 : 0)) return refuse('call cap');
  if (Buffer.byteLength(prepared) + Buffer.byteLength(system) + TOOL_NOTICE_MAX_BYTES > promptLimit) return refuse('prompt size');
  // Rule 100: a server's SecretRefs are opened from custody before anything is reserved; held in memory only.
  const mcpValues = {}, served = [];
  try {
    for (const [server, refs] of Object.entries(mcp?.secrets ?? {})) {
      if (!Object.keys(refs).length) continue;
      mcpValues[server] = Object.fromEntries(Object.entries(refs).map(([key, ref]) => {
        const secret = resolveSecret(ref);
        if (typeof secret !== 'string' || !secret) throw Error('empty');
        served.push([secret, `[credential: SecretRef preview/${ref}]`]);
        return [key, secret];
      }));
    }
  } catch { return refuse('mcp credential unavailable'); }
  const attempt = journal.view.toolTurns?.invocations ?? 0;
  // A checkpointed harness's subagents spend from the turn's one allowance at the checkpoint (every model call of the
  // tree passes it), so no separate subagent budget is reserved for it.
  const children = admission.harness ? 0 : toolChildrenFit(journal.view, recoveringResume ? 1 : 0);
  // Rule 60: the conversation's kept workspace, or (past the root's bound) a fresh one-turn volume and no kept session.
  const space = conversationWorkspace(root, conversation);
  const kept = space.directory !== null;
  // The facts the kept session may be grounded with are read now, before the turn's own answer changes any of them.
  const facts = session && kept ? sessionFactsDigest(journal.view) : null;
  // Whether the journal records an earlier turn in this workspace (read before this turn's own reservation adds it), and
  // the clauses it has forgotten or corrected, which the workspace must not keep handing back.
  const used = kept && (journal.view.toolTurns?.workspaces ?? []).includes(space.key);
  const quotes = kept ? forgottenQuotes(journal.view) : [];
  // Rule 114: the edge's authority and budget share are durable before dispatch, with the turn's whole liability.
  journal.append({ kind: 'tool-turn', phase: 'reserved', id, attempt, calls: extra + children * SUBSCRIPTION_TOOL_LIMITS.childMaxTurns + (recoveringResume ? 1 : 0),
    delegation: { children, turnsEach: SUBSCRIPTION_TOOL_LIMITS.childMaxTurns, type: SUBSCRIPTION_SUBAGENT_TYPE, authority },
    ...(mcp ? { mcp: { servers: Object.keys(mcp.servers), reads: mcp.reads.length, digest: mcp.digest } } : {}),
    workspace: { key: space.key, kept }, at: now() });
  let turn = null, result, failure = null, plan = null, volume = null, notice = '', closeSecrets = null, checkpoint = null, claim = null, gated = null;
  try {
    // A harness with no model-call limit of its own runs only through the checkpoint: no checkpoint, no tool turn.
    if (admission.harness && !gate) throw Error('preview: this tool turn needs the host admission checkpoint');
    if (admission.harness) claim = `tool-turn-${createHash('sha256').update(id, 'utf8').digest('hex').slice(0, 16)}-${String(attempt)}`;
    turn = prepareToolTurn({ root, operation: id, attempt, operations, effectPolicy, irreversibleTerm, children, mcp, scratch,
      volume: kept ? space : null, authority, admission, ...(claim ? { gate: gate.base(claim) } : {}),
      ...(harness ? { harness: { user: harness.user, runner: harness.runner, hookScript: harness.hookScript,
        rootState: harnessRootState(root, harness.user) } } : {}) });
    if (claim) {
      // The turn's own edge: the parent its delegations hang from (its durable record is the journal's reserved row).
      const openedAt = now();
      gate.open(claim, { framework: 'codex-cli', allowance: SUBSCRIPTION_TOOL_LIMITS.maxTurns, edge: { type: 'SessionWorkEdge', schemaVersion: 1,
        id: `tool-turn:${id}:${attempt}`, parent: id, child: `tool-turn:${id}`, scope: turn.workspace, owner, authority: 'the reviewed tools activation',
        budget: { steps: 1, deadline: openedAt + SUBSCRIPTION_TOOL_LIMITS.timeout, maxResultBytes: 16384, calls: SUBSCRIPTION_TOOL_LIMITS.maxTurns, tokens: null },
        exitTest: 'the turn returned one admitted answer', placement: `machine:${owner}`, transport: 'codex exec on this machine',
        resultDestination: `answer of ${id}`, openedAt } });
    }
    if (kept) {
      volume = reconcileWorkspace({ mounted: turn.scratch, workspace: turn.workspace, tmp: join(turn.scratch, 'tmp'), used, quotes });
      notice = workspaceNotice(turn.workspace, volume);
    }
    if (session && kept) {
      // MF5: the session is resumed only when nothing it may hold has changed; otherwise the old one's files go before a
      // new one starts, and the record naming it is written (open) before dispatch, so a crash leaves it `interrupted`.
      const record = readSession(space.directory);
      plan = planSession({ record, binding: `${authority} ${session.harness}`, facts, store: session.store, workspace: turn.workspace,
        volumeLost: volume.lost });
      // Rule 60: a new session removes every earlier one of this workspace, including any whose record was lost.
      if (plan.previous) removeSessionFiles(session.store, plan.previous.workspace, plan.previous.id);
      if (!plan.resume) removeWorkspaceSessions(session.store, turn.workspace);
      writeSession(space.directory, { v: 1, id: plan.id, binding: `${authority} ${session.harness}`, facts, workspace: turn.workspace,
        turns: plan.turn, open: true, at: now() });
    }
    // Plan #507: every outward tool request asks the held-secret check (the turn socket) before it is dispatched, and the
    // shell's network checkpoint runs the same check; the turn's served MCP credentials are held with the runner's own.
    const servedValues = served.map(([secret]) => secret);
    const check = heldVerdict(heldSecrets, servedValues);
    closeSecrets = await serveTurnSocket(turn.socket.path, { nonces: turn.mcp?.nonces ?? {}, values: mcpValues, shared: turn.socket.shared, check });
    // The shell's network checkpoint lives exactly as long as the turn: started here, stopped below whatever the outcome.
    // A confined shell reaches it through its own profile (the one network path it has); the harness's sandbox otherwise.
    const attached = await attachEgress(turn, egress, networkTools(), { check, span: () => heldSpan(heldSecrets, servedValues) });
    checkpoint = attached?.proxy ?? null;
    result = await invoke({ scratch: turn.scratch, workspace: turn.workspace, stateDirectory: turn.stateDirectory, hook: turn.hook, deniedRoots,
      ...(turn.mcp ? { mcp: turn.mcp } : {}), ...(plan ? { session: { id: plan.id, resume: plan.resume } } : {}),
      ...(attached && !admission.confinedShell ? { egress: attached.egress } : {}), ...(claim ? { gate: gate.base(claim) } : {}) }, notice);
  } catch (error) { failure = error; }
  if (checkpoint) await checkpoint.close();
  if (claim) {
    // Nothing the turn left running can dispatch another call; a delegation that never returned settles as uncertain.
    gated = gate.close(claim);
    for (const nested of gated?.openDelegations ?? []) {
      journal.append({ kind: 'session-work', record: nestedSessionWorkClose(nested, 'uncertain', 'the tool turn ended before the delegated agent returned',
        nested.parent, null, now()), at: now() });
      gate.settle(claim, nested.id);
    }
  }
  if (closeSecrets) await closeSecrets();
  else if (turn?.socket) rmSync(dirname(turn.socket.path), { recursive: true, force: true });
  if (turn) scrubAdmissionRecord(turn.stateDirectory, served, redactText);
  const trace = turn ? readToolTrace(turn.stateDirectory) : { calls: [], children: [], consistent: true };
  const egressRecord = turn && checkpoint ? readEgressRecord(turn.privateDirectory) : null;
  const ended = stopped() ? 'cancelled' : 'unknown';
  // A kept session continues only from a turn that ended cleanly; a stop, a withdrawal, a failure or an unproven tool
  // run ends it now (its transcript removed), so nothing it saw outlives the turn that saw it.
  let ending = null;
  if (plan) {
    const why = stopped() ? 'stopped or withdrawn' : failure ? 'the turn failed' : !trace.consistent ? 'a tool ran without its admission record'
      : !completed(result) ? 'the answer did not complete' : null;
    let transcriptBytes = null;
    try { transcriptBytes = statSync(sessionTranscript(session.store, turn.workspace, plan.id)).size; } catch { transcriptBytes = null; }
    ending = why === null && transcriptBytes === null ? 'lost: the harness wrote no transcript' : why;
    try {
      if (ending !== null) removeSessionFiles(session.store, turn.workspace, plan.id);
      writeSession(space.directory, { v: 1, id: plan.id, binding: `${authority} ${session.harness}`, facts, workspace: turn.workspace,
        turns: plan.turn, open: false, ...(ending === null ? {} : { ended: ending }), at: now() });
    } catch { /* an unwritten record leaves the open one: the next turn rotates it as interrupted */ }
    ending = { ended: ending, transcriptBytes };
  }
  journal.append(traceRow({ id, attempt, trace, egress: egressRecord, authority, ended, redactText, workspace: turn ? turn.workspace : null, at: now(),
    extra: { ...(volume ? { volume } : {}),
      // Which identity the harness ran as: its own user (an unavailable one never reaches a turn; launches are held).
      ...(harness ? { harness: { user: harness.user } } : {}),
      ...(plan ? { session: { id: plan.id, mode: plan.resume ? 'resume' : 'new', reason: plan.reason, turn: plan.turn,
        kept: ending.ended === null, ...(ending.ended === null ? {} : { ended: ending.ended }), transcriptBytes: ending.transcriptBytes } } : {}) } }));
  // A kept volume is unmounted between turns, its image (and so its files) staying for the next turn; a one-turn volume
  // goes with its image (a failed unmount is retried by prune).
  if (turn) { if (kept) unmount(space.directory); else detach(turn.directory); }
  pruneToolTurns(root, TOOL_TURNS_KEPT, detach, openToolTurnSlugs(journal.view));
  if (failure) throw failure;
  if (!trace.consistent) throw Error('preview: a tool ran without its admission record');
  // A model call refused at the allowance, or a delegation that never returned: the answer cannot account for the turn.
  if (gated?.refused) throw Error('preview: a model call past the tool turn\'s reserved allowance was refused');
  if (gated && gated.openDelegations.length > 0) throw Error('preview: a delegated agent did not return before the tool turn ended');
  // Proof-room update 46039724: a resumed session was rejected before any model tokens
  // or tools ran. Its ended session is already recorded and removed above. Recover once
  // from the journal through the same admission path, with a fresh whole-turn reservation.
  // Unknown usage, partial work and stops never permit replay. A short allowance keeps
  // the original rejection instead of degrading the requested work to a text-only call.
  if (!recoveringResume && plan?.resume && result?.state === 'rejected'
    && result.usage?.inputComplete === true && result.usage.inputTokens === 0 && result.usage.outputTokens === 0
    && trace.calls.length === 0 && trace.children.length === 0 && !stopped() && toolTurnFits(journal.view, 1)) {
    return runToolTurn({ ...options, recoveringResume: true });
  }
  return { result, turn, trace, session: plan };
}

/** Truthful status lines for the operator's status reply (Rule 84): which tools exist, and what they did.
 * Without a tool activation the briefing already says there are no tools; `off` names why the default did not turn them on.
 * `gated` is a doorway whose harness runs every model call and consequential tool through the host checkpoint. */
export function toolStatusLines(view, enabled, off = null, gated = false) {
  if (!enabled) return off ? [`Tools: off (${off}); answers are text only.`] : [];
  const stats = view.toolTurns ?? { invocations: 0, reservedCalls: 0, refusedCap: 0, toolCalls: 0, toolRefusals: 0, inconsistent: 0, open: [] };
  const sessions = stats.sessions;
  return [gated ? 'Tools: a confined shell and patches in this conversation\'s private workspace, web search, subagents and the login\'s '
      + 'installed MCP tools, every model call and consequential tool through the admission checkpoint.' : `Tools: the harness's full built-in set (${SUBSCRIPTION_TOOL_NAMES.length} tools, each call decided at the admission hook) and the `
      + `root's MCP servers, in this conversation's private workspace (kept between turns, ${String(TOOL_SCRATCH_BYTES / 1048576)} MB); shell `
      + 'sandboxed, its network through the turn\'s checkpoint (reads of public hosts admitted, writes sent to the effect doorway); '
      + 'web reads only; subagents may delegate within the turn\'s budget; consequential effects go through the effect doorway.',
    `Tool turns: ${stats.invocations} run (${stats.reservedCalls} model attempts reserved for them), ${stats.toolCalls} tool calls admitted, `
      + `${stats.toolRefusals} refused, ${stats.refusedCap} turns answered without tools because the call allowance was short`
      + `${stats.children ? `, ${stats.children.started} subagents started (${stats.children.returned} returned, ${stats.children.cancelled} cancelled, ${stats.children.unknown} unknown)` : ''}`
      + `${stats.network ? `, ${stats.network.admitted} shell network reads admitted and ${stats.network.refused} refused at the checkpoint` : ''}`
      + `${stats.refusedPrompt ? `, ${stats.refusedPrompt} because the packet left no room for the tool instructions` : ''}`
      + `${stats.refusedCredential ? `, ${stats.refusedCredential} because an MCP server's stored credential could not be opened` : ''}`
      + `${stats.refusedIdentity ? `, ${stats.refusedIdentity} because the separate harness user was not ready` : ''}`
      + `${stats.inconsistent ? `, ${stats.inconsistent} turns refused because a tool ran without its admission record` : ''}`
      + `${stats.open?.length ? `, ${stats.open.length} without a recorded trace yet (running now, or interrupted with an unknown outcome)` : ''}.`,
    ...(sessions ? [`Kept session: ${sessions.resumed} turns resumed it, ${sessions.fresh} started a new one (${sessions.changed} after the journal `
      + `changed a fact or the authority changed, ${sessions.lost} after a loss or an interrupted turn, ${sessions.bounded} at its size or turn bound); `
      + `${sessions.ended} ended at a stop, withdrawal or failed turn.`] : []),
    ...(stats.overflow ? [`Workspaces: this root keeps ${String(TOOL_WORKSPACES_KEPT)}; ${stats.overflow} turns of further conversations ran in a fresh `
      + 'one-turn workspace without a kept session.'] : []),
    ...(stats.workspacesLost ? [`Workspace lost: ${stats.workspacesLost} turns found this conversation's kept workspace missing; its earlier files are `
      + 'gone and it started again empty (the journal still holds every answer and tool trace).'] : []),
    ...(stats.reconciledFiles ? [`Workspace kept in step with memory: ${stats.reconciledFiles} files had a forgotten or corrected statement removed.`] : []),
    ...(stats.reconcileIncomplete ? [`Workspace check against memory unfinished on ${stats.reconcileIncomplete} turns (files that could not be changed `
      + 'automatically, kept intact, or a part not yet checked); the agent was told which, and the check repeats each turn until it completes.'] : [])];
}
