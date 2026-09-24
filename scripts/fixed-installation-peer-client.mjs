// Fixed synchronous host transport for Ten's SegmentStoragePort. The restricted
// remote account must be provisioned with a forced fixed custody command.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';

const sha = value => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const exact = (value, max = 256) => typeof value === 'string' && value.length > 0 && value.length <= max
  && /^[A-Za-z0-9._:@/-]+$/.test(value) && !value.startsWith('-');
export const pinnedSshTrustOptions = (knownHosts, hostKeyAlias) => [
  '-F', '/dev/null', '-o', 'StrictHostKeyChecking=yes',
  '-o', `UserKnownHostsFile=${knownHosts}`, '-o', 'GlobalKnownHostsFile=/dev/null',
  '-o', `HostKeyAlias=${hostKeyAlias}`, '-o', 'HostKeyAlgorithms=ssh-ed25519',
  '-o', 'KnownHostsCommand=none', '-o', 'VerifyHostKeyDNS=no', '-o', 'UpdateHostKeys=no',
];
export function createPinnedSshPeerTransport(config) {
  const { host, port, user, knownHosts, knownHostsDigest, hostKeyAlias, identityFile,
    peer, trust, timeoutMs, maxRequestBytes, maxResponseBytes } = config;
  if (![host, user, hostKeyAlias, peer, trust].every(v => exact(v)) || !Number.isSafeInteger(port) || port < 1 || port > 65535
    || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || !Number.isSafeInteger(maxRequestBytes) || maxRequestBytes < 1
    || !Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1
    || !/^\/[A-Za-z0-9._/@+-]+$/.test(knownHosts ?? '')
    || realpathSync(knownHosts) !== knownHosts || !lstatSync(knownHosts).isFile() || sha(readFileSync(knownHosts)) !== knownHostsDigest)
    throw Error('pinned SSH peer configuration invalid');
  const hostKeys = readFileSync(knownHosts, 'utf8').trim().split(/\r?\n/);
  const keyFields = hostKeys.length === 1 ? hostKeys[0].split(' ') : [];
  if (trust !== knownHostsDigest || keyFields.length !== 3 || keyFields[0] !== hostKeyAlias
    || keyFields[1] !== 'ssh-ed25519' || !/^[A-Za-z0-9+/=]+$/.test(keyFields[2]))
    throw Error('enrolled host trust differs');
  if (!/^\/[A-Za-z0-9._/@+-]+$/.test(identityFile ?? '')
    || realpathSync(identityFile) !== identityFile || !lstatSync(identityFile).isFile()
    || (lstatSync(identityFile).mode & 0o077) !== 0)
    throw Error('installed Studio key handle missing');
  if (peer !== 'm_cc2ec651a91f') throw Error('enrolled Laptop identity required');
  return Object.freeze({ owner: 'part-ten', exchange(request) {
    const input = JSON.stringify(request);
    if (Buffer.byteLength(input) > maxRequestBytes || request.laptop !== peer || request.trust !== trust) throw Error('peer request bound differs');
    if (sha(readFileSync(knownHosts)) !== knownHostsDigest) throw Error('pinned trust file changed');
    const seconds = Math.max(1, Math.ceil(timeoutMs / 1000));
    const child = spawnSync('/usr/bin/ssh', [
      '-T', ...pinnedSshTrustOptions(knownHosts, hostKeyAlias), '-o', 'BatchMode=yes',
      '-i', identityFile, '-o', 'IdentitiesOnly=yes',
      '-o', 'IdentityAgent=none', '-o', 'ConnectionAttempts=1', '-o', 'NumberOfPasswordPrompts=0',
      '-o', 'PreferredAuthentications=publickey', '-o', 'PasswordAuthentication=no',
      '-o', 'KbdInteractiveAuthentication=no', '-o', 'GSSAPIAuthentication=no',
      '-o', 'ClearAllForwardings=yes', '-o', 'ForwardAgent=no', '-o', 'PermitLocalCommand=no',
      '-o', 'ControlMaster=no', '-o', 'ProxyCommand=none', '-o', 'ProxyJump=none',
      '-o', `ConnectTimeout=${seconds}`, '-p', String(port), `${user}@${host}`, 'instar-fixed-peer-v1',
    ], { input, encoding: 'utf8', timeout: timeoutMs, maxBuffer: maxResponseBytes, stdio: ['pipe', 'pipe', 'ignore'],
      env: { PATH: '/usr/bin:/bin', HOME: '/nonexistent' } });
    if (child.error || child.status !== 0 || child.signal || Buffer.byteLength(child.stdout) > maxResponseBytes)
      throw Error('authenticated peer transport unavailable');
    let response;
    try { response = JSON.parse(child.stdout); } catch { throw Error('peer response frame invalid'); }
    return Object.freeze({ peer, trust, response });
  } });
}
