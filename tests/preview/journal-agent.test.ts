// @ts-nocheck -- offline process and HTTP fixtures exercise the real launcher.
import { expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { successiveWorld, offlineProfile, OFFLINE_STORAGE_KEY, FIXTURE_DOORWAY, PER_RULE_PASS } from './successive-fixture.js';
import { openPreviewJournal } from './journal.js';

// The launcher runs on the real clock against a fixed fixture expiry, so a due credential reminder or a
// failing doorway check (Rules 8, 56, 100) may ride an answer as its own line. The answer itself stays exact,
// and nothing else may be appended.
const NOTICE_LINE = /^(?:Reminder: the credential "[^"]+" \([^)]+\) expires in [^.]+\. Smallest step for you: .+|Model route check: .+; send "status" for detail\.)$/u;
const answerOf = (text: string) => {
  const [answer, ...notices] = text.split('\n\n');
  for (const notice of notices) expect(notice).toMatch(NOTICE_LINE);
  return answer;
};

it.each([['bounded', 0], ['oversized', 5000]])('polls status at the call cap and %s Jev response follows the byte bound', async (_name, padding) => {
  const world = successiveWorld(), root = join(world.directory, 'status-cap-journal');
  const activation = join(world.directory, 'activation.json'), profile = join(world.directory, 'profile.json');
  const log = join(world.directory, 'poll.log'), updates = join(world.directory, 'updates.json');
  const preload = join(world.directory, 'jev.mjs');
  writeFileSync(activation, JSON.stringify(world.activation()));
  writeFileSync(profile, JSON.stringify(offlineProfile));
  writeFileSync(updates, JSON.stringify([{ update_id: 1, message: { chat: {
    id: Number(world.configuration.chatId), type: 'private' },
    from: { id: Number(world.configuration.operatorSenderId) }, text: 'status' } }]));
  writeFileSync(preload, `globalThis.fetch = async () => new Response(JSON.stringify({
    model: 'jev-1.13.0', padding: 'x'.repeat(${padding}),
    answers: Object.fromEntries(['raw_path','cli_command','config_key','credential','api_endpoint',
      'quits_on_self','claims_blocked','parks_on_user','defers_work','unrecorded_blocker'].map(rule => [rule,{type:'noul',noul:0.01}])) }));\n`);
  let journal = openPreviewJournal(join(root, 'journal.encrypted'), OFFLINE_STORAGE_KEY, {
    kind: 'genesis', origin: 'test', bot: world.configuration.botId, chat: world.configuration.chatId,
    operator: world.configuration.operatorSenderId, grant: world.state().read().trial.id,
    configurationDigest: world.state().read().trial.configurationDigest,
    expires: world.state().read().trial.expiresAt, maxCalls: 16, maxReplies: 16,
    maxTurns: 20, maxBytes: 32768, cursor: 0 });
  for (let index = 0; index < 16; index++) journal.append({ kind: 'legacy-call', at: 1000 });
  journal.close();
  const endpoint = spawn(process.execPath, [join(process.cwd(), 'tests/preview/journal-poll-endpoint.mjs'), log, updates],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const port = await new Promise((resolve, reject) => {
      endpoint.stdout.once('data', data => resolve(Number(String(data).trim())));
      endpoint.once('error', reject);
      endpoint.once('exit', code => reject(Error(`endpoint exited before listening: ${String(code)}`)));
    });
    const env = { ...process.env,
      INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
      INSTAR_SECRET_PREVIEW_TYPESAFE_KEY: 'offline-placeholder',
      INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: `http://127.0.0.1:${port}` };
    const trial = world.state().read().trial;
    const run = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      '--import', preload, 'tests/preview/journal-agent.mjs', 'run', '--root', root,
      '--bot-id', world.configuration.botId, '--chat-id', world.configuration.chatId,
      '--operator-sender-id', world.configuration.operatorSenderId, '--grant-reference', trial.id,
      '--configuration-digest', trial.configurationDigest, '--expires-at', String(trial.expiresAt),
      '--tools', 'off', '--activation-record', activation, '--operator-records', join(world.directory, 'operator-records'), '--login-profile', profile, '--model', world.model,
      '--bot-username', world.configuration.botUsername, '--max-cycles', '2', '--max-poll-seconds', '1'],
      // The launch boots the runner and spawns one bounded transport child per Telegram call through the
      // resource owner's limit shim, so its wall time is process-start cost, not work. tests/preview/
      // journal-agent-resources.test.ts budgets the same launch shape (one cycle more) at 30s under a 45s
      // test; this one's 10s was the outlier and the gate's loaded full run crossed it after the run had
      // already printed its final paused notice. Every assertion below is unchanged.
      { cwd: process.cwd(), encoding: 'utf8', timeout: 30000, env });
    expect(run.status, run.stderr).toBe(0);
    expect(readFileSync(log, 'utf8')).toContain('getUpdates');
    journal = openPreviewJournal(join(root, 'journal.encrypted'), OFFLINE_STORAGE_KEY);
    expect(journal.view.order).toHaveLength(1);
    expect(journal.view.calls).toBe(16);
    if (padding === 0) {
      expect(journal.view.order[0]?.replyChecks?.[0]?.verdict).toBe('pass');
      expect(journal.view.replies).toBe(1);
    } else {
      // An oversized Jev response is unavailable and the cap refuses the review call; the
      // no-cost status reply is still sent with the unrun review recorded (Rules 77, 95).
      expect(journal.view.order[0]?.replyChecks?.[0]?.verdict).toBe('unavailable');
      expect(journal.view.order[0]?.held).toBeUndefined();
      expect(journal.view.order[0]?.release).toMatchObject({ review: 'unavailable', reason: 'review not run: call cap reached' });
      expect(journal.view.replies).toBe(1);
    }
    journal.close();
  } finally { endpoint.kill('SIGTERM'); }
}, 45000);

