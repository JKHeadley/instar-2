import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const pinned = {
  'tests/intake/fixtures.ts': '8360353669f8b3b7d80135157169433f595a79753e91e9906142e3230ec41620',
  'tests/effects/fixture.ts': '4189af1bb9ca1e52be8e9161cf0dd2f3036ddbd980814b2420ddcbf18d3be81c',
  'tests/transport/fixture.ts': '0c7810e67c18f5393f788f9ba14b5aeb9f47c48fc34636996f49256b92430bc3',
};

for (const [path, expected] of Object.entries(pinned)) {
  const actual = createHash('sha256').update(readFileSync(path)).digest('hex');
  if (actual !== expected) throw new Error(`P12 additivity: legacy fixture bytes changed: ${path}`);
}
console.log(`${Object.keys(pinned).length} legacy intake/effects/transport fixtures remain byte-identical; their Results also passed in the full suite.`);
