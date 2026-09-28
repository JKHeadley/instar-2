// @ts-nocheck -- U4-G recorded fixture host; never imported by production code.
import { readFileSync, writeFileSync, cpSync, mkdirSync, openSync, fsyncSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import { installedFixtureHost } from './production-boot-installed-fixture.js';
import { localProvider } from '../model-provider/http-provider.js';
import { runRecordedConversation } from './production-boot-trace.js';
import { recordedCheckpoint } from './production-boot-checkpoint.js';
import { value } from '../facts/fixtures.js';
import assert from 'node:assert/strict';
function durableJSON(path, data) {
  writeFileSync(path, JSON.stringify(data)); const fd = openSync(path, 'r');
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
export async function createProductionHost() {
  const input = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const action = process.env.INSTAR_U4_RECORDED_ACTION ?? 'trace';
  const recovery = ['inspect', 'pause'].includes(action)
    ? JSON.parse(readFileSync(join(input.storageRoot, 'recorded-checkpoint.json'), 'utf8')) : undefined;
  const http = action === 'trace' ? await localProvider() : { requests: [], close: async () => {} };
  let ordinal = 0, providerAttempts = 0, fixture;
  const checkpoint = (stage, installed) => {
    // A fault-injection point carrying capture evidence, not installed state: it
    // is neither a recorded prefix nor a physical provider/Telegram invocation.
    if (stage === 'initial-capture-durable') return;
    if (recovery) throw Error('restart attempted a physical invocation');
    durableJSON(join(input.storageRoot, 'recorded-checkpoint.json'), recordedCheckpoint(installed, stage));
    const directory = process.env.INSTAR_U4_RECORDED_SNAPSHOTS;
    if (directory) {
      mkdirSync(directory, { recursive: true });
      cpSync(input.storageRoot, join(directory, `${String(ordinal++).padStart(2, '0')}-${stage}`), { recursive: true });
    }
    process.stderr.write(`recorded durable boundary: ${stage}\n`);
  };
  const route = { provider: 'test-provider', model: 'model', route: 'route', disclosure: 'recorded provider',
    automaticRetries: 0, environment: 'local-test', invoke: async bytes => {
      providerAttempts++;
      if (recovery) throw Error('restart attempted a provider invocation');
      checkpoint('provider-before-response', fixture.state());
      const response = await fetch(http.endpoint, { method: 'POST', body: bytes,
        headers: { Authorization: `Bearer ${http.credential}`, 'Content-Type': 'application/json' } });
      const result = await response.json();
      checkpoint('provider-after-response', fixture.state());
      return result;
    } };
  fixture = installedFixtureHost(input.storageRoot, route, { recovery, physicalCheckpoint: checkpoint });
  return { ...fixture.host, async run(application) {
    const installed = fixture.state(); installed.application = application;
    try {
      if (action === 'boot-only') {
        installed.receive(application);
        durableJSON(join(input.storageRoot, 'boot-proof.json'), { admitted: true, calls: installed.calls });
      } else if (recovery) {
        const all = value(installed.f.store.read());
        assert.deepEqual(all.map(row => ({ id: row.id, kind: row.kind, hash: row.contentHash })), recovery.facts);
        assert.equal(installed.f.id, recovery.run);
        if (action === 'pause') {
          process.on('message', () => {});
          process.send({ ready: true, stage: recovery.stage, head: all.at(-1).contentHash });
          await new Promise(() => {}); // Parent sends a real SIGKILL with the root lease held.
        } else {
          const graph = all.some(row => row.kind === 'run-opening') ? value(application.owners.run.read(installed.f.id)) : null;
          const evidence = {
            stage: recovery.stage, head: all.at(-1).contentHash, count: all.length,
            run: graph && { head: graph.head, pending: graph.pending.map(step => step.id), state: graph.state },
            effects: value(application.boot.coordinator.handles.effect.port.inspect()).map(row => row.fact.id),
            provider: value(application.owners.provider.eight.inspect()).map(row => row.id),
            assessments: value(application.owners.provider.nine.inspect()).map(row => row.fact.id),
            accounting: value(installed.f.effects.transport.inspect()).map(row => ({ id: row.fact.id, record: row.record })),
            calls: installed.calls, providerCalls: http.requests.length, providerAttempts,
          };
          assert.deepEqual(installed.calls, ['getMe']); assert.equal(http.requests.length, 0); assert.equal(providerAttempts, 0);
          assert.deepEqual(value(installed.f.store.read()).map(row => ({ id: row.id, kind: row.kind, hash: row.contentHash })), recovery.facts);
          if (recovery.stage === 'reply-accounted') {
            const final = evidence.accounting.filter(row => row.record.type === 'SettlementApplication').at(-1).record;
            assert.equal(final.actualCharge, -1); assert.equal(final.unresolved, 1); assert.equal(final.retryEligible, 0);
            assert.equal(graph.pending.length, 1);
          }
          durableJSON(join(input.storageRoot, 'recovery-proof.json'), evidence);
        }
      } else {
        const proof = await runRecordedConversation(installed, http, async stage => {
          checkpoint(stage, installed);
          await new Promise(resolve => setImmediate(resolve));
        });
        durableJSON(join(input.storageRoot, 'trace-proof.json'), proof);
      }
    } finally { await http.close(); }
  } };
}
