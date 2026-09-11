import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { beforeAll, expect, it } from 'vitest';

const bundles = mkdtempSync(join(tmpdir(), 'p12-round5-bundles-'));
const intakeChild = join(bundles, 'intake-child.mjs');
const outboundChild = join(bundles, 'outbound-child.mjs');

beforeAll(async () => {
  await Promise.all([
    build({ entryPoints: [resolve('tests/conversation/telegram.round5.intake-child.ts')],
      outfile: intakeChild, bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'silent' }),
    build({ entryPoints: [resolve('tests/conversation/telegram.round5.outbound-child.ts')],
      outfile: outboundChild, bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'silent' }),
  ]);
}, 30_000);

function cutAndRecover(child: string, phase: string) {
  const directory = mkdtempSync(join(tmpdir(), `p12-round5-${phase}-`));
  const writer = spawnSync(process.execPath, [child, directory, phase, 'write'], {
    encoding: 'utf8', timeout: 30_000, maxBuffer: 16 * 1024 * 1024,
  });
  expect(writer.signal, `${phase} writer stderr: ${writer.stderr}`).toBe('SIGKILL');
  const reader = spawnSync(process.execPath, [child, directory, phase, 'read'], {
    encoding: 'utf8', timeout: 30_000, maxBuffer: 16 * 1024 * 1024,
  });
  expect(reader.status, `${phase} reader stderr: ${reader.stderr}`).toBe(0);
  return JSON.parse(reader.stdout.trim()) as any;
}

it.each([
  'before-capture', 'after-capture', 'after-receipt', 'after-admit', 'after-poll-return', 'after-next-poll',
] as const)(
  'P12-NF-06 P12-NF-18 P12-NF-38 P12-NF-48 round5 real SIGKILL intake cut %s reconstructs custody and cursor from facts',
  phase => {
    const recovered = cutAndRecover(intakeChild, phase);
    expect(recovered.phase).toBe(phase);
    expect(recovered.offsetAfterRecovery).toBe(101);
    expect(recovered.admissionsAfter).toBe(1);
    expect(recovered.captures).toBe(1);
    if (phase === 'before-capture' || phase === 'after-capture') {
      expect(recovered).toMatchObject({ offsetBeforeRecovery: 100, receiptsBefore: 0, admissionsBefore: 0 });
    } else {
      expect(recovered).toMatchObject({ offsetBeforeRecovery: 101, receiptsBefore: 1 });
      expect(recovered.recovery.kind).toBe('Success');
    }
  },
  60_000,
);

it.each(['chat', 'topic', 'sender'] as const)(
  'P12-NF-06 P12-NF-16 P12-NF-18 P12-NF-38 round5 real SIGKILL mismatch-%s receipt stays owned but cannot advance the declared route cursor',
  field => {
    const recovered = cutAndRecover(intakeChild, `mismatch-${field}`);
    expect(recovered).toMatchObject({
      phase: `mismatch-${field}`,
      offsetBeforeRecovery: 100,
      offsetAfterRecovery: 100,
      receiptsBefore: 1,
      admissionsBefore: 0,
      admissionsAfter: 0,
      captures: 1,
    });
    expect(recovered.recovery.kind).toBe('Refused');
  },
  60_000,
);

const outboundExpectations = [
  ['prepared', 'Success', 'response', 1],
  ['claimed', 'Refused', '', 0],
  ['claim-durable', 'Refused', '', 0],
  ['consumed', 'Refused', '', 0],
  ['acceptance', 'Success', 'executor-accepted', 0],
  ['acceptance-durable', 'Success', 'executor-accepted', 0],
  ['before-provider', 'Success', 'executor-accepted', 0],
  ['after-provider', 'Success', 'executor-accepted', 1],
  ['response', 'Success', 'response', 1],
] as const;

it.each(outboundExpectations)(
  'P12-NF-28 P12-NF-33 P12-NF-38 P12-NF-48 round5 real SIGKILL outbound cut %s retains one-operation recovery',
  (phase, kind, stage, calls) => {
    const recovered = cutAndRecover(outboundChild, phase);
    expect(recovered.phase).toBe(phase);
    expect(recovered.result.kind).toBe(kind);
    expect(recovered.result.kind === 'Success' ? recovered.result.value.stage : '').toBe(stage);
    expect(recovered.calls).toBe(calls);
    expect(recovered.calls).toBeLessThanOrEqual(1);
    expect(recovered.settlements).toBe(0);
    expect(recovered.reservations.filter((row: { state: string }) => row.state === 'prepared')).toHaveLength(1);
    expect(new Set(recovered.reservations.map((row: { operation: string }) => row.operation)).size).toBe(1);
    if (phase === 'prepared') {
      expect(recovered.reservations.map((row: { state: string }) => row.state)).toContain('consumed');
      expect(recovered.observations.map((row: { stage: string }) => row.stage)).toContain('response');
    }
    if (['acceptance', 'acceptance-durable', 'before-provider', 'after-provider'].includes(phase)) {
      expect(recovered.observations.map((row: { stage: string }) => row.stage)).toEqual(['executor-accepted']);
    }
  },
  60_000,
);
