// @ts-nocheck -- offline process and HTTP fixtures exercise the real launcher.
// Part Thirteen §9 (docs/17-harness-adapters): tools are on by default. Through the real launcher (offline Telegram endpoint,
// offline Jev), a root whose sealed authority holds the operator's recorded grant for the tools policy derives its tools
// activation at launch, writes it to the root as the live withdrawal handle, and says so in status. Plan #449: the grant may be
// recorded for the policy CLASS (tools-policy-class.ts), and the launch records the grant, class and digest it resolved. A root
// with no covering grant or a revoked one REFUSES to start and says why (never a silent text-only start); only `--tools off`
// runs text only, and its status says so. The derived record changes exactly one field of the conversation activation: the
// policy digest.
import { expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { successiveWorld, offlineProfile, OFFLINE_STORAGE_KEY } from './successive-fixture.js';
import { authoritySealKey, sealAuthorityRecord } from './activation-authority.js';
import { subscriptionToolsPolicy } from '../../src/assembly/production-provider.js';
import { encoded } from '../../src/assembly/boundary.js';
import { TOOLS_DEFAULT_ACTIVATION } from './tool-turn.mjs';
import { FULL_TOOLS_CLASS } from './tools-policy-class.js';

async function launch(name: string, authority: (record) => object | null, extra: string[] = [], nodeArgs: (directory: string) => string[] = () => []) {
  const world = successiveWorld(), root = join(world.directory, `${name}-journal`);
  const activationPath = join(world.directory, 'activation.json'), profile = join(world.directory, 'profile.json');
  const log = join(world.directory, 'poll.log'), updates = join(world.directory, 'updates.json'), preload = join(world.directory, 'jev.mjs');
  const conversation = world.activation();
  writeFileSync(activationPath, JSON.stringify(conversation));
  writeFileSync(profile, JSON.stringify(offlineProfile));
  const authorityPath = join(world.directory, 'activation-authority.json');
  const current = JSON.parse(readFileSync(authorityPath, 'utf8'));
  const { seal: _seal, ...unsealed } = current;
  const next = authority(unsealed);
  if (next) writeFileSync(authorityPath, JSON.stringify(sealAuthorityRecord(next, authoritySealKey(OFFLINE_STORAGE_KEY))));
  writeFileSync(updates, JSON.stringify([{ update_id: 1, message: { chat: { id: Number(world.configuration.chatId), type: 'private' },
    from: { id: Number(world.configuration.operatorSenderId) }, text: 'status' } }]));
  writeFileSync(preload, `globalThis.fetch = async () => new Response(JSON.stringify({ model: 'jev-1.13.0',
    answers: Object.fromEntries(['raw_path','cli_command','config_key','credential','api_endpoint',
      'quits_on_self','claims_blocked','parks_on_user','defers_work','unrecorded_blocker'].map(rule => [rule,{type:'noul',noul:0.01}])) }));\n`);
  const endpoint = spawn(process.execPath, [join(process.cwd(), 'tests/preview/journal-poll-endpoint.mjs'), log, updates], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const port = await new Promise((resolve, reject) => {
      endpoint.stdout.once('data', data => resolve(Number(String(data).trim())));
      endpoint.once('error', reject);
      endpoint.once('exit', code => reject(Error(`endpoint exited before listening: ${String(code)}`)));
    });
    const trial = world.state().read().trial;
    const run = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', ...nodeArgs(world.directory), '--import', preload,
      'tests/preview/journal-agent.mjs', 'run', '--root', root, '--bot-id', world.configuration.botId, '--chat-id', world.configuration.chatId,
      '--operator-sender-id', world.configuration.operatorSenderId, '--grant-reference', trial.id,
      '--configuration-digest', trial.configurationDigest, '--expires-at', String(trial.expiresAt),
      '--activation-record', activationPath, '--operator-records', join(world.directory, 'operator-records'), '--login-profile', profile,
      '--model', world.model, '--bot-username', world.configuration.botUsername, '--max-cycles', '2', '--max-poll-seconds', '1', ...extra],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 20000, env: { ...process.env,
      INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'), INSTAR_SECRET_PREVIEW_TYPESAFE_KEY: 'offline-placeholder',
      INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: `http://127.0.0.1:${port}` } });
    const sends = existsSync(`${log}.sends`) ? readFileSync(`${log}.sends`, 'utf8').trim().split('\n').map(line => JSON.parse(line).text) : [];
    const derived = join(root, TOOLS_DEFAULT_ACTIVATION), runsPath = join(root, 'runs.jsonl');
    const runs = existsSync(runsPath) ? readFileSync(runsPath, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
    return { run, conversation, status: sends.join('\n'), sends, runs,
      derived: existsSync(derived) ? JSON.parse(readFileSync(derived, 'utf8')) : null };
  } finally { endpoint.kill(); }
}
const toolsDigest = (model: string) => (encoded(subscriptionToolsPolicy(model)) as { hash: string }).hash;
/** The operator's recorded grant, copied to cover the tools policy: the same words and source, only the policy subject differs. */
const withToolsGrant = (record, revoked = false, expiresAt = undefined, policyClass = undefined) => {
  const grant = record.grants[0];
  const { invocationPolicyDigest: _conversation, ...subject } = grant.scope;
  const tools = { ...grant, id: 'offline-tools-grant', scope: policyClass === undefined
    ? { ...grant.scope, invocationPolicyDigest: toolsDigest(grant.scope.model) } : { ...subject, invocationPolicyClass: policyClass },
    ...(expiresAt === undefined ? {} : { expiresAt }) };
  return { ...record, grants: [...record.grants, tools],
    revocations: revoked ? [{ grantId: 'offline-tools-grant', at: grant.issuedAt + 1, by: grant.grantor, source: 'telegram 3' }] : [] };
};

