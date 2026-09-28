// @ts-nocheck -- offline process and HTTP fixtures exercise the real launcher.
import { expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { successiveWorld, offlineProfile, OFFLINE_STORAGE_KEY } from './successive-fixture.js';

it('the real launcher puts its journal-derived self-state in every prompt, correct across a restart and a raised cap, matching status', async () => {
  const world = successiveWorld(), root = join(world.directory, 'self-journal');
  const activation = join(world.directory, 'activation.json'), profile = join(world.directory, 'profile.json');
  const log = join(world.directory, 'poll.log'), updates = join(world.directory, 'updates.json');
  const provider = join(world.directory, 'provider.mjs'), loader = join(world.directory, 'loader.mjs');
  const prompts = join(world.directory, 'prompts.jsonl');
  writeFileSync(activation, JSON.stringify(world.activation()));
  writeFileSync(profile, JSON.stringify(offlineProfile));
  const chat = Number(world.configuration.chatId), operator = Number(world.configuration.operatorSenderId);
  const message = (update_id, text) => ({ update_id, message: { chat: { id: chat, type: 'private' }, from: { id: operator }, text } });
  writeFileSync(provider, `import { appendFileSync } from 'node:fs';
// This launcher test measures self-state; give its reply check the same clear-pass
// Jev answer as the worker tests, without spending a subscription review call.
globalThis.fetch = async (url, init) => {
  if (url !== 'https://api.typesafe.ai/v1/systemone') throw Error('unexpected fetch');
  return new Response(JSON.stringify({ model: 'jev-1.13.0', answers: Object.fromEntries(
    Object.keys(JSON.parse(init.body).questions).map(id => [id, { type: 'noul', noul: 0.01 }])) }));
};
export { SUBSCRIPTION_CONVERSATION_FRAMING, subscriptionConversationPolicy,
  validateSubscriptionActivation } from ${JSON.stringify(pathToFileURL(join(process.cwd(),'src/assembly/production-provider.ts')).href)};
export const createClaudeCodeSubscriptionRoute = () => ({kind:'Success',value:{invoke:async prepared => {
  appendFileSync(${JSON.stringify(prompts)}, JSON.stringify(prepared) + '\\n');
  const binding=JSON.parse(JSON.parse(prepared).messages[1].content).bindings;
  const decision={type:'Decision',schemaVersion:1,id:'self-answer',at:binding.at,by:binding.by,
    conclusion:{subject:'preview-stage2-answer',predicate:'answer-text',value:'Answered.',evidence:binding.evidence},
    reason:{subject:'question',predicate:'answered',value:true,evidence:binding.evidence},
    floor:{allowed:binding.floor,chosen:binding.floor.default}};
  return {state:'complete',bytes:JSON.stringify(decision),usage:{inputTokens:1,outputTokens:1}};
}}});
`);
  writeFileSync(loader, `export async function resolve(specifier,context,next) {
  if (context.parentURL?.endsWith('/journal-agent.mjs') && specifier.endsWith('/production-provider.js'))
    return {url:${JSON.stringify(pathToFileURL(provider).href)},shortCircuit:true};
  return next(specifier,context);
}\n`);
  const endpoint = spawn(process.execPath, [join(process.cwd(), 'tests/preview/journal-poll-endpoint.mjs'), log, updates],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const port = await new Promise((done, fail) => {
      endpoint.stdout.once('data', data => done(Number(String(data).trim()))); endpoint.once('error', fail);
    });
    const trial = world.state().read().trial;
    const env = { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
      INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      INSTAR_SECRET_PREVIEW_TYPESAFE_KEY: 'offline-test-key',
      INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: `http://127.0.0.1:${port}` };
    const agent = (...rest) => spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      '--loader', loader, 'tests/preview/journal-agent.mjs', ...rest], { cwd: process.cwd(), encoding: 'utf8', timeout: 20000, env });
    const run = (cycles, stepCheck = false) => {
      const start = performance.now();
      const result = agent('run', '--root', root, '--bot-id', world.configuration.botId, '--chat-id', world.configuration.chatId,
        '--operator-sender-id', world.configuration.operatorSenderId, '--grant-reference', trial.id,
        '--configuration-digest', trial.configurationDigest, '--expires-at', String(trial.expiresAt),
        '--activation-record', activation, '--operator-records', join(world.directory, 'operator-records'), '--login-profile', profile, '--model', world.model,
        '--bot-username', world.configuration.botUsername, '--max-cycles', String(cycles), '--max-poll-seconds', '1',
        '--max-calls', '3', '--max-replies', '2', '--max-turns', '4', '--time-zone', 'America/Los_Angeles',
        ...(stepCheck ? ['--step-check', 'true'] : []));
      expect(result.status, result.stderr).toBe(0);
      return performance.now() - start;
    };
    const status = () => JSON.parse(agent('status', '--root', root, '--time-zone', 'America/Los_Angeles').stdout);
    const packetOf = line => JSON.parse(JSON.parse(JSON.parse(line)).messages.find(m => m.role === 'context').content).packet;
    const selfOf = line => packetOf(line).sources.find(source => source.id === 'self-state').text;
    // Run 1: two messages fill the reply cap; one call slot stays available for review.
    writeFileSync(updates, JSON.stringify([message(1, 'first'), message(2, 'second')]));
    const firstLaunch = run(4);
    let s = status();
    expect(s.self).toContain(s.memoryHealth);
    expect(s.memoryHealth).toContain('Memory health:');
    expect(s, JSON.stringify({ calls: s.calls, replies: s.replies, holds: s.holds,
      replyChecks: s.replyChecks, launches: s.launches, turns: s.turns, summaries: s.summaries }))
      .toMatchObject({ calls: 2, replies: 2, unknownCalls: 0, unknownSends: 0 });
    expect(s.launches).toHaveLength(1);
    expect(s.stepChecks).toBeUndefined();
    // Rule 15: a reached cap no longer ends the run; the reserve keeps reading until the cycle bound.
    expect(s.launches[0].reason).toBe('cycle limit reached');
    let prompt = readFileSync(prompts, 'utf8').trim().split('\n').map(selfOf);
    expect(prompt[0]).toContain('That is the first recorded launch');
    expect(prompt[0]).toMatch(/This run started 2026-\d\d-\d\d \d\d:\d\d P[DS]T; uptime \d+m\./u);
    // The burst intake admits every waiting update before reply work, so both are already received.
    expect(prompt[0]).toContain('Operator messages received: 2 today, 2 in this trial');
    expect(prompt[1]).toContain('My replies Telegram accepted: 1 today, 1 in this trial');
    expect(prompt[1]).toContain('Model attempts: 1 of 3 used, 2 left');
    expect(readFileSync(prompts, 'utf8').trim().split('\n').every(line =>
      !packetOf(line).sources.some(source => source.id === 'restart-handoff'))).toBe(true);
    // The operator raises caps; run 2 answers a third message and knows its own restart and why.
    const raised = agent('raise-caps', '--root', root, '--max-calls', '6', '--max-replies', '5', '--max-turns', '6',
      '--authority', 'Justin, offline test');
    expect(raised.status, raised.stderr).toBe(0);
    writeFileSync(updates, JSON.stringify([message(1, 'first'), message(2, 'second'),
      message(3, 'how many messages have we exchanged today and when did you last restart?'),
      message(4, 'one more question')]));
    const secondLaunch = run(4);
    s = status();
    expect(s.self).toContain(s.memoryHealth);
    const lines = readFileSync(prompts, 'utf8').trim().split('\n');
    prompt = lines.map(selfOf);
    expect(prompt).toHaveLength(4);
    expect(packetOf(lines[2]).sources.find(source => source.id === 'restart-handoff').text)
      .toContain('pending turns 0; held items 0; UNKNOWN model outcomes 0; UNKNOWN sends 0; lost-answer notices due 0');
    expect(packetOf(lines[3]).sources.some(source => source.id === 'restart-handoff')).toBe(false);
    const now = prompt[2];
    expect(now).toContain('Operator messages received: 4 today, 4 in this trial (including the one being answered now)');
    expect(now).toContain('My replies Telegram accepted: 2 today, 2 in this trial');
    expect(now).toContain('Messages exchanged today: 6');
    expect(now).toContain('Model attempts: 2 of 6 used, 4 left');
    expect(now).toContain('on the authority "Justin, offline test"');
    expect(now).toMatch(/This run started 2026-\d\d-\d\d \d\d:\d\d P[DS]T; uptime \d+m\./u);
    expect(now).toMatch(/Last restart: 2026-\d\d-\d\d \d\d:\d\d P[DS]T\. The run before it started .* and ended .*: cycle limit reached\./u);
    expect(now).toContain('Launches recorded: 2');
    expect(s.launches).toHaveLength(2);
    expect(s.launches[1].reason).toBe('cycle limit reached');
    // Status, read afterwards, agrees on the same restart and includes the fourth reply.
    expect(s.self).toContain('Operator messages received: 4 today, 4 in this trial');
    expect(s.self).toContain('My replies Telegram accepted: 4 today, 4 in this trial');
    expect(s.self).toContain('Messages exchanged today: 8');
    expect(s.self).toContain(now.match(/Last restart: [^.]*\./u)[0]);
    expect(s.self).toContain('ended'); // the latest launch has recorded its end
    process.stdout.write(`launcher runs: first=${firstLaunch.toFixed(0)} ms, restarted=${secondLaunch.toFixed(0)} ms\n`);
  } finally { endpoint.kill('SIGTERM'); }
}, 60000);
