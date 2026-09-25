// @ts-nocheck -- installed owner fixture records genuine Four/Five/Six facts.
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
// @ts-expect-error Offline Node fixture outside the TypeScript source graph.
import { installedServingFixture, installServingBinding } from '../fixtures/production-serving-host.mjs';
import { extractTelegramUpdate } from '../../src/conversation/index.js';
import { runIdFor } from '../../src/rungraph/index.js';
import { value, refused } from '../facts/fixtures.js';

it('binds real Four/Five input to genuine Six and keeps the slot until host quiescence', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'production-serving-port-')));
  try {
    const active = new Set();
    const fixture = await installedServingFixture(root, { provider: 'test-provider', model: 'model', route: 'route',
      disclosure: 'recorded provider', automaticRetries: 0, environment: 'local-test',
      invoke: async () => { throw Error('provider must not run during construction'); } });
    const built = fixture.boot();
    const app = built.application;
    expect(app.owners.serving.owner).toBe('part-six');
    expect(value(app.owners.serving.inspect()).binding).toBeNull();
    const batch = value(built.api.poll({ token: built.declaration.token, apiVersion: built.declaration.apiVersion,
      offset: 0, limit: 100, timeout: 0 }));
    const route = extractTelegramUpdate(batch.updates[0], built.declaration).route;
    expect(value(app.owners.transport.inspect()).map(row => row.record.type)).toEqual(['Lease']);
    const binding = installServingBinding(built, batch.updates[0]);
    const installation = value(built.f.store.read()).find(row => row.kind === 'assembly-ProductionInstallation');
    value(app.owners.serving.registerQuiescence(run => !active.has(run)));
    value(app.owners.serving.bind('serving:installed', built.f.effects.fence, {
      installation: installation.id, conversation: binding.id, ceiling: 100, maxTurns: 2,
      maxReplies: 1, expires: 500, providerMax: 20, replyMax: 5,
      errorLimit: 3, totalErrorLimit: 5 }));
    const received = value(app.owners.intake.receive(batch.updates[0], route));
    expect(received.kind).toBe('admitted');
    const input = value(built.f.store.read()).find(row => row.id === received.fact.id);
    expect(input.body.binding).toBe(binding.id);
    built.f.bindIntake(input);
    const run = value(app.owners.run.open(built.f.run));
    expect(run.run.id).toBe(built.f.id);
    const admitted = value(app.owners.serving.admitTurn('turn:real:1', built.f.effects.fence,
      input.id, run.run.id));
    expect(admitted).toMatchObject({ action: 'admit', input: input.id, provider: run.run.id });
    expect(value(app.owners.serving.inspect()).slot).toBe(run.run.id);
    active.add(run.run.id);
    expect(refused(app.owners.serving.retire('retire:real:1', built.f.effects.fence, run.run.id, '')))
      .toContain('local executor has not returned or terminated');
    const raw = batch.updates[1], nextRoute = extractTelegramUpdate(raw, built.declaration).route;
    const received2 = value(app.owners.intake.receive(raw, nextRoute));
    expect(received2.kind).toBe('admitted');
    const input2 = value(built.f.store.read()).find(row => row.id === received2.fact.id);
    expect(input2.body.binding).toBe(binding.id);
    const reference = fact => ({ owner: 'part-two', name: 'FactEnvelope', id: fact.id });
    const nextRun = { ...built.f.run, id: runIdFor(reference(input2)), opening: reference(input2),
      intent: { type: 'Intent', id: input2.body.intent.id, fact: reference(input2), field: 'intent' },
      authority: { resolution: reference(input2), grants: [] },
      resultDestination: { ...built.f.run.resultDestination, route: reference(input2) } };
    const opened2 = value(app.owners.run.open(nextRun));
    expect(refused(app.owners.serving.admitTurn('turn:real:2', built.f.effects.fence, input2.id, opened2.run.id)))
      .toContain('serving slot unavailable');
    active.delete(run.run.id);
    value(app.owners.serving.retire('retire:real:1', built.f.effects.fence, run.run.id, ''));
    value(app.owners.serving.admitTurn('turn:real:2', built.f.effects.fence, input2.id, opened2.run.id));
    expect(value(app.owners.serving.inspect())).toMatchObject({ turns: 2, slot: opened2.run.id });
    app.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);
