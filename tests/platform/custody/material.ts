import { generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { factsFixture } from '../../facts/fixtures.js';
// @ts-expect-error Physical distribution adapter stays outside the pure core.
import { digest } from '../../../scripts/custody-platform/distribution.mjs';
export function signedMaterial(platform = 'linux') {
  const keys = generateKeyPairSync('ed25519');
  const files: Record<string, Buffer> = {
    'entry.mjs': readFileSync('tests/platform/custody/probe-entry.mjs'),
    'package.json': Buffer.from('{"type":"module"}'),
    'context.json': Buffer.from(JSON.stringify(factsFixture().c)),
  };
  const walk = (base: string) => {
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      const path = join(base, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (path.endsWith('.js')) files[path] = readFileSync(path);
    }
  };
  walk('dist');
  const manifest = Buffer.from(JSON.stringify({ version: 1, platform, entry: 'entry.mjs',
    files: Object.entries(files).map(([path, bytes]) => ({ path, sha256: digest(bytes) })) }));
  return { material: { manifest, signature: sign(null, manifest, keys.privateKey), files },
    anchor: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    resign: (bytes: Buffer) => sign(null, bytes, keys.privateKey) };
}
