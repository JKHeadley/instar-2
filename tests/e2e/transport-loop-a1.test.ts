import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { runChild as spawnChild } from './async-child.js';

type Wire = Readonly<{ body?: { record?: { policy?: { breaker?: unknown }; transition?: unknown; state?: unknown } } }>;

const runChild = (mode: string, directory: string) => spawnChild(process.execPath,
  [resolve('node_modules/vitest/vitest.mjs'), 'run', '--config',
    'tests/fixtures/transport-loop-a1-e2e.config.mjs', '--reporter=dot'], {
    timeout: 90_000,
    env: { ...process.env, SLB_A1_E2E_MODE: mode, SLB_A1_E2E_DIR: directory },
  });

it('SLB-A1-E2E-91 SLB-A1-CUTS-101 reconstructs all 20 persisted A1 transition cuts in fresh processes', async () => {
  const expected = {
    primary: ['scheduled/scheduled', 'attempt-admitted/running', 'opened/open-breaker',
      'half-opened/half-open', 'reopened/open-breaker', 'half-opened/half-open', 'closed/closed'],
    waiting: ['scheduled/scheduled', 'attempt-admitted/running', 'outcome-recorded/waiting'],
    stopped: ['scheduled/scheduled', 'attempt-admitted/running', 'outcome-recorded/waiting', 'stopped/stopped'],
    evidence: ['scheduled/scheduled', 'attempt-admitted/running', 'opened/open-breaker',
      'half-opened/half-open', 'outcome-recorded/half-open', 'closed/closed'],
  } as const;
  let cuts = 0;
  for (const [scenario, expectedTransitions] of Object.entries(expected)) {
    const produced = mkdtempSync(join(tmpdir(), `transport-loop-a1-${scenario}-`));
    const producer = await runChild(`produce-${scenario}`, produced);
    expect(producer.status, `${producer.stdout}\n${producer.stderr}`).toBe(0);
    const wires = JSON.parse(readFileSync(join(produced, 'facts.json'), 'utf8')) as Wire[];
    const indexes = wires.flatMap((wire, index) => wire.body?.record?.policy?.breaker === 'shared-circuit-v1'
      ? [index] : []);
    const transitions = indexes.map(index => {
      const record = wires[index]!.body!.record!;
      return `${record.transition}/${record.state}`;
    });
    expect(transitions).toEqual(expectedTransitions);
    for (const index of indexes) {
      const cut = mkdtempSync(join(tmpdir(), `transport-loop-a1-${scenario}-cut-`));
      writeFileSync(join(cut, 'facts.json'), JSON.stringify(wires.slice(0, index + 1)));
      const recovery = await runChild('recover', cut);
      expect(recovery.status, `${scenario} cut ${index}\n${recovery.stdout}\n${recovery.stderr}`).toBe(0);
      cuts++;
    }
  }
  expect(cuts).toBe(20);
}, 240_000);

it('SLB-A1-REPAIR17-E2E-114 V27 V28 returns exact mixed-evidence close and stopped results after process restart', async () => {
  for (const scenario of ['retry-evidence', 'retry-stopped']) {
    const directory = mkdtempSync(join(tmpdir(), `transport-loop-a1-${scenario}-`));
    const producer = await runChild(`produce-${scenario}`, directory);
    expect(producer.status, `${producer.stdout}\n${producer.stderr}`).toBe(0);
    const retry = await runChild(scenario, directory);
    expect(retry.status, `${retry.stdout}\n${retry.stderr}`).toBe(0);
  }
}, 120_000);
