// Distribution authentication is independent of the future agent's keys. The caller
// supplies an OS-admin-owned release anchor, never a key from the downloaded bundle.
import { createHash, createPublicKey, verify } from 'node:crypto';

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const safePath = path => typeof path === 'string' && path.length <= 200
  && path.split('/').every(part => /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(part));
export function verifyDistribution(material, trustedPublicKey, platform) {
  const anchor = createPublicKey(trustedPublicKey);
  if (anchor.asymmetricKeyType !== 'ed25519') throw Error('distribution: Ed25519 release anchor required');
  const bytes = Buffer.from(material.manifest);
  if (bytes.length > 512 * 1024 || !verify(null, bytes, anchor, material.signature))
    throw Error('distribution: release signature refused');
  const manifest = JSON.parse(bytes.toString('utf8'));
  if (manifest.version !== 1 || manifest.platform !== platform || !safePath(manifest.entry)
    || !Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length > 4096)
    throw Error('distribution: manifest refused');
  const files = new Map(); let total = 0;
  for (const row of manifest.files) {
    if (!safePath(row.path) || !/^[a-f0-9]{64}$/.test(row.sha256) || files.has(row.path))
      throw Error('distribution: file declaration refused');
    const content = material.files[row.path];
    if (!Buffer.isBuffer(content) && !(content instanceof Uint8Array)) throw Error('distribution: file missing');
    const copy = Buffer.from(content); total += copy.length;
    if (total > 32 * 1024 * 1024 || digest(copy) !== row.sha256) throw Error('distribution: file digest refused');
    files.set(row.path, copy);
  }
  if (!files.has(manifest.entry) || Object.keys(material.files).length !== files.size)
    throw Error('distribution: entry or file set differs');
  // A snapshot, not the source paths: changes after verification cannot change install bytes.
  return { manifest, bytes, signature: Buffer.from(material.signature), files, digest: digest(bytes) };
}
