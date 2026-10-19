import { expect, it } from 'vitest';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { successiveWorld, offlineProfile, OFFLINE_STORAGE_KEY, FIXTURE_DOORWAY, PER_RULE_PASS,
  offlineOperatorMessage, writeOperatorRecords } from './successive-fixture.js';
import { authoritySealKey, sealAuthorityRecord } from './activation-authority.js';
import { appendGroupCarry } from './group-carry.js';
import { resolveGroupDisclosure } from './group-disclosure.js';
import { grant } from './group-carry-fixture.js';
import { openPreviewJournal } from './journal-test-worker.js';

const recorded = JSON.parse(readFileSync(new URL('./fixtures/topic-awareness-live-2026-10-10.json', import.meta.url), 'utf8'));

it.each(['current', 'revoked', 'wider-audience'] as const)('shipped runner serves a copied lineage with %s disclosure', async posture => {
  const world = successiveWorld(), dir = world.directory;
  const original = join(dir, 'original-group'), copy = join(dir, 'canary-copy'), sourceRoot = join(dir, 'private');
  const activation = join(dir, 'activation.json'), profile = join(dir, 'profile.json'), authorityPath = join(dir, 'activation-authority.json');
  const operator = join(dir, 'operator-records'), provider = join(dir, 'provider.mjs'), loader = join(dir, 'loader.mjs');
  writeFileSync(activation, JSON.stringify(world.activation()));
  writeFileSync(profile, JSON.stringify(offlineProfile));
  const trial = world.state().read().trial, now = Date.now();
  const scope = { sourceRoot, destinationRoot: original, chat: recorded.genesis.chat,
    operator: world.configuration.operatorSenderId, bot: world.configuration.botId };
  const disclosure = { ...grant, scope, grantor: scope.operator, custodian: scope.operator,
    source: { kind: 'telegram-message' as const, topicId: 1, messageId: 3 } };
  const message = offlineOperatorMessage(1, 3, disclosure.words, disclosure.issuedAt);
  writeOperatorRecords(operator, [offlineOperatorMessage(1, 1, 'offline approval stand-in'),
    offlineOperatorMessage(1, 2, 'offline waiver stand-in'), message]);
  const records = { messages: [message.message], provenance: [message.classification],
    bindings: JSON.parse(readFileSync(join(operator, 'state', 'topic-operators.json'), 'utf8')) };
  const record = { ...JSON.parse(readFileSync(authorityPath, 'utf8')), groupDisclosureGrants: [disclosure] };
  const sealKey = authoritySealKey(OFFLINE_STORAGE_KEY), authority = sealAuthorityRecord(record, sealKey);
  writeFileSync(authorityPath, JSON.stringify(authority));
  mkdirSync(original); mkdirSync(sourceRoot);
  const genesis = { kind: 'genesis' as const, origin: 'test' as const, bot: scope.bot, operator: scope.operator,
    chat: scope.operator, grant: trial.id, configurationDigest: trial.configurationDigest, expires: trial.expiresAt,
    maxCalls: 16, maxReplies: 16, maxTurns: 20, maxBytes: 32768, cursor: 0 };
  const source = openPreviewJournal(join(sourceRoot, 'journal.encrypted'), OFFLINE_STORAGE_KEY, genesis);
  const destination = openPreviewJournal(join(original, 'journal.encrypted'), OFFLINE_STORAGE_KEY, { ...genesis, chat: scope.chat, forum: true });
  appendGroupCarry(destination, source, scope, resolveGroupDisclosure(scope, authority, now, records, sealKey), true, now, () => false);
  source.close(); destination.close(); cpSync(original, copy, { recursive: true });
  const before = readFileSync(join(original, 'journal.encrypted'));
  if (posture === 'revoked') writeFileSync(authorityPath, JSON.stringify(sealAuthorityRecord({ ...record,
    revocations: [{ grantId: disclosure.id, at: now, by: scope.operator, source: 'TEST withdrawal' }] }, sealKey)));

  // Real recorded model bytes enter the normal parser; only provider IO and Telegram HTTP are local substitutes.
  writeFileSync(provider, `export * from ${JSON.stringify(pathToFileURL(join(process.cwd(), 'src/assembly/production-provider.ts')).href)};
${FIXTURE_DOORWAY}
${PER_RULE_PASS}
export const createClaudeCodeSubscriptionRoute = () => ({kind:'Success',value:{invoke:async prepared => {
  const packet=JSON.parse(prepared), binding=JSON.parse(packet.messages[1].content).bindings;
  const review=packet.messages[0].content.startsWith('Judge this proposed reply');
  const value=review ? perRulePass(packet.messages[0].content,'Within the recorded rules.') : ${JSON.stringify(recorded.modelReplay.cases[0].output)};
  return {state:'complete',bytes:JSON.stringify({type:'Decision',schemaVersion:1,id:'copy-answer',at:binding.at,by:binding.by,
    conclusion:{subject:'preview-stage2-answer',predicate:'answer-text',value,evidence:binding.evidence},
    reason:{subject:'question',predicate:'answered',value:true,evidence:binding.evidence},floor:{allowed:binding.floor,chosen:binding.floor.default}}),
    usage:{inputTokens:1,outputTokens:1}};
}}});`);
  writeFileSync(loader, `export async function resolve(specifier,context,next) {
    if (context.parentURL?.endsWith('/journal-agent.mjs') && specifier.endsWith('/production-provider.js'))
      return {url:${JSON.stringify(pathToFileURL(provider).href)},shortCircuit:true};
    return next(specifier,context);
  }`);
  const sends: Record<string, unknown>[] = [], seen: string[] = [];
  const server = createServer(async (request, response) => {
    let bytes = ''; for await (const part of request) bytes += part;
    const body = JSON.parse(bytes), method = request.url!.split('/').at(-1)!; seen.push(method);
    if (method === 'sendMessage') sends.push(body);
    const result = method === 'getChat' ? { id: Number(scope.chat), type: 'supergroup', is_forum: true }
      : method === 'getMe' ? { id: Number(scope.bot), is_bot: true, username: world.configuration.botUsername.replace(/^@/, '') }
        : method === 'getChatMemberCount' ? posture === 'wider-audience' ? 3 : 2
          : method === 'getChatMember' ? { status: 'member', user: { id: Number(body.user_id), is_bot: body.user_id === scope.bot } }
            : method === 'getUpdates' ? [recorded.question].filter(u => u.update_id >= Number(body.offset))
              : { message_id: 100 + sends.length, chat: { id: Number(scope.chat) }, text: body.text };
    response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ ok: true, result }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw Error('listener unavailable');
  const run = () => promisify(execFile)(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', '--loader', loader,
    'tests/preview/journal-agent.mjs', 'run', '--root', copy, '--bot-id', scope.bot, '--chat-id', scope.chat, '--forum', 'true',
    '--operator-sender-id', scope.operator, '--grant-reference', trial.id, '--configuration-digest', trial.configurationDigest,
    '--expires-at', String(trial.expiresAt), '--tools', 'off', '--activation-record', activation, '--authority-record', authorityPath,
    '--operator-records', operator, '--login-profile', profile, '--model', world.model, '--bot-username', world.configuration.botUsername,
    '--conversation-owners', join(dir, 'owners'), '--sentinels', 'none', '--retrospective', 'false', '--max-cycles', '2', '--max-poll-seconds', '1'],
    { env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
      INSTAR_SECRET_PREVIEW_TYPESAFE_KEY: '', INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: `http://127.0.0.1:${address.port}` }, timeout: 45000, maxBuffer: 1024 * 1024 });
  try {
    await run();
    const replay = openPreviewJournal(join(copy, 'journal.encrypted'), OFFLINE_STORAGE_KEY, undefined, undefined, true);
    try {
      expect(replay.view.groupCarry!.scope.destinationRoot).toBe(original);
      expect(replay.view.order).toHaveLength(1);
      if (posture === 'current') {
        expect(sends.some(s => String(s.text).includes('This message is in the General topic.'))).toBe(true);
        expect(replay.view.order[0]!.sent).toBeDefined(); expect(seen).toContain('getChatMember');
      } else {
        expect(replay.view.modelCalls.total).toBe(0);
        expect(sends.some(s => String(s.text).includes('This message is in the General topic.'))).toBe(false);
      }
    } finally { replay.close(); }
    const count = sends.length; await run(); expect(sends).toHaveLength(count);
    expect(readFileSync(join(original, 'journal.encrypted'))).toEqual(before);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); rmSync(dir, { recursive: true, force: true }); }
}, 100000);
