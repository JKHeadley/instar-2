import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { beforeEach, expect, it } from 'vitest';
import { createEffectDoorway, decodeEffectPayload, effectOperationContracts } from '../../src/effects/index.js';
import { payloadInput, payloadKinds } from '../effects/payload-fixtures.js';
import { typedEffectFixture, value } from '../effects/typed-effect-fixture.js';

beforeEach(async () => { await pause(1); });

it.each(payloadKinds)('P8-TP-R6-LIFECYCLE-%s P8-NF-49 reconstructs a prepared slice-A request and dispatches it once', kind => {
  const contract = effectOperationContracts[kind];
  const effect = typedEffectFixture(undefined, 'executor:1', { payloadKind: kind, inputSchema: contract.inputSchema,
    canonicalization: contract.canonicalization, observationCapabilities: contract.observations }, [kind]);
  const payload = value(decodeEffectPayload(payloadInput(kind, effect.host), effect.host));
  const request = value(effect.api.preparePayload({ definition: effect.d.id, payload, run: effect.run,
    pending: payload.sourceResult, attempt: 'attempt:1', verificationOwner: 'verifier:1', obligation: effect.obligation,
    closure: [], fence: effect.fence }));
  const restarted = createEffectDoorway(effect.composition);
  const observation = value(restarted.dispatch(request, effect.fence));
  expect(observation.request).toBe(request.id);
  expect(effect.calls()).toBe(1);
  expect(value(restarted.dispatch(request, effect.fence)).id).toBe(observation.id);
  expect(effect.calls()).toBe(1);
});

it.each(payloadKinds)('P8-TP-R7-PROCESS-RESTART-%s uses SIGKILL and a fresh process/store without repeating the provider call', async kind => {
  const directory = await mkdtemp(join(tmpdir(), 'effect-payload-restart-'));
  const args = [resolve('node_modules/vite-node/vite-node.mjs'), resolve('tests/effects/effect-payload-restart-worker.ts')];
  const child = spawn(process.execPath, [...args, 'start', directory, kind], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    for (let attempts = 0; attempts < 600 && !existsSync(join(directory, 'ready.json')); attempts++) {
      if (child.exitCode !== null) break;
      await pause(25);
    }
    expect(existsSync(join(directory, 'ready.json'))).toBe(true);
    const exited = new Promise(resolveExit => child.once('exit', (_code, signal) => resolveExit(signal)));
    child.kill('SIGKILL');
    expect(await exited).toBe('SIGKILL');
    const recovered = spawn(process.execPath, [...args, 'recover', directory, kind], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    recovered.stdout.on('data', chunk => { stdout += String(chunk); });
    recovered.stderr.on('data', chunk => { stderr += String(chunk); });
    const completion = await Promise.race([
      new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(done =>
        recovered.once('exit', (code, signal) => done({ code, signal }))),
      pause(60_000).then(() => ({ code: null, signal: 'SIGKILL' as const })),
    ]);
    if (completion.code === null && completion.signal === 'SIGKILL' && recovered.exitCode === null) recovered.kill('SIGKILL');
    expect(completion.code, stderr).toBe(0);
    const result = JSON.parse(stdout.trim().split('\n').at(-1)!) as {
      calls: number; newCalls: number; recovered: boolean; taints: string[]; types: string[];
    };
    expect(result.calls).toBe(1);
    expect(result.newCalls).toBe(0);
    expect(result.taints).toEqual([]);
    expect(result.types).toEqual(expect.arrayContaining(['EffectPayload', 'EffectRequest', 'OperationObservation']));
    expect(result.recovered).toBe(true);
  } finally { child.kill('SIGKILL'); }
}, 90_000);
