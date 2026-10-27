// Foreground, isolated macOS proof. Reuses desk-owned disposable users; never
// creates/deletes accounts, touches a live login, or supplies fixture authority.
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, chownSync, copyFileSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ipcCertificates } from './setup-ipc-material.mjs';
import { setupCertificatePin, setupOwnerSocketClient } from '../../../scripts/custody-platform/setup-ipc.mjs';
if (process.platform !== 'darwin' || process.getuid() !== 0) throw Error('macOS administrator proof required');
const repository = process.argv[2], root = mkdtempSync('/private/tmp/ipc-studio-');
const identities = { brokerUid: 42000, installerUid: 0, agentUid: 42001, harnessUid: 42002 };
const names = ['_ifg86281b', '_ifg86281a', '_ifg86281h'];
const label = `test.instar.setup-ipc.${process.pid}`, node = process.execPath;
const command = (file, args) => execFileSync(file, args, { encoding: 'utf8', timeout: 7000,
  env: { PATH: '/usr/bin:/bin:/usr/sbin:/sbin', LANG: 'C' } });
const check = (value, message) => { if (!value) throw Error(message); };
const pause = ms => new Promise(accept => setTimeout(accept, ms));
let loaded = false, pid, stage = 'prepare', denials = 0, output;
try {
  chmodSync(root, 0o755);
  for (let index = 0; index < names.length; index++)
    check(Number(command('/usr/bin/id', ['-u', names[index]]).trim()) === 42000 + index, 'test identity mismatch');
  const certificates = ipcCertificates(root);
  chownSync(join(root, 'server'), 42000, 42000);
  for (const path of Object.values(certificates.server)) chownSync(path, 42000, 42000);
  const run = join(root, 'run'); mkdirSync(run, { mode: 0o755 }); chmodSync(run, 0o755); chownSync(run, 42000, 42000);
  const release = join(root, 'release'); mkdirSync(release, { mode: 0o755 }); mkdirSync(join(release, 'custody-platform'), { mode: 0o755 });
  chmodSync(release, 0o755); chmodSync(join(release, 'custody-platform'), 0o755);
  for (const file of ['setup-owner-receiver.mjs', 'setup-supervisor-protocol.mjs', 'custody-platform/setup-ipc.mjs']) {
    const target = join(release, file); copyFileSync(join(repository, 'scripts', file), target); chmodSync(target, 0o444);
  }
  const socket = join(run, 'owner.sock'), entry = join(release, 'entry.mjs');
  const clientPin = setupCertificatePin(readFileSync(certificates.client.cert));
  const serverPin = setupCertificatePin(readFileSync(certificates.server.cert));
  writeFileSync(entry, `import {mountSetupOwner,protectedSetupPath} from './custody-platform/setup-ipc.mjs';
import {PRECHECKS} from './setup-supervisor-protocol.mjs';
const run=${JSON.stringify(run)};
const mounted=await mountSetupOwner({socket:${JSON.stringify(socket)},credentials:${JSON.stringify(certificates.server)},
 clientPin:${JSON.stringify(clientPin)},identities:${JSON.stringify(identities)},implementation:{
 async read(checkpoint){
  const protectedDirectory=protectedSetupPath(run,42000,'directory');
  return {checkpoint:{...checkpoint,frontier:'ipc-observation:1'},checks:PRECHECKS[checkpoint.step].map((name,i)=>{
   const observed=['isolated_custodian','protected_paths'].includes(name);
   const passed=name==='isolated_custodian'?process.getuid()===42000:name==='protected_paths'?protectedDirectory.uid===42000:false;
   return {name,owner:'custodian',observed,passed,receipt:'r'+(i+1)};
  })};
 }, async reconcile(){return 'absent'},async execute(){throw Error('preparation owner not installed')}
}});
const timer=setTimeout(stop,45000);let stopped=false;
async function stop(){if(stopped)return;stopped=true;clearTimeout(timer);await mounted.close()}
process.on('SIGTERM',stop);
`, { mode: 0o444 });
  chmodSync(entry, 0o444);
  const plist = join(root, 'broker.plist'), stderr = join(root, 'broker.stderr');
  writeFileSync(stderr, '', { mode: 0o600 }); chownSync(stderr, 42000, 42000);
  const xml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
  writeFileSync(plist, `<?xml version="1.0"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>${label}</string><key>UserName</key><string>${names[0]}</string><key>GroupName</key><string>${names[0]}</string><key>ProgramArguments</key><array><string>${xml(node)}</string><string>${xml(entry)}</string></array><key>WorkingDirectory</key><string>${xml(root)}</string><key>StandardErrorPath</key><string>${xml(stderr)}</string><key>RunAtLoad</key><true/><key>KeepAlive</key><false/><key>HardResourceLimits</key><dict><key>NumberOfFiles</key><integer>64</integer><key>NumberOfProcesses</key><integer>16</integer><key>Core</key><integer>0</integer></dict></dict></plist>`, { mode: 0o644 });
  command('/usr/bin/plutil', ['-lint', plist]);
  stage = 'launchd'; command('/bin/launchctl', ['bootstrap', 'system', plist]); loaded = true;
  const client = setupOwnerSocketClient({ socket, credentials: certificates.client, serverPin, identities });
  const checkpoint = { installation: 'test-installation', session: 'test-session', subject: 'a'.repeat(64), authority: 'test-preparation',
    step: 'key', phase: 'pre', operation: 'test-session:key', schema: 'setup-owner-results-v1' };
  const request = operation => ({ kind: 'setup-owner-request', operation, checkpoint });
  let record;
  for (let attempt = 0; attempt < 5; attempt++) {
    const status = command('/bin/launchctl', ['print', `system/${label}`]);
    const match = /\bpid = (\d+)/.exec(status); if (match) pid = Number(match[1]);
    try { record = await client.request(request('inspect')); break; } catch { await pause(50); }
  }
  check(pid > 0 && Number(command('/bin/ps', ['-p', String(pid), '-o', 'uid=']).trim()) === 42000, 'no independent kernel PID');
  stage = 'receiver';
  check(record?.checks?.filter(row => row.passed).length === 2, 'observed owner checks missing');
  check(await client.request({ ...request('authenticate'), record }) === true, 'current partial evidence not authenticated');
  check((await client.request(request('execute'))).reason === 'owner-check-failed', 'uninstalled preparation accepted');
  const changed = structuredClone(record); changed.checks[0].passed = true; changed.checks[0].observed = true;
  check(await client.request({ ...request('authenticate'), record: changed }) === false, 'forged preparation accepted');
  let oversized = false;
  try { await client.request({ data: 'x'.repeat(16385) }); } catch { oversized = true; }
  check(oversized, 'oversized client request accepted');
  for (const options of [{ credentials: certificates.other }, { serverPin: 'a'.repeat(64) }]) {
    let refused = false;
    try { await setupOwnerSocketClient({ socket, credentials: certificates.client, serverPin, identities, ...options }).request(request('inspect')); }
    catch { refused = true; }
    check(refused, 'wrong TLS identity accepted'); denials++;
  }
  stage = 'kernel-denials';
  const probe = (name, source) => {
    const result = spawnSync('/usr/bin/sudo', ['-n', '-u', name, node, '-e',
      `try{${source};process.stdout.write('opened')}catch(e){process.stdout.write(['EACCES','EPERM'].includes(e.code)?'kernel-denied':'unexpected')}`],
    { encoding: 'utf8', timeout: 3000, env: { PATH: '/usr/bin:/bin' } });
    check(!result.error && result.status === 0, 'probe failed to execute'); return result.stdout;
  };
  check(probe(names[0], `require('fs').readFileSync(${JSON.stringify(certificates.server.key)})`) === 'opened', 'broker positive read failed');
  for (const name of names.slice(1)) {
    for (const source of [
      `require('fs').readFileSync(${JSON.stringify(certificates.server.key)})`,
      `require('fs').readFileSync(${JSON.stringify(certificates.client.key)})`,
      `require('fs').openSync(${JSON.stringify(entry)},'w')`,
      `require('fs').renameSync(${JSON.stringify(join(root, 'server'))},${JSON.stringify(join(root, 'replaced'))})`,
      `require('fs').openSync(${JSON.stringify(plist)},'w')`,
      `require('fs').unlinkSync(${JSON.stringify(socket)})`,
      'process.setuid(42000)', `process.kill(${pid},0)`,
    ]) { check(probe(name, source) === 'kernel-denied', `${name} kernel denial absent`); denials++; }
  }
  stage = 'client-material';
  chmodSync(certificates.client.key, 0o644);
  let refused = false; try { await client.request(request('inspect')); } catch { refused = true; }
  check(refused, 'changed client custody accepted'); chmodSync(certificates.client.key, 0o600);
  check((await client.request(request('inspect'))).checks.length === record.checks.length, 'repair did not recover');
  output = { launchd: 'observed', pid, identities: [42000, 42001, 42002], denials,
    ownerExecution: 'refused-missing-preparation' };
} catch (error) {
  // Only fixed test labels, never TLS/private material or raw owner diagnostics.
  process.stderr.write(`IPC platform proof failed at ${stage}: ${error.message}\n`); process.exitCode = 1;
  if (stage === 'launchd') {
    try { process.stderr.write(readFileSync(join(root, 'broker.stderr'), 'utf8')); } catch { /* May not have launched. */ }
    try { process.stderr.write(command('/bin/launchctl', ['print', `system/${label}`])); } catch { /* May not be installed. */ }
  }
} finally {
  if (pid) {
    try { process.kill(pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    for (let attempt = 0; attempt < 40; attempt++) {
      try { process.kill(pid, 0); await pause(50); } catch (error) { if (error.code === 'ESRCH') break; throw error; }
    }
    // Cleanup addresses only the recorded child PID, never a pattern or group.
    try { process.kill(pid, 0); process.kill(pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  if (loaded) command('/bin/launchctl', ['bootout', `system/${label}`]);
  rmSync(root, { recursive: true, force: true });
  if (output) process.stdout.write(JSON.stringify({ ...output, cleanup: 'complete-no-identity-changes' }) + '\n');
}
