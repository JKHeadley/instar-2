// @ts-nocheck -- offline process and HTTP fixtures exercise the real launcher.
// Rules 13, 40, 56, 60, 61, 100 on the shipped launcher path: every model launch passes
// the host resource owner; the exchange refreshes the doorway map; a credential in
// an operator message is stored before use; status reports all of it.
import { expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { successiveWorld, offlineProfile, OFFLINE_STORAGE_KEY, FIXTURE_DOORWAY, PER_RULE_PASS } from './successive-fixture.js';

const TOKEN = 'ghp_' + 'Z9y8X7w6V5u4T3s2R1q0P9o8';

it('PREVIEW-HOST-RESOURCE-FUNNEL launches every model call through the resource owner and records resources, doorways and credential custody', async () => {
  const world = successiveWorld(), root = join(world.directory, 'resource-journal');
  const activation = join(world.directory, 'activation.json'), profile = join(world.directory, 'profile.json');
  const log = join(world.directory, 'poll.log'), updates = join(world.directory, 'updates.json');
  const provider = join(world.directory, 'provider.mjs'), loader = join(world.directory, 'loader.mjs');
  const cli = join(world.directory, 'fake-cli.mjs'), prompts = join(world.directory, 'prompts.jsonl');
  writeFileSync(activation, JSON.stringify(world.activation()));
  writeFileSync(profile, JSON.stringify(offlineProfile));
  writeFileSync(prompts, '');
  const chat = Number(world.configuration.chatId), operator = Number(world.configuration.operatorSenderId);
  writeFileSync(updates, JSON.stringify([
    { update_id: 1, message: { message_id: 1, chat: { id: chat, type: 'private' }, from: { id: operator },
      text: `Please keep my github token ${TOKEN} for later.` } },
    { update_id: 2, message: { message_id: 2, chat: { id: chat, type: 'private' }, from: { id: operator }, text: 'Thanks!' } }]));
  // A stand-in CLI: a real child process launched through the physical IO the launcher built.
  writeFileSync(cli, `import { appendFileSync, readFileSync } from 'node:fs';
const prepared = readFileSync(0, 'utf8');
appendFileSync(process.argv[2], JSON.stringify(prepared) + '\\n');
const envelope = JSON.parse(prepared), binding = JSON.parse(envelope.messages[1].content).bindings;
${PER_RULE_PASS}
const value = envelope.messages[0].content.startsWith('Judge this proposed reply') ? perRulePass(envelope.messages[0].content, 'The reply stays within the rules.') : 'Noted.';
const decision = { type: 'Decision', schemaVersion: 1, id: 'resource-answer', at: binding.at, by: binding.by,
  conclusion: { subject: 'preview-stage2-answer', predicate: 'answer-text', value, evidence: binding.evidence },
  reason: { subject: 'question', predicate: 'answered', value: true, evidence: binding.evidence },
  floor: { allowed: binding.floor, chosen: binding.floor.default } };
process.stdout.write(JSON.stringify({ type: 'result', is_error: false, result: JSON.stringify(decision),
  modelUsage: { [process.argv[3]]: {} } }));
`);
  writeFileSync(provider, `export { SUBSCRIPTION_CONVERSATION_FRAMING, SUBSCRIPTION_PREVIEW_EXPIRY, subscriptionConversationPolicy,
  validateSubscriptionActivation, SUBSCRIPTION_TOOLS_FRAMING, SUBSCRIPTION_TOOLS_SYSTEM_PROMPT,
  subscriptionToolsPolicy } from ${JSON.stringify(pathToFileURL(join(process.cwd(), 'src/assembly/production-provider.ts')).href)};
${FIXTURE_DOORWAY}
export const createClaudeCodeSubscriptionRoute = config => ({ kind: 'Success', value: { invoke: async prepared => {
  const r = await config.io.execute({ executable: process.execPath, args: [${JSON.stringify(cli)}, ${JSON.stringify(prompts)}, config.model],
    cwd: ${JSON.stringify(world.directory)}, env: { PATH: '/usr/bin:/bin' }, stdin: prepared, timeout: 20000, maxBytes: 1048576 });
  if (r.code !== 0 || r.limited) return { state: 'uncertain' };
  // A command with no prompt on stdin (like the real route's version and auth preflights) prints no
  // result frame; it is not the doorway exchange. It runs last so observing it would be the final reading.
  const check = await config.io.execute({ executable: process.execPath, args: ['--version'],
    cwd: ${JSON.stringify(world.directory)}, env: { PATH: '/usr/bin:/bin' }, stdin: '', timeout: 20000, maxBytes: 1024 });
  if (check.code !== 0 || check.limited) return { state: 'uncertain' };
  return { state: 'complete', bytes: JSON.parse(r.stdout).result, usage: { inputTokens: 1, outputTokens: 1 } };
} } });
`);
  writeFileSync(loader, `export async function resolve(specifier, context, next) {
  if (context.parentURL?.endsWith('/journal-agent.mjs') && specifier.endsWith('/production-provider.js'))
    return { url: ${JSON.stringify(pathToFileURL(provider).href)}, shortCircuit: true };
  return next(specifier, context);
}\n`);
  const endpoint = spawn(process.execPath, [join(process.cwd(), 'tests/preview/journal-poll-endpoint.mjs'), log, updates],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const port = await new Promise((done, fail) => {
      endpoint.stdout.once('data', data => done(Number(String(data).trim()))); endpoint.once('error', fail);
    });
    const trial = world.state().read().trial;
    const env = { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
      INSTAR_SECRET_PREVIEW_TYPESAFE_KEY: '',
      INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: `http://127.0.0.1:${port}` };
    const run = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', '--loader', loader,
      'tests/preview/journal-agent.mjs', 'run', '--root', root, '--bot-id', world.configuration.botId, '--chat-id', world.configuration.chatId,
      '--operator-sender-id', world.configuration.operatorSenderId, '--grant-reference', trial.id,
      '--configuration-digest', trial.configurationDigest, '--expires-at', String(trial.expiresAt),
      '--tools', 'off', '--activation-record', activation, '--operator-records', join(world.directory, 'operator-records'), '--login-profile', profile, '--model', world.model,
      '--bot-username', world.configuration.botUsername, '--max-cycles', '3', '--max-poll-seconds', '1'],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 30000, env });
    expect(run.status, run.stderr).toBe(0);
    const sent = readFileSync(`${log}.sends`, 'utf8');
    expect(sent).toContain('Noted.');
    expect(sent).not.toContain(TOKEN);
    // The model never received the secret; it saw the stored reference instead.
    const seen = readFileSync(prompts, 'utf8');
    expect(seen.length).toBeGreaterThan(0);
    expect(seen).not.toContain(TOKEN);
    expect(seen).toMatch(/credential stored before use: SecretRef preview\/chat-github-token-[a-f0-9]{16}/u);
    const status = JSON.parse(spawnSync(process.execPath,
      ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', 'status', '--root', root],
      { cwd: process.cwd(), env, encoding: 'utf8', timeout: 10000 }).stdout);
    // Rules 60/61: every launch was admitted by the one owner and none is left running.
    expect(status.resources).toMatchObject({ version: 1, active: [], waiting: [],
      inherited: { state: 'observed', effectivePerLaunch: { handleCount: expect.any(Number) } },
      counters: { admitted: status.calls * 2, refusedCapacity: 0 } }); // each call launches its model command and its no-prompt check
    expect(status.resources.counters.admitted).toBeGreaterThanOrEqual(2);
    // Each launch's bounds are declared by what the host holds, and its facts are durable in the journal.
    expect(status.resources.enforcement).toEqual({ cpuPerProcess: 'hard', handlesPerProcess: 'hard', memory: 'sampled', treeCpu: 'sampled',
      processGrowth: 'sampled', treeHandles: 'unsupported' });
    expect(status.resources.bounds).toMatchObject({ treeMembership: 'working-area-joined', sixAllocation: 'hard', uidProcesses: 'hard', aggregateLaunches: 'hard' });
    // Every launch went through its Six allocation set (SEAM-LEDGER row 36), and none was refused there.
    expect(status.resources.allocation).toEqual({ state: 'six', lastRefusal: null });
    // Per-launch evidence: each launch carries its own admission, its user-ID limit with its subject, a
    // cleanup verified over the joined membership (the provider's private working area included), and
    // its Six debit returned citing that verification. (This stand-in route bypasses the call-outcome
    // recorder, whose per-call copy is covered in call-diagnostics.test.ts.)
    expect(status.resources.lastLaunch).toMatchObject({ admission: { work: expect.stringMatching(/^(answer|review|maintenance)$/u), concurrent: expect.any(Number) },
      cleanup: 'verified', membership: 'working-area-joined',
      allocation: { state: 'returned', settlement: expect.stringMatching(/^cleanup-verified:/u) },
      uidProcesses: { state: 'hard', subject: expect.stringMatching(/^uid:\d+$/u) } });
    expect(Array.isArray(status.resources.launches)).toBe(true);
    expect(status.resources.durable).toMatchObject({ 'cleanup-unresolved': 0, capacity: 0 });
    expect(status.resources.orphans).toEqual([]);
    expect(JSON.parse(readFileSync(join(root, 'owned-launches.json'), 'utf8')).launches).toEqual({});
    // Rule 56: the answered exchanges verified the exact provider-reported id (the preflight, with no prompt, is not
    // observed: had it been, its missing result frame would read unavailable); the unreachable Jev route is an unavailable reading.
    expect(status.doorways.models).toEqual([
      expect.objectContaining({ doorway: 'preview-subscription', model: world.model, state: 'verified', fresh: true,
        age: expect.stringMatching(/ ms of doorway-verification-age \(preview-subscription\//u) }),
      expect.objectContaining({ doorway: 'typesafe-jev', state: 'unavailable', fresh: false })]);
    expect(status.doorways.fresh).toBe(false);
    // The standing check ran from the poll cycle, with no status request needed.
    expect(status.doorways.standing).toMatchObject({ fresh: false, failing: expect.arrayContaining([expect.stringMatching(/^typesafe-jev\//u)]) });
    expect(status.doorways.prices.map(p => p.state)).toEqual(['unavailable', 'unavailable']);
    expect(status.doorways.map.doorways[0].models[0]).toMatchObject({ strength: 'provider-reported' });
    // Rule 100: the vault record and the installed credentials' identity and expiry.
    const names = status.credentials.records.map(r => r.name);
    expect(names).toEqual(expect.arrayContaining(['telegram-bot-token', 'typesafe-key', 'preview-activation']));
    expect(status.credentials.records.find(r => r.name === 'preview-activation')).toMatchObject({
      expiresAt: trial.expiresAt, expirySource: 'activation-record', reminders: expect.arrayContaining([trial.expiresAt]) });
    expect(status.credentials.records.find(r => r.name.startsWith('chat-github-token-'))).toMatchObject({ custody: 'preview-vault' });
    expect(status.credentials.referencedIn).toEqual([1]);
    // Custody is intact and checked live: the original capture and the stored secret both open.
    expect(status.credentials.custody).toEqual({ stored: 1, failed: [], missing: [] });
    expect(status.credentials.intact).toBe(true);
    expect(JSON.stringify(status)).not.toContain(TOKEN);
    // Rule 40: the packet outcome is a success type, with or without trimming.
    expect(status.packet.capacity).toMatchObject({ outcome: 'success' });
    expect(status.journalCapacity).toEqual({ outcome: 'success', capacity: 'none' });
    expect(status.reconciliation).toMatchObject({ reservedCalls: status.calls, charge: { state: 'UNKNOWN', settled: null, released: null } });
  } finally { endpoint.kill('SIGTERM'); }
}, 45000);
