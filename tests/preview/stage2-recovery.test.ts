import { expect, it } from 'vitest';
import { stage2CompositionFixture } from './stage2-fixture.js';

it('reconstructs each durable response/reply phase without repeating either physical operation', async () => {
  const s = stage2CompositionFixture(); let c = await s.create();
  try {
    c.pollOnce();
    for (const phase of ['provider-prepared', 'response-preserved', 'answer-accepted', 'reply-opened', 'reply-admitted', 'reply-prepared']) {
      await c.resumeOne(); expect(c.sidecar.read().phase).toBe(phase);
      const original = c.sidecar.read();
      c.close(); c = await s.create();
      expect(c.sidecar.read()).toEqual(original);
    }
    await c.resume(); expect(c.sidecar.read().phase).toBe('api-accepted');
    c.close(); c = await s.create(); await c.resume();
    expect(s.models).toHaveLength(1);
    expect(s.calls.filter(row => row.method === 'sendMessage')).toHaveLength(1);
  } finally { c.close(); }
}, 120000);

import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import ts from 'typescript';

function crashWorker() {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'preview-s2-crash-evidence-')));
  const root = join(directory, 'root'); mkdirSync(root, { mode: 0o700 });
  const helper = readFileSync(join(process.cwd(), 'tests/preview/stage2-fixture.ts'), 'utf8');
  const source = helper.slice(helper.indexOf('export function stage2CompositionFixture'));
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  const worker = join(directory, 'worker.mjs');
  const imports = `import fs, {realpathSync,mkdtempSync,readFileSync,appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto'; import {tmpdir} from 'node:os'; import {join} from 'node:path';
import {syncBuiltinESMExports} from 'node:module';
import {productionStorageIO} from ${JSON.stringify(join(process.cwd(), 'scripts/production-boot-io.mjs'))};
import {stage2GuardedProviderPath} from ${JSON.stringify(join(process.cwd(), 'tests/preview/composition.ts'))};
import {HOST_OUTAGE_TEXT,openPreviewState} from ${JSON.stringify(join(process.cwd(), 'tests/preview/state.ts'))};
import {encoded as enc} from ${JSON.stringify(join(process.cwd(), 'tests/preview/stage2-provider.ts'))};
import {subscriptionInvocationPolicy,SUBSCRIPTION_PREVIEW_EXPIRY} from ${JSON.stringify(join(process.cwd(), 'src/assembly/production-provider.ts'))};
`;
  const driver = `
const root=process.argv[2], cut=process.argv[3], log=process.argv[4];
let pendingResolve;
const logEvent=e=>appendFileSync(log,JSON.stringify({event:e})+'\\n');
const checkpoint=phase=>{ if(phase===cut)process.exit(86); };
const f=stage2CompositionFixture({root, checkpoint, onModel:async()=>{logEvent('model');
  if(cut==='return-before-response')process.exit(86);
  if(cut==='pending-signal') { logEvent('pending'); await new Promise(resolve=>{const keepalive=setInterval(()=>{},1000);pendingResolve=()=>{clearInterval(keepalive);resolve();};}); }
}, onSend:()=>{logEvent('send');if(cut==='send-before-outcome')process.exit(86);}});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{f.state.latchStop('signal');pendingResolve?.();});
const rename=fs.renameSync;
fs.renameSync=function(from,to){rename(from,to);
 if(!String(to).endsWith('/.preview-stage2/facts.json'))return;
 const rows=JSON.parse(readFileSync(to,'utf8')), row=rows.at(-1), r=row.body.record;
 const side=JSON.parse(readFileSync(join(root,'preview-stage2-state.json'),'utf8'));
 const providerClaim=r?.type==='AdmissionReservation'&&r.state==='dispatch-claimed'&&side.phase==='provider-dispatch-unknown';
 const consumedReply=r?.type==='AdmissionReservation'&&r.state==='consumed'&&r.run===side.references.replyRun;
 if((cut==='provider-claimed'&&providerClaim)||(cut==='reply-consumed'&&consumedReply)
  ||(cut==='assessment-append-ambiguous'&&r?.type==='VerificationAssessment')

  ||(cut==='reply-outcome'&&r?.type==='OperationObservation'&&r.stage==='response'))process.exit(86);
};
const rmdir=fs.rmdirSync;
fs.rmdirSync=function(path,...rest){rmdir(path,...rest);
 if(!String(path).endsWith('/.preview-stage2/append.lock'))return;
 const rows=JSON.parse(readFileSync(join(root,'.preview-stage2/facts.json'),'utf8')),r=rows.at(-1).body.record;
 if((cut==='assessment'&&r?.type==='VerificationAssessment')
  ||(cut==='accounting'&&r?.type==='SettlementApplication')
  ||(cut==='acceptance'&&r?.type==='ProviderAnswerAcceptance'))process.exit(86);
};syncBuiltinESMExports();
const c=await f.create();try{if(!c.sidecar.read().selectedTurn)c.pollOnce();await c.resume();
 logEvent(c.sidecar.read().phase);}finally{c.close();}
`;
  writeFileSync(worker, imports + compiled + driver);
  const log = join(directory, 'events.jsonl');
  const events = () => { try { return readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line).event); } catch { return []; } };
  const run = (cut: string, signal?: NodeJS.Signals) => new Promise<number | null>((resolve, reject) => {
    const env = { ...process.env }; delete env.INSTAR_TELEGRAM_LIVE_TEST;
    const child = spawn(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', worker, root, cut, log],
      { cwd: process.cwd(), env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = ''; child.stderr.on('data', data => { stderr += data; });
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(Error(`offline worker timeout; retained at ${directory}`)); }, 90000);
    let sent = false;
    const interval = signal ? setInterval(() => { if (!sent && events().includes('pending')) { sent = true; child.kill(signal); } }, 25) : undefined;
    child.on('error', reject); child.on('exit', code => {
      clearTimeout(timer); clearInterval(interval);
      if (code !== 0 && code !== 86) reject(Error(`offline worker ${code}: ${stderr}`)); else resolve(code);
    });
  });
  return { root, directory, events, run, sidecar: () => JSON.parse(readFileSync(join(root, 'preview-stage2-state.json'), 'utf8')) };
}

for (const cut of ['provider-prepared', 'provider-dispatch-unknown', 'provider-claimed', 'return-before-response',
  'response-preserved', 'assessment-append-ambiguous', 'assessment', 'accounting', 'acceptance', 'reply-opened', 'reply-admitted',
  'reply-prepared', 'reply-consumed', 'send-before-outcome', 'reply-outcome']) {
  it(`fresh process crash at ${cut} never repeats a model or send`, async () => {
    const worker = crashWorker(); expect(await worker.run(cut)).toBe(86);
    const before = worker.sidecar();
    expect(await worker.run('resume')).toBe(0);
    const held = ['provider-dispatch-unknown', 'provider-claimed', 'return-before-response', 'assessment-append-ambiguous', 'reply-consumed', 'send-before-outcome'].includes(cut);
    expect(worker.sidecar().phase).toBe(held ? 'held' : 'api-accepted');
    expect(worker.sidecar().ownerStart).toBe(before.ownerStart);
    expect(worker.sidecar().ownerDeadline).toBe(before.ownerDeadline);
    const facts = JSON.parse(readFileSync(join(worker.root, '.preview-stage2/facts.json'), 'utf8'));
    expect(facts.some((row: any) => row.kind === 'judgment-provider-ProviderJudgmentResolution')).toBe(false);
    for (const row of facts.filter((row: any) => row.kind === 'transport-SettlementApplication'))
      expect(row.body.record).toMatchObject({ actualCharge: -1, unresolved: 1, released: 0, retryEligible: 0, exposure: 0 });
    expect(worker.events().filter(e => e === 'model').length).toBeLessThanOrEqual(1);
    expect(worker.events().filter(e => e === 'send').length).toBeLessThanOrEqual(1);
    expect(await worker.run('resume')).toBe(0);
    expect(worker.events().filter(e => e === 'model').length).toBeLessThanOrEqual(1);
    expect(worker.events().filter(e => e === 'send').length).toBeLessThanOrEqual(1);
    // Deliberately retain all roots, failed cuts and logs as crash evidence.
  }, 120000);
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) it(`handles ${signal} while the model is pending and suppresses reply`, async () => {
  const worker = crashWorker(); expect(await worker.run('pending-signal', signal)).toBe(0);
  expect(worker.sidecar()).toMatchObject({ phase: 'held', modelAttemptUsed: 1 });
  expect(worker.events().filter(e => e === 'model')).toHaveLength(1);
  expect(worker.events().filter(e => e === 'send')).toHaveLength(0);
}, 120000);

