import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { sameMachineReconnectCandidate } from '../../src/harness-adapters/holder.js';
import type { HarnessEvidenceStateStorePort } from '../../src/harness-adapters/holder.js';
import { value } from '../facts/fixtures.js';
import { round9PoisonPrefixFixture } from '../harness-adapters/a2-round9-fixture.js';
import { transportFixture } from '../transport/fixture.js';

const runner = join(process.cwd(), 'node_modules/.bin/vite-node');
const worker = 'tests/harness-adapters/a2-round13-release-worker.ts';

it('A2-E2E R13-F1-CROSS-PROCESS-RELEASE P13-NF-25 P13-NF-29 P13-NF-38 release through Six file storage during the evidence read refuses reconnect', () => {
  const fixture = round9PoisonPrefixFixture({ confirmPoison: false });
  const directory = mkdtempSync(join(tmpdir(), 'p13-a2-r13-cross-process-'));
  const six = transportFixture(join(directory, 'six'));
  const fence = value(six.api.acquire('r13:file:lease', '', 500));
  let child: Readonly<{ status: number | null; stdout: string; stderr: string }> | null = null;
  let armed = true;
  const state: HarnessEvidenceStateStorePort = Object.freeze({
    ...fixture.eventState,
    load() {
      if (armed) {
        armed = false;
        const result = spawnSync(runner, [worker, join(directory, 'six')], {
          cwd: process.cwd(), encoding: 'utf8', timeout: 40_000,
        });
        child = { status: result.status, stdout: result.stdout, stderr: result.stderr };
      }
      return fixture.eventState.load();
    },
  });
  const evidence = fixture.holder(state, fixture.freshNine(fixture.fullNine));
  const decision = sameMachineReconnectCandidate({
    launch: fixture.handle.launch,
    machine: fixture.handle.machine,
    incarnation: fixture.handle.incarnation,
    fence,
    now: 22,
    evidence,
    authority: six.api,
  }, fixture.handles);
  expect(child).not.toBeNull();
  expect(child!.status, child!.stderr).toBe(0);
  expect(JSON.parse(child!.stdout)).toEqual({ release: 'Success' });
  expect(decision).toMatchObject({ disposition: 'refused', handle: null });
  expect(six.api.admitWrite('r13:file:after', fence).kind).toBe('Refused');
}, 60_000);

it('A2-E2E R13-F1-CROSS-PROCESS-RELEASE-CONTROL P13-NF-25 P13-NF-29 P13-NF-38 unchanged Six file storage and evidence reconnect', () => {
  const fixture = round9PoisonPrefixFixture({ confirmPoison: false });
  const directory = mkdtempSync(join(tmpdir(), 'p13-a2-r13-cross-process-control-'));
  const six = transportFixture(join(directory, 'six'));
  const fence = value(six.api.acquire('r13:file:lease', '', 500));
  expect(sameMachineReconnectCandidate({
    launch: fixture.handle.launch,
    machine: fixture.handle.machine,
    incarnation: fixture.handle.incarnation,
    fence,
    now: 22,
    evidence: fixture.evidence,
    authority: six.api,
  }, fixture.handles)).toMatchObject({ disposition: 'reconnect', handle: fixture.handle });
}, 60_000);
