import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';
it('production package export is live in a fresh Node process', () => {
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
    import { canonical, consumeResult, decode, defineDecoder, readHistorical, rehydrateResult, rehydrateConflict, rehydrateOutcome, schemas } from '@instar/constitutional-types';
    const encoded = consumeResult(canonical({ type: 'Example', schemaVersion: 1 }), { Success: x => x, Refused: r => { throw new Error(r.detail); } });
    const refusal = consumeResult(decode('Profile', null, { preserved: 'capture:e2e' }), { Success: () => { throw new Error('null accepted'); }, Refused: r => r });
    console.log(JSON.stringify({ count: Object.keys(schemas).length, hash: encoded.hash, reason: refusal.reason, preserved: refusal.preserved,
      seams: [defineDecoder, readHistorical, rehydrateResult, rehydrateConflict, rehydrateOutcome].every(x => typeof x === 'function') }));
  `], { encoding: 'utf8' });
  expect(JSON.parse(output)).toMatchObject({ count: 18, reason: 'decode', preserved: 'capture:e2e', seams: true });
});