import { renameSync } from 'node:fs';
import { cutoverPreviewRoot, openPreviewState, openStage2State } from './state.js';
import { createPreviewComposition } from './composition.js';
it('holds ambiguous burned slot forever and refuses missing/corrupt sidecar or changed configuration', async () => {
  const s = stage2CompositionFixture(); let c = await s.create();
  c.pollOnce(); await c.resumeOne();
  c.sidecar.update({ phase: 'provider-dispatch-unknown', modelAttemptUsed: 1 });
  c.close(); c = await s.create(); await c.resume();
  expect(c.sidecar.read().phase).toBe('held'); expect(s.models).toHaveLength(0); c.close();
  const file = join(s.root, 'preview-stage2-state.json'); renameSync(file, file + '.retained');
  await expect(s.create()).rejects.toThrow('sidecar missing');
  writeFileSync(file, '{'); await expect(s.create()).rejects.toThrow();
  writeFileSync(file, readFileSync(file + '.retained'));
  s.activation.invocationPolicyDigest = `sha256:${'0'.repeat(64)}`;
  await expect(s.create()).rejects.toThrow();
}, 60000);

it('refuses a competing root owner and stage1 after stage2 arm', async () => {
  const s = stage2CompositionFixture(); const c = await s.create();
  try {
    await expect(s.create()).rejects.toThrow();
    expect(() => createPreviewComposition({ configuration: s.configuration, state: s.state } as any)).toThrow('sidecar excludes stage1');
  } finally { c.close(); }
});

for (const event of ['stop', 'expiry', 'deadline', 'revoked'] as const) it(`holds ${event} during pending provider work without send or second model`, async () => {
  let s: ReturnType<typeof stage2CompositionFixture>;
  s = stage2CompositionFixture({ onModel: () => {
    if (event === 'stop') s.state.latchStop('operator');
    else if (event === 'expiry') s.time(s.state.read().trial.expiresAt);
    else if (event === 'deadline') s.time(s.now() + 300000);
    else s.revoke();
  } });
  const c = await s.create();
  try {
    c.pollOnce(); await c.resume(); expect(c.sidecar.read().phase).toBe('held');
    expect(c.sidecar.read().modelAttemptUsed).toBe(1); await c.resume();
    expect(s.models).toHaveLength(1); expect(s.calls.filter(row => row.method === 'sendMessage')).toHaveLength(0);
  } finally { c.close(); }
}, 60000);

it('cuts over a stopped predecessor with unchanged counters, cursor, exclusions and expiry', () => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'preview-s2-cutover-evidence-')));
  const predecessorRoot = join(directory, 'old'), root = join(directory, 'new'), now = 1790000000000;
  const configuration = { root: predecessorRoot, limit: 8 }, nextConfiguration = { ...configuration, root };
  const options = { root: predecessorRoot, configuration, expiresAt: 1790628000000, now: () => now,
    replyLimit: 6, replyWindowMs: 60000, errorLimit: 5, totalErrorLimit: 1000, maxPendingTurns: 16, maxTrialTurns: 128 };
  const old = openPreviewState(options);
  old.recordIntake({ id: 'telegram:8820318295:update:82', updateId: 82,
    route: { channel: 'private', sender: 'operator', identityEpoch: 'trial', eventId: '82' },
    receipt: 'prior-receipt', preserved: 'prior-capture', disposition: 'admitted-bound' });
  old.advance('telegram:8820318295:update:82', 'intake-preserved', 'grounded');
  old.advance('telegram:8820318295:update:82', 'grounded', 'dispatch-outcome-unknown');
  old.advanceCursor(83); old.reserveReply(); old.noteError(); old.latchStop('operator');
  const prior = old.read(), sourceBytes = readFileSync(old.path, 'utf8');
  const inherited = cutoverPreviewRoot({ predecessorRoot, root, predecessorConfiguration: configuration,
    configuration: nextConfiguration, cutoff: now, now: () => now, quiescenceReference: 'desk:poller-quiesced' });
  const next = openPreviewState({ ...options, root, configuration: nextConfiguration, create: false });
  expect(next.read()).toEqual(inherited);
  expect(inherited.trial.id).toBe(prior.trial.id); expect(inherited.trial.expiresAt).toBe(prior.trial.expiresAt);
  expect(inherited.cursor).toEqual(prior.cursor); expect(inherited.replyWindow).toEqual(prior.replyWindow);
  expect(inherited.turns).toEqual(prior.turns);
  expect(JSON.parse(readFileSync(join(root, 'preview-predecessor.json'), 'utf8')).excludedTurns).toEqual(Object.keys(prior.turns));
  expect(inherited.totalErrors).toBe(prior.totalErrors); expect(inherited.stop).toBeNull();
  expect(old.read().stop).not.toBeNull(); expect(readFileSync(old.path, 'utf8')).toBe(sourceBytes);
  expect(JSON.parse(readFileSync(join(root, 'preview-predecessor.json'), 'utf8')).quiescenceReference).toBe('desk:poller-quiesced');
  expect(() => cutoverPreviewRoot({ predecessorRoot, root: join(directory, 'enlarged'),
    predecessorConfiguration: configuration, configuration: { root: join(directory, 'enlarged'), limit: 9 },
    cutoff: now, now: () => now, quiescenceReference: 'desk:poller-quiesced' })).toThrow('inherit trial bounds');
  mkdirSync(join(predecessorRoot, '.preview-stage2'));
  expect(() => cutoverPreviewRoot({ predecessorRoot, root: join(directory, 'rearm'),
    predecessorConfiguration: configuration, configuration: { ...configuration, root: join(directory, 'rearm') },
    cutoff: now, now: () => now, quiescenceReference: 'desk:poller-quiesced' })).toThrow('predecessor cutover refused');
});

