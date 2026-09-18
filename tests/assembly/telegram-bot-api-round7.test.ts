import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { consumeResult } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { createTelegramBotApiCustodian } from '../../src/assembly/index.js';
import type {
  TelegramBotApiCustodianOptions, TelegramBridgeReply, TelegramConfinedBridgePort,
  TelegramDurableCapturePort,
} from '../../src/assembly/index.js';
import { admitTelegramAdapter } from '../../src/conversation/index.js';
import type { TelegramBotApiCustodianPort } from '../../src/conversation/index.js';
import { conversationFixture } from '../conversation/fixture.js';

const response = (result: unknown): TelegramBridgeReply => ({
  kind: 'response', status: 200, bytes: JSON.stringify({ ok: true, result }),
});
type DecodedResult<T> = { accepted: true; value: T } | { accepted: false; detail: string };

function outcome<T>(result: Result<T>): DecodedResult<T> {
  return consumeResult(result, {
    Success: value => ({ accepted: true, value }) as DecodedResult<T>,
    Refused: refusal => ({ accepted: false, detail: refusal.detail }) as DecodedResult<T>,
  });
}

function value<T>(result: Result<T>): T {
  const decoded = outcome(result);
  if (!decoded.accepted) throw new Error(decoded.detail);
  return decoded.value;
}

function fixture(replies: TelegramBridgeReply[]) {
  const owner = conversationFixture({ skipInitialAdmission: true, botId: '818181' });
  const declaration = { ...owner.declaration,
    bot: { ...owner.declaration.bot, username: '@fixture_bot', identityEpoch: 'live' } };
  const fixtureToken = declaration.token;
  const rows = value(owner.verification.inspectCurrent());
  const plan = rows.find(row => row.record.type === 'VerificationPlan'
    && row.record.subject.governed === 'telegram:v1:bot:818181')?.record;
  if (!plan || plan.type !== 'VerificationPlan') throw new Error('fixture verification plan absent');
  const identityEvidence = { verification: owner.verification, plan: plan.id,
    arm: plan.arms.find(arm => arm.required)!.id, generation: 'generation:fixture' };
  const bytes = new Map<string, string>();
  const captures: TelegramDurableCapturePort = { owner: 'part-ten',
    preserve(reference, captured) { bytes.set(reference, captured); return true; },
    read(reference) { return bytes.get(reference) ?? null; } };
  let calls = 0;
  const bridge: TelegramConfinedBridgePort = { owner: 'part-ten', invoke() {
    calls += 1;
    return replies.shift() ?? { kind: 'uncertain', limitation: 'transport' };
  } };
  const options: TelegramBotApiCustodianOptions = { context: owner.intake.f.c, machine: 'machine-a',
    now: () => owner.intake.f.clock(100), freshFor: 50, captures, bridge, declaration, identityEvidence };
  const api = value(createTelegramBotApiCustodian(options));
  return { api, bytes, declaration, identityEvidence, options, owner, token: fixtureToken, calls: () => calls };
}

describe('round 7 sealed identity owner path', () => {
  test.each([[false, false], [false, true], [true, false], [true, true]] as const)(
    'P12-NF-07 admits through the genuine private resolver while a public wrapper receives no bytes (%s/%s)',
    (hasDeclaration, hasEvidence) => {
      const secret = '1234567890:abcdefghijklmnopqrstuvwxyz';
      const original = response({ id: 818181, is_bot: true, username: 'fixture_bot', first_name: secret });
      if (original.kind !== 'response') throw new Error('identity fixture malformed');
      const f = fixture([original]);
      const { declaration: _declaration, identityEvidence: _identityEvidence, ...common } = f.options;
      const restarted = value(createTelegramBotApiCustodian({ ...common,
        ...(hasDeclaration ? { declaration: f.declaration } : {}),
        ...(hasEvidence ? { identityEvidence: f.identityEvidence } : {}) }));
      let publicReadCalls = 0;
      const wrapped: TelegramBotApiCustodianPort = Object.freeze({ ...f.api,
        readCapture(reference: string) {
          publicReadCalls += 1;
          return restarted.readCapture(reference);
        } });

      const admission = outcome(admitTelegramAdapter(f.declaration,
        { ...f.owner.admissionDependencies, api: wrapped }));
      expect(admission.accepted).toBe(true);
      expect(publicReadCalls).toBe(0);
      const sealedReference = [...f.bytes.keys()].find(reference => reference.includes(':sealed-getMe:'));
      expect(sealedReference).toBeDefined();
      expect(outcome(restarted.readCapture(sealedReference!)).accepted).toBe(false);
      expect(JSON.stringify(admission)).not.toContain(secret);
    },
  );

  test.each([
    ['V65', undefined],
    ['V66', { id: 818181, is_bot: false, username: 'valid_bot' }],
    ['V67', { id: 818181, is_bot: true, username: '' }],
    ['V68', { id: -1, is_bot: true, username: 'valid_bot' }],
  ] as const)('%s preserves the exact malformed original privately before refusing', (_id, bot) => {
    const reply = response(bot);
    if (reply.kind !== 'response') throw new Error('malformed fixture missing bytes');
    const f = fixture([reply]);
    expect(outcome(f.api.identity({ token: f.token, apiVersion: '9.2' })).accepted).toBe(false);
    expect(f.calls()).toBe(1);
    expect([...f.bytes.values()]).toContain(reply.bytes);
    const reference = [...f.bytes.entries()].find(([, bytes]) => bytes === reply.bytes)?.[0];
    expect(reference).toMatch(/^capture:telegram:sealed-getMe:[a-f0-9]{64}$/u);
    expect(outcome(f.api.readCapture(reference!)).accepted).toBe(false);
  });

  test('wires the private resolver into the Part Twelve contract map without a public export', async () => {
    const map = readFileSync('scripts/check-p12-contract-map.mjs', 'utf8');
    expect(map).toContain('sealed original resolves only through the non-public Part Ten owner registration');
    expect(map).toContain('resolveTelegramIdentityCapture(deps.api, probe.capture.reference)');
    const publicConversation = await import('../../src/conversation/index.js');
    expect(Object.hasOwn(publicConversation, 'registerTelegramIdentityCaptureResolver')).toBe(false);
  });
});
