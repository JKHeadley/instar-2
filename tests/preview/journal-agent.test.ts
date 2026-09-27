// @ts-nocheck -- offline process and HTTP fixtures exercise the real launcher.
import { expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { successiveWorld, offlineProfile, OFFLINE_STORAGE_KEY } from './successive-fixture.js';

it.each(['SIGTERM','SIGHUP'])('pauses on %s during synchronous idle polls and resumes on launch', async signal => {
  const world = successiveWorld(), root = join(world.directory, 'idle-journal');
  const activation = join(world.directory, 'activation.json'), profile = join(world.directory, 'profile.json');
  const log = join(world.directory, 'poll.log');
  const updates = join(world.directory, 'updates.json');
  const provider = join(world.directory, 'provider.mjs'), loader = join(world.directory, 'loader.mjs');
  writeFileSync(activation, JSON.stringify(world.activation()));
  writeFileSync(profile, JSON.stringify(offlineProfile));
  writeFileSync(updates,'[]');
  writeFileSync(provider, `export { SUBSCRIPTION_CONVERSATION_FRAMING, subscriptionConversationPolicy,
  validateSubscriptionActivation } from ${JSON.stringify(pathToFileURL(join(process.cwd(),'src/assembly/production-provider.ts')).href)};
export const createClaudeCodeSubscriptionRoute = () => ({kind:'Success',value:{invoke:async prepared => {
  const binding=JSON.parse(JSON.parse(prepared).messages[1].content).bindings;
  const review=JSON.parse(prepared).messages[0].content.startsWith('Judge this proposed reply');
  const decision={type:'Decision',schemaVersion:1,id:'resumed-answer',at:binding.at,by:binding.by,
    conclusion:{subject:'preview-stage2-answer',predicate:'answer-text',value:review
      ? JSON.stringify({verdict:'pass',ruleIds:[],reason:'The reply stays within the rules.'}) : 'Resumed answer.',evidence:binding.evidence},
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
    {stdio:['ignore','pipe','pipe']});
  let child;
  try {
    const port = await new Promise((done, fail) => {
      endpoint.stdout.once('data', data => done(Number(String(data).trim()))); endpoint.once('error', fail);
    });
    const trial = world.state().read().trial;
    const args = ['--no-warnings','--loader','./scripts/slice-ts-loader.mjs','--loader',loader,'tests/preview/journal-agent.mjs',
      'run','--root',root,'--bot-id',world.configuration.botId,'--chat-id',world.configuration.chatId,
      '--operator-sender-id',world.configuration.operatorSenderId,'--grant-reference',trial.id,
      '--configuration-digest',trial.configurationDigest,'--expires-at',String(trial.expiresAt),
      '--activation-record',activation,'--login-profile',profile,'--model',world.model,
      '--bot-username',world.configuration.botUsername,'--max-cycles','100000','--max-poll-seconds','1'];
    child = spawn(process.execPath,args,{cwd:process.cwd(),stdio:['ignore','pipe','pipe'],env:{...process.env,
      INSTAR_SECRET_PREVIEW_STORAGE_KEY:Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
      INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN:'12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT:`http://127.0.0.1:${port}`}});
    let stderr=''; child.stderr.on('data',data=>{stderr+=String(data);});
    const deadline = Date.now()+10000;
    while ((!existsSync(log) || readFileSync(log,'utf8').split('getUpdates').length < 4) && Date.now()<deadline)
      await new Promise(done=>setTimeout(done,20));
    expect(existsSync(log),stderr).toBe(true);
    expect(readFileSync(log,'utf8').split('getUpdates').length).toBeGreaterThanOrEqual(4);
    const pollsAtSignal=readFileSync(log,'utf8').split('getUpdates').length-1;
    child.kill(signal);
    const exit = await Promise.race([
      new Promise(done=>child.once('exit',(code,signal)=>done({code,signal}))),
      new Promise(done=>setTimeout(()=>done('timeout'),3000))]);
    expect(exit).not.toBe('timeout');
    expect(readFileSync(log,'utf8').split('getUpdates').length-1).toBeLessThanOrEqual(pollsAtSignal+1);
    const status = spawnSync(process.execPath,
      ['--no-warnings','--loader','./scripts/slice-ts-loader.mjs','tests/preview/journal-agent.mjs','status','--root',root],
      {cwd:process.cwd(),env:{...process.env,INSTAR_SECRET_PREVIEW_STORAGE_KEY:Buffer.from(OFFLINE_STORAGE_KEY).toString('hex')},
        encoding:'utf8',timeout:10000});
    expect(status.status).toBe(0);
    expect(JSON.parse(status.stdout).stop).toBeNull();
    expect(JSON.parse(status.stdout).launches).toMatchObject([{ reason: `paused by signal ${signal}` }]);
    expect(existsSync(join(root,'preview-stop.json'))).toBe(false);
    writeFileSync(updates, JSON.stringify([{update_id:1,message:{chat:{id:Number(world.configuration.chatId),type:'private'},
      from:{id:Number(world.configuration.operatorSenderId)},text:'Please answer after restart.'}}]));
    const resumed = spawnSync(process.execPath,[...args.slice(0,-4),'--max-cycles','3','--max-poll-seconds','1'],
      {cwd:process.cwd(),encoding:'utf8',timeout:10000,env:{...process.env,
        INSTAR_SECRET_PREVIEW_STORAGE_KEY:Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
        INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN:'12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT:`http://127.0.0.1:${port}`}});
    expect(resumed.status,resumed.stderr).toBe(0);
    expect(readFileSync(log,'utf8').split('getUpdates').length-1).toBeGreaterThan(pollsAtSignal);
    expect(readFileSync(log,'utf8').split('sendMessage').length-1).toBe(1);
    expect(JSON.parse(spawnSync(process.execPath,
      ['--no-warnings','--loader','./scripts/slice-ts-loader.mjs','tests/preview/journal-agent.mjs','status','--root',root],
      {cwd:process.cwd(),env:{...process.env,INSTAR_SECRET_PREVIEW_STORAGE_KEY:Buffer.from(OFFLINE_STORAGE_KEY).toString('hex')},
        encoding:'utf8',timeout:10000}).stdout)).toMatchObject({calls:2,replies:1,unknownCalls:0,unknownSends:0,
          coherence:{checked:1,unchecked:0,failed:0,pendingCorrections:0,findings:[]}});
    const stop = spawnSync(process.execPath,
      ['--no-warnings','--loader','./scripts/slice-ts-loader.mjs','tests/preview/journal-agent.mjs','stop','--root',root],
      {cwd:process.cwd(),encoding:'utf8',timeout:10000});
    expect(stop.status).toBe(0);
    expect(JSON.parse(readFileSync(join(root,'preview-stop.json'),'utf8')).reason).toBe('operator');
    const refused = spawnSync(process.execPath,[...args.slice(0,-4),'--max-cycles','1','--max-poll-seconds','1'],
      {cwd:process.cwd(),encoding:'utf8',timeout:10000,env:{...process.env,
        INSTAR_SECRET_PREVIEW_STORAGE_KEY:Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
        INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN:'12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT:`http://127.0.0.1:${port}`}});
    expect(refused.status).not.toBe(0);
  } finally { child?.kill('SIGKILL'); endpoint.kill('SIGTERM'); }
},30000);

it.each([['echo', 0], ['drop-thread', 1]])('the real launcher answers a topic from the main chat and replies into that topic (endpoint %s; a result without the thread stays UNKNOWN)', async (mode, unknown) => {
  const world = successiveWorld(), root = join(world.directory, 'topic-journal');
  const activation = join(world.directory, 'activation.json'), profile = join(world.directory, 'profile.json');
  const log = join(world.directory, 'poll.log'), updates = join(world.directory, 'updates.json');
  const provider = join(world.directory, 'provider.mjs'), loader = join(world.directory, 'loader.mjs');
  writeFileSync(activation, JSON.stringify(world.activation()));
  writeFileSync(profile, JSON.stringify(offlineProfile));
  const chat = Number(world.configuration.chatId), operator = Number(world.configuration.operatorSenderId);
  writeFileSync(updates, JSON.stringify([
    {update_id:1,message:{chat:{id:chat,type:'private'},from:{id:operator},text:'My sister is called Wren.'}},
    {update_id:2,message:{chat:{id:chat,type:'private'},from:{id:operator},text:'What is my sister called?',
      message_thread_id:7,is_topic_message:true}}]));
  writeFileSync(provider, `export { SUBSCRIPTION_CONVERSATION_FRAMING, subscriptionConversationPolicy,
  validateSubscriptionActivation } from ${JSON.stringify(pathToFileURL(join(process.cwd(),'src/assembly/production-provider.ts')).href)};
export const createClaudeCodeSubscriptionRoute = () => ({kind:'Success',value:{invoke:async prepared => {
  const envelope=JSON.parse(prepared), binding=JSON.parse(envelope.messages[1].content).bindings;
  const context=envelope.messages[1].content, asked=envelope.messages[0].content;
  const value=asked.startsWith('Judge this proposed reply')
    ? JSON.stringify({verdict:'pass',ruleIds:[],reason:'The reply stays within the rules.'})
    : asked.includes('What is my sister') ? (context.includes('Wren') && context.includes('main chat')
    ? 'Your sister is Wren; you told me in the main chat.' : 'I do not know.') : 'Noted.';
  const decision={type:'Decision',schemaVersion:1,id:'topic-answer',at:binding.at,by:binding.by,
    conclusion:{subject:'preview-stage2-answer',predicate:'answer-text',value,evidence:binding.evidence},
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
  const endpoint = spawn(process.execPath, [join(process.cwd(), 'tests/preview/journal-poll-endpoint.mjs'), log, updates, mode],
    {stdio:['ignore','pipe','pipe']});
  try {
    const port = await new Promise((done, fail) => {
      endpoint.stdout.once('data', data => done(Number(String(data).trim()))); endpoint.once('error', fail);
    });
    const trial = world.state().read().trial;
    const env = {...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY:Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
      INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN:'12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT:`http://127.0.0.1:${port}`};
    const run = spawnSync(process.execPath,['--no-warnings','--loader','./scripts/slice-ts-loader.mjs','--loader',loader,
      'tests/preview/journal-agent.mjs','run','--root',root,'--bot-id',world.configuration.botId,'--chat-id',world.configuration.chatId,
      '--operator-sender-id',world.configuration.operatorSenderId,'--grant-reference',trial.id,
      '--configuration-digest',trial.configurationDigest,'--expires-at',String(trial.expiresAt),
      '--activation-record',activation,'--login-profile',profile,'--model',world.model,
      '--bot-username',world.configuration.botUsername,'--max-cycles','3','--max-poll-seconds','1'],
      {cwd:process.cwd(),encoding:'utf8',timeout:20000,env});
    expect(run.status,run.stderr).toBe(0);
    const sends = readFileSync(`${log}.sends`,'utf8').trim().split('\n').map(line => JSON.parse(line));
    expect(sends).toHaveLength(2);
    expect(sends[0].message_thread_id).toBeUndefined();
    expect(sends[1]).toMatchObject({chat_id:world.configuration.chatId,message_thread_id:7,
      text:'PREVIEW — Your sister is Wren; you told me in the main chat.'});
    expect(JSON.parse(spawnSync(process.execPath,
      ['--no-warnings','--loader','./scripts/slice-ts-loader.mjs','tests/preview/journal-agent.mjs','status','--root',root],
      {cwd:process.cwd(),env,encoding:'utf8',timeout:10000}).stdout)).toMatchObject({calls:4,replies:2,unknownCalls:0,unknownSends:unknown,
        lastReplyTiming: { update: mode === 'echo' ? 2 : 1,
          intakeToApiAcceptedMs: expect.any(Number), checkMs: expect.any(Number) },
        coherence:{checked:2,unchecked:0,failed:0}});
  } finally { endpoint.kill('SIGTERM'); }
},30000);
