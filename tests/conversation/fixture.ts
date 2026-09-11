import { readFileSync } from 'node:fs';
import { canonical, consumeResult, decode } from '../../src/index.js';
import type { Clock, Json, ProvenanceInput, Result, SecretRef } from '../../src/index.js';
import { authorAndAppend, createFactStore, hashBytes } from '../../src/facts/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import type { InboundRoute } from '../../src/intake/index.js';
import { decodeDeclaration } from '../../src/register/index.js';
import {
  admitTelegramAdapter, extractTelegramUpdate, telegramParserDeclarationId,
} from '../../src/conversation/index.js';
import type {
  TelegramBotApiCustodianPort, TelegramBotDeclaration, TelegramIdentityProbe,
} from '../../src/conversation/index.js';
import { privateKey } from '../facts/fixtures.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { intakeFixture, json, value } from '../intake/fixtures.js';

const fixtureNames = ['reply', 'callback', 'edit', 'channel-post', 'service-event', 'media-metadata', 'unsupported'] as const;
export type TelegramFixtureName = typeof fixtureNames[number];

export function telegramRaw(name: TelegramFixtureName): string {
  return readFileSync(`tests/conversation/fixtures/telegram/${name}.json`, 'utf8');
}

export function conversationFixture(options: { mode?: 'long-poll' | 'webhook'; botId?: string } = {}) {
  const intake = intakeFixture();
  const assembly = assemblyRuntimeFixture();
  const declarations = [
    ...JSON.parse(readFileSync('src/intake/port.declarations.json', 'utf8')) as object[],
    ...JSON.parse(readFileSync('src/conversation/telegram.declarations.json', 'utf8')) as object[],
  ];
  Object.assign(intake.r.context, { references: [...intake.r.context.references ?? [],
    { provider: 'fixture', id: 'P12-TELEGRAM-REPLY-CAPTURE', kind: 'captured-bytes' }] });
  for (const candidate of declarations) consumeResult(decodeDeclaration(candidate, intake.r.context), {
    Success: () => undefined,
    Refused: refusal => { throw new Error(`${String((candidate as { id?: unknown }).id)}: ${refusal.detail}`); },
  });
  const governed = intake.govern(declarations);
  const runtimeRegister = {
    ...intake.context.decode.register,
    entries: [...new Set([...intake.context.decode.register.entries,
      'telegram-conversation-adapter', telegramParserDeclarationId])],
    methods: [...new Set([...intake.context.decode.register.methods, 'telegram-bot-api-long-poll', 'telegram-bot-api-webhook'])],
  };
  Object.assign(intake.context, { decode: { ...intake.context.decode, register: runtimeRegister } });
  const token = value(decode('SecretRef', {
    type: 'SecretRef', schemaVersion: 1, vault: 'vault', name: 'telegram-bot-token-fixture',
  }, intake.f.ctx.decode)) as SecretRef;
  const declaration: TelegramBotDeclaration = Object.freeze({
    schemaVersion: 1,
    bot: Object.freeze({ id: options.botId ?? '9001', username: '@fixture_bot', identityEpoch: 'installation-1' }),
    token,
    apiVersion: '9.2',
    ...(options.mode === 'webhook' ? { recordedEndpointChoice: Object.freeze({
      mode: 'webhook' as const,
      signedChoice: Object.freeze({ owner: 'part-two' as const, name: 'FactEnvelope' as const, id: 'fact:telegram-endpoint-choice' }),
      endpointAvailabilityEvidence: Object.freeze(['probe:webhook-route']),
      captureBeforeResponseEvidence: Object.freeze(['check:integration']),
    }) } : {}),
    cursor: Object.freeze({ contractVersion: 'telegram-update-offset:v1', initialOffset: 0, maxBatchItems: 100, maxPollSeconds: 30 }),
    limits: Object.freeze({ maxUpdateBytes: 64 * 1024, maxReplyCharacters: 4096 as const, maxReplyBytes: 4096,
      maxEntities: 100, maxConcurrentPolls: 1 as const, maxCharge: 1, timeout: 30 }),
    supportedOperations: Object.freeze(['ordinary-reply'] as const),
  });
  const calls: { identity: unknown[]; authenticate: unknown[]; poll: unknown[]; send: unknown[] } = {
    identity: [], authenticate: [], poll: [], send: [],
  };
  let batches: string[][] = [];
  let probe: TelegramIdentityProbe = {
    botId: declaration.bot.id, username: declaration.bot.username, apiVersion: declaration.apiVersion,
    authenticated: true, observedAt: 100, freshFor: 50, reference: 'probe:1',
    capture: { reference: 'capture:telegram:get-me', hash: hashBytes('{"ok":true,"id":9001}') },
  };
  let sendResult = '{"ok":true,"result":{"message_id":700}}';
  const api: TelegramBotApiCustodianPort = Object.freeze({
    owner: 'part-ten' as const,
    id: 'telegram-bot-api-custodian:fixture',
    identity(input: Parameters<TelegramBotApiCustodianPort['identity']>[0]) { calls.identity.push(input); return intake.f.success(probe); },
    authenticate(input: Parameters<TelegramBotApiCustodianPort['authenticate']>[0]) {
      calls.authenticate.push({ token: input.token, apiVersion: input.apiVersion, route: input.route });
      const extracted = extractTelegramUpdate(input.raw, declaration);
      const evidence = intake.f.proof({ id: extracted.principal.id, kind: extracted.principal.kind },
        { id: extracted.principal.id, kind: extracted.principal.kind }, 'telegram-update', true);
      intake.syncCaptures();
      const provenance: ProvenanceInput = {
        type: 'Provenance', schemaVersion: 1, adapter: telegramParserDeclarationId,
        method: options.mode === 'webhook' ? 'telegram-bot-api-webhook' : 'telegram-bot-api-long-poll',
        record: evidence.input.record, verifiedAt: input.at, machine: evidence.input.machine,
        evidence: { kind: 'channel', authenticated: true },
      };
      return intake.f.success(provenance);
    },
    poll(input: Parameters<TelegramBotApiCustodianPort['poll']>[0]) {
      calls.poll.push(input);
      const updates = batches.shift() ?? [];
      return intake.f.success({ updates, response: { reference: `capture:telegram:poll:${input.offset}`,
        hash: hashBytes(JSON.stringify({ ok: true, result: updates })) } });
    },
    sendMessage(input: Parameters<TelegramBotApiCustodianPort['sendMessage']>[0]) { calls.send.push(input); return intake.f.success(sendResult); },
  });
  const fixtureDigests = fixtureNames.map(name => hashBytes(telegramRaw(name)));
  const admissionDependencies = {
    boundary: { ...intake.f.c, register: runtimeRegister },
    governance: governed.governance,
    assembly: assembly.runtime,
    api,
    clock: () => intake.f.clock(100),
    generation: 'generation:fixture',
    evidence: {
      package: 'conversation-adapters:telegram-slice-a', artifact: hashBytes('telegram-adapter-artifact'),
      parserDeclaration: telegramParserDeclarationId, fixtureDigests,
      sourceProvenance: ['git:src/conversation/telegram.ts'],
      stages: [
        { stage: 'unit', checkRun: 'check:unit', positive: ['P12-NF-16'], negative: ['P12-NF-17'] },
        { stage: 'integration', checkRun: 'check:integration', positive: ['P12-NF-06'], negative: ['P12-NF-18'] },
        { stage: 'lifecycle', checkRun: 'check:lifecycle', positive: ['P12-NF-38'], negative: ['P12-NF-44-non-executable'] },
      ],
      bars: ['bar:isolation'], validFor: 1_000,
      positiveFixtures: ['tests/conversation/telegram.unit.test.ts', 'tests/conversation/telegram.integration.test.ts', 'tests/conversation/telegram.lifecycle.test.ts'],
      negativeFixtures: fixtureNames.map(name => `tests/conversation/fixtures/telegram/${name}.json`),
    },
  } as const;
  const admit = (candidate: TelegramBotDeclaration = declaration) => admitTelegramAdapter(candidate, admissionDependencies);
  const admitted = value(admit());

  function bind(route: InboundRoute): FactEnvelope {
    const extracted = extractTelegramUpdate(telegramRaw('reply'), declaration);
    const principal = intake.f.principal(extracted.principal.id, 'person');
    const authorGrant = intake.f.grant({ id: 'telegram-binding-author-grant', grantee: intake.f.alice, scope: intake.f.scope });
    const grant = intake.f.grant({ id: 'telegram-binding-grant', grantee: principal, scope: intake.f.scope });
    intake.syncCaptures();
    const rootSchema = { ...intake.f.schema, kind: 'genesis-grant', fields: {
      grant: { kind: 'constitutional' as const, type: 'StandingGrant' as const },
    } };
    Object.assign(intake.context, { schemas: [...intake.context.schemas.filter(schema => schema.kind !== rootSchema.kind), rootSchema] });
    const grantContext = { ...intake.context, decode: { ...intake.context.decode, provenance: authorGrant.source } };
    const root = value(authorAndAppend({
      kind: 'genesis-grant', schemaVersion: 1, machine: 'machine-a', principal: json(intake.f.alice),
      provenance: json(authorGrant.source), at: json(intake.f.now), body: { grant: json(authorGrant) }, required: [],
    }, grantContext, createFactStore(grantContext, intake.storage), privateKey)).fact;
    Object.assign(intake.context, { grants: [{ factId: root.id, grant: authorGrant }] });
    const targetContext = { ...intake.context, decode: { ...intake.context.decode, provenance: grant.source } };
    const target = value(authorAndAppend({
      kind: 'genesis-grant', schemaVersion: 1, machine: 'machine-a', principal: json(intake.f.alice),
      provenance: json(grant.source), at: json(intake.f.now), body: { grant: json(grant) }, required: [root.id],
    }, targetContext, createFactStore(targetContext, intake.storage), privateKey)).fact;
    Object.assign(intake.context, { grants: [{ factId: root.id, grant: authorGrant }, { factId: target.id, grant }] });
    return value(authorAndAppend({
      kind: 'conversation-binding', schemaVersion: 1, machine: 'machine-a', principal: json(intake.f.alice),
      provenance: json(intake.f.alice.provenance), at: json(intake.f.now), body: {
        adapter: telegramParserDeclarationId, channel: route.channel, sender: route.sender,
        identityEpoch: route.identityEpoch, principalId: principal.id, grantId: grant.id,
        scope: json(intake.f.scope), supersedes: 'none',
      }, required: [root.id, target.id],
    }, intake.context, createFactStore(intake.context, intake.storage), privateKey)).fact;
  }

  return {
    intake, assembly, declarations, governed, runtimeRegister, declaration, api, admitted, calls,
    fixtureNames, admissionDependencies, admit,
    queue: (...updates: string[]) => { batches.push(updates); },
    setProbe: (value: TelegramIdentityProbe) => { probe = value; },
    setSendResult: (value: string) => { sendResult = value; },
    bind,
  };
}

export function resultValue<T>(result: Result<T>): T { return value(result); }
export const clockJson = (clock: Clock): Json => JSON.parse(value(canonical(clock)).bytes) as Json;
