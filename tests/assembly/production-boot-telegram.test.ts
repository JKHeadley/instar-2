import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { createProductionTelegramCustodian, isProductionTelegramCustodian } from '../../src/assembly/production-telegram.js';
import { openProductionStorage } from '../../src/assembly/production-storage.js';
import { value, refused } from '../facts/fixtures.js';
import { conversationFixture } from '../conversation/fixture.js';
// @ts-expect-error Ten physical host is JavaScript outside the pure core.
import { productionStorageIO } from '../../scripts/production-boot-io.mjs';

it('production boot Telegram custody: recorded identity bytes use unit 3 and survive encrypted disk reopen', () => {
  const getMe = readFileSync('tests/assembly/telegram-recorded/getMe.json', 'utf8');
  const bot = JSON.parse(getMe).result;
  const f = conversationFixture({ botId: String(bot.id), skipInitialAdmission: true });
  const context = { ...f.intake.context.decode, site: f.intake.f.c.site, preserved: f.intake.f.c.preserved };
  const declaration = { ...f.declaration, bot: { ...f.declaration.bot, username: `@${bot.username}` } };
  const plan = value(f.verification.inspectCurrent()).find(row => row.record.type === 'VerificationPlan')!.record;
  if (plan.type !== 'VerificationPlan') throw Error('identity plan missing');
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'boot-telegram-')));
  const storageInput = { root, machine: 'machine-a', key: new Uint8Array(32).fill(19), policy: 'policy', store: 'store',
    context, io: productionStorageIO };
  const storage = value(openProductionStorage(storageInput));
  try {
    let calls = 0;
    const custodian = value(createProductionTelegramCustodian({ context, declaration, credential: declaration.token,
      machine: 'machine-a', now: () => f.intake.f.clock(100), freshFor: 50, captures: storage.captures,
      identityEvidence: { verification: f.verification, plan: plan.id, arm: plan.arms.find(arm => arm.required)!.id,
        generation: 'generation:fixture' },
      resolveSecret: () => '8820318295:synthetic_recorded_test_only_value',
      io: { invoke: () => { calls++; return { kind: 'response', status: 200, bytes: getMe }; } } }));
    expect(isProductionTelegramCustodian(custodian)).toBe(true);
    expect(isProductionTelegramCustodian({ ...custodian })).toBe(false);
    const identity = value(custodian.identity({ token: declaration.token, apiVersion: declaration.apiVersion }));
    expect(identity.botId).toBe(String(bot.id)); expect(calls).toBe(1);
    refused(custodian.readCapture(identity.capture.reference), 'not publicly readable');
    expect(storage.captures.read(identity.capture.reference)).toBe(getMe);
    expect(readFileSync(join(root, 'captures.encrypted'), 'utf8')).not.toContain(bot.username);
    storage.close();
    const reopened = value(openProductionStorage(storageInput));
    expect(reopened.captures.read(identity.capture.reference)).toBe(getMe);
    reopened.close();
  } finally { storage.close(); rmSync(root, { recursive: true, force: true }); }
});
