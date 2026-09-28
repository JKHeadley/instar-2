import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { createIntakePort } from '../../src/intake/index.js';
import { intakeFixture, message, route, value } from './fixtures.js';
// @ts-expect-error The shared first-landing baseline checker is plain ESM.
import { firstLanding } from '../../scripts/first-landing.mjs';

type Factory = typeof createIntakePort;
type Outcome = Readonly<{ ok: true; value: unknown }>
  | Readonly<{ ok: false; detail: string; reason: string }>;

async function mainFactory(): Promise<Factory> {
  const root = process.cwd();
  let main = 'main';
  try { execFileSync('git', ['rev-parse', '--verify', main], { cwd: root, stdio: 'ignore' }); }
  catch { main = 'origin/main'; }
  const base = execFileSync('git', ['merge-base', 'HEAD', main], { cwd: root, encoding: 'utf8' }).trim();
  let source = execFileSync('git', ['show', `${base}:src/intake/port.ts`], { cwd: root, encoding: 'utf8' });
  for (const [from, to] of [
    ["'../index.js'", `'${resolve(root, 'src/index.js')}'`],
    ["'../facts/index.js'", `'${resolve(root, 'src/facts/index.js')}'`],
    ["'../register/index.js'", `'${resolve(root, 'src/register/index.js')}'`],
    ["'../projections/index.js'", `'${resolve(root, 'src/projections/index.js')}'`],
    ["'./boundary.js'", `'${resolve(root, 'src/intake/boundary.js')}'`],
    ["'./contracts.js'", `'${resolve(root, 'src/intake/contracts.js')}'`],
    ["'./records.js'", `'${resolve(root, 'src/intake/records.js')}'`],
  ] as const) source = source.replaceAll(from, to);
  const directory = mkdtempSync(join(tmpdir(), 'p11-r10-main-intake-'));
  const file = join(directory, 'port.ts');
  writeFileSync(file, source);
  return (await import(`${pathToFileURL(file).href}?base=${base}`)).createIntakePort as Factory;
}

function outcome(result: unknown): Outcome {
  return consumeResult<unknown, Outcome>(result as never, {
    Success: value => ({ ok: true, value }),
    Refused: refusal => ({ ok: false, detail: refusal.detail, reason: refusal.reason }),
  });
}

// Rule 37 quarantine: see docs/defects/stale-main-baseline-additivity.md
it.skip('R10 rereview8 V95 compares 20 ordinary receive/recover/expire outcomes on P11 first landing', async () => {
  const scope = firstLanding(process.cwd(), ['src/operator/seams.ts']);
  if (!scope.applicable) {
    console.log(`P11 intake round10 first-landing comparison inapplicable: operator seams unit already present on current-main baseline ${scope.mainTip}.`);
    return;
  }
  const legacy = await mainFactory();
  const payloads = [
    message(),
    message(''),
    '{',
    JSON.stringify({ schemaVersion: 1, kind: 'stop', command: '/stop' }),
    JSON.stringify({ schemaVersion: 1, kind: 'authorization', valid: true }),
    JSON.stringify({ schemaVersion: 1, kind: 'message', text: 'hello', grant: { actions: ['work'] } }),
    JSON.stringify({ schemaVersion: 2, kind: 'message', text: 'hello' }),
    JSON.stringify({ schemaVersion: 1, kind: 'message', text: 100 }),
    JSON.stringify({ schemaVersion: 1, kind: 'message', text: 'hello', principal: 'alice' }),
    JSON.stringify({ schemaVersion: 1, kind: 'message', text: 'yes, approve' }),
  ];
  let compared = 0;
  for (const bind of [false, true]) for (const raw of payloads) {
    const run = (factory: Factory) => {
      const f = intakeFixture();
      if (bind) f.bind();
      const port = value(factory(f.deps));
      const first = outcome(port.receive(raw, route));
      const receipts = f.facts().filter(row => row.kind === 'intake-receipt');
      const recovery = receipts.map(row => outcome(port.recover(row.id)));
      f.setTime(1200);
      return { first, recovery, expiry: outcome(port.expireHolds()) };
    };
    expect(run(createIntakePort), `${bind}:${raw}`).toEqual(run(legacy));
    compared++;
  }
  expect(compared).toBe(20);
}, 120_000);
