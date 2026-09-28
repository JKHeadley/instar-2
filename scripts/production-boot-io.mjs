// The fixed Ten physical host. No worker receives these OS ports.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, constants, existsSync, fsyncSync, lstatSync, mkdirSync, openSync,
  readFileSync, readdirSync, realpathSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { homedir, userInfo } from 'node:os';
import { fileURLToPath } from 'node:url';
import { hostResources } from './resource-owner.mjs';

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
  return Object.freeze({ invoke(input, credential) {
    const request = Buffer.from(JSON.stringify({ method: input.method, body: input.body, timeoutMs: input.timeoutMs,
      captureDirectory: directory, identityBinding: input.identityBinding,
      ...(testEndpoint === null ? {} : { testEndpoint }) })).toString('base64url');
    // A synchronous, sequential transport child: its V8 heap is capped here and
    // its elapsed time and output by the options below.
    const child = spawnSync(process.execPath,
      ['--max-old-space-size=256', fileURLToPath(new URL('../src/assembly/telegram-bot-api-bridge.mjs', import.meta.url)), request],
      { input: credential, encoding: 'utf8', timeout: input.timeoutMs + 2000, maxBuffer: 2 * 1024 * 1024,
        env: { PATH: '/usr/bin:/bin' }, stdio: ['pipe', 'pipe', 'ignore'] });
    if (child.status !== 0) return { kind: 'uncertain', limitation: 'transport', stage: 'child-exit' };
    try {
      const reply = JSON.parse(child.stdout);
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
  } });
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