import { chmodSync, existsSync as requireExists } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { SUBSCRIPTION_PREVIEW_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import { encoded, subscriptionInvocationPolicy } from './stage2-provider.js';
// @ts-expect-error Physical host; inspection only, no installed CLI is executed.
import { createSubscriptionProviderIO } from '../../scripts/production-boot-io.mjs';

const launcherClockSource = (epoch: number) => `const epoch=${epoch}, elapsedStart=performance.now();Date.now=()=>epoch+Math.floor(performance.now()-elapsedStart);`;

for (const signal of [null, 'SIGINT', 'SIGTERM'] as const) it(`actual async launcher ${signal ?? 'accepts one answer'} with a spawned synthetic CLI`, () => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'preview-s2-launch-evidence-'))), root = join(directory, 'root');
  const home = join(directory, 'home'), configDirectory = join(directory, 'config'), workingDirectory = join(directory, 'work');
  for (const path of [root, home, configDirectory, workingDirectory]) mkdirSync(path, { mode: 0o700 });
  const elapsedStart = performance.now(), epoch = 1790000000000;
  const clock = () => epoch + Math.floor(performance.now() - elapsedStart);
  const now = clock(), cutoff = now - 1000, expiresAt = 1790628000000;
  const configuration = { root, machine: 'preview-local-machine', botId: '8820318295', botUsername: '@echo_mmtest_seam_b27x_bot',
    operatorSenderId: '7812716706', chatId: '7812716706', chatKind: 'private', forum: false, messageThreadId: null,
    maxPollSeconds: 1, maxBatchItems: 1, maxContextTurns: 8, maxContextBytes: 65536 };
  const limits = { expiresAt, replyLimit: 6, replyWindowMs: 60000, errorLimit: 5, maxPendingTurns: 16, maxTrialTurns: 128 };
  const state = openPreviewState({ root, configuration: { ...configuration, ...limits }, ...limits, totalErrorLimit: 1000, now: clock });
  const executable = join(directory, 'synthetic-cli.mjs'), log = join(directory, 'models.jsonl');
  const auth = { loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty', analyticsDisabled: true,
    projectsDirectory: configDirectory + '/projects', configDirectory, email: 'offline@example.invalid', orgId: 'offline-org',
    orgName: 'Offline', subscriptionType: 'max' };
  const source = `#!${process.execPath}
import {appendFileSync} from 'node:fs';
let stdin='';for await(const bytes of process.stdin)stdin+=bytes;
if(process.argv[2]==='--version')process.stdout.write('2.1.280 (Claude Code)');
else if(process.argv[2]==='auth')process.stdout.write(${JSON.stringify(JSON.stringify(auth))});
else {appendFileSync(${JSON.stringify(log)},JSON.stringify({args:process.argv.slice(2),stdin,env:process.env})+String.fromCharCode(10));
 const signal=${JSON.stringify(signal)};
 if(signal){process.kill(process.ppid,signal);setInterval(()=>{},1000);}
 else {const request=JSON.parse(stdin), context=JSON.parse(request.messages[1].content), binding=context.bindings;
 if(JSON.stringify(process.argv.slice(2))!==${JSON.stringify(JSON.stringify(subscriptionInvocationPolicy('claude-offline-exact-1').args))}
 || Object.keys(context).sort().join(',')!=='bindings,conversation,conversationKind'
 || context.conversationKind!=='captured-telegram-updates' || context.conversation.length!==1
 || context.conversation[0].message.text!==request.messages[0].content
 || JSON.stringify(binding.floor)!==JSON.stringify(request.floor) || JSON.stringify(binding.evidence)!==JSON.stringify(request.evidence)
 || binding.by.model!==request.model || binding.by.route!==request.route || binding.by.judgment!==request.point)process.exit(42);
 const decision={type:'Decision',schemaVersion:1,id:'spawned-answer',at:binding.at,by:binding.by,
 conclusion:{subject:'preview-stage2-answer',predicate:'answer-text',value:'A spawned answer 世界 <>& &lt;',evidence:binding.evidence},
 reason:{subject:'question',predicate:'answered',value:true,evidence:binding.evidence},floor:{allowed:binding.floor,chosen:binding.floor.default}};
 const raw=JSON.stringify({type:'result',subtype:'success',is_error:false,result:JSON.stringify(decision),
 session_id:'offline-call',usage:{input_tokens:1,output_tokens:20},total_cost_usd:1.25});
 appendFileSync(${JSON.stringify(log + '.raw')},raw);process.stdout.write(raw);}}
`;
  writeFileSync(executable, source); chmodSync(executable, 0o700);
  const seed = { type: 'ProviderSubscriptionProfile', schemaVersion: 1, reference: 'offline-login', home, configDirectory, workingDirectory,
    expectedAccount: auth.email, organization: auth.orgId, plan: 'max', executable,
    artifact: `sha256:${createHash('sha256').update(source).digest('hex')}`, version: '2.1.280', activationReference: 'offline-activation' };
  const profile = { ...seed, ...createSubscriptionProviderIO({ repository: process.cwd(), stopped: () => false }).inspectSubscriptionProfile(seed) };
  const model = 'claude-offline-exact-1', activation = { type: 'SubscriptionActivationRecord', schemaVersion: 1,
    reference: 'offline-activation', waiver: 'offline-waiver', p11: 'offline-p11', reviewedHead: 'offline-head', trial: state.read().trial.id,
    baseConfigurationDigest: state.read().trial.configurationDigest, profileDigest: encoded(profile).hash,
    executable, artifact: profile.artifact, version: profile.version, model, invocationPolicyDigest: encoded(subscriptionInvocationPolicy(model)).hash,
    expectedAccount: auth.email, observedAccount: auth.email, authSource: 'claude.ai', operatorAssertion: 'offline-assertion', assertedAt: now - 2,
    observer: 'offline-desk', observedAt: now - 1, method: 'offline', safeCaptureReference: 'offline-capture',
    extraUsage: 'operator-asserted/unobservable', extraUsageReason: 'Offline assertion only', subscriptionLimit: 'unobservable',
    subscriptionLimitReason: 'Offline only', acceptedResiduals: ['UNKNOWN charge/quiescence', 'unconfined preview'], expiresAt };
  const activationPath = join(directory, 'activation.json'), profilePath = join(directory, 'profile.json');
  writeFileSync(activationPath, JSON.stringify(activation)); writeFileSync(profilePath, JSON.stringify(profile));
  const preload = join(directory, 'telegram-preload.mjs'), report = join(directory, 'telegram.json');
  writeFileSync(preload, `import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';import {writeFileSync} from 'node:fs';
${launcherClockSource(epoch)}
const calls=[];let polled=false;
cp.spawnSync=(exe,args)=>{const q=JSON.parse(Buffer.from(args[1],'base64url').toString('utf8'));calls.push(q);let result;
if(q.method==='getMe')result={id:8820318295,is_bot:true,username:'echo_mmtest_seam_b27x_bot',first_name:'Offline'};
else if(q.method==='getUpdates'){result=polled?[]:[{update_id:1,message:{message_id:1001,from:{id:7812716706,is_bot:false,first_name:'Offline'},chat:{id:7812716706,type:'private'},date:Math.floor(Date.now()/1000),text:'Give a brief answer.'}}];polled=true;}
else result={message_id:2001,chat:{id:7812716706,type:'private'},text:q.body.text.replace(/&lt;/gu,'<').replace(/&gt;/gu,'>').replace(/&amp;/gu,'&')};
return{status:0,stdout:JSON.stringify({kind:'response',status:200,bytes:JSON.stringify({ok:true,result})})};};syncBuiltinESMExports();
process.on('exit',()=>writeFileSync(${JSON.stringify(report)},JSON.stringify(calls)));
`);
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_OPTIONS: `--import=${preload}`,
    INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '8820318295:synthetic_recorded_test_only_value', INSTAR_SECRET_PREVIEW_STORAGE_KEY: '13'.repeat(32) };
  delete env.INSTAR_TELEGRAM_LIVE_TEST;
  const args = ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/agent.mjs', 'run',
    '--stage', '2', '--root', root, '--bot-id', configuration.botId, '--bot-username', configuration.botUsername,
    '--operator-sender-id', configuration.operatorSenderId, '--chat-id', configuration.chatId, '--chat-kind', 'private', '--forum', 'false',
    '--message-thread-id', 'none', '--expires-at', String(expiresAt), '--max-cycles', '3', '--max-poll-seconds', '1', '--max-batch-items', '1',
    '--activation-record', activationPath, '--login-profile', profilePath, '--model', model, '--activation-cutoff', String(cutoff), '--arm', 'true'];
  const result = spawnSync(process.execPath, args, { cwd: process.cwd(), env, encoding: 'utf8', timeout: 90000 });
  expect(result.status, result.stderr + ` retained ${directory}`).toBe(0);
  expect(requireExists(log), result.stderr).toBe(true);
  expect(readFileSync(log, 'utf8').trim().split('\n')).toHaveLength(1);
  const sidecar = JSON.parse(readFileSync(join(root, 'preview-stage2-state.json'), 'utf8'));
  expect(sidecar, result.stderr).toMatchObject({ modelAttemptUsed: 1, terminalLatch: true, phase: signal ? 'held' : 'api-accepted' });
  const calls = JSON.parse(readFileSync(report, 'utf8'));
  expect(calls.filter((row: any) => row.method === 'sendMessage')).toHaveLength(signal ? 0 : 1);
  if (signal) expect(state.read().stop?.reason).toBe('signal');
  else {
    expect(calls.find((row: any) => row.method === 'sendMessage').body.text).toContain('A spawned answer 世界 &lt;&gt;&amp; &amp;lt;');
    const spawned=JSON.parse(readFileSync(log,'utf8').trim());
    expect(spawned.args).toEqual(subscriptionInvocationPolicy(model).args);
    expect(Object.keys(spawned.env).filter(key=>key!=='__CF_USER_TEXT_ENCODING').sort()).toEqual(
      ['PATH','HOME','CLAUDE_CONFIG_DIR','CLAUDE_CODE_MAX_RETRIES','CLAUDE_CODE_MAX_OUTPUT_TOKENS','CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC'].sort());
    const facts=JSON.parse(readFileSync(join(root,'.preview-stage2/facts.json'),'utf8'));
    const q=facts.find((f:any)=>f.kind==='judgment-provider-ProviderJudgmentRequest').body.record;
    expect(readFileSync(join(root,'.preview-stage2/captures',q.submitted.hash.slice(7)),'utf8')).toBe(spawned.stdin);
    const response=facts.find((f:any)=>f.kind==='judgment-provider-ProviderJudgmentAttemptRecord'&&f.body.record.phase==='response-observed').body.record;
    const receipt=JSON.parse(readFileSync(join(root,'.preview-stage2/captures',response.receipt.hash.slice(7)),'utf8'));
    expect(Buffer.from(readFileSync(join(root,'.preview-stage2/captures',receipt.responseEvidence.terminal.raw.hash.slice(7)),'utf8'),'base64'))
      .toEqual(readFileSync(log+'.raw'));
    for(const kind of ['verification-VerificationAssessment','judgment-provider-ProviderAnswerAcceptance','transport-RunPairAdmission','effect-EffectRequest'])
      expect(facts.some((f:any)=>f.kind===kind)).toBe(true);
    expect(facts.find((f:any)=>f.kind==='transport-SettlementApplication').body.record).toMatchObject({unresolved:1,actualCharge:-1,retryEligible:0,exposure:0});
    const source=facts.find((f:any)=>f.body.evidence?.claim.predicate==='provider-response-source-contract').body.evidence.claim.value;
    expect(Object.keys(source).sort()).toEqual(['version','parserReference','parserVersion','endpoint','account','credentialReference','controller','executableArtifact','provider','model','route'].sort());
    const bindingFact=facts.find((f:any)=>f.body.evidence?.claim.predicate==='preview-invocation-binding');
    const binding=bindingFact.body.evidence;
    expect(binding.id).toBe(`proof:preview-invocation-binding:${q.id}`);
    expect(binding.claim.subject).toBe(q.id);
    expect(readFileSync(join(root,'.preview-stage2/captures',binding.capture.hash.slice(7)),'utf8')).toBe(encoded(binding.claim.value).bytes);
    expect(receipt.responseEvidence.source.evidence).not.toContain(binding.id);
    expect(binding.claim.value).toMatchObject({framing:'preview-decision-system-v2',invocationPolicyDigest:encoded(subscriptionInvocationPolicy(model)).hash,
      systemPromptDigest:'sha256:'+createHash('sha256').update(SUBSCRIPTION_PREVIEW_SYSTEM_PROMPT).digest('hex')});
    state.latchStop('operator');
    const before = retainedFiles(root);
    const statusEnv = { ...env }; delete statusEnv.NODE_OPTIONS;
    const statusArgs = [...args]; statusArgs[statusArgs.indexOf('run')] = 'status';
    const status = () => spawnSync(process.execPath, statusArgs, { cwd: process.cwd(), env: statusEnv, encoding: 'utf8', timeout: 30000 });
    const recorded = status();
    expect(recorded.status, recorded.stderr).toBe(0);
    expect(JSON.parse(recorded.stdout).stage2.phase).toBe('api-accepted');
    const restarted = spawnSync(process.execPath, args, { cwd: process.cwd(), env: statusEnv, encoding: 'utf8', timeout: 30000 });
    expect(restarted.status, restarted.stderr).toBe(0);
    expect(retainedFiles(root)).toEqual(before);
    const path = join(root, 'preview-stage2-state.json'), original = readFileSync(path, 'utf8');
    writeFileSync(path, JSON.stringify({ ...sidecar, references: {} }));
    expect(status().status).not.toBe(0); writeFileSync(path, original);
    expect(readFileSync(log, 'utf8').trim().split('\n')).toHaveLength(1);
    expect(JSON.parse(readFileSync(report, 'utf8')).filter((row: any) => row.method === 'sendMessage')).toHaveLength(1);
  }
}, 120000);