it('derives and keeps the tools activation when the recorded grant covers the tools policy, and status names the tools', { timeout: 60000 }, async () => {
  const on = await launch('on', record => withToolsGrant(record));
  expect(on.run.status, on.run.stderr).toBe(0);
  expect(on.run.stderr).not.toMatch(/tools off/u);
  // The derived record is the conversation activation with exactly one field changed: the tools policy digest.
  const { invocationPolicyDigest, ...rest } = on.derived;
  const { invocationPolicyDigest: conversationDigest, ...conversationRest } = on.conversation;
  expect(invocationPolicyDigest).toBe(toolsDigest(on.conversation.model));
  expect(invocationPolicyDigest).not.toBe(conversationDigest);
  expect(rest).toEqual(conversationRest);
  expect(on.status).toMatch(/Tools: the harness's full built-in set \(27 tools, each call decided at the admission hook\) and the root's MCP servers/u);
  // Plan #473: with no --harness-user the granted tools are refused, never run as the operator's account, and the launch
  // and status say so (the harness-user cases in harness-user.test.ts prove the refusal and its neighbour).
  const refusal = /Harness identity: REFUSED, tool turns are not run, because Claude Code would run as the operator's account \(no --harness-user was given\)/u;
  expect(on.status).toMatch(refusal);
  expect(on.run.stderr).toMatch(refusal);
  // A grant with an expiry still ahead resolves the same way (the neighbour of the live-expiry withdrawal below).
  const dated = await launch('dated', record => withToolsGrant(record, false, Date.now() + 3_600_000));
  expect(dated.run.status, dated.run.stderr).toBe(0);
  expect(dated.status).toMatch(/Tools: the harness's full built-in set \(27 tools, each call decided at the admission hook\) and the root's MCP servers/u);
});

it('records the class grant at launch: one standing grant for the policy class turns tools on, with grant, class and digest recorded', { timeout: 60000 }, async () => {
  const on = await launch('class', record => withToolsGrant(record, false, undefined, FULL_TOOLS_CLASS));
  expect(on.run.status, on.run.stderr).toBe(0);
  expect(on.derived.invocationPolicyDigest).toBe(toolsDigest(on.conversation.model));
  expect(on.run.stderr).toContain(`preview: tools on: grant offline-tools-grant (class ${FULL_TOOLS_CLASS}) covers tools policy ${toolsDigest(on.conversation.model)}`);
  expect(on.status).toMatch(/Tools: the harness's full built-in set \(27 tools, each call decided at the admission hook\) and the root's MCP servers/u);
  expect(on.runs.find(row => row.tools)?.tools).toEqual({ state: 'on', grant: 'offline-tools-grant', policyClass: FULL_TOOLS_CLASS,
    policyDigest: toolsDigest(on.conversation.model) });
  // The exact-digest grant is recorded as such.
  const exact = await launch('exact', record => withToolsGrant(record));
  expect(exact.run.stderr).toContain('preview: tools on: grant offline-tools-grant (exact policy)');
  expect(exact.runs.find(row => row.tools)?.tools).toMatchObject({ state: 'on', policyClass: null });
});

