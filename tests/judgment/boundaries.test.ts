import { renameSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { authorAndAppend } from '../../src/facts/index.js';
import { json, privateKey } from '../facts/fixtures.js';
import type { DispatchClaim } from '../../src/transport/index.js';
import type { JudgmentResolution, ProviderObservation } from '../../src/judgment/index.js';
import { judgmentFixture, refused, value } from './fixture.js';

it('P7-NF-22 P7-NF-31 zero capture capacity and input boundary-plus-one prevent any invocation', async () => {
  const empty = judgmentFixture({ capacity: 0 }); refused(await empty.door.judge(empty.input, empty.start()), 'capacity exhausted'); expect(empty.calls).toHaveLength(0);
  const full = judgmentFixture(); refused(await full.door.judge({ ...full.input, question: 'x'.repeat(full.host.description.maxInputBytes + 1) }, full.start()), 'submitted byte bound');
  expect(full.calls).toHaveLength(0);
  const positive = judgmentFixture(); value(await positive.door.judge(positive.input, positive.start())); expect(positive.calls).toHaveLength(1);
});
it('P7-NF-11 P7-NF-12 unreserved/cloned claims cannot enter the provider boundary', async () => {
  const f = judgmentFixture(), token = f.start(), bytes = value(f.model.prepare({ question: 'unreserved' }));
  const claim = { operation: 'invented', attempt: 'attempt:1', digest: value(canonical(bytes)).hash, executor: 'worker:1' } as DispatchClaim;
  refused(await f.model.exchange({ claim, fence: token, bytes, deadline: 400, incarnation: 'worker:1' }), 'no admitted provider observation');
  expect(f.calls).toHaveLength(0);
  value(await f.door.judge(f.input, token)); expect(f.calls).toHaveLength(1);
});
it('P7-NF-09 a callback retained after exchange returns is not later invocation permission', async () => {
  let delayed!: () => Promise<ProviderObservation>;
  const f = judgmentFixture({ client: { automaticRetries: 0, execute: async send => { delayed = send; } } });
  refused(await f.door.judge(f.input, f.start()), 'no admitted provider observation');
  await expect(delayed()).rejects.toThrow('exchange already returned'); expect(f.calls).toHaveLength(0);
});
it('P7-NF-02 P7-NF-17 direct P2 append cannot skip phases, replace an answer or add a second terminal', async () => {
  const f = judgmentFixture(), token = f.start();
  value(await f.door.judge(f.input, token));
  const all = value(f.door.inspect()), terminal = all.at(-1)!;
  refused(f.spine.append({ ...terminal.record, id: 'forged:resolution', predecessor: terminal.fact.id } as JudgmentResolution), 'terminal question cannot reopen');
  const early = judgmentFixture({ invoke: async () => {
    const records = value(early.door.inspect());
    refused(early.spine.append({ type: 'JudgmentResolution', schemaVersion: 1, id: 'fake:resolution', request: early.input.id,
      predecessor: records.at(-1)!.fact.id, attempt: 'attempt:question:1:1', disposition: 'decided', response: 'missing', accounting: 'missing', decoded: 'missing' } as JudgmentResolution), 'requires all durable');
    return early.observation;
  } });
  value(await early.door.judge(early.input, early.start()));
});
it('P7-NF-04 P7-NF-25 P7-NF-39 a cached result is not usable after generation, standing, stop or lease changes', async () => {
  for (const cut of ['generation', 'standing', 'stop', 'lease']) {
    const f = judgmentFixture(), token = f.start(); const q = { ...f.input, deadline: 1000 };
    value(await f.door.judge(q, token));
    if (cut === 'generation') f.generation('generation:2');
    if (cut === 'standing') f.grants.splice(0);
    if (cut === 'stop') f.stop();
    if (cut === 'lease') f.time(601);
    refused(f.door.readAnswer(q.id, token)); expect(f.calls).toHaveLength(1);
  }
});
it('P7-NF-34 P7-NF-43 P7-NF-45 missing local capture cannot be replaced by cached metadata or remote bytes', async () => {
  const f = judgmentFixture(), token = f.start(); value(await f.door.judge(f.input, token));
  const response = value(f.door.inspect()).find(v => v.record.type === 'JudgmentAttemptRecord' && v.record.receipt)?.record;
  if (response?.type !== 'JudgmentAttemptRecord' || !response.receipt) throw new Error('missing response');
  const path = join(f.directory, 'captures', response.receipt.hash.slice(7));
  renameSync(path, `${path}.held-for-test`); // Recoverable loss simulation of test-owned bytes.
  refused(f.door.readAnswer(f.input.id, token), 'local capture missing'); expect(f.calls).toHaveLength(1);
  refused(f.captures.read({ ...response.receipt, reference: 'https://remote.example/raw' }), 'invalid local');
  renameSync(`${path}.held-for-test`, path); value(f.captures.read(response.receipt));
  expect(value(f.door.readAnswer(f.input.id, token)).decision.floor?.chosen).toBe('work');
});
it('P7-NF-28 observed over-cap charge remains recorded and cannot debit or release another reservation', async () => {
  const base = judgmentFixture();
  const f = judgmentFixture({ observation: { ...base.observation, usage: { ...base.observation.usage, charge: 21 } } });
  refused(await f.door.judge(f.input, f.start()), 'liability exceeds reservation');
  const response = value(f.door.inspect()).find(v => v.record.type === 'JudgmentAttemptRecord' && v.record.receipt)?.record;
  if (response?.type !== 'JudgmentAttemptRecord' || !response.receipt) throw new Error('missing response');
  expect(JSON.parse(value(f.captures.read(response.receipt)))).toMatchObject({ usage: { charge: 21 } });
  expect(value(f.six.inspect()).at(-1)?.record).toMatchObject({ charge: 20, state: 'consumed' });
});
it('P7-NF-02 P7-NF-39 a genuine machine signature does not let a different principal author judgment facts', async () => {
  const f = judgmentFixture(), token = f.start(); value(await f.door.judge(f.input, token));
  const original = value(f.door.inspect())[0]!.record;
  const forged = authorAndAppend({ kind: 'judgment-JudgmentRequest', schemaVersion: 1, machine: f.host.transport.machine,
    principal: json(f.bob), provenance: json(f.bob.provenance), at: json(f.now), body: json({ record: original }), required: [] }, f.ctx, f.store, privateKey);
  refused(forged, 'recorder identity mismatch');
  const unknown = { ...original, schemaVersion: 2 };
  refused(authorAndAppend({ kind: 'judgment-JudgmentRequest', schemaVersion: 1, machine: f.host.transport.machine,
    principal: json(f.alice), provenance: json(f.alice.provenance), at: json(f.now), body: json({ record: unknown }), required: [] }, f.ctx, f.store, privateKey), 'version');
});
it('P7-NF-07 P7-NF-11 unknown evidence or an exhausted deadline cannot buy a model call', async () => {
  for (const change of [{ evidence: ['invented-evidence'] }, { deadline: 100 }]) {
    const f = judgmentFixture(); refused(await f.door.judge({ ...f.input, ...change }, f.start())); expect(f.calls).toHaveLength(0);
  }
});
