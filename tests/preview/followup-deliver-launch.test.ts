// @ts-nocheck -- isolated process/HTTP fixture runs the actual launcher with recorded model bytes.
import { expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { successiveWorld, offlineProfile, OFFLINE_STORAGE_KEY, FIXTURE_DOORWAY, PER_RULE_PASS } from './successive-fixture.js';
import { createJournalWorker, openPreviewJournal, LOOP_REVISIT_MS } from './journal-test-worker.js';

const recorded = JSON.parse(readFileSync(new URL('./fixtures/requested-report-proofroom4-2026-10-17.json', import.meta.url), 'utf8'));

// Rule 36: the real request, acknowledgement, work result and delivered body from update 46040219.
// Only the unrelated reviewer and transport are stand-ins. No real credential, chat or login is used.
it.each(['delivered', 'uncertain', 'withdrawn'])('the shipped poll loop retains follow-up work across busy empty polls: %s', async mode => {
  const world = successiveWorld(), root = join(world.directory, 'followup-journal');
  const path = join(root, 'journal.encrypted'), activation = join(world.directory, 'activation.json');
  const profile = join(world.directory, 'profile.json'), log = join(world.directory, 'poll.log');
  const started = join(world.directory, 'work-started'), polled = join(world.directory, 'polled');
  const provider = join(world.directory, 'provider.mjs'), loader = join(world.directory, 'loader.mjs');
  writeFileSync(activation, JSON.stringify(world.activation())); writeFileSync(profile, JSON.stringify(offlineProfile));
  const trial = world.state().read().trial, now = Date.now();
  let journal = openPreviewJournal(path, OFFLINE_STORAGE_KEY, { kind: 'genesis', origin: 'test',
    bot: world.configuration.botId, chat: world.configuration.chatId, operator: world.configuration.operatorSenderId,
    grant: trial.id, configurationDigest: trial.configurationDigest, expires: trial.expiresAt,
    maxCalls: 40, maxReplies: 20, maxTurns: 20, maxBytes: 32768, cursor: 0 });
  const prior = createJournalWorker(journal, { origin: 'test', now: () => now - 2 * LOOP_REVISIT_MS,
    stopped: () => false, model: async input => input.id.startsWith('summary:')
      ? JSON.stringify({ summary: 'The operator requested a later answer.', memory: [], people: [], commitments: [], closed: [] })
      : recorded.answer, send: async () => 1, checkOutbound: () => {} });
  prior.intake([{ update_id: recorded.provenance.sourceUpdate, message: {
    chat: { id: Number(world.configuration.chatId), type: 'private' }, from: { id: Number(world.configuration.operatorSenderId) },
    text: recorded.request, date: Math.floor((now - 2 * LOOP_REVISIT_MS) / 1000) } }]);
  await prior.drain();
  expect(journal.view.commitments[0]).toBeDefined();
  expect(journal.view.commitments[0].deliveryRequest).toBeDefined();
  journal.close();
  writeFileSync(provider, `export { SUBSCRIPTION_CONVERSATION_FRAMING, SUBSCRIPTION_PREVIEW_EXPIRY, subscriptionConversationPolicy,
  validateSubscriptionActivation, SUBSCRIPTION_TOOLS_FRAMING, SUBSCRIPTION_TOOLS_SYSTEM_PROMPT,
  subscriptionToolsPolicy } from ${JSON.stringify(pathToFileURL(join(process.cwd(), 'src/assembly/production-provider.ts')).href)};
import { existsSync, writeFileSync } from 'node:fs';
${FIXTURE_DOORWAY}
${PER_RULE_PASS}
export const createClaudeCodeSubscriptionRoute = () => ({kind:'Success',value:{invoke:async prepared => {
  const envelope=JSON.parse(prepared), binding=JSON.parse(envelope.messages[1].content).bindings;
  const asked=envelope.messages[0].content;
  let text;
  if (asked.startsWith('packet.obligation is open work')) {
    writeFileSync(${JSON.stringify(started)}, 'started');
    const deadline = Date.now() + 15000;
    while (!existsSync(${JSON.stringify(polled)}) && Date.now() < deadline) await new Promise(r => setTimeout(r, 10));
    if (!existsSync(${JSON.stringify(polled)})) throw Error('fixture poll never arrived');
    // The two empty polls finish while work is still in flight. Inject latency, never CPU load.
    await new Promise(r => setTimeout(r, 300));
    text=${JSON.stringify(recorded.work)};
  } else if (asked==='Cancel that result delivery.') text=JSON.stringify({reply:'I cancelled that result delivery.',cancelDeliveries:[{id:0,quote:asked}]});
  else if (asked.startsWith('Judge this proposed reply')) text=perRulePass(asked,'The recorded result answers the request.');
  else text=JSON.stringify({summary:'The operator requested a later answer.',memory:[],people:[],commitments:[],closed:[]});
  const decision={type:'Decision',schemaVersion:1,id:'followup-answer',at:binding.at,by:binding.by,
    conclusion:{subject:'preview-stage2-answer',predicate:'answer-text',value:text,evidence:binding.evidence},
    reason:{subject:'question',predicate:'answered',value:true,evidence:binding.evidence},
    floor:{allowed:binding.floor,chosen:binding.floor.default}};
  return {state:'complete',bytes:JSON.stringify(decision),usage:{inputTokens:1,outputTokens:1}};
}}});`);
  writeFileSync(loader, `export async function resolve(specifier,context,next) {
    if (context.parentURL?.endsWith('/journal-agent.mjs') && specifier.endsWith('/production-provider.js'))
      return {url:${JSON.stringify(pathToFileURL(provider).href)},shortCircuit:true};
    return next(specifier,context);
  }
  // The shipped transport shim uses ulimit -u, unsupported by WSL's /bin/sh (dash).
  // This scheduling test substitutes Linux thread-aware process headroom (the production census is macOS-specific).
  // Handles, CPU, elapsed time and the kernel process ceiling still apply; this is not a host-conformance proof.
  export async function load(url,context,next) {
    const loaded=await next(url,context);
    if(process.platform==='linux' && url.endsWith('/scripts/production-boot-io.mjs'))
      return {...loaded,source:String(loaded.source).replaceAll("spawnSync('/bin/sh', argv","spawnSync('/bin/bash', argv")
        .replaceAll("spawn('/bin/sh', argv","spawn('/bin/bash', argv").replace("['-U', String(uid), '-o', 'pid=']", "['-U', String(uid), '-L', '-o', 'lwp=']")
        .replace('count + TRANSPORT_LIMITS.processCount', 'count + 32')};
    return loaded;
  }`);
  const endpointScript = join(world.directory, 'endpoint.mjs');
  const cancellation = { update_id: recorded.provenance.sourceUpdate + 1, message: {
    chat: { id: Number(world.configuration.chatId), type: 'private' }, from: { id: Number(world.configuration.operatorSenderId) },
    text: 'Cancel that result delivery.' } };
  writeFileSync(endpointScript, `import {createServer} from 'node:http';
import {appendFileSync,existsSync,writeFileSync} from 'node:fs';
let polls=0, message=100;
createServer((req,res)=>{const chunks=[]; req.on('data',b=>chunks.push(b)); req.on('end',async()=>{
  const method=req.url.split('/').at(-1), body=JSON.parse(Buffer.concat(chunks).toString()||'{}');
  appendFileSync(${JSON.stringify(log)},JSON.stringify({method,body})+'\\n');
  if(method==='getUpdates') {
    const deadline=Date.now()+15000;
    while(!existsSync(${JSON.stringify(started)}) && Date.now()<deadline) await new Promise(r=>setTimeout(r,10));
    if(++polls===2) writeFileSync(${JSON.stringify(polled)},'empty polls complete');
  }
  if(method==='sendMessage' && ${JSON.stringify(mode)}==='uncertain') {req.socket.destroy(); return;}
  res.setHeader('content-type','application/json');
  res.end(JSON.stringify({ok:true,result:method==='getMe'?{id:12345678,is_bot:true,username:'echo_mmtest_seam_b27x_bot'}
    :method==='getUpdates'?(polls===2 && ${JSON.stringify(mode)}==='withdrawn'?[${JSON.stringify(cancellation)}]:[]):method==='sendMessage'?{message_id:++message,chat:{id:Number(body.chat_id)},
      text:String(body.text).replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&')}:true}));
});}).listen(0,'127.0.0.1',function(){process.stdout.write(String(this.address().port)+'\\n');});`);
  const endpoint = spawn(process.execPath, [endpointScript], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const port = await new Promise((resolve, reject) => {
      endpoint.stdout.once('data', data => resolve(Number(String(data).trim()))); endpoint.once('error', reject);
    });
    const env = { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
      INSTAR_SECRET_PREVIEW_TYPESAFE_KEY: '', INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: `http://127.0.0.1:${port}` };
    const args = ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', '--loader', loader,
      'tests/preview/journal-agent.mjs', 'run', '--root', root, '--bot-id', world.configuration.botId, '--chat-id', world.configuration.chatId,
      '--operator-sender-id', world.configuration.operatorSenderId, '--grant-reference', trial.id,
      '--configuration-digest', trial.configurationDigest, '--expires-at', String(trial.expiresAt),
      '--tools', 'off', '--activation-record', activation, '--operator-records', join(world.directory, 'operator-records'), '--login-profile', profile,
      '--model', world.model, '--bot-username', world.configuration.botUsername, '--max-cycles', '2', '--max-poll-seconds', '1', '--sentinels', 'none'];
    const run = spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8', timeout: 60000, env });
    expect(run.status, run.stderr + (existsSync(log) ? readFileSync(log, 'utf8') : 'no endpoint calls') + (existsSync(join(root, 'runs.jsonl')) ? readFileSync(join(root, 'runs.jsonl'), 'utf8') : '')).toBe(0);
    expect(existsSync(started)).toBe(true); expect(existsSync(polled)).toBe(true);
    const rows = () => readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line));
    expect(rows().filter(row => row.method === 'getUpdates')).toHaveLength(2);
    const sends = () => rows().filter(row => row.method === 'sendMessage');
    expect(sends(), JSON.stringify(sends())).toHaveLength(mode==='uncertain' ? 2 : 1);
    if (mode==='withdrawn') { expect(sends()[0].body.text).toContain('I cancelled that result delivery.');
      expect(sends()[0].body.text).not.toContain(JSON.parse(recorded.work).report); }
    else expect(sends()[0].body.text).toContain(JSON.parse(recorded.work).report);
    if (mode==='uncertain') expect(sends()[1].body.text).toContain('My answer may not have arrived.');
    journal = openPreviewJournal(path, OFFLINE_STORAGE_KEY);
    expect(journal.view.closed.has(0)).toBe(mode!=='uncertain');
    expect(journal.view.obligationWork['commitment:0'].report.delivered !== undefined).toBe(mode==='delivered');
    journal.close();
    // A fresh launcher rereads the durable receipt; it must not deliver the result again.
    const restart = spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8', timeout: 60000, env });
    expect(restart.status, restart.stderr).toBe(0); expect(sends(), JSON.stringify(sends())).toHaveLength(mode==='uncertain' ? 2 : 1);
  } finally { endpoint.kill('SIGTERM'); journal.close(); }
}, 120000);