it('refuses to start, loudly and specifically, when no grant covers the tools policy; never a silent text-only start', { timeout: 90000 }, async () => {
  const refusedToStart = (launched, why: RegExp) => {
    expect(launched.run.status).not.toBe(0);
    expect(launched.derived).toBeNull();
    expect(launched.run.stderr).not.toMatch(/preview: tools off/u);
    expect(launched.run.stderr).toMatch(/preview: refused to start: no recorded operator grant covers this build's tools policy \(sha256:[0-9a-f]{64}\)/u);
    expect(launched.run.stderr).toMatch(why);
    expect(launched.run.stderr).toMatch(/or pass --tools off to run text only/u);
    // Nothing was answered text only, and the refusal is recorded as a launch refused before it launched.
    expect(launched.sends).toEqual([]);
    expect(launched.runs.at(-1)).toMatchObject({ reason: 'refused before launch', refused: expect.stringMatching(/refused to start/u) });
  };
  refusedToStart(await launch('none', () => null), /does not cover/u);
  // The revoked tools grant no longer resolves; the still-live conversation grant does not cover the tools policy. The positive
  // neighbour is the same grant unrevoked (above).
  refusedToStart(await launch('revoked', record => withToolsGrant(record, true)), /a new verified approval is required/u);
  // A class grant for a class this build does not know covers nothing either.
  refusedToStart(await launch('unknown-class', record => withToolsGrant(record, false, undefined, 'full-tools-anything')), /not known to this build/u);
  // A build whose OWN tools policy removes a checkpoint (here: permission checks off, as `--permission-mode bypassPermissions`
  // would) is outside the class: the class grant does not cover it, and the launch refuses, naming the checkpoint.
  const bypassBuild = (directory: string) => {
    const loader = join(directory, 'bypass-permissions-loader.mjs');
    writeFileSync(loader, `export async function load(url, context, next) {
  const loaded = await next(url, context);
  if (!url.endsWith('/src/assembly/production-provider.ts')) return loaded;
  const source = String(loaded.source).replace("'--permission-mode', 'default'", "'--permission-mode', 'bypassPermissions'");
  if (source === String(loaded.source)) throw Error('fixture: the tools policy permission mode was not found');
  return { ...loaded, source };
}\n`);
    return ['--loader', loader];
  };
  refusedToStart(await launch('bypass', record => withToolsGrant(record, false, undefined, FULL_TOOLS_CLASS), [], bypassBuild),
    new RegExp(`outside the granted class ${FULL_TOOLS_CLASS}: the permission mode is not default`, 'u'));
  // Only an explicit --tools off runs text only, and its status says so.
  const refused = await launch('refused', record => withToolsGrant(record), ['--tools', 'off']);
  expect(refused.run.status, refused.run.stderr).toBe(0);
  expect(refused.derived).toBeNull();
  expect(refused.status).toContain('Tools: off (refused at launch with --tools off); answers are text only.');
});

/** Runs the real launcher with tools on under `initial(unsealed)`, applies `withdraw` once the tools are derived and the
 * runner is polling, then asks for status and returns it. */
async function liveStatus(initial, withdraw: (seal, unsealed, authorityPath: string) => Promise<void>) {
  const world = successiveWorld(), root = join(world.directory, 'live-journal');
  const activationPath = join(world.directory, 'activation.json'), profile = join(world.directory, 'profile.json');
  const log = join(world.directory, 'poll.log'), updates = join(world.directory, 'updates.json'), preload = join(world.directory, 'jev.mjs');
  writeFileSync(activationPath, JSON.stringify(world.activation()));
  writeFileSync(profile, JSON.stringify(offlineProfile));
  const authorityPath = join(world.directory, 'activation-authority.json');
  const { seal: _seal, ...unsealed } = JSON.parse(readFileSync(authorityPath, 'utf8'));
  const seal = record => writeFileSync(authorityPath, JSON.stringify(sealAuthorityRecord(record, authoritySealKey(OFFLINE_STORAGE_KEY))));
  seal(initial(unsealed));
  writeFileSync(updates, '[]');
  writeFileSync(preload, `globalThis.fetch = async () => new Response(JSON.stringify({ model: 'jev-1.13.0',
    answers: Object.fromEntries(['raw_path','cli_command','config_key','credential','api_endpoint',
      'quits_on_self','claims_blocked','parks_on_user','defers_work','unrecorded_blocker'].map(rule => [rule,{type:'noul',noul:0.01}])) }));\n`);
  const endpoint = spawn(process.execPath, [join(process.cwd(), 'tests/preview/journal-poll-endpoint.mjs'), log, updates, 'keep-thread', 'long-poll'],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  let runner = null;
  try {
    const port = await new Promise((resolve, reject) => {
      endpoint.stdout.once('data', data => resolve(Number(String(data).trim())));
      endpoint.once('error', reject);
    });
    const trial = world.state().read().trial;
    runner = spawn(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', '--import', preload,
      'tests/preview/journal-agent.mjs', 'run', '--root', root, '--bot-id', world.configuration.botId, '--chat-id', world.configuration.chatId,
      '--operator-sender-id', world.configuration.operatorSenderId, '--grant-reference', trial.id,
      '--configuration-digest', trial.configurationDigest, '--expires-at', String(trial.expiresAt),
      '--activation-record', activationPath, '--operator-records', join(world.directory, 'operator-records'), '--login-profile', profile,
      '--model', world.model, '--bot-username', world.configuration.botUsername, '--max-cycles', '12', '--max-poll-seconds', '1'],
    { cwd: process.cwd(), stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env,
      INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'), INSTAR_SECRET_PREVIEW_TYPESAFE_KEY: 'offline-placeholder',
      INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: `http://127.0.0.1:${port}` } });
    const exited = new Promise(resolve => runner.once('exit', resolve));
    const until = async (test: () => boolean) => { for (let i = 0; i < 300 && !test(); i++) await new Promise(r => setTimeout(r, 50)); return test(); };
    // Tools came on by default: the derived record is in the root and the runner is polling.
    expect(await until(() => existsSync(join(root, TOOLS_DEFAULT_ACTIVATION)) && existsSync(log))).toBe(true);
    await withdraw(seal, unsealed, authorityPath);
    writeFileSync(updates, JSON.stringify([{ update_id: 1, message: { chat: { id: Number(world.configuration.chatId), type: 'private' },
      from: { id: Number(world.configuration.operatorSenderId) }, text: 'status' } }]));
    expect(await until(() => existsSync(`${log}.sends`))).toBe(true);
    const status = readFileSync(`${log}.sends`, 'utf8').trim().split('\n').map(line => JSON.parse(line).text).join('\n');
    // The record in the root is unchanged: withdrawal is the grant's.
    expect(existsSync(join(root, TOOLS_DEFAULT_ACTIVATION))).toBe(true);
    runner.kill('SIGTERM');
    await exited;
    return status;
  } finally { if (runner && runner.exitCode === null) runner.kill('SIGKILL'); endpoint.kill(); }
}
const WITHDRAWN = 'Tools: off (withdrawn since launch: the activation record changed or its grant no longer resolves); answers are text only.';

