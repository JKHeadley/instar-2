// One request per forced-command process. The service account's installed
// configuration supplies every root, key, decoder and policy; stdin supplies none.
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync, readdirSync, statfsSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { consumeResult } from '../dist/index.js';
import { openProductionStorage } from '../dist/assembly/production-storage.js';
import { receiveFixedPeerRequest } from '../dist/assembly/production-replication.js';
import { productionStorageIO } from './production-boot-io.mjs';

const fail = () => { process.stdout.write('{"refused":true}'); process.exitCode = 1; };
let storage, deadline;
try {
  const path = process.env.INSTAR_FIXED_PEER_CONFIG;
  const pin = process.env.INSTAR_FIXED_PEER_CONFIG_DIGEST;
  if (!path?.startsWith('/') || realpathSync(path) !== path || !lstatSync(path).isFile()
    || `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}` !== pin)
    throw Error('installed peer configuration invalid');
  const installed = await import(pathToFileURL(path).href);
  if (typeof installed.openFixedPeerConfiguration !== 'function') throw Error('installed peer configuration missing');
  const config = await installed.openFixedPeerConfiguration();
  if (config.descriptor.laptop !== 'm_cc2ec651a91f' || config.machine !== config.descriptor.laptop
    || config.store !== config.descriptor.store || config.policy !== config.descriptor.custody
    || config.authenticatedStudio !== config.descriptor.studio) throw Error('installed peer binding differs');
  // OpenSSH ExposeAuthInfo is a deployment prerequisite. The file is written
  // by sshd after authentication, not selected by the wire request.
  const authPath = process.env.SSH_USER_AUTH;
  if (process.env.SSH_ORIGINAL_COMMAND !== 'instar-fixed-peer-v1' || !authPath?.startsWith('/')
    || realpathSync(authPath) !== authPath || !lstatSync(authPath).isFile()
    || lstatSync(authPath).size > 4096 || !/^ssh-(ed25519|rsa) [A-Za-z0-9+/=]+$/.test(config.clientPublicKey))
    throw Error('authenticated Studio key evidence missing');
  const auth = readFileSync(authPath, 'utf8').trim();
  if (auth !== `publickey ${config.clientPublicKey}`) throw Error('authenticated Studio key differs');
  const limit = config.descriptor.limits.maxRequestBytes;
  if (!Number.isSafeInteger(limit) || limit < 1) throw Error('request bound missing');
  deadline = setTimeout(() => process.exit(1), config.descriptor.limits.timeoutMs);
  const chunks = []; let length = 0;
  for await (const chunk of process.stdin) {
    length += chunk.length;
    if (length > limit) throw Error('request bound exceeded');
    chunks.push(chunk);
  }
  const request = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  storage = consumeResult(openProductionStorage({ root: config.root, machine: config.machine, key: config.key,
    policy: config.policy, store: config.store, context: config.boundary, io: productionStorageIO }),
    { Success: value => value, Refused: refusal => { throw Error(refusal.detail); } });
  const cut = config.testFaultCut;
  if (cut !== null && cut !== undefined && (config.testProofMode !== true
    || process.env.INSTAR_FIXED_PEER_TEST_PROOF !== '1'
    || !['before-fsync', 'after-fsync', 'before-response', 'after-response'].includes(cut)))
    throw Error('test cut not installed');
  const segment = !cut || !['before-fsync', 'after-fsync'].includes(cut) ? storage.segment : {
    owner: 'part-ten', read: storage.segment.read, append(bytes, expectedHead) {
      if (cut === 'before-fsync') process.exit(77);
      const receipt = storage.segment.append(bytes, expectedHead);
      if (cut === 'after-fsync') process.exit(77);
      return receipt;
    },
  };
  const reserve = requestBytes => {
    // The exclusive production-storage lease is held. Count all retained files,
    // including failed-write artifacts. Each appended fact is JSON encoded as
    // a string inside the facts array; both arrays/maps are then base64 sealed.
    // Budget all additions plus the largest final rewrite temporary while the
    // old files and every other retained file still coexist.
    let used = 0n, factsSize = 0n, capturesSize = 0n;
    const count = dir => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name), entry = lstatSync(path);
        if (entry.isSymbolicLink()) throw Error('storage quota symlink refused');
        if (entry.isDirectory()) count(path);
        else if (entry.isFile()) {
          const size = BigInt(entry.size);
          used += size;
          if (dir === config.root && name === 'facts.encrypted') factsSize = size;
          if (dir === config.root && name === 'captures.encrypted') capturesSize = size;
        }
        else throw Error('storage quota entry refused');
      }
    };
    count(config.root);
    if (requestBytes > config.descriptor.limits.maxRequestBytes) throw Error('request allowance exhausted');
    const factPlain = request.facts.reduce((size, fact) =>
      size + BigInt(Buffer.byteLength(JSON.stringify(JSON.stringify(fact))) + 1), 2n);
    const capturePlain = request.captures.reduce((size, capture) =>
      size + BigInt(Buffer.byteLength(JSON.stringify(capture.reference))
        + Buffer.byteLength(JSON.stringify(capture.bytes)) + 2), 2n);
    // Four base64 bytes per three plaintext bytes, plus a full seal wrapper and
    // rounding margin for each target. The old encrypted sizes already include
    // their wrappers; unchanged rows retain their serialized byte lengths.
    const growth = plain => (4n * plain + 2n) / 3n + 128n;
    const factGrowth = growth(factPlain), captureGrowth = growth(capturePlain);
    const temporary = factsSize + factGrowth > capturesSize + captureGrowth
      ? factsSize + factGrowth : capturesSize + captureGrowth;
    const extra = factGrowth + captureGrowth + temporary;
    const limit = BigInt(config.descriptor.limits.maxDiskBytes);
    if (used + extra > limit) throw Error('storage allowance exhausted');
    const available = statfsSync(config.root, { bigint: true });
    if (available.bavail * available.bsize < (extra > limit ? extra : limit))
      throw Error('disk reservation unavailable');
  };
  const result = consumeResult(receiveFixedPeerRequest({ request, descriptor: config.descriptor,
    authenticatedStudio: config.authenticatedStudio, context: config.context,
    storage: segment, captures: storage.captures, boundary: config.boundary, reserve }),
    { Success: value => value, Refused: refusal => { throw Error(refusal.detail); } });
  const output = JSON.stringify(result);
  if (Buffer.byteLength(output) > config.descriptor.limits.maxResponseBytes) throw Error('response bound exceeded');
  if (cut === 'before-response') process.exit(77);
  if (cut === 'after-response') { writeSync(1, output); process.exit(77); }
  process.stdout.write(output);
} catch { fail(); }
finally { clearTimeout(deadline); try { storage?.close(); } catch { process.exitCode = 1; } }