it('holds a sidecar that names an absent signed owner fact before model launch', async () => {
  const s = stage2CompositionFixture(); let c = await s.create();
  c.pollOnce(); await c.resumeOne(); c.close();
  const path = join(s.root, 'preview-stage2-state.json'), document = JSON.parse(readFileSync(path, 'utf8'));
  document.references.preparedFact = 'absent-owner-fact'; writeFileSync(path, JSON.stringify(document));
  c = await s.create();
  try { await c.resume(); expect(c.sidecar.read().phase).toBe('held');
    expect(s.models).toHaveLength(0); expect(s.calls.filter(row => row.method === 'sendMessage')).toHaveLength(0);
  } finally { c.close(); }
}, 60000);

import { stage2HistoricalStatus } from './stage2-owners.js';
import { readdirSync, statSync } from 'node:fs';
const retainedFiles = (root: string): unknown => Object.fromEntries(readdirSync(root).sort().map(name => {
  const path = join(root, name), stat = statSync(path);
  return [name, stat.isDirectory() ? retainedFiles(path) : [stat.mtimeMs, createHash('sha256').update(readFileSync(path)).digest('hex')]];
}));

it('refuses an unsupported terminal success without owner facts', async () => {
  const s = stage2CompositionFixture(), c = await s.create(); c.close();
  const path = join(s.root, 'preview-stage2-state.json'), d = JSON.parse(readFileSync(path, 'utf8'));
  writeFileSync(path, JSON.stringify({ ...d, phase: 'api-accepted', terminalLatch: true }));
  expect(() => openStage2State({ root: s.root, state: s.state, activationDigest: d.activationDigest,
    policyDigest: d.policyDigest, cutoff: d.cutoff, ownerFactsExist: () => false })).toThrow('corrupt stage2');
  await expect(s.create()).rejects.toThrow('corrupt stage2');
  expect(() => stage2HistoricalStatus(s.root, s.state.read(), s.configuration)).toThrow('corrupt stage2');
  expect(s.models).toHaveLength(0); expect(s.calls).toHaveLength(1); // initial getMe only
});

