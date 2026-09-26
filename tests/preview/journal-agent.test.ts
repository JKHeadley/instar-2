// @ts-nocheck -- offline process and HTTP fixtures exercise the real launcher.
import { expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { successiveWorld, offlineProfile, OFFLINE_STORAGE_KEY } from './successive-fixture.js';

it.each(['SIGTERM','SIGHUP'])('latches %s during synchronous idle polls before another dispatch', async signal => {
  const world = successiveWorld(), root = join(world.directory, 'idle-journal');
  const activation = join(world.directory, 'activation.json'), profile = join(world.directory, 'profile.json');
  const log = join(world.directory, 'poll.log');
  writeFileSync(activation, JSON.stringify(world.activation()));
  writeFileSync(profile, JSON.stringify(offlineProfile));
  const endpoint = spawn(process.execPath, [join(process.cwd(), 'tests/preview/journal-poll-endpoint.mjs'), log],
    {stdio:['ignore','pipe','pipe']});
  let child;
  try {
    const port = await new Promise((done, fail) => {
      endpoint.stdout.once('data', data => done(Number(String(data).trim()))); endpoint.once('error', fail);
    });
    const trial = world.state().read().trial;
    const args = ['--no-warnings','--loader','./scripts/slice-ts-loader.mjs','tests/preview/journal-agent.mjs',
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
    expect(JSON.parse(status.stdout).stop.reason).toBe('signal');
  } finally { child?.kill('SIGKILL'); endpoint.kill('SIGTERM'); }
},30000);
