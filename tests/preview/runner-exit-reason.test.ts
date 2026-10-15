// @ts-nocheck -- real runner processes, isolated offline provider and HTTP transport.
import { expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { successiveWorld, offlineProfile, OFFLINE_STORAGE_KEY, FIXTURE_DOORWAY, PER_RULE_PASS } from './successive-fixture.js';
import { openPreviewJournal } from './journal.js';

it.each(['queued', 'sending'])('cycle self-exit preserves %s reply across relaunch', async mode => {
  const world = successiveWorld(), root = join(world.directory, 'exit-journal');
  const activation = join(world.directory, 'activation.json'), profile = join(world.directory, 'profile.json');
  const log = join(world.directory, 'poll.log'), updates = join(world.directory, 'updates.json');
  const provider = join(world.directory, 'provider.mjs'), loader = join(world.directory, 'loader.mjs');
  const phases = join(world.directory, 'phases.log'), laneModule = join(world.directory, 'lane.mjs');
  writeFileSync(activation, JSON.stringify(world.activation()));
  writeFileSync(profile, JSON.stringify(offlineProfile));
  writeFileSync(phases, '');
  writeFileSync(updates, JSON.stringify([{ update_id: 1, message: {
    chat: { id: Number(world.configuration.chatId), type: 'private' },
    from: { id: Number(world.configuration.operatorSenderId) }, text: 'Please answer after restart.' } }]));
  writeFileSync(provider, `export { SUBSCRIPTION_CONVERSATION_FRAMING, SUBSCRIPTION_PREVIEW_EXPIRY, subscriptionConversationPolicy,
  validateSubscriptionActivation, SUBSCRIPTION_TOOLS_FRAMING, SUBSCRIPTION_TOOLS_SYSTEM_PROMPT,
  subscriptionToolsPolicy } from ${JSON.stringify(pathToFileURL(join(process.cwd(),'src/assembly/production-provider.ts')).href)};
${FIXTURE_DOORWAY}
${PER_RULE_PASS}
export const createClaudeCodeSubscriptionRoute = () => ({kind:'Success',value:{invoke:async prepared => {
  const binding=JSON.parse(JSON.parse(prepared).messages[1].content).bindings;
  const asked=JSON.parse(prepared).messages[0].content, review=asked.startsWith('Judge this proposed reply');
  const decision={type:'Decision',schemaVersion:1,id:'resumed-answer',at:binding.at,by:binding.by,
    conclusion:{subject:'preview-stage2-answer',predicate:'answer-text',value:review
      ? perRulePass(asked,'The reply stays within the rules.') : 'Resumed answer.',evidence:binding.evidence},
    reason:{subject:'question',predicate:'answered',value:true,evidence:binding.evidence},
    floor:{allowed:binding.floor,chosen:binding.floor.default}};
  return {state:'complete',bytes:JSON.stringify(decision),usage:{inputTokens:1,outputTokens:1}};
}}});
`);
  writeFileSync(loader, `export async function resolve(specifier,context,next) {
  if (context.parentURL?.endsWith('/journal-agent.mjs') && specifier.endsWith('/production-provider.js'))
    return {url:${JSON.stringify(pathToFileURL(provider).href)},shortCircuit:true};
  if (context.parentURL?.endsWith('/journal-agent.mjs') && specifier.endsWith('/live-sentinels.js'))
    return {url:${JSON.stringify(pathToFileURL(laneModule).href)},shortCircuit:true};
  return next(specifier,context);
}\n`);
  const realLane = pathToFileURL(join(process.cwd(), 'tests/preview/live-sentinels.ts')).href;
  writeFileSync(laneModule, `export * from ${JSON.stringify(realLane)};
import { createOrdinaryLane as create } from ${JSON.stringify(realLane)};
import { appendFileSync } from 'node:fs';
export function createOrdinaryLane(ports) {
  const lane = create({...ports, peerCurrent: () => process.env.EXIT_TEST_QUEUED !== '1' && ports.peerCurrent()});
  return {...lane, settle: async () => {
    appendFileSync(${JSON.stringify(phases)}, 'settle-start\\n');
    await lane.settle();
    appendFileSync(${JSON.stringify(phases)}, 'settle-end\\n');
  }};
}
`);
  // Inject slow transport acknowledgement, not CPU load; this child's PID is the only endpoint we stop.
  const endpointFile = join(world.directory, 'endpoint.mjs');
  writeFileSync(endpointFile, `import { createServer } from 'node:http';
import { readFileSync, appendFileSync } from 'node:fs';
const server = createServer((req, res) => {
  const chunks=[]; req.on('data', b => chunks.push(b)); req.on('end', () => {
    const body=JSON.parse(Buffer.concat(chunks).toString()), method=req.url.split('/').at(-1);
    appendFileSync(${JSON.stringify(log)}, method+'\\n');
    const sending=method==='sendMessage';
    if(sending) appendFileSync(${JSON.stringify(phases)}, 'send-start\\n');
    setTimeout(() => {
      if(sending) appendFileSync(${JSON.stringify(phases)}, 'send-ack\\n');
      res.setHeader('content-type','application/json');
      res.end(JSON.stringify({ok:true,result:method==='getMe'
        ? {id:12345678,is_bot:true,username:'echo_mmtest_seam_b27x_bot'}
        : method==='getUpdates' ? JSON.parse(readFileSync(${JSON.stringify(updates)},'utf8')).filter(u=>u.update_id>=body.offset)
        : {message_id:1,chat:{id:Number(body.chat_id)},text:body.text}}));
    },sending?500:0);
  });
});
server.listen(0,'127.0.0.1',()=>process.stdout.write(String(server.address().port)));
`);
  const endpoint = spawn(process.execPath, [endpointFile], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const port = await new Promise((done, fail) => {
      endpoint.stdout.once('data', data => done(Number(String(data)))); endpoint.once('error', fail);
      endpoint.once('exit', code => fail(Error(`endpoint exited: ${code}`)));
    });
    const trial = world.state().read().trial;
    const args = ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', '--loader', loader,
      'tests/preview/journal-agent.mjs', 'run', '--root', root,
      '--bot-id', world.configuration.botId, '--chat-id', world.configuration.chatId,
      '--operator-sender-id', world.configuration.operatorSenderId, '--grant-reference', trial.id,
      '--configuration-digest', trial.configurationDigest, '--expires-at', String(trial.expiresAt),
      '--tools', 'off', '--activation-record', activation, '--operator-records', join(world.directory, 'operator-records'),
      '--login-profile', profile, '--model', world.model, '--bot-username', world.configuration.botUsername,
      '--max-cycles', '1', '--max-poll-seconds', '1'];
    const env = { ...process.env,
      INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
      INSTAR_SECRET_PREVIEW_TYPESAFE_KEY: '',
      INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: `http://127.0.0.1:${port}` };
    const run = queued => {
      const result = spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8', timeout: 30000,
        env: { ...env, EXIT_TEST_QUEUED: queued ? '1' : '0' } });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr.match(/^runner exiting: .+$/gm)).toEqual(['runner exiting: cycle limit reached']);
    };
    const view = () => {
      const journal = openPreviewJournal(join(root, 'journal.encrypted'), OFFLINE_STORAGE_KEY);
      try { return structuredClone(journal.view); } finally { journal.close(); }
    };
    run(mode === 'queued');
    expect(view().order).toHaveLength(1);
    expect(view().cursor).toBe(2);
    expect(view().replies).toBe(mode === 'queued' ? 0 : 1);
    if (mode === 'queued') {
      expect(readFileSync(log, 'utf8')).not.toContain('sendMessage');
      const exits = readFileSync(join(root, 'runs.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse).filter(r => r.exit);
      expect(exits.at(-1)).toMatchObject({ reason: 'cycle limit reached', unfinished: 1, revival: 'queued' });
    } else {
      const events = readFileSync(phases, 'utf8').trim().split('\n');
      expect(events.indexOf('send-ack')).toBeGreaterThan(events.indexOf('settle-start'));
      expect(events.indexOf('settle-end')).toBeGreaterThan(events.indexOf('send-ack'));
    }
    // Telegram no longer offers the accepted update: only durable intake can recover it.
    writeFileSync(updates, '[]');
    run(false);
    expect(view().replies).toBe(1);
    run(false);
    expect(view().replies).toBe(1);
    expect(readFileSync(log, 'utf8').split('sendMessage').length - 1).toBe(1);
  } finally { endpoint.kill('SIGTERM'); }
}, 90000);
