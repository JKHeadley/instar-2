import { readFileSync } from 'node:fs';
import { consumeResult } from '../../dist/index.js';
import { createTransportSlice } from '../../scripts/transport-slice.mjs';

const [seedPath, directory, mode, cursorId] = process.argv.slice(2);
const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const take = result => consumeResult(result, { Success: value => value, Refused: refusal => { throw new Error(refusal.detail); } });
const slice = createTransportSlice(seed, directory, {
  incarnation: mode === 'start' ? 'worker:scan-1' : 'worker:scan-2',
  authorityIncarnation: mode === 'start' ? 'authority:scan-1' : 'authority:scan-2',
  monotonic: () => mode === 'start' ? 100 : 120,
});
const page = take(slice.dueScan.page({
  scan: 'verification-due', generation: 'due:g1', orderedKeys: ['a', 'b', 'c'],
  cursor: cursorId ? { owner: 'part-six', name: 'ScanCursor', id: cursorId } : null,
  maxItems: 2, maxDuration: 100,
}));
process.stdout.write(JSON.stringify(page) + '\n');