it('historically validates terminal Unicode HTML and literal entities after expiry with zero effects and refuses corrupt owner joins/captures', async () => {
  const s = stage2CompositionFixture({ answer: '世界 <>& &lt; �' }); let c = await s.create();
  c.pollOnce(); await c.resume();
  expect(c.sidecar.read().phase).toBe('api-accepted'); c.close();
  const path = join(s.root, 'preview-stage2-state.json'), original = readFileSync(path, 'utf8'), d = JSON.parse(original);
  const factsPath = join(s.root, '.preview-stage2/facts.json'), factsBytes = readFileSync(factsPath, 'utf8'), facts = JSON.parse(factsBytes);
  s.state.latchStop('operator'); s.time(4102444800000); s.revoke();
  const before = retainedFiles(s.root), calls = s.calls.length;
  c = await s.create(); await c.resume(); await c.resumeOne(); expect(c.pollOnce()).toBeNull();
  expect(c.sidecar.read().phase).toBe('api-accepted'); c.close();
  expect(stage2HistoricalStatus(s.root, s.state.read(), s.configuration).phase).toBe('api-accepted');
  expect(retainedFiles(s.root)).toEqual(before); expect(s.calls).toHaveLength(calls); expect(s.models).toHaveLength(1);
  const refuses = async () => {
    expect(() => stage2HistoricalStatus(s.root, s.state.read(), s.configuration)).toThrow();
    await expect(s.create()).rejects.toThrow();
    expect(s.calls).toHaveLength(calls); expect(s.models).toHaveLength(1);
  };
  for (const change of [{ selectedTurn: null }, { modelAttemptUsed: 0 }, { ownerStart: d.ownerStart + 1 },
    { ownerStart: d.ownerStart + 1, absoluteStart: d.ownerStart + 1, ownerDeadline: d.ownerDeadline + 1 }, { references: {} }]) {
    writeFileSync(path, JSON.stringify({ ...d, ...change })); await refuses(); writeFileSync(path, original);
  }
  for (const role of Object.keys(d.references)) {
    // An existing, correctly signed fact of the wrong role must not pass existence-only checking.
    writeFileSync(path, JSON.stringify({ ...d, references: { ...d.references, [role]: facts[0].id } }));
    await refuses(); writeFileSync(path, original);
  }
  const response = facts.find((f: any) => f.id === d.references.replyObservationFact);
  const responseCapture = join(s.root, '.preview-stage2/captures', response.body.record.capture.hash.slice(7));
  const responseBytes = readFileSync(responseCapture, 'utf8');
  expect(JSON.parse(responseBytes).result.text).toContain('世界 <>& &lt;');
  renameSync(responseCapture, responseCapture + '.retained'); await refuses(); renameSync(responseCapture + '.retained', responseCapture);
  const altered = JSON.parse(responseBytes); altered.result.text += '!';
  writeFileSync(responseCapture, JSON.stringify(altered)); await refuses(); writeFileSync(responseCapture, responseBytes);
  // Replacement decoding must not hide changed raw bytes when display text
  // legitimately contains U+FFFD: invalid FF would otherwise decode identically.
  const raw = Buffer.from(responseBytes), replacement = raw.indexOf(Buffer.from('�'));
  expect(replacement).toBeGreaterThanOrEqual(0);
  writeFileSync(responseCapture, Buffer.concat([raw.subarray(0, replacement), Buffer.from([255]), raw.subarray(replacement + 3)]));
  await refuses(); writeFileSync(responseCapture, responseBytes);
  writeFileSync(factsPath, JSON.stringify(facts.filter((f: any) => f.id !== response.id))); await refuses(); writeFileSync(factsPath, factsBytes);
  const acceptance = facts.find((f: any) => f.id === d.references.acceptanceFact);
  const answerCapture = join(s.root, '.preview-stage2/captures', acceptance.body.record.capture.hash.slice(7));
  renameSync(answerCapture, answerCapture + '.retained'); await refuses(); renameSync(answerCapture + '.retained', answerCapture);
  expect(stage2HistoricalStatus(s.root, s.state.read(), s.configuration).phase).toBe('api-accepted');
  // A crash after the retained response can reconcile bookkeeping even after
  // expiry/stop, without constructing active owners or changing their journal.
  const { replyObservationFact: _observation, ...references } = d.references;
  writeFileSync(path, JSON.stringify({ ...d, phase: 'reply-dispatch-unknown', terminalLatch: false, references }));
  s.state.advance(d.selectedTurn, 'api-accepted', 'dispatch-outcome-unknown', { replyObservation: '' });
  const ownerFiles = retainedFiles(join(s.root, '.preview-stage2'));
  c = await s.create(); await c.resume(); expect(c.sidecar.read().phase).toBe('api-accepted'); c.close();
  expect(retainedFiles(join(s.root, '.preview-stage2'))).toEqual(ownerFiles);
  expect(s.calls).toHaveLength(calls); expect(s.models).toHaveLength(1);
}, 120000);

it('holds genuinely changed Telegram display text and never sends again on recovery', async () => {
  const s = stage2CompositionFixture({ answer: '世界 <>& &lt;', displayText: 'changed display text' }); let c = await s.create();
  c.pollOnce(); await c.resume(); expect(c.sidecar.read().phase).toBe('held'); c.close();
  c = await s.create(); await c.resume(); c.close();
  expect(s.models).toHaveLength(1); expect(s.calls.filter(row => row.method === 'sendMessage')).toHaveLength(1);
}, 60000);

it('refuses an existing signed fact in the wrong nonterminal sidecar role before launching', async () => {
  const s = stage2CompositionFixture(); let c = await s.create(); c.pollOnce(); await c.resumeOne(); c.close();
  const path = join(s.root, 'preview-stage2-state.json'), d = JSON.parse(readFileSync(path, 'utf8'));
  d.references.preparedFact = d.references.requestFact; writeFileSync(path, JSON.stringify(d));
  c = await s.create(); await c.resume(); expect(c.sidecar.read().phase).toBe('held'); c.close();
  expect(s.models).toHaveLength(0); expect(s.calls.filter(row => row.method === 'sendMessage')).toHaveLength(0);
});


it('replays the synthetic launcher preload clock independently of the runner calendar with real elapsed timers', () => {
  for (const calendar of [0, 4102444800000]) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e',
      `Date.now=()=>${calendar};${launcherClockSource(1790000000000)}
       const start=Date.now();await new Promise(resolve=>setTimeout(resolve,25));
       process.stdout.write(JSON.stringify({start,end:Date.now()}));`], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    const reading = JSON.parse(result.stdout);
    expect(reading.start).toBeGreaterThanOrEqual(1790000000000);
    expect(reading.end).toBeGreaterThan(reading.start);
    expect(reading.end + 300000).toBeLessThan(1790628000000);
  }
});

import { cpSync, rmSync } from 'node:fs';
import { cutoverRefusedStage2Root, validateStage2Successor } from './state.js';
import { validateRefusedStage2Predecessor } from './stage2-owners.js';
const refusalFixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/preview/fixtures/stage2-first-live-refusal.json'), 'utf8'));
const retainedProseTerminal = () => Buffer.from(refusalFixture.rawBase64, 'base64').toString('utf8');

async function refusedSuccessorFixture(options: any = {}) {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), 'preview-s2-successor-evidence-')));
  const source = join(parent, 'attempt-1'), target = join(parent, 'attempt-2');
  mkdirSync(source); mkdirSync(target);
  const s = stage2CompositionFixture({ root: source, terminal: retainedProseTerminal(), ...options });
  const c = await s.create(); c.pollOnce(); await c.resume(); const sidecar = c.sidecar.read(); c.close();
  s.state.latchStop('operator');
  const now = s.now() + 2000, model = 'claude-offline-exact-2', reference = 'offline-activation-2';
  const configuration = { ...s.configuration, root: target };
  const profile = Object.freeze({ ...s.profile, activationReference: reference });
  const activation = { ...s.activation, reference, model, profileDigest: encoded(profile).hash,
    baseConfigurationDigest: 'sha256:' + createHash('sha256').update(JSON.stringify(configuration)).digest('hex'),
    invocationPolicyDigest: encoded(subscriptionInvocationPolicy(model)).hash, assertedAt: now - 2, observedAt: now - 1 };
  const input: any = { predecessorRoot: source, root: target, predecessorConfiguration: s.configuration, configuration,
    quiescenceReference: 'desk:old-poller-and-local-child-exited', cutoff: now - 1000, now: () => now,
    activation, profile, model };
  const marker = join(parent, `.preview-s2-framing-v2-${createHash('sha256').update(s.state.read().trial.id).digest('hex')}.json`);
  return { s, source, target, parent, input, marker, sidecar, now };
}

it('replays exact first-live refusal bytes through genuine route/owners and retains the terminal unresolved slot across restart', async () => {
  expect('sha256:' + createHash('sha256').update(Buffer.from(refusalFixture.rawBase64, 'base64')).digest('hex')).toBe(refusalFixture.rawDigest);
  const f = await refusedSuccessorFixture();
  expect(f.sidecar).toMatchObject({ phase: 'held', hold: { code: 'REFUSED' }, terminalLatch: true, modelAttemptUsed: 1 });
  const proof = validateRefusedStage2Predecessor(f.source, f.s.state.read(), f.s.configuration);
  expect(proof).toMatchObject({ rawDigest: refusalFixture.rawDigest, answerDigest: refusalFixture.answerDigest,
    unresolvedObligation: { charge: 'UNKNOWN', quiescence: 'UNKNOWN', actualCharge: -1, unresolved: 1, released: 0, retryEligible: 0, exposure: 0 } });
  expect(f.s.models).toHaveLength(1); expect(f.s.calls.filter(r => r.method === 'sendMessage')).toHaveLength(0);
  const before = retainedFiles(f.source), c = await f.s.create(); await c.resume(); c.close();
  expect(retainedFiles(f.source)).toEqual(before); expect(f.s.models).toHaveLength(1);
}, 60000);

