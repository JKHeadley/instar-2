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
import {openPreviewState} from ${JSON.stringify(join(process.cwd(), 'tests/preview/state.ts'))};
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
import { cutoverPreviewRoot, openPreviewState } from './state.js';
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
import { encoded, subscriptionInvocationPolicy } from './stage2-provider.js';
// @ts-expect-error Physical host; inspection only, no installed CLI is executed.
import { createSubscriptionProviderIO } from '../../scripts/production-boot-io.mjs';

for (const signal of [null, 'SIGINT', 'SIGTERM'] as const) it(`actual async launcher ${signal ?? 'accepts one answer'} with a spawned synthetic CLI`, () => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'preview-s2-launch-evidence-'))), root = join(directory, 'root');
  const home = join(directory, 'home'), configDirectory = join(directory, 'config'), workingDirectory = join(directory, 'work');
  for (const path of [root, home, configDirectory, workingDirectory]) mkdirSync(path, { mode: 0o700 });
  const now = Date.now(), cutoff = now - 1000, expiresAt = 1790628000000;
  const configuration = { root, machine: 'preview-local-machine', botId: '8820318295', botUsername: '@echo_mmtest_seam_b27x_bot',
    operatorSenderId: '7812716706', chatId: '7812716706', chatKind: 'private', forum: false, messageThreadId: null,
    maxPollSeconds: 1, maxBatchItems: 1, maxContextTurns: 8, maxContextBytes: 65536 };
  const limits = { expiresAt, replyLimit: 6, replyWindowMs: 60000, errorLimit: 5, maxPendingTurns: 16, maxTrialTurns: 128 };
  const state = openPreviewState({ root, configuration: { ...configuration, ...limits }, ...limits, totalErrorLimit: 1000 });
  const executable = join(directory, 'synthetic-cli.mjs'), log = join(directory, 'models.jsonl');
  const auth = { loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty', analyticsDisabled: true,
    projectsDirectory: configDirectory + '/projects', configDirectory, email: 'offline@example.invalid', orgId: 'offline-org',
    orgName: 'Offline', subscriptionType: 'max' };
  const source = `#!${process.execPath}
import {appendFileSync} from 'node:fs';
let stdin='';for await(const bytes of process.stdin)stdin+=bytes;
if(process.argv[2]==='--version')process.stdout.write('2.1.280 (Claude Code)');
else if(process.argv[2]==='auth')process.stdout.write(${JSON.stringify(JSON.stringify(auth))});
else {appendFileSync(${JSON.stringify(log)},'model'+String.fromCharCode(10));
 const signal=${JSON.stringify(signal)};
 if(signal){process.kill(process.ppid,signal);setInterval(()=>{},1000);}
 else {const binding=JSON.parse(JSON.parse(stdin).messages[1].content).bindings;
 const decision={type:'Decision',schemaVersion:1,id:'spawned-answer',at:binding.at,by:binding.by,
 conclusion:{subject:'preview-stage2-answer',predicate:'answer-text',value:'A spawned answer 世界',evidence:binding.evidence},
 reason:{subject:'question',predicate:'answered',value:true,evidence:binding.evidence},floor:{allowed:binding.floor,chosen:binding.floor.default}};
 process.stdout.write(JSON.stringify({type:'result',subtype:'success',is_error:false,result:JSON.stringify(decision),
 session_id:'offline-call',usage:{input_tokens:1,output_tokens:20},total_cost_usd:1.25}));}}
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
const calls=[];let polled=false;
cp.spawnSync=(exe,args)=>{const q=JSON.parse(Buffer.from(args[1],'base64url').toString('utf8'));calls.push(q);let result;
if(q.method==='getMe')result={id:8820318295,is_bot:true,username:'echo_mmtest_seam_b27x_bot',first_name:'Offline'};
else if(q.method==='getUpdates'){result=polled?[]:[{update_id:1,message:{message_id:1001,from:{id:7812716706,is_bot:false,first_name:'Offline'},chat:{id:7812716706,type:'private'},date:Math.floor(Date.now()/1000),text:'Give a brief answer.'}}];polled=true;}
else result={message_id:2001,chat:{id:7812716706,type:'private'},text:q.body.text};
return{status:0,stdout:JSON.stringify({kind:'response',status:200,bytes:JSON.stringify({ok:true,result})})};};syncBuiltinESMExports();
process.on('exit',()=>writeFileSync(${JSON.stringify(report)},JSON.stringify(calls)));
`);
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_OPTIONS: `--import=${preload}`,
    INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '8820318295:synthetic_recorded_test_only_value', INSTAR_SECRET_PREVIEW_STORAGE_KEY: '13'.repeat(32) };
  delete env.INSTAR_TELEGRAM_LIVE_TEST;
  const result = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/agent.mjs', 'run',
    '--stage', '2', '--root', root, '--bot-id', configuration.botId, '--bot-username', configuration.botUsername,
    '--operator-sender-id', configuration.operatorSenderId, '--chat-id', configuration.chatId, '--chat-kind', 'private', '--forum', 'false',
    '--message-thread-id', 'none', '--expires-at', String(expiresAt), '--max-cycles', '3', '--max-poll-seconds', '1', '--max-batch-items', '1',
    '--activation-record', activationPath, '--login-profile', profilePath, '--model', model, '--activation-cutoff', String(cutoff), '--arm', 'true'],
  { cwd: process.cwd(), env, encoding: 'utf8', timeout: 90000 });
  expect(result.status, result.stderr + ` retained ${directory}`).toBe(0);
  expect(requireExists(log), result.stderr).toBe(true);
  expect(readFileSync(log, 'utf8').trim().split('\n')).toHaveLength(1);
  const sidecar = JSON.parse(readFileSync(join(root, 'preview-stage2-state.json'), 'utf8'));
  expect(sidecar, result.stderr).toMatchObject({ modelAttemptUsed: 1, terminalLatch: true, phase: signal ? 'held' : 'api-accepted' });
  const calls = JSON.parse(readFileSync(report, 'utf8'));
  expect(calls.filter((row: any) => row.method === 'sendMessage')).toHaveLength(signal ? 0 : 1);
  if (signal) expect(state.read().stop?.reason).toBe('signal');
  else expect(calls.find((row: any) => row.method === 'sendMessage').body.text).toContain('A spawned answer 世界');
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
