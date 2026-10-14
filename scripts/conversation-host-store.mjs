// Host-owned encrypted snapshot under the existing conversation fence, outside worker scope.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { openSync, closeSync, fsyncSync, readFileSync, writeFileSync, renameSync, constants } from 'node:fs';
import { dirname } from 'node:path';
const aad = Buffer.from('instar-conversation-host-v1');
export function createConversationHostStore(path, key) {
  if (!(key instanceof Uint8Array) || key.byteLength !== 32) throw Error('host custody key required');
  return {
    load() {
      let encoded;
      try { encoded = readFileSync(path, 'utf8'); }
      catch (error) { if (error.code === 'ENOENT') return null; throw error; }
      const row = JSON.parse(encoded);
      if (row.version !== 1) throw Error('unsupported conversation snapshot');
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(row.nonce, 'base64'));
      decipher.setAAD(aad); decipher.setAuthTag(Buffer.from(row.tag, 'base64'));
      return JSON.parse(Buffer.concat([decipher.update(Buffer.from(row.bytes, 'base64')), decipher.final()]).toString('utf8'));
    },
    save(state) {
      const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, nonce); cipher.setAAD(aad);
      const bytes = Buffer.concat([cipher.update(JSON.stringify(state), 'utf8'), cipher.final()]);
      const encoded = JSON.stringify({ version: 1, nonce: nonce.toString('base64'), tag: cipher.getAuthTag().toString('base64'), bytes: bytes.toString('base64') });
      const temporary = `${path}.${process.pid}.tmp`;
      const fd = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW, 0o600);
      try { writeFileSync(fd, encoded); fsyncSync(fd); } finally { closeSync(fd); }
      renameSync(temporary, path);
      const directory = openSync(dirname(path), 'r');
      try { fsyncSync(directory); } finally { closeSync(directory); }
    },
  };
}