it('performs only one successor cutover, inherits all history and bounds, and pairs only one fresh post-cutoff turn', async () => {
  const f = await refusedSuccessorFixture(), before = retainedFiles(f.source), old = f.s.state.read();
  const results = await Promise.allSettled([cutoverRefusedStage2Root(f.input), cutoverRefusedStage2Root(f.input)]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
  const inherited = JSON.parse(readFileSync(join(f.target, 'preview-state.json'), 'utf8'));
  expect(inherited).toEqual({ ...old, stop: null, trial: { ...old.trial, configurationDigest: f.input.activation.baseConfigurationDigest } });
  expect(retainedFiles(f.source)).toEqual(before);
  const predecessor = JSON.parse(readFileSync(join(f.target, 'preview-predecessor.json'), 'utf8'));
  for (const [path, hash] of Object.entries(predecessor.snapshot)) expect('sha256:' + createHash('sha256')
    .update(readFileSync(join(f.target, '.preview-predecessor', path))).digest('hex')).toBe(hash);
  const marker = JSON.parse(readFileSync(f.marker, 'utf8'));
  expect(marker.reservationDigest).toBe(encoded(marker.reservation).hash);
  expect(predecessor.continuation.reservationDigest).toBe(marker.reservationDigest);
  expect(marker.completion).toEqual({ archiveInventoryDigest: encoded(predecessor.snapshot).hash, predecessorRecordDigest: encoded(predecessor).hash });
  expect(requireExists(join(f.target, '.preview-stage2'))).toBe(false);
  const s = stage2CompositionFixture({ root: f.target, start: f.now, cutoff: f.input.cutoff,
    model: f.input.model, activationReference: f.input.activation.reference,
    updates: [{ update_id: 2, message: { message_id: 1002, from: { id: 7812716706, is_bot: false, first_name: 'Offline' },
      chat: { id: 7812716706, type: 'private' }, date: Math.floor(f.now / 1000), text: 'And three plus three?' } }] });
  expect(s.activation).toEqual(f.input.activation);
  let c = await s.create();
  expect(c.sidecar.read().excludedTurns).toEqual(Object.keys(old.turns).sort());
  expect(c.sidecar.read().modelAttemptUsed).toBe(0);
  c.close(); // active restart must validate the same marker before polling
  const markerBytes = readFileSync(f.marker, 'utf8');
  writeFileSync(f.marker, JSON.stringify({ ...marker, completion: null })); await expect(s.create()).rejects.toThrow();
  writeFileSync(f.marker, markerBytes);
  // Recomputed hashes do not authorize changed immutable policy/system bindings.
  const predecessorPath = join(f.target, 'preview-predecessor.json'), predecessorBytes = readFileSync(predecessorPath, 'utf8');
  for (const [field, value] of [['systemPromptDigest', 'sha256:' + '1'.repeat(64)], ['framing', 'legacy'],
    ['policyDigest', 'sha256:' + '2'.repeat(64)], ['profileDigest', 'sha256:' + '3'.repeat(64)]]) {
    const changed = structuredClone(marker), pred = JSON.parse(predecessorBytes);
    changed.reservation[field!] = value; pred[field!] = value;
    changed.reservationDigest = encoded(changed.reservation).hash;
    pred.continuation.reservationDigest = changed.reservationDigest;
    changed.completion.predecessorRecordDigest = encoded(pred).hash;
    writeFileSync(f.marker, JSON.stringify(changed)); writeFileSync(predecessorPath, JSON.stringify(pred));
    await expect(s.create()).rejects.toThrow(); expect(s.children).toHaveLength(0);
  }
  writeFileSync(f.marker, markerBytes); writeFileSync(predecessorPath, predecessorBytes);
  c = await s.create(); c.pollOnce(); await c.resume();
  expect(c.sidecar.read()).toMatchObject({ phase: 'api-accepted', modelAttemptUsed: 1, selectedTurn: 'telegram:8820318295:update:2' });
  expect(JSON.parse(JSON.parse(s.models[0].stdin).messages[1].content).conversation.map((r: any) => r.update_id)).toEqual([1, 2]);
  c.close(); c = await s.create(); await c.resume(); expect(c.pollOnce()).toBeNull(); c.close();
  expect(f.s.models.length + s.models.length).toBe(2); expect(s.calls.filter(r => r.method === 'sendMessage')).toHaveLength(1);
  expect(retainedFiles(f.source)).toEqual(before);
  const other = join(f.parent, 'alternate'); mkdirSync(other);
  await expect(cutoverRefusedStage2Root({ ...f.input, root: other, configuration: { ...f.input.configuration, root: other } })).rejects.toThrow();
  await expect(cutoverRefusedStage2Root(f.input)).rejects.toThrow();
  s.state.latchStop('operator');
  await expect(cutoverRefusedStage2Root({ ...f.input, predecessorRoot: f.target, predecessorConfiguration: s.configuration,
    root: other, configuration: { ...s.configuration, root: other } })).rejects.toThrow();
}, 120000);

it('refuses successor stop/window/config/activation/lease/lineage/capture corruption without reserving or launching', async () => {
  const f = await refusedSuccessorFixture(), original = retainedFiles(f.source);
  const rejects = async (input = f.input) => {
    await expect(cutoverRefusedStage2Root(input)).rejects.toThrow(); expect(requireExists(f.marker)).toBe(false);
    expect(f.s.models).toHaveLength(1); expect(f.s.calls.filter(r => r.method === 'sendMessage')).toHaveLength(0);
  };
  for (const change of [ { quiescenceReference: '' }, { now: () => f.s.state.read().trial.expiresAt },
    { now: () => f.s.state.read().trial.expiresAt - 299999 }, { configuration: { ...f.input.configuration, maxContextTurns: 99 } },
    { activation: { ...f.input.activation, trial: 'wrong' } }, { activation: { ...f.input.activation, invocationPolicyDigest: f.s.activation.invocationPolicyDigest } },
    { activation: { ...f.input.activation, reference: f.s.activation.reference } }, { profile: { ...f.input.profile, activationReference: 'wrong' } } ]) await rejects({ ...f.input, ...change });
  const mutateFile = async (path: string, bytes: string | null) => {
    const saved = readFileSync(path); if (bytes === null) renameSync(path, path + '.retained'); else writeFileSync(path, bytes);
    try { await rejects(); } finally { if (bytes === null) renameSync(path + '.retained', path); else writeFileSync(path, saved); }
  };
  for (const reason of ['expiry', 'breaker', 'capacity', null]) {
    const path = join(f.source, 'preview-state.json'), saved = readFileSync(path);
    const old = JSON.parse(saved.toString()); writeFileSync(path, JSON.stringify({ ...old, stop: reason ? { latchedAt: f.now, reason } : null }));
    await mutateFile(join(f.source, 'preview-stop.json'), JSON.stringify(reason ? { latchedAt: f.now, reason } : null));
    writeFileSync(path, saved);
  }
  for (const name of ['.boot-lease', '.boot-lease-guard', '.preview-stage2/append.lock']) {
    mkdirSync(join(f.source, name)); await rejects(); rmSync(join(f.source, name), { recursive: true });
  }
  for (const bytes of ['{', '[]']) await mutateFile(join(f.source, '.preview-stage2/facts.json'), bytes);
  await mutateFile(join(f.source, '.preview-stage2/facts.json'), null);
  const proof = validateRefusedStage2Predecessor(f.source, f.s.state.read(), f.s.configuration);
  for (const digest of [proof.receiptDigest, proof.answerDigest, proof.rawCaptureDigest, proof.submittedDigest]) {
    const path = join(f.source, '.preview-stage2/captures', digest.slice(7)); await mutateFile(path, null); await mutateFile(path, 'changed');
  }
  const sidecarPath = join(f.source, 'preview-stage2-state.json');
  for (const change of [{ hold: { code: 'UNKNOWN', lengths: {}, references: [] } }, { modelAttemptUsed: 0 },
    { references: { ...f.sidecar.references, responseFact: f.sidecar.references.requestFact } }])
    await mutateFile(sidecarPath, JSON.stringify({ ...f.sidecar, ...change }));
  mkdirSync(join(f.source, '.preview-predecessor'));
  mkdirSync(join(f.source, '.preview-predecessor/.preview-stage2')); await rejects();
  rmSync(join(f.source, '.preview-predecessor'), { recursive: true });
  writeFileSync(join(f.source, 'preview-predecessor.json'), JSON.stringify({ continuation: { marker: 'prior' } })); await rejects();
  rmSync(join(f.source, 'preview-predecessor.json'));
  // Byte restoration, not mtime restoration, after intentional corruption.
  expect(Object.keys(retainedFiles(f.source) as object)).toEqual(Object.keys(original as object));
}, 120000);

it('refuses valid JSON failure and any accepted/reply outcome as successor predecessors', async () => {
  for (const options of [{ terminal: JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: '{}',
    session_id: 'offline-call', usage: { input_tokens: 1, output_tokens: 1 } }) }, { terminal: undefined }]) {
    const f = await refusedSuccessorFixture(options);
    if (f.sidecar.phase === 'api-accepted') {
      // A false held sidecar cannot conceal existing acceptance, reply Run, pair,
      // outbound request/message or dispatch claims in the signed store.
      writeFileSync(join(f.source, 'preview-stage2-state.json'), JSON.stringify({ ...f.sidecar, phase: 'held', hold: { code: 'REFUSED', lengths: {}, references: [] } }));
    }
    await expect(cutoverRefusedStage2Root(f.input)).rejects.toThrow(); expect(requireExists(f.marker)).toBe(false);
  }
}, 120000);

