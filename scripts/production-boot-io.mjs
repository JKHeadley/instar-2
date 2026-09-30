// The fixed Ten physical host. No worker receives these OS ports.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, constants, existsSync, fsyncSync, lstatSync, mkdirSync, openSync,
  readFileSync, readdirSync, realpathSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { homedir, userInfo } from 'node:os';
import { fileURLToPath } from 'node:url';
import { hostResources, limitedFileArgv } from './resource-owner.mjs';

/** The transport child's own bounds: per-process handles, and user-ID process headroom. */
const TRANSPORT_LIMITS = Object.freeze({ handleCount: 256, processCount: 4 });
/** The user ID's current process count plus the transport headroom, or null when it cannot be read.
 * Its subject is the user ID, not the transport's tree: it caps a fork burst, never the tree's size. */
function transportProcessLimit() {
  const uid = typeof process.getuid === 'function' ? process.getuid() : null;
  if (uid === null || uid === 0) return null;
  let count = 0;
  try { count = execFileSync('/bin/ps', ['-U', String(uid), '-o', 'pid='], { encoding: 'utf8', timeout: 2000, env: { PATH: '/usr/bin:/bin' },
    stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(line => line.trim()).length; } catch { count = 0; }
  return count > 0 ? count + TRANSPORT_LIMITS.processCount : null;
}

export const productionStorageIO = Object.freeze({ pid: process.pid,
  probePid: pid => { process.kill(pid, 0); }, join, resolve, closeSync, constants, existsSync,
  fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, rmdirSync,
  unlinkSync, writeFileSync });

export const productionProviderIO = Object.freeze({
  now: () => Date.now(),
  localClockResetAt: (hour, minute, now) => {
    const candidate = new Date(now);
    candidate.setHours(hour, minute, 0, 0);
    if (candidate.getTime() <= now) candidate.setDate(candidate.getDate() + 1);
    return candidate.getTime();
  },
  calendarResetAt: (month, day, hour, minute, zone, now) => {
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: 'numeric',
      day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23', timeZoneName: 'shortOffset' });
    for (let year = new Date(now).getUTCFullYear() - 1; year <= new Date(now).getUTCFullYear() + 1; year++) {
      const wallUtc = Date.UTC(year, month - 1, day, hour, minute);
      const offset = formatter.formatToParts(wallUtc).find(part => part.type === 'timeZoneName')?.value;
      const match = /^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/.exec(offset ?? '');
      if (!match) continue;
      const minutes = (Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0)) * (match[1] === '-' ? -1 : 1);
      const candidate = wallUtc - minutes * 60000;
      const fields = Object.fromEntries(formatter.formatToParts(candidate).map(part => [part.type, part.value]));
      if (candidate > now && Number(fields.year) === year && Number(fields.month) === month
        && Number(fields.day) === day && Number(fields.hour) === hour && Number(fields.minute) === minute)
        return candidate;
    }
    return NaN;
  },
  realpath: realpathSync,
  executableBytes: path => { if (!lstatSync(path).isFile()) throw Error('provider executable missing'); return readFileSync(path); },
  // Every launch passes the host's one resource owner (Rules 60, 61): admission,
  // OS CPU/handle ceilings and observed descendant memory/process ceilings.
  execute: (input, work = 'answer') => hostResources.execute(input, work),
});

/** Unit 3 owns scanning and sealed identity capture. Transfer its private exact
 * original into encrypted root custody before removing the temporary original. */
export function createProductionTelegramIO(root, captures, testEndpoint = null) {
  const directory = join(root, '.telegram-sealed');
  mkdirSync(directory, { mode: 0o700, recursive: true });
  if (realpathSync(directory) !== directory) throw Error('telegram: sealed capture path substituted');
  const launch = input => {
    const request = Buffer.from(JSON.stringify({ method: input.method, body: input.body, timeoutMs: input.timeoutMs,
      captureDirectory: directory, identityBinding: input.identityBinding,
      ...(testEndpoint === null ? {} : { testEndpoint }) })).toString('base64url');
    // A transport child through the same limit shim as every provider launch
    // (Rule 60): kernel-held per-process CPU time and handles, and user-ID process headroom (not a tree
    // bound: see resource-owner.mjs). Its V8 heap is capped through NODE_OPTIONS (argv is unchanged),
    // and its elapsed time and output by the bounds below. Its RSS is not held by any unprivileged
    // kernel limit on this host.
    const env = { PATH: '/usr/bin:/bin', NODE_OPTIONS: '--max-old-space-size=256' };
    // The request stays at argv[1] (the file shim's label), as the recorded transports read it.
    return { env, timeout: input.timeoutMs + 2000, argv: limitedFileArgv({ label: request, executable: process.execPath,
      args: [fileURLToPath(new URL('../src/assembly/telegram-bot-api-bridge.mjs', import.meta.url)), request],
      handles: TRANSPORT_LIMITS.handleCount, cpuSeconds: Math.ceil((input.timeoutMs + 2000) / 1000) + 1,
      processLimit: transportProcessLimit(), env }) };
  };
  const settle = (status, stdout) => {
    if (status !== 0) return { kind: 'uncertain', limitation: 'transport', stage: 'child-exit' };
    try {
      const reply = JSON.parse(stdout);
      if (reply.kind === 'identity') {
        const match = /^capture:telegram:sealed-getMe:([a-f0-9]{64})$/.exec(reply.capture?.reference);
        if (!match) throw Error('sealed identity reference invalid');
        const file = join(directory, `${match[1]}.capture`), bytes = readFileSync(file, 'utf8');
        if (`sha256:${createHash('sha256').update(bytes).digest('hex')}` !== reply.capture.hash
          || !captures.preserve(reply.capture.reference, bytes)
          || captures.read(reply.capture.reference) !== bytes) throw Error('identity custody transfer failed');
        unlinkSync(file); const fd = openSync(directory, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
      }
      return reply;
    } catch { return { kind: 'uncertain', limitation: 'transport', stage: 'sealed-capture' }; }
  };
  const MAX_TRANSPORT_BYTES = 2 * 1024 * 1024;
  return Object.freeze({
    /** Sequential and waited on synchronously: short calls (identity, send, acknowledge). */
    invoke(input, credential) {
      const { env, timeout, argv } = launch(input);
      const child = spawnSync('/bin/sh', argv, { input: credential, encoding: 'utf8', timeout, maxBuffer: MAX_TRANSPORT_BYTES,
        env, stdio: ['pipe', 'pipe', 'ignore'] });
      return settle(child.status, child.stdout);
    },
    /** The same bounded child, awaited without blocking the event loop: the long poll. A synchronous
     * long poll froze every concurrent launch's timers and exit events for its whole wait, so a
     * finished provider preflight was judged timed out (live 2026-09-29, cint-L4). */
    poll(input, credential) {
      const { env, timeout, argv } = launch(input);
      return new Promise(resolve => {
        let child;
        try { child = spawn('/bin/sh', argv, { env, stdio: ['pipe', 'pipe', 'ignore'] }); }
        catch { resolve(settle(null, '')); return; }
        let chunks = [], size = 0, failed = false;
        const fail = () => { failed = true; chunks = []; try { child.kill('SIGKILL'); } catch { /* already gone */ } };
        const timer = setTimeout(fail, timeout);
        child.on('error', () => { clearTimeout(timer); resolve(settle(null, '')); });
        child.stdin.on('error', fail);
        child.stdout.on('data', chunk => { size += chunk.length; if (size > MAX_TRANSPORT_BYTES) fail(); else if (!failed) chunks.push(chunk); });
        child.on('close', code => { clearTimeout(timer); resolve(settle(failed ? null : code, Buffer.concat(chunks).toString('utf8'))); });
        child.stdin.end(credential, 'utf8');
      });
    },
  });
}

/** The worker's physical boundary is the running installed process. Encrypted
 * custody is flushed before the worker independently reads and parses delivery. */
export function createProductionNativeContextIO(captures) {
  const identity = `pid:${process.pid}:start:${Math.floor(performance.timeOrigin)}`;
  const artifact = `sha256:${createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex')}`;
  const current = () => {
    process.kill(process.pid, 0);
    return { identity, artifact };
  };
  return Object.freeze({ current, consume(reference, bytes) {
    current();
    if (captures.read(reference) !== null) throw Error('native context operation already delivered');
    if (!captures.preserve(reference, bytes)) throw Error('native context custody unavailable');
    const actual = captures.read(reference);
    if (actual !== bytes) throw Error('native context readback differs');
    const delivered = JSON.parse(actual);
    if (delivered.processIdentity !== identity || !Array.isArray(delivered.contents)
      || delivered.contents.some(row => typeof row.bytes !== 'string')) throw Error('native context delivery malformed');
    // Parsing every delivered body is the actual worker input boundary. No
    // provider call or ungoverned output is possible through this physical port.
    for (const row of delivered.contents) JSON.parse(row.bytes);
    return { identity, digest: `sha256:${createHash('sha256').update(actual).digest('hex')}` };
  } });
}


/** Directory identity of a subscription login profile: canonical path plus
 * inode. The device number is deliberately excluded: macOS renumbers st_dev
 * across a reboot for the same unchanged volume, so a dev-bound identity
 * refused every provider call after a restart. A replaced or recreated
 * directory still receives a new inode and changes the identity. */
export function subscriptionProfileIdentity(bindings) {
  const rows = bindings.map(({ path, ino }) => ({ path, ino }));
  return `sha256:${createHash('sha256').update(JSON.stringify(rows)).digest('hex')}`;
}

/** Preview-only provider host. No secret file or Keychain contents are read here. */
export function createSubscriptionProviderIO({ repository, stopped, work = 'answer' }) {
  const outside = (path, root) => { const suffix = relative(root, path);
    return suffix.startsWith('../') || suffix === '..' || isAbsolute(suffix); };
  const digest = value => `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
  const inspectSubscriptionProfile = profile => {
    if (!['darwin', 'linux'].includes(process.platform)) throw Error('subscription platform unsupported');
    const bindings = [];
    for (const path of [profile.home, profile.configDirectory, profile.workingDirectory]) {
      const info = lstatSync(path);
      if (realpathSync(path) !== path || !info.isDirectory() || (info.mode & 0o777) !== 0o700
        || info.uid !== process.getuid() || !outside(path, repository) || !outside(path, homedir()))
        throw Error('subscription profile path refused');
      bindings.push({ path, ino: info.ino });
    }
    if (new Set(bindings.map(row => row.path)).size !== 3 || readdirSync(profile.workingDirectory).length)
      throw Error('subscription working directory is not isolated and empty');
    const managedRoot = process.platform === 'darwin' ? '/Library/Application Support/ClaudeCode' : '/etc/claude-code';
    const paths = [join(managedRoot, 'managed-settings.json'), join(profile.configDirectory, 'managed-settings.json')];
    const dropins = join(managedRoot, 'managed-settings.d');
    if (existsSync(dropins)) {
      if (realpathSync(dropins) !== dropins || !lstatSync(dropins).isDirectory()) throw Error('subscription policy path refused');
      const names = readdirSync(dropins).filter(name => !name.startsWith('.') && name.endsWith('.json')).sort();
      if (names.length > 32) throw Error('subscription policy count bound');
      paths.push(...names.map(name => join(dropins, name)));
    }
    // The pinned CLI also consults device and per-user MDM policy. This narrow
    // preview refuses those sources rather than interpreting plist helpers.
    if (process.platform === 'darwin') {
      for (const base of ['/Library/Managed Preferences', `/Library/Managed Preferences/${userInfo().username}`]) {
        if (existsSync(join(base, 'com.anthropic.claudecode.plist'))) throw Error('subscription MDM policy unsupported');
      }
    }
    const policy = [];
    for (const path of paths) {
      if (!existsSync(path)) { policy.push({ path, settings: null }); continue; }
      const info = lstatSync(path);
      if (!info.isFile() || info.size > 65536 || realpathSync(path) !== path) throw Error('subscription policy path refused');
      const settings = JSON.parse(readFileSync(path, 'utf8'));
      if (!settings || typeof settings !== 'object' || Array.isArray(settings)
        || Object.keys(settings).some(key => !['forceLoginMethod', 'forceLoginOrgUUID', 'disableAllHooks'].includes(key))
        || (settings.forceLoginMethod !== undefined && settings.forceLoginMethod !== 'claudeai')
        || (settings.forceLoginOrgUUID !== undefined && settings.forceLoginOrgUUID !== profile.organization)
        || (settings.disableAllHooks !== undefined && settings.disableAllHooks !== true))
        throw Error('subscription managed configuration unsupported');
      policy.push({ path, settings });
    }
    // Unknown server policy formats are an activation hold, never ignored.
    // 2.1.280 also reads remote-settings plus signed/cache companions. Never
    // adopt an opaque cached server policy (including an orphan companion).
    if (readdirSync(profile.configDirectory).some(name =>
      name.startsWith('policy-limits.json') || name.startsWith('remote-settings')))
      throw Error('subscription server policy requires reviewed effective configuration');
    return Object.freeze({ loginProfileIdentity: subscriptionProfileIdentity(bindings), managedConfigurationDigest: digest(policy) });
  };
  return Object.freeze({ ...productionProviderIO, inspectSubscriptionProfile,
    execute: input => productionProviderIO.execute({ ...input, stopped }, work) });
}
