import { createCipheriv, createDecipheriv } from 'node:crypto';
import { canonical } from '../index.js';
import type { Result } from '../index.js';
import { hashBytes } from '../facts/index.js';
import { boundary, ensure, freeze, take } from './boundary.js';
import type { CustodyKeyPort, EncryptedChunk, EncryptedChunkStorePort, PersistenceAdapterPort, PersistenceReceipt, StoreCustodyPolicy } from './contracts.js';

function keyBytes(key: string): Uint8Array {
  ensure(/^[a-f0-9]{64}$/.test(key), 'custody key must be 32-byte hex'); return Uint8Array.from(Buffer.from(key, 'hex'));
}
function nonceBytes(nonce: string): Uint8Array {
  ensure(/^[a-f0-9]{24}$/.test(nonce), 'custody nonce must be 12-byte hex'); return Uint8Array.from(Buffer.from(nonce, 'hex'));
}

export function createCustodiedPersistenceAdapter(id: string, policy: StoreCustodyPolicy,
  chunks: EncryptedChunkStorePort, keys: CustodyKeyPort, context: import('./contracts.js').AssemblyDecodeContext): Result<PersistenceAdapterPort> {
  return boundary('PersistenceAdapterConstruction', { id, policy }, context, () => {
    ensure(id && chunks.owner === 'part-ten' && chunks.administration === 'custodian', 'custodian storage boundary required');
    ensure(keys.owner === 'part-ten' && keys.administration === 'independent', 'independent key custodian required');
    ensure(policy.encryption.suite === 'AES-256-GCM' && policy.dataKeys.length > 0, 'approved encryption policy required');
    const keyInfo = policy.dataKeys.at(-1)!;
    const receiptByPosition = new Map<string, PersistenceReceipt>();
    const port: PersistenceAdapterPort = { owner: 'part-ten' as const, id,
      describe: () => freeze({ backend: 'custodied-encrypted-chunks', policy: policy.id, encrypted: true as const, appendAtomic: true as const }),
      appendExact(input) {
        return boundary('PersistenceAppendExact', input, context, () => {
          ensure(input.policy === policy.id && input.segment === policy.store, 'append outside custody policy');
          ensure(hashBytes(input.bytes) === input.bytesDigest, 'canonical byte digest mismatch');
          const old = chunks.read(input.position); const prior = receiptByPosition.get(input.position);
          if (old || prior) { ensure(prior && prior.bytesDigest === input.bytesDigest, 'different bytes at immutable position'); return prior; }
          const nonce = take(keys.nonce(policy.store, keyInfo.epoch, input.position));
          const aad = take(canonical({ store: policy.store, schema: 1, keyEpoch: keyInfo.epoch, segment: input.segment, position: input.position })).bytes;
          const cipher = createCipheriv('aes-256-gcm', keyBytes(take(keys.key(policy.wrappingKey, keyInfo.epoch))), nonceBytes(nonce));
          cipher.setAAD(Buffer.from(aad)); const encrypted = Buffer.concat([cipher.update(input.bytes, 'utf8'), cipher.final()]); const tag = cipher.getAuthTag();
          const encoded = JSON.stringify({ ciphertext: encrypted.toString('base64'), tag: tag.toString('hex'), nonce, aad });
          const physicalHead = hashBytes(`${input.expectedPhysicalHead ?? ''}:${input.position}:${encoded}`);
          const chunk: EncryptedChunk = freeze({ store: policy.store, position: input.position, keyEpoch: keyInfo.epoch, nonce,
            ciphertext: encrypted.toString('base64'), tag: tag.toString('hex'), associatedData: aad, physicalHead });
          ensure(take(chunks.append(chunk, input.expectedPhysicalHead)) === 'durable', 'physical append did not cross durable boundary');
          const receipt = freeze({ owner: 'part-ten' as const, store: policy.store, position: input.position,
            bytesDigest: input.bytesDigest, physicalHead, durability: 'local-durable' as const }); receiptByPosition.set(input.position, receipt); return receipt;
        });
      },
      readExact(input) {
        return boundary('PersistenceReadExact', input, context, () => {
          ensure(input.store === policy.store && input.access, 'mediated access reference required'); ensure(Number.isSafeInteger(input.maxBytes) && input.maxBytes >= 0, 'finite read bound required');
          let total = 0; return freeze(input.positions.map(position => {
            const chunk = chunks.read(position); ensure(chunk && chunk.store === policy.store, 'encrypted position missing');
            const decipher = createDecipheriv('aes-256-gcm', keyBytes(take(keys.key(policy.wrappingKey, chunk.keyEpoch))), nonceBytes(chunk.nonce));
            decipher.setAAD(Buffer.from(chunk.associatedData)); decipher.setAuthTag(Buffer.from(chunk.tag, 'hex'));
            const bytes = Buffer.concat([decipher.update(Buffer.from(chunk.ciphertext, 'base64')), decipher.final()]).toString('utf8');
            total += Buffer.byteLength(bytes); ensure(total <= input.maxBytes, 'bounded read exceeded'); return bytes;
          }));
        });
      },
      flushEvidence(receipt) { return boundary('PersistenceFlushEvidence', receipt, context, () => {
        const original = receiptByPosition.get(receipt.position); const chunk = chunks.read(receipt.position);
        ensure(original && chunk && original.physicalHead === receipt.physicalHead && original.bytesDigest === receipt.bytesDigest, 'flush receipt not bound to exact durable bytes'); return original;
      }); },
    };
    return Object.freeze(port);
  });
}