it('holds partial/corrupt lineage markers and copy crashes without another cutover or startup', async () => {
  const f = await refusedSuccessorFixture();
  for (const bytes of ['{', JSON.stringify({ reservation: {}, reservationDigest: 'wrong', completion: null })]) {
    writeFileSync(f.marker, bytes);
    await expect(cutoverRefusedStage2Root(f.input)).rejects.toThrow(); expect(readFileSync(f.marker, 'utf8')).toBe(bytes);
    expect(() => validateStage2Successor({ ...f.input, outer: { ...f.s.state.read(), trial: { ...f.s.state.read().trial,
      configurationDigest: f.input.activation.baseConfigurationDigest } } })).toThrow();
    rmSync(f.marker); // explicit test reset only; helper never removes a marker
  }
  // Fault injection at the actual fs copy boundary, after exclusive reservation.
  const fs = await import('node:fs'), module = await import('node:module');
  const original = fs.default.cpSync;
  fs.default.cpSync = (() => { throw Error('synthetic copy crash'); }) as typeof original; module.syncBuiltinESMExports();
  try { await expect(cutoverRefusedStage2Root(f.input)).rejects.toThrow('synthetic copy crash'); }
  finally { fs.default.cpSync = original; module.syncBuiltinESMExports(); }
  expect(JSON.parse(readFileSync(f.marker, 'utf8')).completion).toBeNull();
  await expect(cutoverRefusedStage2Root(f.input)).rejects.toThrow();
  expect(requireExists(join(f.target, '.preview-stage2'))).toBe(false);
  expect(f.s.models).toHaveLength(1);
}, 60000);

import { signEnvelope } from '../../src/facts/envelope.js';
import { privateKey as fixtureSigningKey, factsFixture, value as factValue } from '../facts/fixtures.js';
import { decodeFrame } from '../../src/facts/envelope.js';
import { extendsChain } from '../../src/facts/index.js';

// Test-only re-signing preserves valid chains so semantic negatives cannot pass
// merely because a signature was broken. No live root or key is used.
function signedBindingVariant(rows: any[], change: (e: any) => void, root: string) {
  const copy = structuredClone(rows), last = copy.at(-1);
  expect(last.body.evidence.claim.predicate).toBe('preview-invocation-binding');
  change(last.body.evidence);
  const bytes = encoded(last.body.evidence.claim.value).bytes;
  const hash = 'sha256:' + createHash('sha256').update(bytes).digest('hex');
  writeFileSync(join(root, '.preview-stage2/captures', hash.slice(7)), bytes);
  last.body.evidence.capture = { reference: `judgment-capture:${hash}`, hash };
  copy[copy.length - 1] = signEnvelope(last, fixtureSigningKey);
  const verified: any[] = [], base = factsFixture();
  for (const row of copy) {
    const f = factValue(decodeFrame(row, base.ctx)).frame as any;
    extendsChain(f, { ...base.ctx, facts: verified }); verified.push(f);
  }
  return copy;
}

it('rejects missing, altered, duplicate and wrongly joined signed invocation bindings before any child on active restart', async () => {
  const s = stage2CompositionFixture(); let c = await s.create(); c.pollOnce(); await c.resumeOne(); c.close();
  const path = join(s.root, '.preview-stage2/facts.json'), original = readFileSync(path, 'utf8'), rows = JSON.parse(original);
  const binding = rows.at(-1), request = rows.find((f: any) => f.kind === 'judgment-provider-ProviderJudgmentRequest');
  expect(binding.body.evidence.claim.value.request.id).toBe(request.id);
  const calls = s.calls.length;
  const refuses = async () => { await expect(s.create()).rejects.toThrow(); expect(s.calls).toHaveLength(calls); expect(s.models).toHaveLength(0); expect(s.children).toHaveLength(0); };
  writeFileSync(path, JSON.stringify(rows.slice(0, -1))); await refuses();
  for (const change of [
    (e: any) => { e.claim.value.request = e.claim.value.prepared; },
    (e: any) => { e.claim.value.attempt = request.body.record.run; },
    (e: any) => { e.claim.subject = request.id; }, // fact id is not the prepared request record id
    (e: any) => { e.claim.value.submittedDigest = e.claim.value.systemPromptDigest; },
    (e: any) => { e.claim.value.activationDigest = 'sha256:' + '1'.repeat(64); },
    (e: any) => { e.claim.value.profileDigest = 'sha256:' + '1'.repeat(64); },
    (e: any) => { e.claim.value.framing = 'legacy'; },
    (e: any) => { e.claim.value.invocationPolicy.args[7] += '!'; e.claim.value.invocationPolicyDigest = encoded(e.claim.value.invocationPolicy).hash; },
    (e: any) => { e.claim.value.invocationPolicy.maxPromptBytes++; e.claim.value.invocationPolicyDigest = encoded(e.claim.value.invocationPolicy).hash; },
    (e: any) => { e.claim.value.systemPromptDigest = 'sha256:' + '1'.repeat(64); },
    (e: any) => { e.claim.value.extra = true; },
    (e: any) => { e.type = 'Claim'; },
    (e: any) => { e.extra = true; },
  ]) { writeFileSync(path, JSON.stringify(signedBindingVariant(rows, change, s.root))); await refuses(); }
  const duplicate = structuredClone(binding);
  duplicate.segment.position++; duplicate.id = `${duplicate.machine}:${duplicate.segment.epoch}:${duplicate.segment.position}`;
  duplicate.prevInSegment = binding.contentHash; duplicate.predecessors.inSegment = binding.id;
  writeFileSync(path, JSON.stringify([...rows, signEnvelope(duplicate, fixtureSigningKey)])); await refuses();
  writeFileSync(path, original);
  const capture = join(s.root, '.preview-stage2/captures', binding.body.evidence.capture.hash.slice(7));
  const captured = readFileSync(capture);
  writeFileSync(capture, '{}'); await refuses(); writeFileSync(capture, captured);
  c = await s.create(); await c.resume(); expect(c.sidecar.read().phase).toBe('api-accepted'); c.close();
  expect(s.models).toHaveLength(1);
  // A dispatched binding cannot be reconstructed by replacing its missing capture.
  writeFileSync(capture, '{}'); const before = readFileSync(path);
  await expect(s.create()).rejects.toThrow(); expect(readFileSync(path)).toEqual(before); expect(s.models).toHaveLength(1);
  writeFileSync(capture, captured);
}, 120000);

