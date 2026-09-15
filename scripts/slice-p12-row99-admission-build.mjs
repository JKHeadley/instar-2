import { resolve } from 'node:path';
import { build } from 'esbuild';

const [source, output] = process.argv.slice(2);
if (!source || !output) throw new Error('usage: slice-p12-row99-admission-build.mjs <source.ts> <output.mjs>');
await build({
  entryPoints: [resolve(source)],
  outfile: resolve(output),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
});