it('withdraws tools live when the grant is revoked in the sealed authority while the runner runs', { timeout: 90000 }, async () => {
  // The operator revokes the grant; the desk re-seals the authority. Nothing touches the runner or its record.
  const status = await liveStatus(unsealed => withToolsGrant(unsealed), async (seal, unsealed) => seal(withToolsGrant(unsealed, true)));
  expect(status).not.toMatch(/Tools: the harness's full built-in set/u);
  expect(status).toContain(WITHDRAWN);
});

it('withdraws tools live when the grant expires, though the sealed authority\'s bytes never change', { timeout: 90000 }, async () => {
  const expiresAt = Date.now() + 8000;
  const status = await liveStatus(unsealed => withToolsGrant(unsealed, false, expiresAt), async () => {
    while (Date.now() <= expiresAt + 500) await new Promise(r => setTimeout(r, 100));
  });
  expect(status).not.toMatch(/Tools: the harness's full built-in set/u);
  expect(status).toContain(WITHDRAWN);
});

it('withdraws tools live when the sealed authority becomes unreadable', { timeout: 90000 }, async () => {
  const status = await liveStatus(unsealed => withToolsGrant(unsealed), async (_seal, _unsealed, authorityPath) => {
    unlinkSync(authorityPath);
  });
  expect(status).not.toMatch(/Tools: the harness's full built-in set/u);
  expect(status).toContain(WITHDRAWN);
});
