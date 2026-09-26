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
      INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: `http://127.0.0.1:${port}` };
    const agent = (...rest) => spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      '--loader', loader, 'tests/preview/journal-agent.mjs', ...rest], { cwd: process.cwd(), encoding: 'utf8', timeout: 20000, env });
    const run = cycles => {
      const start = performance.now();
      const result = agent('run', '--root', root, '--bot-id', world.configuration.botId, '--chat-id', world.configuration.chatId,
        '--operator-sender-id', world.configuration.operatorSenderId, '--grant-reference', trial.id,
        '--configuration-digest', trial.configurationDigest, '--expires-at', String(trial.expiresAt),
        '--activation-record', activation, '--login-profile', profile, '--model', world.model,
        '--bot-username', world.configuration.botUsername, '--max-cycles', String(cycles), '--max-poll-seconds', '1',
        '--max-calls', '2', '--max-replies', '2', '--max-turns', '4', '--time-zone', 'America/Los_Angeles');
      expect(result.status, result.stderr).toBe(0);
      return performance.now() - start;
    };
    const status = () => JSON.parse(agent('status', '--root', root, '--time-zone', 'America/Los_Angeles').stdout);
    const selfOf = line => JSON.parse(JSON.parse(JSON.parse(line)).messages.find(m => m.role === 'context').content)
      .packet.sources.find(source => source.id === 'self-state').text;
    // Run 1: two messages fill the two-attempt cap; the loop ends at the model-attempt cap.
    writeFileSync(updates, JSON.stringify([message(1, 'first'), message(2, 'second')]));
    const firstLaunch = run(4);
    let s = status();
    expect(s).toMatchObject({ calls: 2, replies: 2, unknownCalls: 0, unknownSends: 0 });
    expect(s.launches).toHaveLength(1);
    expect(s.launches[0].reason).toBe('model attempt cap reached');
    let prompt = readFileSync(prompts, 'utf8').trim().split('\n').map(selfOf);
    expect(prompt[0]).toContain('That is the first recorded launch');
    expect(prompt[0]).toContain('Operator messages received: 1 today, 1 in this trial');
    expect(prompt[1]).toContain('My replies Telegram accepted: 1 today, 1 in this trial');
    expect(prompt[1]).toContain('Model attempts: 1 of 2 used, 1 left');
    // The operator raises caps; run 2 answers a third message and knows its own restart and why.
    const raised = agent('raise-caps', '--root', root, '--max-calls', '4', '--max-replies', '4', '--max-turns', '6',
      '--authority', 'Justin, offline test');
    expect(raised.status, raised.stderr).toBe(0);
    writeFileSync(updates, JSON.stringify([message(1, 'first'), message(2, 'second'),
      message(3, 'how many messages have we exchanged today and when did you last restart?')]));
    const secondLaunch = run(3);
    s = status();
    prompt = readFileSync(prompts, 'utf8').trim().split('\n').map(selfOf);
    expect(prompt).toHaveLength(3);
    const now = prompt[2];
    expect(now).toContain('Operator messages received: 3 today, 3 in this trial (including the one being answered now)');
    expect(now).toContain('My replies Telegram accepted: 2 today, 2 in this trial');
    expect(now).toContain('Messages exchanged today: 5');
    expect(now).toContain('Model attempts: 2 of 4 used, 2 left');
    expect(now).toContain('on the authority "Justin, offline test"');
    expect(now).toMatch(/Last restart: 2026-\d\d-\d\d \d\d:\d\d P[DS]T\. The run before it started .* and ended .*: model attempt cap reached\./u);
    expect(now).toContain('Launches recorded: 2');
    expect(s.launches).toHaveLength(2);
    expect(s.launches[1].reason).toBe('cycle limit reached');
    // Status, read afterwards, agrees: one more reply (the answer just sent) and the same restart.
    expect(s.self).toContain('Operator messages received: 3 today, 3 in this trial');
    expect(s.self).toContain('My replies Telegram accepted: 3 today, 3 in this trial');
    expect(s.self).toContain('Messages exchanged today: 6');
    expect(s.self).toContain(now.match(/Last restart: [^.]*\./u)[0]);
    expect(s.self).toContain('ended'); // the latest launch has recorded its end
    process.stdout.write(`launcher runs: first=${firstLaunch.toFixed(0)} ms, restarted=${secondLaunch.toFixed(0)} ms\n`);
  } finally { endpoint.kill('SIGTERM'); }
}, 60000);
