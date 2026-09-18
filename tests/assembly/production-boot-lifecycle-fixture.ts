// @ts-nocheck -- integration fixture configuration; owner methods are the landed implementations.
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonical } from '../../src/index.js';
import { createFactStore } from '../../src/facts/index.js';
import { createIntakePort, intakeWorkRegistration, intakeStopRegistration } from '../../src/intake/index.js';
import { admitTelegramAdapter, createTelegramIntakeAdapter, extractTelegramUpdate } from '../../src/conversation/index.js';
import { createProductionTelegramCustodian } from '../../src/assembly/production-telegram.js';
import { openProductionStorage } from '../../src/assembly/production-storage.js';
import { conversationFixture } from '../conversation/fixture.js';
import { createProductionBootOwnerFixture } from './production-boot-owner-fixture.js';
import { genuineProductionComposition } from './genuine-production-fixture.js';
import { productionBindingSet } from './production-fixture.js';
import { value } from '../facts/fixtures.js';
import { productionStorageIO, createProductionNativeContextIO } from '../../scripts/production-boot-io.mjs';

export function recordedTelegramBootFixture() {
  const getMe = readFileSync('tests/assembly/telegram-recorded/getMe.json', 'utf8');
  const poll = readFileSync('tests/assembly/telegram-recorded/poll-0.json', 'utf8');
  const sent = readFileSync('tests/assembly/telegram-recorded/sendMessage.json', 'utf8');
  const calls: string[] = [];
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
      io: { invoke: request => { calls.push(request.method); return { kind: 'response', status: 200,
        bytes: request.method === 'getMe' ? getMe : request.method === 'getUpdates' ? poll : sent }; } } }));
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
        if (!storage.captures.preserve(captured.reference, bytes)) throw Error('intake custody failed');
        return t.intake.f.success(captured);
      } }, dedupGeneration: () => ({ reference: context.decode.register.generation,
        kinds: context.schemas.map(schema => schema.kind), lineages: { 'machine-a': {
          head: storage.segment.read().at(-1)?.segment ?? null, observedAt: 100, closed: false } } }) }));
    const result = value(intake.receive(raw, extracted.route));
    if (result.kind !== 'admitted') throw Error('recorded Telegram input was not admitted');
    const facts = value(createFactStore(context, storage.segment).read());
    const opening = facts.find(row => row.id === result.fact.id);
    if (opening.kind !== 'intake-admitted') throw Error('Four opening missing');
    const f = createProductionBootOwnerFixture(() => storage.segment, { minimal: true, native: { captures: storage.captures, io: createProductionNativeContextIO(storage.captures) },
      intake: { ...context, facts, opening } });
    return { f, t, root, storage, api, admitted, declaration, raw, extracted, calls,
      close: () => { storage.close(); rmSync(root, { recursive: true, force: true }); } };
  } catch (error) { storage.close(); rmSync(root, { recursive: true, force: true }); throw error; }
}