it.each(['SIGINT','SIGTERM','SIGHUP'])('pauses on %s during synchronous idle polls and resumes on launch', async signal => {
  const world = successiveWorld(), root = join(world.directory, 'idle-journal');
  const activation = join(world.directory, 'activation.json'), profile = join(world.directory, 'profile.json');
  const log = join(world.directory, 'poll.log');
  const updates = join(world.directory, 'updates.json');
  const provider = join(world.directory, 'provider.mjs'), loader = join(world.directory, 'loader.mjs');
  writeFileSync(activation, JSON.stringify(world.activation()));
  writeFileSync(profile, JSON.stringify(offlineProfile));
  writeFileSync(updates,'[]');
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
      '--tools', 'off', '--activation-record', activation, '--operator-records', join(world.directory, 'operator-records'),'--login-profile',profile,'--model',world.model,
      '--bot-username',world.configuration.botUsername,'--max-cycles','100000','--max-poll-seconds','1'];
    child = spawn(process.execPath,args,{cwd:process.cwd(),stdio:['ignore','pipe','pipe'],env:{...process.env,
      INSTAR_SECRET_PREVIEW_STORAGE_KEY:Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
      INSTAR_SECRET_PREVIEW_TYPESAFE_KEY:'',
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
        INSTAR_SECRET_PREVIEW_TYPESAFE_KEY:'',
        INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN:'12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT:`http://127.0.0.1:${port}`}});
    expect(resumed.status,resumed.stderr).toBe(0);
    expect(readFileSync(log,'utf8').split('getUpdates').length-1).toBeGreaterThan(pollsAtSignal);
    expect(readFileSync(log,'utf8').split('sendMessage').length-1).toBe(1);
    expect(JSON.parse(spawnSync(process.execPath,
      ['--no-warnings','--loader','./scripts/slice-ts-loader.mjs','tests/preview/journal-agent.mjs','status','--root',root],
      {cwd:process.cwd(),env:{...process.env,INSTAR_SECRET_PREVIEW_STORAGE_KEY:Buffer.from(OFFLINE_STORAGE_KEY).toString('hex')},
        encoding:'utf8',timeout:10000}).stdout)).toMatchObject({calls:2,replies:1,unknownCalls:1,
          unknownCallBreakdown:{answers:0,summaries:0,reviews:0,jev:1,total:1},
          replyChecks:{unavailable:1},unknownSends:0,
          // Rules 41/75: every live model call, including the failed Jev check, is recorded at the one boundary.
          modelCalls:{total:3,byJudgment:{answer:1,'reply-review':1,'jev-reply-check':1},byOutcome:{complete:2,failed:1},usageUnknown:1},
          // Rules 42/89: the one reply was accepted and signed as the agent's own speech.
          sendOutcomes:{accepted:1,refused:0,unknown:0,speakers:{agent:1,infrastructure:0}},
          // Rules 28/29/35: the one admitted turn was written by the verified operator over the test endpoint.
          intakeWriters:{verifiedOperator:1,scheduler:0,legacyExactBinding:0,testOrigin:1,refused:0},
          coherence:{checked:1,unchecked:0,failed:0,pendingCorrections:0,findings:[]}});
    const stop = spawnSync(process.execPath,
      ['--no-warnings','--loader','./scripts/slice-ts-loader.mjs','tests/preview/journal-agent.mjs','stop','--root',root],
      {cwd:process.cwd(),encoding:'utf8',timeout:10000});
    expect(stop.status).toBe(0);
    expect(JSON.parse(readFileSync(join(root,'preview-stop.json'),'utf8')).reason).toBe('operator');
    const refused = spawnSync(process.execPath,[...args.slice(0,-4),'--max-cycles','1','--max-poll-seconds','1'],
      {cwd:process.cwd(),encoding:'utf8',timeout:10000,env:{...process.env,
        INSTAR_SECRET_PREVIEW_STORAGE_KEY:Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
        INSTAR_SECRET_PREVIEW_TYPESAFE_KEY:'',
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
  writeFileSync(provider, `export { SUBSCRIPTION_CONVERSATION_FRAMING, SUBSCRIPTION_PREVIEW_EXPIRY, subscriptionConversationPolicy,
  validateSubscriptionActivation, SUBSCRIPTION_TOOLS_FRAMING, SUBSCRIPTION_TOOLS_SYSTEM_PROMPT,
  subscriptionToolsPolicy } from ${JSON.stringify(pathToFileURL(join(process.cwd(),'src/assembly/production-provider.ts')).href)};
${FIXTURE_DOORWAY}
${PER_RULE_PASS}
export const createClaudeCodeSubscriptionRoute = () => ({kind:'Success',value:{invoke:async prepared => {
  const envelope=JSON.parse(prepared), binding=JSON.parse(envelope.messages[1].content).bindings;
  const context=envelope.messages[1].content, asked=envelope.messages[0].content;
  const value=asked.startsWith('Judge this proposed reply')
    ? perRulePass(asked,'The reply stays within the rules.')
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
  const endpoint = spawn(process.execPath, [join(process.cwd(), 'tests/preview/journal-poll-endpoint.mjs'), log, updates, mode, 'long-poll'],
    {stdio:['ignore','pipe','pipe']});
  try {
    const port = await new Promise((done, fail) => {
      endpoint.stdout.once('data', data => done(Number(String(data).trim()))); endpoint.once('error', fail);
    });
    const trial = world.state().read().trial;
    const env = {...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY:Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
      INSTAR_SECRET_PREVIEW_TYPESAFE_KEY:'',
      INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN:'12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT:`http://127.0.0.1:${port}`};
    const run = spawnSync(process.execPath,['--no-warnings','--loader','./scripts/slice-ts-loader.mjs','--loader',loader,
      'tests/preview/journal-agent.mjs','run','--root',root,'--bot-id',world.configuration.botId,'--chat-id',world.configuration.chatId,
      '--operator-sender-id',world.configuration.operatorSenderId,'--grant-reference',trial.id,
      '--configuration-digest',trial.configurationDigest,'--expires-at',String(trial.expiresAt),
      '--tools', 'off', '--activation-record', activation, '--operator-records', join(world.directory, 'operator-records'),'--login-profile',profile,'--model',world.model,
      '--bot-username',world.configuration.botUsername,'--max-cycles','4','--max-poll-seconds','1'],
      {cwd:process.cwd(),encoding:'utf8',timeout:20000,env});
    expect(run.status,run.stderr).toBe(0);
    const sends = readFileSync(`${log}.sends`,'utf8').trim().split('\n').map(line => JSON.parse(line));
    expect(sends).toHaveLength(2);
    expect(sends[0].message_thread_id).toBeUndefined();
    expect(sends[1]).toMatchObject({chat_id:world.configuration.chatId,message_thread_id:7});
    expect(answerOf(sends[1].text)).toBe('PREVIEW — Your sister is Wren; you told me in the main chat.');
    expect(JSON.parse(spawnSync(process.execPath,
      ['--no-warnings','--loader','./scripts/slice-ts-loader.mjs','tests/preview/journal-agent.mjs','status','--root',root],
      {cwd:process.cwd(),env,encoding:'utf8',timeout:10000}).stdout)).toMatchObject({calls:4,replies:2,unknownCalls:2,unknownCallBreakdown:{ jev:2,total:2 },unknownSends:unknown,
        lastReplyTiming: { update: mode === 'echo' ? 2 : 1,
          intakeToApiAcceptedMs: expect.any(Number), checkMs: expect.any(Number) },
        coherence:{checked:2,unchecked:0,failed:0}});
  } finally { endpoint.kill('SIGTERM'); }
},30000);

it.each([
  ['wrapped', { 'answer/decision/tolerated/fenced': 1, 'reply-review/decision/tolerated/fenced': 1 }, null, {}],
  // int11's reply verdict is one line; CRLF fencing applies to the outer Decision.
  ['wrapped-crlf', { 'answer/decision/tolerated/fenced': 1, 'reply-review/decision/tolerated/fenced': 1 }, null, {}],
  // Each miss is re-asked once with a format reminder (Rule 116); this fake misses again, so each shape counts twice.
  ['verdict-contradicted', { 'reply-review/verdict/malformed/not-json': 2 },
    { role: 'reply-review', layer: 'verdict', shape: 'not-json' }, {}],
  ['decision-contradicted', { 'reply-review/decision/malformed/prose-wrapped': 2 },
    { role: 'reply-review', layer: 'decision', shape: 'prose-wrapped' }, {}],
  ['answer-two-objects', { 'answer/decision/malformed/multiple-objects': 2 },
    { role: 'answer', layer: 'decision', shape: 'multiple-objects' }, { malformed: 2 }],
  // The live 2026-10-01 k6 failure: the answer model wrote its reasoning before the Decision. The answer side
  // reads the one object and answers (Rules 15, 77); the shape is counted as tolerated, never hidden.
  ['answer-prose-wrapped', { 'answer/decision/tolerated/prose-wrapped': 1 }, null, {}],
  // Still ambiguous for the answer side too: a list could have held any number of objects, so it stays malformed.
  ['answer-list-wrapped', { 'answer/decision/malformed/prose-wrapped': 2 },
    { role: 'answer', layer: 'decision', shape: 'prose-wrapped' }, { malformed: 2 }],
  // Accepted as one object, then refused by the same field checks an unwrapped Decision passes.
  ['answer-prose-wrong-fields', { 'answer/decision/malformed/prose-wrapped-wrong-fields': 2 },
    { role: 'answer', layer: 'decision', shape: 'prose-wrapped-wrong-fields' }, { malformed: 2 }],
  ['verdict-second-line', { 'reply-review/verdict/malformed/not-json': 2 },
    { role: 'reply-review', layer: 'verdict', shape: 'not-json' }, {}],
])('the real launcher accepts a whole-response Decision fence, never passes contradicting review text, still answers, and says why (%s)', async (mode, counts, last, failures) => {
  const world = successiveWorld(), root = join(world.directory, 'shape-journal');
  const activation = join(world.directory, 'activation.json'), profile = join(world.directory, 'profile.json');
  const log = join(world.directory, 'poll.log'), updates = join(world.directory, 'updates.json');
  const provider = join(world.directory, 'provider.mjs'), loader = join(world.directory, 'loader.mjs');
  writeFileSync(activation, JSON.stringify(world.activation()));
  writeFileSync(profile, JSON.stringify(offlineProfile));
  const chat = Number(world.configuration.chatId), operator = Number(world.configuration.operatorSenderId);
  writeFileSync(updates, JSON.stringify([{update_id:1,message:{chat:{id:chat,type:'private'},from:{id:operator},text:'Remember this.'}}]));
  writeFileSync(provider, `export { SUBSCRIPTION_CONVERSATION_FRAMING, SUBSCRIPTION_PREVIEW_EXPIRY, subscriptionConversationPolicy,
  validateSubscriptionActivation, SUBSCRIPTION_TOOLS_FRAMING, SUBSCRIPTION_TOOLS_SYSTEM_PROMPT,
  subscriptionToolsPolicy } from ${JSON.stringify(pathToFileURL(join(process.cwd(),'src/assembly/production-provider.ts')).href)};
${FIXTURE_DOORWAY}
${PER_RULE_PASS}
const mode = ${JSON.stringify(mode)};
export const createClaudeCodeSubscriptionRoute = () => ({kind:'Success',value:{invoke:async prepared => {
  const envelope=JSON.parse(prepared), binding=JSON.parse(envelope.messages[1].content).bindings;
  const review=envelope.messages[0].content.startsWith('Judge this proposed reply');
  const verdict=review ? perRulePass(envelope.messages[0].content,'The reply stays within the rules.') : '';
  const newline=mode === 'wrapped-crlf' ? '\\r\\n' : '\\n';
  const value=!review ? 'Noted.'
    : mode === 'verdict-contradicted' ? 'VIOLATION: the proposed reply exposes a credential. Do not send it. '+verdict
    : mode === 'verdict-second-line' ? verdict+'\\nVIOLATION:credential | Do not send this reply.' : verdict;
  const decision=JSON.stringify({type:'Decision',schemaVersion:1,id:'shape-answer',at:binding.at,by:binding.by,
    conclusion:{subject:'preview-stage2-answer',predicate:'answer-text',value,evidence:binding.evidence},
    reason:{subject:'question',predicate:'answered',value:true,evidence:binding.evidence},
    floor:{allowed:binding.floor,chosen:binding.floor.default}});
  const prose='Looking at the history, there is one thing to check first. ';
  const bytes=mode === 'decision-contradicted' && review ? 'VIOLATION: this reply must not be sent. '+decision
    : mode === 'answer-prose-wrapped' && !review ? prose+decision
    : mode === 'answer-list-wrapped' && !review ? prose+'['+decision+']'
    : mode === 'answer-prose-wrong-fields' && !review ? prose+JSON.stringify({type:'Other',conclusion:{subject:'preview-stage2-answer',value}})
    : mode === 'wrapped' || mode === 'wrapped-crlf' ? (review ? '\\u0060\\u0060\\u0060'+newline+decision+newline+'\\u0060\\u0060\\u0060' : '\\u0060\\u0060\\u0060json'+newline+decision+newline+'\\u0060\\u0060\\u0060')
    : mode === 'answer-two-objects' && !review ? decision+'\\n'+decision : decision;
  return {state:'complete',bytes,usage:{inputTokens:1,outputTokens:1}};
}}});
`);
  writeFileSync(loader, `export async function resolve(specifier,context,next) {
  if (context.parentURL?.endsWith('/journal-agent.mjs') && specifier.endsWith('/production-provider.js'))
    return {url:${JSON.stringify(pathToFileURL(provider).href)},shortCircuit:true};
  return next(specifier,context);
}\n`);
  const endpoint = spawn(process.execPath, [join(process.cwd(), 'tests/preview/journal-poll-endpoint.mjs'), log, updates],
    {stdio:['ignore','pipe','pipe']});
  try {
    const port = await new Promise((done, fail) => {
      endpoint.stdout.once('data', data => done(Number(String(data).trim()))); endpoint.once('error', fail);
    });
    const trial = world.state().read().trial;
    const env = {...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY:Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
      INSTAR_SECRET_PREVIEW_TYPESAFE_KEY:'',
      INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN:'12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT:`http://127.0.0.1:${port}`};
    const run = spawnSync(process.execPath,['--no-warnings','--loader','./scripts/slice-ts-loader.mjs','--loader',loader,
      'tests/preview/journal-agent.mjs','run','--root',root,'--bot-id',world.configuration.botId,'--chat-id',world.configuration.chatId,
      '--operator-sender-id',world.configuration.operatorSenderId,'--grant-reference',trial.id,
      '--configuration-digest',trial.configurationDigest,'--expires-at',String(trial.expiresAt),
      '--tools', 'off', '--activation-record', activation, '--operator-records', join(world.directory, 'operator-records'),'--login-profile',profile,'--model',world.model,
      '--bot-username',world.configuration.botUsername,'--max-cycles','3','--max-poll-seconds','1'],
      {cwd:process.cwd(),encoding:'utf8',timeout:20000,env});
    expect(run.status,run.stderr).toBe(0);
    const sends = existsSync(`${log}.sends`) ? readFileSync(`${log}.sends`,'utf8').trim().split('\n').map(line => JSON.parse(line)) : [];
    // A contradicted review is unavailable, never a pass and never a veto (Rules 77, 86, 95).
    // An answer that stays malformed after its one re-ask is never sent; every other mode still answers.
    expect(sends.some(send => answerOf(send.text) === 'PREVIEW — Noted.')).toBe(
      !['answer-two-objects', 'answer-list-wrapped', 'answer-prose-wrong-fields'].includes(mode));
    const status = JSON.parse(spawnSync(process.execPath,
      ['--no-warnings','--loader','./scripts/slice-ts-loader.mjs','tests/preview/journal-agent.mjs','status','--root',root],
      {cwd:process.cwd(),env,encoding:'utf8',timeout:10000}).stdout);
    expect(status.modelJsonShapes).toEqual({ version: 1, counts, last: last && { ...last, at: expect.any(Number) } });
    expect(status.modelFailureClasses).toEqual(failures);
    expect(readFileSync(join(root, 'model-json-shapes.json'), 'utf8')).not.toMatch(/Noted|rules|Decision/u);
  } finally { endpoint.kill('SIGTERM'); }
},30000);

it('Rule 35: a test-endpoint composition refuses a production journal before taking its lease or writing a byte', () => {
  const world = successiveWorld(), root = join(world.directory, 'production-journal');
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, OFFLINE_STORAGE_KEY, { kind: 'genesis', bot: world.configuration.botId,
    chat: world.configuration.chatId, operator: world.configuration.operatorSenderId, grant: 'grant:production',
    configurationDigest: 'sha256:production', expires: 9999999999999, maxCalls: 4, maxReplies: 4, maxTurns: 4, maxBytes: 32768, cursor: 0 });
  journal.close();
  const before = readFileSync(path);
  const run = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
    'tests/preview/journal-agent.mjs', 'run', '--root', root], { cwd: process.cwd(), encoding: 'utf8', timeout: 10000,
    env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
      INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: 'http://127.0.0.1:9' } });
  expect(run.status).toBe(1);
  expect(readFileSync(path).equals(before)).toBe(true);
  expect(existsSync(join(root, '.writer'))).toBe(false);
  // Refused before the writer lease: no startup-refusal record is written into the production root either.
  expect(existsSync(join(root, 'runs.jsonl'))).toBe(false);
});

it('Rules 2, 42: a launch refused under the writer lease records its scrubbed reason and stderr stays terse', () => {
  const world = successiveWorld(), root = join(world.directory, 'refused-launch');
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), OFFLINE_STORAGE_KEY, { kind: 'genesis', origin: 'test',
    bot: '1001', chat: '2002', operator: '2002', grant: 'grant:refusal', configurationDigest: 'sha256:recorded',
    expires: 9999999999999, maxCalls: 4, maxReplies: 4, maxTurns: 4, maxBytes: 32768, cursor: 0 });
  journal.close();
  const env = { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
    INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: 'http://127.0.0.1:9', INSTAR_CONVERSATION_OWNERS: join(world.directory, 'owners') };
  const run = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
    'tests/preview/journal-agent.mjs', 'run', '--root', root, '--bot-id', '1001', '--chat-id', '2002',
    '--operator-sender-id', '2002', '--grant-reference', 'grant:refusal', '--configuration-digest', 'sha256:different',
    '--expires-at', '9999999999999', '--max-calls', '4', '--max-replies', '4', '--max-turns', '4'],
  { cwd: process.cwd(), encoding: 'utf8', timeout: 20000, env });
  expect(run.status).toBe(1);
  expect(run.stderr).toContain('details suppressed');
  expect(run.stderr).not.toContain('configuration-digest');
  const rows = readFileSync(join(root, 'runs.jsonl'), 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
  expect(rows).toHaveLength(2);
  expect(rows[1]).toEqual({ v: 1, launch: rows[0].launch, exit: expect.any(Number), reason: 'refused before launch',
    refused: 'preview: configuration-digest differs from journal' });
  // The lease is released after the record, so the next launch is not refused as a concurrent boot.
  expect(existsSync(join(root, '.writer', '.boot-lease'))).toBe(false);
  const status = JSON.parse(spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
    'tests/preview/journal-agent.mjs', 'status', '--root', root], { cwd: process.cwd(), env, encoding: 'utf8', timeout: 20000 }).stdout);
  expect(status.startupRefusals).toEqual({ count: 1, last: { at: rows[0].launch, reason: 'preview: configuration-digest differs from journal' } });
}, 30000);
