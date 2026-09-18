import { readFileSync } from 'node:fs';
import { consumeResult } from '../../dist/index.js';
import { hashBytes } from '../../dist/facts/index.js';
import { openProductionStorage } from '../../dist/assembly/production-storage.js';
import { productionStorageIO } from '../../scripts/production-boot-io.mjs';
const input = JSON.parse(readFileSync(0, 'utf8'));
const take = result => consumeResult(result, { Success: value => value, Refused: refusal => { throw Error(refusal.detail); } });
const store = take(openProductionStorage({ ...input, key: new Uint8Array(32).fill(23), io: productionStorageIO }));
const cut = name => { if (input.cut === name) { process.stdout.write(`durable:${name}\n`); process.kill(process.pid, 'SIGKILL'); } };
const bytes = '{"contentHash":"storage-crash-head","message":"preserved"}';
take(store.segment.append(bytes, null)); cut('facts');
if (!store.captures.preserve('capture:crash', 'captured exact bytes')) throw Error('capture not durable');
cut('captures');
take(store.persistence.appendExact({ bytes, bytesDigest: hashBytes(bytes), segment: input.store,
  position: 'position:crash', policy: input.policy, expectedPhysicalHead: null })); cut('exact');
throw Error('cut not reached');
