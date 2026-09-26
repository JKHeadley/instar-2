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
  const decision={type:'Decision',schemaVersion:1,id:'resumed-answer',at:binding.at,by:binding.by,
    conclusion:{subject:'preview-stage2-answer',predicate:'answer-text',value:'Resumed answer.',evidence:binding.evidence},
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
        encoding:'utf8',timeout:10000}).stdout)).toMatchObject({calls:1,replies:1,unknownCalls:0,unknownSends:0});
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
