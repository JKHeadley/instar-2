// Root-side Linux lifecycle adapter. Broker semantics remain in the signed entrypoint.
// Deliberately machine-local; root is the independent administrator, never the harness.
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, chownSync, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync,
  readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { connect } from 'node:net';
import { once } from 'node:events';
import { custodyPlatform } from './interface.mjs';
import { verifyDistribution } from './distribution.mjs';

const command = (name, args) => {
  const result = spawnSync(name, args, { encoding: 'utf8', timeout: 5000, env: { PATH: '/usr/sbin:/usr/bin:/sbin:/bin', LANG: 'C' } });
  if (result.error || result.status !== 0) throw Error(`custody: ${name} refused`);
  return result.stdout.trim();
};
const nameOK = name => typeof name === 'string' && /^[a-z_][a-z0-9_-]{0,30}$/.test(name);
function rootRequired() {
  if (process.platform !== 'linux' || process.getuid() !== 0) throw Error('custody: Linux root installation session required');
}
function protectedPath(path, directory = false) {
  if (!isAbsolute(path) || resolve(path) !== path) throw Error('custody: absolute canonical path required');
  let at = path;
  for (;;) {
    const s = lstatSync(at);
    // Sticky root-owned /tmp is permitted only as an ancestor of a root-owned leaf.
    const stickyAncestor = at !== path && s.isDirectory() && (s.mode & 0o1000);
    if (s.isSymbolicLink() || s.uid !== 0 || ((s.mode & 0o022) && !stickyAncestor)
      || (at === path && (directory ? !s.isDirectory() : !s.isFile())))
      throw Error('custody: path is not independently administered');
    if (at === '/') break;
    at = dirname(at);
  }
}
function account(name) {
  if (!nameOK(name)) throw Error('custody: invalid identity');
  const row = command('/usr/bin/getent', ['passwd', name]).split(':');
  const uid = Number(row[2]), gid = Number(row[3]);
  if (row[0] !== name || !Number.isSafeInteger(uid) || uid <= 0 || !Number.isSafeInteger(gid) || gid <= 0
    || !['/usr/sbin/nologin', '/sbin/nologin', '/bin/false'].includes(row[6]))
    throw Error('custody: locked system identity required');
  const groups = command('/usr/bin/id', ['-G', name]).split(/\s+/).map(Number);
  if (groups.length !== 1 || groups[0] !== gid) throw Error('custody: privileged or supplementary group refused');
  const shadow = command('/usr/bin/getent', ['shadow', name]).split(':')[1];
  if (!shadow || !/^[!*]/.test(shadow)) throw Error('custody: unlocked account refused');
  // Ask sudo as the administrator, not as a passwordless caller. Even password-required
  // authority is forbidden; a locked password alone is not proof of no sudo policy.
  if (existsSync('/usr/bin/sudo')) {
    const listed = spawnSync('/usr/bin/sudo', ['-n', '-l', '-U', name], { encoding: 'utf8', timeout: 5000,
      env: { PATH: '/usr/sbin:/usr/bin:/sbin:/bin', LANG: 'C' } });
    if (listed.error || listed.status !== 1 || !`${listed.stdout}${listed.stderr}`.includes('not allowed to run sudo'))
      throw Error('custody: sudo authority present or unverified');
  }
  return { name, uid, gid };
}
export function brokerProcessObservation(status, uid) {
  const ids = /^Uid:\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/m.exec(status);
  return Boolean(ids && ids.slice(1).every(value => Number(value) === uid)
    && /^NoNewPrivs:\s+1$/m.test(status)
    && ['Inh', 'Prm', 'Eff', 'Bnd', 'Amb'].every(kind => new RegExp(`^Cap${kind}:\\s+0+$`, 'm').test(status)));
}
// Rule 60: hard rlimits survive exec/fork and cannot be raised after setpriv drops
// all capabilities. NPROC counts threads across the dedicated broker UID. AS caps
// each address space (including mappings), DATA also bounds anonymous allocations.
const addressSpaceBytes = 1024 * 1024 * 1024, dataBytes = 256 * 1024 * 1024, tasks = 16;
export function boundedBrokerCommand(executable, args) {
  return { executable: '/usr/bin/prlimit', args: [
    `--as=${addressSpaceBytes}:${addressSpaceBytes}`, `--data=${dataBytes}:${dataBytes}`,
    `--nproc=${tasks}:${tasks}`, '--core=0:0', '--', executable, ...args,
  ] };
}
export function brokerResourceObservation(limits) {
  return [['Max address space', addressSpaceBytes, 'bytes'], ['Max data size', dataBytes, 'bytes'],
    ['Max processes', tasks, 'processes'], ['Max core file size', 0, 'bytes']].every(([name, ceiling, unit]) => {
    const row = new RegExp(`^${name}\\s+(\\d+)\\s+(\\d+)\\s+${unit}\\s*$`, 'm').exec(limits);
    return Boolean(row && Number(row[1]) <= Number(row[2]) && Number(row[2]) <= ceiling);
  });
}
function observedBroker(pid, uid) {
  return brokerProcessObservation(readFileSync(`/proc/${pid}/status`, 'utf8'), uid)
    && brokerResourceObservation(readFileSync(`/proc/${pid}/limits`, 'utf8'));
}
function durableFile(path, bytes, mode) {
  const fd = openSync(path, 'wx', mode);
  try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
  chmodSync(path, mode);
}
function syncDirectory(path) {
  const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
}
export function systemdUnit({ base, node, broker }) {
  if (!nameOK(broker) || ![base, node].every(p => /^\/[a-zA-Z0-9/._-]+$/.test(p))) throw Error('custody: unsafe unit path');
  return `[Unit]\nDescription=Instar custody broker\nAfter=local-fs.target\n\n[Service]\nType=simple\nUser=${broker}\nGroup=${broker}\nExecStart=${node} ${base}/release/entry.mjs ${base}/run/broker.sock\nWorkingDirectory=${base}/release\nEnvironment=NODE_ENV=production\nNoNewPrivileges=yes\nCapabilityBoundingSet=\nAmbientCapabilities=\nProtectSystem=strict\nProtectHome=yes\nPrivateTmp=yes\nRestrictSUIDSGID=yes\nReadWritePaths=${base}/run\nUMask=0077\nRestart=no\nKillMode=process\nTimeoutStopSec=5\nTasksMax=16\nMemoryMax=256M\n\n[Install]\nWantedBy=multi-user.target\n`;
}
export function requestSocket(socket, request) {
  const bytes = JSON.stringify(request);
  // A setup authentication request carries both the checkpoint and its full
  // owner record. The closed protocol's longest valid binding exceeds 2 KiB.
  // Keep a finite wire bound, measured in bytes in both directions.
  const maxBytes = 16384;
  if (Buffer.byteLength(bytes) > maxBytes) return Promise.reject(Error('custody: request bound'));
  return new Promise((accept, reject) => {
    const peer = connect(socket); const chunks = []; let received = 0;
    const fail = () => { peer.destroy(); reject(Error('custody: request unavailable')); };
    peer.setTimeout(2000, fail); peer.on('error', fail);
    peer.on('connect', () => peer.end(`${bytes}\n`));
    peer.on('data', bytes => {
      received += bytes.length;
      if (received > maxBytes) { fail(); return; }
      chunks.push(bytes);
    });
    peer.on('end', () => { try { accept(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { fail(); } });
  });
}

export function linuxCustodyPlatform({ base, broker, agent, harness, trustAnchorPath, node = process.execPath }) {
  if (![broker, agent, harness].every(nameOK) || new Set([broker, agent, harness]).size !== 3)
    throw Error('custody: three separate identities required');
  if (!/^\/[a-zA-Z0-9/._-]+$/.test(base)) throw Error('custody: unsafe installation path');
  if (typeof trustAnchorPath !== 'string' || !isAbsolute(trustAnchorPath)) throw Error('custody: independently installed release anchor path required');
  node = realpathSync(node);
  const releaseAnchor = () => { protectedPath(trustAnchorPath); return readFileSync(trustAnchorPath, 'utf8'); };
  let child = null, exit = null;
  const socket = join(base, 'run/broker.sock');
  const identities = () => {
    const rows = [account(broker), account(agent), account(harness)];
    if (new Set(rows.map(r => r.uid)).size !== 3 || new Set(rows.map(r => r.gid)).size !== 3)
      throw Error('custody: identity separation refused');
    return rows;
  };
  const load = () => {
    protectedPath(base, true); protectedPath(join(base, 'release'), true);
    const files = {};
    const walk = (directory, prefix = '') => {
      for (const entry of readdirSync(directory)) {
        const path = join(directory, entry), name = `${prefix}${entry}`, stat = lstatSync(path);
        protectedPath(path, stat.isDirectory());
        if (stat.isDirectory()) walk(path, `${name}/`);
        else files[name] = readFileSync(path);
      }
    };
    walk(join(base, 'release'));
    for (const file of ['manifest.json', 'manifest.sig']) protectedPath(join(base, file));
    return verifyDistribution({ manifest: readFileSync(join(base, 'manifest.json')),
      signature: readFileSync(join(base, 'manifest.sig')), files }, releaseAnchor(), 'linux');
  };
  const verifyInstalled = () => {
    rootRequired(); protectedPath(node); protectedPath(realpathSync('/usr/bin/setpriv'));
    protectedPath(realpathSync('/usr/bin/prlimit'));
    const rows = identities(), release = load();
    if (release.manifest.entry !== 'entry.mjs') throw Error('custody: distribution entry differs');
    for (const directory of ['private', 'run']) {
      const s = lstatSync(join(base, directory));
      if (!s.isDirectory() || s.isSymbolicLink() || s.uid !== rows[0].uid || s.gid !== rows[0].gid
        || (s.mode & 0o777) !== 0o700) throw Error('custody: broker private directory differs');
    }
    protectedPath(join(base, 'broker.service'));
    if (readFileSync(join(base, 'broker.service'), 'utf8') !== systemdUnit({ base, node, broker }))
      throw Error('custody: service definition differs');
    return { digest: release.digest, identities: rows, startup: 'foreground', systemdUnit: join(base, 'broker.service') };
  };
  return custodyPlatform({
    install(material) {
      rootRequired();
      const release = verifyDistribution(material, releaseAnchor(), 'linux');
      if (release.manifest.entry !== 'entry.mjs') throw Error('custody: distribution entry differs');
      protectedPath(dirname(base), true); protectedPath(node);
      if (existsSync(base)) throw Error('custody: installation exists; refusing overwrite');
      if (spawnSync('/usr/bin/getent', ['passwd', broker], { timeout: 5000 }).status === 2)
        command('/usr/sbin/useradd', ['--system', '--user-group', '--no-create-home', '--home-dir', '/nonexistent', '--shell', '/usr/sbin/nologin', broker]);
      const [owner] = identities();
      mkdirSync(base, { mode: 0o755 }); chmodSync(base, 0o755);
      mkdirSync(join(base, 'release'), { mode: 0o755 }); chmodSync(join(base, 'release'), 0o755);
      for (const [path, bytes] of release.files) {
        const target = join(base, 'release', path); mkdirSync(dirname(target), { recursive: true, mode: 0o755 });
        let directory = dirname(target);
        while (directory !== base) { chmodSync(directory, 0o755); directory = dirname(directory); }
        durableFile(target, bytes, 0o444);
      }
      for (const directory of ['private', 'run']) {
        const path = join(base, directory); mkdirSync(path, { mode: 0o700 }); chownSync(path, owner.uid, owner.gid);
      }
      durableFile(join(base, 'manifest.json'), release.bytes, 0o444);
      durableFile(join(base, 'manifest.sig'), release.signature, 0o444);
      durableFile(join(base, 'broker.service'), systemdUnit({ base, node, broker }), 0o444);
      syncDirectory(base);
      return verifyInstalled();
    },
    verify: verifyInstalled,
    async start() {
      if (child && child.exitCode === null && child.signalCode === null) throw Error('custody: already running');
      const checked = verifyInstalled(), owner = checked.identities[0];
      // Root drops all supplementary groups via setpriv before exec. No shell, no
      // inherited NODE_OPTIONS, credentials or ambient capabilities. Works without systemd.
      // Establish soft AND hard resource ceilings before any distribution code runs.
      // prlimit and setpriv exec in place, retaining the exact observed/stopped PID.
      const launch = boundedBrokerCommand('/usr/bin/setpriv', ['--reuid', String(owner.uid), '--regid', String(owner.gid), '--clear-groups',
        '--no-new-privs', '--inh-caps=-all', '--ambient-caps=-all', '--bounding-set=-all',
        node, join(base, 'release/entry.mjs'), socket]);
      child = spawn(launch.executable, launch.args, { cwd: join(base, 'release'),
        env: { PATH: '/usr/bin:/bin', HOME: '/nonexistent', NODE_ENV: 'production' }, stdio: ['ignore', 'ignore', 'ignore'] });
      exit = once(child, 'exit');
      // An error still has a listener even when exec fails before polling begins.
      exit.catch(() => {});
      for (let attempt = 0; attempt < 50; attempt++) {
        try {
          const response = await requestSocket(socket, { operation: 'status' });
          if (response.state === 'running' && response.pid === child.pid && response.uid === owner.uid && observedBroker(child.pid, owner.uid)) return { pid: child.pid, uid: owner.uid };
        } catch { /* bounded startup observation */ }
        if (child.exitCode !== null || child.signalCode !== null) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      await this.stop(); throw Error('custody: broker did not become ready');
    },
    async request(request) {
      if ((await this.status()).state !== 'running') throw Error('custody: request requires verified running broker');
      return requestSocket(socket, request);
    },
    async status() {
      let verified;
      try { verified = verifyInstalled(); } catch { return { state: 'refused' }; }
      if (!child || child.exitCode !== null || child.signalCode !== null) return { state: 'stopped' };
      try {
        const live = await requestSocket(socket, { operation: 'status' });
        if (live.state !== 'running' || live.pid !== child.pid || live.uid !== verified.identities[0].uid
          || !observedBroker(child.pid, verified.identities[0].uid)) return { state: 'refused' };
        return { ...live, digest: verified.digest };
      } catch { return { state: 'refused' }; }
    },
    async stop() {
      if (!child || child.exitCode !== null || child.signalCode !== null) return;
      child.kill('SIGTERM');
      const timer = setTimeout(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }, 2000);
      try { await exit; } finally { clearTimeout(timer); }
    },
  });
}