it('finishes an interrupted pre-binding preparation only before dispatch and never duplicates a repeated preparation', async () => {
  const s = stage2CompositionFixture(); let c = await s.create(); c.pollOnce(); await c.resumeOne(); c.close();
  const path = join(s.root, '.preview-stage2/facts.json'), rows = JSON.parse(readFileSync(path, 'utf8'));
  expect(rows.at(-1).body.evidence.claim.predicate).toBe('preview-invocation-binding');
  writeFileSync(path, JSON.stringify(rows.slice(0, -1)));
  writeFileSync(join(s.root, '.preview-stage2/peer/facts.json'), JSON.stringify(rows.slice(0, -1)));
  const sidePath = join(s.root, 'preview-stage2-state.json'), d = JSON.parse(readFileSync(sidePath, 'utf8'));
  writeFileSync(sidePath, JSON.stringify({ ...d, phase: 'armed', references: {} }));
  c = await s.create(); await c.resumeOne(); expect(c.sidecar.read().phase).toBe('provider-prepared'); c.close();
  c = await s.create(); await c.resume(); expect(c.sidecar.read().phase).toBe('api-accepted'); c.close();
  expect(JSON.parse(readFileSync(path, 'utf8')).filter((f: any) => f.body.evidence?.claim.predicate === 'preview-invocation-binding')).toHaveLength(1);
  expect(s.models).toHaveLength(1);
}, 120000);

// Produce synthetic legacy history from a genuine refused owner chain. Only this
// fixture re-signs; historical production readers cannot author or retrofit facts.
function legacyRefusalHistory(root: string) {
  const path = join(root, '.preview-stage2/facts.json'), rows = JSON.parse(readFileSync(path, 'utf8'));
  const replacements = new Map<string, string>();
  const hash = (bytes: string) => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
  const walk = (v: any): any => {
    if (typeof v === 'string') return replacements.get(v) ?? v;
    if (v === null || typeof v !== 'object') return v;
    if (v.reference?.startsWith('judgment-capture:') && v.hash && !replacements.has(v.hash)) {
      const file = join(root, '.preview-stage2/captures', v.hash.slice(7)), bytes = readFileSync(file, 'utf8');
      try {
        const parsed = JSON.parse(bytes), changed = walk(parsed);
        if (encoded(parsed).bytes !== encoded(changed).bytes) {
          const nextBytes = encoded(changed).bytes, nextHash = hash(nextBytes);
          writeFileSync(join(root, '.preview-stage2/captures', nextHash.slice(7)), nextBytes);
          replacements.set(v.hash, nextHash); replacements.set(v.reference, `judgment-capture:${nextHash}`);
          replacements.set(encoded(bytes).hash, encoded(nextBytes).hash);
        }
      } catch { /* Exact non-JSON answer/raw text stays unchanged. */ }
    }
    const next = Array.isArray(v) ? v.map(walk) : Object.fromEntries(Object.entries(v).map(([k, value]) => [k, walk(value)]));
    if (encoded(v).bytes !== encoded(next).bytes) replacements.set(encoded(v).hash, encoded(next).hash);
    return next;
  };
  const next: any[] = [];
  for (const original of rows) {
    const row = walk(original);
    if (row.body.evidence?.claim.predicate === 'preview-invocation-binding') {
      const e = row.body.evidence;
      const bytes = encoded({ legacy: 'unrelated local attestation; no invocation binding' }).bytes, h = hash(bytes);
      writeFileSync(join(root, '.preview-stage2/captures', h.slice(7)), bytes);
      row.body = { evidence: { ...e, id: 'legacy-local-note', capture: { reference: `judgment-capture:${h}`, hash: h },
        claim: { subject: 'legacy-history', predicate: 'local-note', value: JSON.parse(bytes) } } };
    }
    const signed: any = signEnvelope(row, fixtureSigningKey); replacements.set(original.contentHash, signed.contentHash); next.push(signed);
  }
  const verified: any[] = [], base = factsFixture();
  for (const row of next) {
    const fact = factValue(decodeFrame(row, base.ctx)).frame as any; extendsChain(fact, { ...base.ctx, facts: verified }); verified.push(fact);
  }
  writeFileSync(path, JSON.stringify(next));
  writeFileSync(join(root, '.preview-stage2/peer/facts.json'), JSON.stringify(next));
  cpSync(join(root, '.preview-stage2/captures'), join(root, '.preview-stage2/peer/captures'), { recursive: true });
  const q = rows.find((r: any) => r.kind === 'judgment-provider-ProviderJudgmentRequest').body.record;
  const { framing: _framing, maxPromptBytes: _maximum, ...legacy } = subscriptionInvocationPolicy(q.model);
  const policy = { ...legacy, args: legacy.args.filter((_: string, i: number, args: readonly string[]) => args[i] !== '--system-prompt' && args[i - 1] !== '--system-prompt') };
  const sidePath = join(root, 'preview-stage2-state.json'), d = JSON.parse(readFileSync(sidePath, 'utf8'));
  writeFileSync(sidePath, JSON.stringify({ ...d, policyDigest: encoded(policy).hash }));
}

it('inspects and archives synthetic v1 predecessor history without retrofitting a binding; v2 continuation cannot use its absence allowance', async () => {
  const f = await refusedSuccessorFixture(); legacyRefusalHistory(f.source);
  const before = retainedFiles(f.source);
  expect(validateRefusedStage2Predecessor(f.source, f.s.state.read(), f.s.configuration).unresolvedObligation)
    .toMatchObject({ charge: 'UNKNOWN', quiescence: 'UNKNOWN', unresolved: 1 });
  expect(stage2HistoricalStatus(f.source, f.s.state.read(), f.s.configuration).phase).toBe('held');
  await cutoverRefusedStage2Root(f.input);
  expect(retainedFiles(f.source)).toEqual(before);
  const archive = JSON.parse(readFileSync(join(f.target, '.preview-predecessor/.preview-stage2/facts.json'), 'utf8'));
  expect(archive.some((r: any) => r.body.evidence?.claim.predicate === 'preview-invocation-binding')).toBe(false);
  const s = stage2CompositionFixture({ root: f.target, start: f.now, cutoff: f.input.cutoff,
    model: f.input.model, activationReference: f.input.activation.reference,
    updates: [{ update_id: 2, message: { message_id: 1002, from: { id: 7812716706, is_bot: false, first_name: 'Offline' },
      chat: { id: 7812716706, type: 'private' }, date: Math.floor(f.now / 1000), text: 'A new question?' } }] });
  let c = await s.create(); c.pollOnce(); await c.resumeOne(); c.close();
  const path = join(s.root, '.preview-stage2/facts.json'), rows = JSON.parse(readFileSync(path, 'utf8'));
  const sidePath = join(s.root, 'preview-stage2-state.json'), d = JSON.parse(readFileSync(sidePath, 'utf8'));
  writeFileSync(path, JSON.stringify(rows.slice(0, -1)));
  const legacyPolicy = JSON.parse(readFileSync(join(f.source, 'preview-stage2-state.json'), 'utf8')).policyDigest;
  writeFileSync(sidePath, JSON.stringify({ ...d, policyDigest: legacyPolicy }));
  const children = s.children.length;
  await expect(s.create()).rejects.toThrow(); expect(s.children).toHaveLength(children); expect(s.models).toHaveLength(0);
}, 120000);
