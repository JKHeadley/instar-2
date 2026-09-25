// @ts-nocheck -- integration fixture configuration; owner methods are the landed implementations.
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { createFactStore } from '../../src/facts/index.js';
import { createIntakePort, intakeWorkRegistration, intakeStopRegistration } from '../../src/intake/index.js';
import { admitTelegramAdapter, createTelegramIntakeAdapter, extractTelegramUpdate } from '../../src/conversation/index.js';
import { createProductionTelegramCustodian } from '../../src/assembly/production-telegram.js';
import { validateAssemblyRecordReferences } from '../../src/assembly/index.js';
import { openProductionStorage } from '../../src/assembly/production-storage.js';
import { conversationFixture } from '../conversation/fixture.js';
import { createProductionBootOwnerFixture } from './production-boot-owner-fixture.js';
import { genuineProductionComposition } from './genuine-production-fixture.js';
import { productionBindingSet } from './production-fixture.js';
import { value } from '../facts/fixtures.js';
import { productionStorageIO, createProductionNativeContextIO } from '../../scripts/production-boot-io.mjs';

it.each([false, true])('deferred admission %s: recorded Telegram → Four → native Five grounding; replication peer and Six run admission use landed fixture bindings (U4-C/U4-F)', deferred => {
  const getMe = readFileSync('tests/assembly/telegram-recorded/getMe.json', 'utf8');
  const poll = readFileSync('tests/assembly/telegram-recorded/poll-0.json', 'utf8');
  const bot = JSON.parse(getMe).result;
  const t = conversationFixture({ botId: String(bot.id), skipInitialAdmission: true });
  const c = { ...t.intake.context.decode, site: t.intake.f.c.site, preserved: t.intake.f.c.preserved };
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'boot-telegram-four-five-')));
  const storage = value(openProductionStorage({ root, machine: 'machine-a', key: new Uint8Array(32).fill(19),
    policy: 'policy', store: 'store', context: c, io: productionStorageIO }));
  try {
    const declaration = { ...t.declaration, bot: { ...t.declaration.bot, username: `@${bot.username}` } };
    const plan = value(t.verification.inspectCurrent()).find(row => row.record.type === 'VerificationPlan').record;
    const captures = { owner: 'part-ten', read: reference => storage.captures.read(reference),
      preserve: (reference, bytes) => {
        const durable = storage.captures.preserve(reference, bytes);
        if (durable && !reference.includes(':sealed-getMe:')) {
          t.intake.f.captures[reference] = bytes; t.intake.syncCaptures();
        }
        return durable;
      } };
    const api = value(createProductionTelegramCustodian({ context: c, declaration, credential: declaration.token,
      resolveSecret: () => '8820318295:synthetic_recorded_test_only_value', captures,
      machine: 'machine-a', now: () => t.intake.f.clock(100), freshFor: 50,
      identityEvidence: { verification: t.verification, plan: plan.id,
        arm: plan.arms.find(arm => arm.required).id, generation: 'generation:fixture' },
      io: { invoke: request => ({ kind: 'response', status: 200,
        bytes: request.method === 'getMe' ? getMe : poll }) } }));
    const admitted = value(admitTelegramAdapter(declaration, { ...t.admissionDependencies, api }));
    const batch = value(api.poll({ token: declaration.token, apiVersion: declaration.apiVersion, offset: 0, limit: 100, timeout: 0 }));
    const raw = batch.updates[0], extracted = extractTelegramUpdate(raw, declaration);
    const context = t.intake.context;
    Object.assign(context, { ownedBodies: [
      value(intakeWorkRegistration(c, t.intake.deps.author.principal.id)),
      value(intakeStopRegistration(c, t.intake.deps.author.principal.id))] });
    const intake = value(createIntakePort({ ...t.intake.deps, governance: t.governed.governance,
      adapter: createTelegramIntakeAdapter(admitted, api), storage: storage.segment,
      capture: { owner: 'part-ten', preserve: (bytes, at) => {
        const captured = value(t.intake.deps.capture.preserve(bytes, at));
        const update = extractTelegramUpdate(bytes, declaration);
        const witnessed = `capture:telegram:update-${update.updateId}:${captured.hash.slice(7)}`;
        const readable = api.readCapture(witnessed);
        if (readable.kind !== 'Success' || readable.value !== bytes
          || !storage.captures.preserve(witnessed, bytes)) throw Error('intake custody failed');
        t.intake.f.captures[witnessed] = bytes; t.intake.syncCaptures();
        return t.intake.f.success({ ...captured, reference: witnessed });
      } }, dedupGeneration: () => ({ reference: context.decode.register.generation,
        kinds: context.schemas.map(schema => schema.kind), lineages: { 'machine-a': {
          head: storage.segment.read().at(-1)?.segment ?? null, observedAt: 100, closed: false } } }) }));
    const result = value(intake.receive(raw, extracted.route));
    expect(result.kind).toBe('admitted');
    const facts = value(createFactStore(context, storage.segment).read());
    const opening = facts.find(row => row.id === result.fact.id);
    expect(opening.kind).toBe('intake-admitted');
    const f = createProductionBootOwnerFixture(() => storage.segment, { minimal: true, deferred, native: { captures: storage.captures, io: createProductionNativeContextIO(storage.captures) },
      intake: { ...context, facts, opening: deferred ? undefined : opening } });
    if (deferred) f.bindIntake(opening);
    let receiptCaptureChecked = false;
    f.setMutation(spec => {
      const signedFacts = value(f.store.read());
      const receipt = signedFacts.find(row => row.id === opening.body.receipt);
      const capture = receipt.body.capture;
      expect(capture.reference).not.toBe(opening.body.rawHash);
      expect(spec.contextManifest).toContainEqual({ class: 'message', reference: capture.reference, digest: capture.hash });
      const validation = { ...f.c, history: f.runtime.history, ownerFacts: { ...f.ctx, facts: signedFacts } };
      expect(() => validateAssemblyRecordReferences(spec, validation)).not.toThrow();
      const unbound = { ...spec, contextManifest: spec.contextManifest.map(row => row.class === 'message'
        ? { ...row, reference: opening.body.rawHash } : row) };
      expect(() => validateAssemblyRecordReferences(unbound, validation))
        .toThrow('context delivery manifest does not contain the exact input capture');
      receiptCaptureChecked = true;
    });
    const production = genuineProductionComposition(f, productionBindingSet());
    const run = value(production.run.port.open(f.run));
    expect(run.run.opening.id).toBe(opening.id);
    const grounding = value(production.run.port.ground(f.id, 'w', 'native', 'start', f.lease));
    expect(receiptCaptureChecked).toBe(true);
    expect(grounding.body.record.intake.id).toBe(opening.id);
    expect(grounding.body.record.messages[0].hash).toBe(opening.body.rawHash);
    expect(storage.captures.read(facts.find(row => row.id === opening.body.receipt).body.capture.reference)).toBe(raw);
  } finally { storage.close(); rmSync(root, { recursive: true, force: true }); }
}, 120000);
