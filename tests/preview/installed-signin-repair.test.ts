// @ts-nocheck -- real launcher, authority resolver, provider adapter and encrypted journal;
// only physical Telegram, harness identity and CLI IO are replaced. No Shared mutation/model spend.
import { expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { runChild } from '../e2e/async-child.js';
import { cpSync, existsSync, readFileSync, renameSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { successiveWorld, offlineProfile, offlineActivationAuthority, offlineOperatorMessage, writeOperatorRecords, OFFLINE_STORAGE_KEY } from './successive-fixture.js';
import { authoritySealKey, sealAuthorityRecord, singleMachineProfileDigest, SINGLE_MACHINE_PROFILE } from './activation-authority.js';
import { encoded } from './stage2-provider.js';
import { CREDENTIAL_SHAPE_NOTICE, MODEL_FAILURE_REPLY, MODEL_NOT_STARTED_REPLY, openPreviewJournal } from './journal.js';
import { harnessLoginPath, storeHarnessLogin } from './harness-user.mjs';

// Two installations, run, status and withdrawal each retain their 30s child ceiling.
// Leave room for all five and cleanup; awaited children keep worker IPC responsive.
it.each(['complete', 'credential-needed', 'phone-tap', 'wrong-account', 'fallback-code', 'retryable', 'restart', 'stop', 'duplicate'])('installed runner sign-in repair: %s, durable ownership and once-only action notice', async mode => {
  const world = successiveWorld(), directory = world.directory;
  let root = join(directory, 'pool-runner');
  const absolute = relative => pathToFileURL(join(process.cwd(), relative)).href;
  const log = join(directory, 'telegram.log'), updates = join(directory, 'updates.json'), calls = join(directory, 'calls.jsonl');
  const custodyCase = mode.includes('custody');
  const missingCustody = mode.startsWith('missing-custody');
  const secretAnswer = mode.endsWith('custody-secret');
  const encodedPrimary = Buffer.from('sk-ant-oat01-synthetic-serving-a-only').toString('base64');
  const missing = mode === 'missing-profile' || custodyCase;
  // The first login's own CLI login check reports it signed out (1.x QuotaPoller needs-reauth evidence).
  const signedOut = true;
  // The plain not-started line is a reserve (limited) answer: on one machine it speaks only under the operator's
  // accepted P-08 single-machine policy, as every live proof room records. Without it the turn is kept and the
  // outage is owned on the status surface (minimal-path-live.test.ts); this variant proves that side here.
  const unaccepted = mode === 'signed-out-unaccepted';
  // A handed-over token the provider refuses: status still says signed in; the model frame is the genuine 401.
  const refusedToken = mode === 'refused-token';
  const pooled = true, automatic = true;
  const logins = (pooled ? ['serving-a', 'serving-b'] : ['serving-b']).map(name => {
    const profile = { ...offlineProfile, reference: name, activationReference: `${name}-activation`, expectedAccount: `${name}@example.invalid`,
      home: `/offline/${name}/home`, configDirectory: `/offline/${name}/config`, workingDirectory: `/offline/${name}/work` };
    const activation = { ...world.activation(), reference: profile.activationReference, profileDigest: encoded(profile).hash,
      expectedAccount: profile.expectedAccount, observedAccount: profile.expectedAccount };
    const row = { profile: join(directory, `${name}.json`), activation: join(directory, `${name}-activation.json`),
      authority: join(directory, `${name}-authority.json`) };
    writeFileSync(row.profile, JSON.stringify(profile)); writeFileSync(row.activation, JSON.stringify(activation));
    writeFileSync(row.authority, JSON.stringify(offlineActivationAuthority(activation)));
    const custodyPath = pooled ? harnessLoginPath(profile, join(directory, 'custody')) : join(directory, 'custody', 'login.json');
    storeHarnessLogin(profile, `sk-ant-oat01-synthetic-${name}-only`, custodyPath);
    if (mode === 'legacy') {
      const record = JSON.parse(readFileSync(custodyPath, 'utf8')); delete record.reference;
      writeFileSync(custodyPath, JSON.stringify(record));
    }
    return row;
  });
  if (signedOut && !unaccepted) {
    // The desk's recorded step, as in minimal-path-live.test.ts: the acceptance message and the sealed policy.
    const words = 'I accept the single-machine profile and its loss model for this preview.', activation = JSON.parse(readFileSync(logins[0].activation, 'utf8'));
    const accepted = offlineOperatorMessage(1, 3, words);
    writeOperatorRecords(join(directory, 'operator-records'), [offlineOperatorMessage(1, 1, 'offline approval stand-in'),
      offlineOperatorMessage(1, 2, 'offline waiver stand-in'), accepted]);
    const { seal: _seal, ...body } = JSON.parse(readFileSync(logins[0].authority, 'utf8'));
    writeFileSync(logins[0].authority, JSON.stringify(sealAuthorityRecord({ ...body, installationPolicies: [{ id: 'p08-single-machine', policy: 'P-08',
      shape: 'single-machine', grantor: String(world.configuration.operatorSenderId), words, source: { kind: 'telegram-message', topicId: 1, messageId: 3 },
      acceptedAt: Date.parse(accepted.message.timestamp), subject: { trial: activation.trial, profile: SINGLE_MACHINE_PROFILE.id, profileDigest: singleMachineProfileDigest() } }] },
    authoritySealKey(OFFLINE_STORAGE_KEY))));
  }
  const manifest = join(directory, 'pool.json'); writeFileSync(manifest, JSON.stringify({ version: 1, logins }));
  const repaired = join(directory, 'repaired'), repairCalls = join(directory, 'repair-calls.jsonl');
  const clockPath = join(directory, 'clock'), releasePath = join(directory, 'release'), revalidatePath = join(directory, 'revalidate');
  let clockNow = Date.now(); writeFileSync(clockPath, String(clockNow));
  const quota = join(directory, 'quota.mjs');
  writeFileSync(quota, `export const createClaudePoolQuota = ({entries}) => ({ refresh: async () => {}, read: () => ({version:1,
   accounts:entries.map(entry=>({email:entry.profile.expectedAccount,configHome:entry.profile.configDirectory,
    lastQuota:{measuredAt:new Date(Date.now()).toISOString(),fiveHour:{utilizationPct:10,resetsAt:new Date(Date.now()+600000).toISOString()},
    sevenDay:{utilizationPct:10,resetsAt:new Date(Date.now()+600000).toISOString()}}}))}) });`);
  const harness = join(directory, 'harness.mjs'), io = join(directory, 'io.mjs'), loader = join(directory, 'loader.mjs');
  writeFileSync(harness, `export * from ${JSON.stringify(absolute('tests/preview/harness-user.mjs'))};
import { harnessGate as gate, migrateHarnessLogin, readHarnessLogin as read, harnessLoginPath } from ${JSON.stringify(absolute('tests/preview/harness-user.mjs'))};
export const readHarnessLogin = profile => read(profile, harnessLoginPath(profile, ${JSON.stringify(join(directory, 'custody'))}));
export const harnessCredentialValues = () => [];
export const harnessGate = ({profile,migrateLegacy}) => gate({profile,migrateLegacy,denied:[],clock:()=>1,runner:()=> 'offline-runner',
 migrate:profile=>migrateHarnessLogin(profile,${JSON.stringify(join(directory, 'custody'))}),login:readHarnessLogin,
 check:()=>{try{readHarnessLogin(profile);return {ready:true,user:'offline-harness'};}catch{return {ready:false,reason:'missing login'};}}
});`);
  writeFileSync(io, `export * from ${JSON.stringify(absolute('scripts/production-boot-io.mjs'))};
import {appendFileSync,readFileSync,existsSync} from 'node:fs';
import {productionProviderIO} from ${JSON.stringify(absolute('scripts/production-boot-io.mjs'))};
const captured = readFileSync(${JSON.stringify(join(process.cwd(), `tests/fixtures/provider-failure/${refusedToken ? 'claude-auth-401-result.json' : 'claude-limit-result.json'}`))},'utf8');
export const createSubscriptionProviderIO = ({runAs,stopped}) => ({...productionProviderIO,
 descriptorLogin:true,realpath:p=>p,executableBytes:()=>Buffer.from('offline executable bytes'),
 inspectSubscriptionProfile:profile=>({loginProfileIdentity:profile.loginProfileIdentity,managedConfigurationDigest:profile.managedConfigurationDigest}),
 execute:async command=>{
  if(stopped()) throw Error('stopped');
  const token=runAs.login();
  const account=command.env.HOME.split('/')[2];
  if(token!=='sk-ant-oat01-synthetic-'+account+'-only')throw Error('login crossed accounts');
  let stdout,code=0;
  if(command.args[0]==='--version')stdout='2.1.280 (Claude Code)';
  else if(command.args[0]==='auth'&&account==='serving-a'&&!existsSync(${JSON.stringify(repaired)})&&${JSON.stringify(signedOut && !refusedToken)}){stdout=JSON.stringify({loggedIn:false,authMethod:'none',apiProvider:'firstParty'});code=1;}
  else if(command.args[0]==='auth')stdout=JSON.stringify({loggedIn:true,authMethod:'oauth_token',apiProvider:'firstParty',analyticsDisabled:false,
    configDirectory:command.env.CLAUDE_CONFIG_DIR,projectsDirectory:command.env.CLAUDE_CONFIG_DIR+'/projects'});
  else {
   appendFileSync(${JSON.stringify(calls)},JSON.stringify({account,home:command.env.HOME,config:command.env.CLAUDE_CONFIG_DIR,evidence:JSON.parse(JSON.parse(command.stdin).messages[1].content).bindings.evidence})+'\\n');
   if(account==='serving-a' && ${JSON.stringify(!missing && (!signedOut || refusedToken))}){stdout=captured;code=1;}
   else stdout=JSON.stringify({type:'result',subtype:'success',is_error:false,result:JSON.stringify({reasoning:'The operator asked an ordinary question.',answer:${JSON.stringify(secretAnswer ? encodedPrimary : 'The second approved login answered.')}}),
    session_id:'offline-b',usage:{input_tokens:10,output_tokens:20,cache_creation_input_tokens:0,cache_read_input_tokens:0}});
  }
  return {code,limited:false,stdout,stdoutBytes:Buffer.from(stdout)};
 }});`);
  const clockModule = join(directory, 'clock.mjs');
  writeFileSync(clockModule, `export const createPreviewClock=(wall,elapsed)=>({now:wall,elapsed,seed:()=>{}});`);
  const physicalRepair = join(directory, 'repair.mjs');
  writeFileSync(physicalRepair, `import {appendFileSync,existsSync,writeFileSync} from 'node:fs';
export const installedSigninRepairAdapter=({root})=>({
 normalSigninAuthorized:entry=>entry.profile.expectedAccount.endsWith('@example.invalid'),
 profile:(entry,machine)=>({reference:entry.profile.reference,account:entry.profile.expectedAccount,machine,
  registered:true,ownership:'agent',revision:'fixture-profile-1'}),
 resumeRevision:()=>undefined,
 runNormal:async(input,signal)=>{appendFileSync(${JSON.stringify(repairCalls)},JSON.stringify(input)+'\\n');
  if(${JSON.stringify(mode)}==='stop'){writeFileSync(root+'/preview-stop.json','test stop'); await new Promise(r=>signal.addEventListener('abort',r,{once:true}));return 'uncertain';}
  if(${JSON.stringify(mode)}==='restart'){process.kill(process.pid,'SIGTERM'); await new Promise(r=>signal.addEventListener('abort',r,{once:true}));return 'uncertain';}
  if(${JSON.stringify(mode)}==='duplicate'){while(!existsSync(${JSON.stringify(releasePath)})&&!signal.aborted)await new Promise(r=>setTimeout(r,10));return 'complete';}
  return ${JSON.stringify(mode)};
 }, quiescent:async()=>{writeFileSync(${JSON.stringify(revalidatePath)},'revalidated');return true;},cancel:()=>{},
 candidate:async target=>({reference:target.key,account:target.account,current:()=>true,
  identity:async()=>${JSON.stringify(mode)}==='restart'?'unknown':'match',use:async()=>true,
  publish:async()=>{writeFileSync(${JSON.stringify(repaired)},'verified fixture candidate');return true;},close:()=>{}})
});`);
  writeFileSync(loader, `export async function resolve(specifier,context,next){
 if(context.parentURL?.endsWith('/journal-agent.mjs')){
  if(${JSON.stringify(mode === 'retryable')} && specifier.endsWith('/clock.js'))return {url:${JSON.stringify(pathToFileURL(clockModule).href)},shortCircuit:true};
  if(specifier.endsWith('/signin-repair-physical.mjs'))return {url:${JSON.stringify(pathToFileURL(physicalRepair).href)},shortCircuit:true};
  if(specifier.endsWith('/claude-pool-quota.mjs'))return {url:${JSON.stringify(pathToFileURL(quota).href)},shortCircuit:true};
  if(specifier.endsWith('/harness-user.mjs'))return {url:${JSON.stringify(pathToFileURL(harness).href)},shortCircuit:true};
  if(specifier.endsWith('/production-boot-io.mjs'))return {url:${JSON.stringify(pathToFileURL(io).href)},shortCircuit:true};
 }
 return next(specifier,context);
}

`);
  const preload = join(directory, 'jev.mjs');
  writeFileSync(preload, `import {readFileSync} from 'node:fs'; Date.now=()=>Number(readFileSync(${JSON.stringify(clockPath)},'utf8')); globalThis.fetch=async()=>new Response(JSON.stringify({model:'jev-1.13.0',answers:Object.fromEntries(
 ['raw_path','cli_command','config_key','credential','api_endpoint','quits_on_self','claims_blocked','parks_on_user','defers_work','unrecorded_blocker','self_state_claim','breaks_preference']
 .map(k=>[k,{type:'noul',noul:0.01}])),usage:{input_tokens:1,output_tokens:1}}));`);
  writeFileSync(updates, JSON.stringify([1, 2, 3].map(update_id => ({ update_id, message: {
    chat: { id: Number(world.configuration.chatId), type: 'private' }, from: { id: Number(world.configuration.operatorSenderId) },
    text: 'Please say hello.' } }))));
  const endpoint = spawn(process.execPath, ['tests/preview/journal-poll-endpoint.mjs', log, updates, 'normal', 'long-poll'], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const port = await new Promise((done, fail) => { endpoint.stdout.once('data', bytes => done(Number(String(bytes).trim()))); endpoint.once('error', fail); });
    const trial = world.state().read().trial;
    const args = ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', '--loader', loader, '--import', preload,
      'tests/preview/journal-agent.mjs', 'run', '--root', root, '--bot-id', world.configuration.botId, '--chat-id', world.configuration.chatId,
      '--operator-sender-id', world.configuration.operatorSenderId, '--grant-reference', trial.id, '--configuration-digest', trial.configurationDigest,
      '--expires-at', String(trial.expiresAt), '--tools', 'off', '--activation-record', logins[0].activation, '--login-profile', logins[0].profile,
      ...[], '--harness-user', 'offline-harness', '--operator-records', join(directory, 'operator-records'), '--model', world.model,
      '--bot-username', world.configuration.botUsername, '--max-cycles', '6', '--max-poll-seconds', '1'];
    const env = { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
      INSTAR_SECRET_PREVIEW_TYPESAFE_KEY: 'synthetic', INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: `http://127.0.0.1:${port}` };
    // Primary account activation uses its own authority too, even before the pool is built.
    args.push('--authority-record', logins[0].authority);
    if (automatic) {
      for (const row of (mode === 'imported' ? logins.slice(0, 1) : logins)) {
        const installArgs = args.map(value => value === 'run' ? 'install-login' : value);
        for (const [flag, value] of [['--login-profile', row.profile], ['--activation-record', row.activation], ['--authority-record', row.authority]])
          installArgs[installArgs.indexOf(flag) + 1] = value;
        if (mode === 'imported') installArgs.push('--login-pool', manifest);
        const installed = await runChild(process.execPath, installArgs, { cwd: process.cwd(), timeout: 30000, env });
        expect(installed.status, installed.stderr).toBe(0);
      }
      const registry = JSON.parse(readFileSync(join(root, 'harness-logins.json'), 'utf8'));
      expect(registry.logins.map(row => row.profile)).toEqual(logins.map(row => row.profile));
      if ((missing || mode === 'missing' || mode === 'lost-build') && !custodyCase) {
        const prepared = JSON.parse(readFileSync(registry.preparedManifest, 'utf8'));
        rmSync(mode === 'missing-profile' ? logins[1].profile : mode === 'lost-build'
          ? join(registry.preparedManifest, '..') : prepared.logins[1].activation, { recursive: true });
      }
      if (missingCustody) rmSync(harnessLoginPath(JSON.parse(readFileSync(logins[1].profile, 'utf8')), join(directory, 'custody')));
      if (mode === 'fresh') {
        const usageFile = join(directory, 'usage.json');
        writeFileSync(usageFile, JSON.stringify({ version: 1, accounts: logins.map((row, index) => {
          const a = JSON.parse(readFileSync(row.profile, 'utf8')), utilizationPct = index === 0 ? 80 : 20;
          const window = { utilizationPct, resetsAt: new Date(Date.now() + 600000).toISOString() };
          return { email: a.expectedAccount, configHome: a.configDirectory,
            lastQuota: { measuredAt: new Date().toISOString(), fiveHour: window, sevenDay: window } };
        }) }));
        const prepared = JSON.parse(readFileSync(registry.preparedManifest, 'utf8'));
        writeFileSync(registry.preparedManifest, JSON.stringify({ ...prepared, usageFile }));
      }
      if (mode === 'renamed' || mode === 'copied') {
        const moved = join(directory, 'relocated-runner');
        // Strip the new marker to replay the legacy absolute-path manifest from the incident.
        const prepared = JSON.parse(readFileSync(registry.preparedManifest, 'utf8'));
        delete prepared.recordRoot;
        writeFileSync(registry.preparedManifest, JSON.stringify(prepared));
        delete registry.recordRoot;
        writeFileSync(join(root, 'harness-logins.json'), JSON.stringify(registry));
        if (mode === 'renamed') renameSync(root, moved); else cpSync(root, moved, { recursive: true });
        root = moved; args[args.indexOf('--root') + 1] = root;
      }
      for (const flag of ['--login-profile', '--activation-record', '--authority-record']) args.splice(args.indexOf(flag), 2);
    }
    const run = () => runChild(process.execPath, args, { cwd: process.cwd(), timeout: 30000, env });
    const firstRun = run();
    if (mode === 'duplicate') {
      const until = performance.now() + 15000;
      while (!existsSync(repairCalls) && performance.now() < until) await new Promise(resolve => setTimeout(resolve, 20));
      expect(existsSync(repairCalls)).toBe(true);
      const duplicate = await run();
      expect(duplicate.stderr + duplicate.stdout).toMatch(/owner|already|another|refused/i);
      writeFileSync(releasePath, 'release');
    }
    const first = await firstRun; expect(first.status, first.stderr + (existsSync(join(root, 'runs.jsonl')) ? readFileSync(join(root, 'runs.jsonl'), 'utf8') : '')).toBe(0);
    const state = () => JSON.parse(readFileSync(join(root, 'harness-login-pool.json'), 'utf8'));
    const episode = state().signinRepairs?.[0]?.episode;
    expect(state().handoffAttempts ?? []).toEqual([]);
    expect(episode, JSON.stringify(state())).toBeDefined();
    const attempts = () => existsSync(repairCalls) ? readFileSync(repairCalls, 'utf8').trim().split('\n').map(JSON.parse) : [];
    expect(attempts().length).toBeGreaterThan(0);
    const sends = () => existsSync(`${log}.sends`) ? readFileSync(`${log}.sends`, 'utf8').trim().split('\n').map(JSON.parse) : [];
    const notices = () => sends().filter(row => row.text.startsWith('Sign-in for '));
    if (mode === 'complete' || mode === 'duplicate') {
      expect(episode.phase).toBe('succeeded'); expect(state().signedOut).toEqual({});
      expect(existsSync(repaired)).toBe(true); expect(notices()).toHaveLength(0);
    } else if (['credential-needed', 'phone-tap', 'wrong-account', 'fallback-code'].includes(mode)) {
      expect(episode).toMatchObject({ phase: 'parked', reason: mode, attempts: 1 });
      expect(notices()).toHaveLength(1);
      const words = { 'credential-needed': 'Please supply this account’s sign-in credential through Secret Drop.',
        'phone-tap': 'Please approve the sign-in request on your phone.',
        'wrong-account': 'The service showed a different account. Please confirm which account I should use.',
        'fallback-code': 'The service requested a fallback code, which I will not use. Please approve a normal sign-in method.' };
      expect(notices()[0].text).toBe(`Sign-in for serving-a@example.invalid: ${words[mode]}`);
    } else expect(notices()).toHaveLength(0);
    const observed = openPreviewJournal(join(root, 'journal.encrypted'), OFFLINE_STORAGE_KEY, undefined, undefined, true);
    const edges = observed.sessionWorkRecords().filter(row => row.type === 'SessionWorkEdge' && row.transport === 'normal-sign-in adapter');
    expect(edges.length).toBeGreaterThan(0); expect(edges[0].id).toBe(episode.owner);
    observed.close();
    writeFileSync(updates, '[]');
    if (mode === 'complete') {
      // Prefer the recovered member, then prove the installed runtime actually admits its next model call.
      writeFileSync(join(root, 'harness-login-pool.json'), JSON.stringify({ ...state(), active: 0 }));
      writeFileSync(updates, JSON.stringify([{ update_id: 4, message: { chat: { id: Number(world.configuration.chatId), type: 'private' },
        from: { id: Number(world.configuration.operatorSenderId) }, text: 'Say hello again.' } }]));
    }
    const before = attempts().length;
    if (mode === 'restart') expect(episode.phase).toBe('attempting');
    if (mode === 'retryable') {
      expect(episode).toMatchObject({ phase: 'cooldown', attempts: 1, nextAt: clockNow + 5000 });
      for (const [advance, expected] of [[4999, 1], [1, 2], [9999, 2], [1, 3]]) {
        clockNow += advance; writeFileSync(clockPath, String(clockNow));
        const next = await run(); expect(next.status, next.stderr).toBe(0);
        expect(attempts()).toHaveLength(expected);
      }
      expect(state().signinRepairs[0].episode).toMatchObject({ phase: 'parked', reason: 'attempt-cap', attempts: 3 });
    }
    if (mode !== 'stop' && mode !== 'retryable') {
      const second = await run(); expect(second.status, second.stderr).toBe(0);
      expect(attempts()).toHaveLength(before);
      if (mode === 'complete') expect(JSON.parse(readFileSync(calls, 'utf8').trim().split('\n').at(-1)).account).toBe('serving-a');
      if (mode === 'restart') { expect(existsSync(revalidatePath)).toBe(true); expect(state().signinRepairs[0].episode.reason).toBe('uncertain'); }
      expect(notices()).toHaveLength(['complete', 'restart', 'duplicate'].includes(mode) ? 0 : 1);
    }
  } finally { endpoint.kill('SIGTERM'); await new Promise(resolve => endpoint.once('exit', resolve)); rmSync(directory, { recursive: true, force: true }); }
}, 180000);
