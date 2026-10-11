// @ts-nocheck -- real launcher, authority resolver, provider adapter and encrypted journal;
// only physical Telegram, harness identity and CLI IO are replaced. No Shared mutation/model spend.
import { expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { successiveWorld, offlineProfile, offlineActivationAuthority, OFFLINE_STORAGE_KEY } from './successive-fixture.js';
import { encoded } from './stage2-provider.js';
import { openPreviewJournal } from './journal.js';
import { harnessLoginPath, storeHarnessLogin } from './harness-user.mjs';

it.each(['pool', 'legacy'])('shipped launcher answers through %s custody with exact activation and no repeated send', async mode => {
  const world = successiveWorld(), directory = world.directory, root = join(directory, 'pool-runner');
  const absolute = relative => pathToFileURL(join(process.cwd(), relative)).href;
  const log = join(directory, 'telegram.log'), updates = join(directory, 'updates.json'), calls = join(directory, 'calls.jsonl');
  const logins = (mode === 'pool' ? ['serving-a', 'serving-b'] : ['serving-b']).map(name => {
    const profile = { ...offlineProfile, reference: name, activationReference: `${name}-activation`, expectedAccount: `${name}@example.invalid`,
      home: `/offline/${name}/home`, configDirectory: `/offline/${name}/config`, workingDirectory: `/offline/${name}/work` };
    const activation = { ...world.activation(), reference: profile.activationReference, profileDigest: encoded(profile).hash,
      expectedAccount: profile.expectedAccount, observedAccount: profile.expectedAccount };
    const row = { profile: join(directory, `${name}.json`), activation: join(directory, `${name}-activation.json`),
      authority: join(directory, `${name}-authority.json`) };
    writeFileSync(row.profile, JSON.stringify(profile)); writeFileSync(row.activation, JSON.stringify(activation));
    writeFileSync(row.authority, JSON.stringify(offlineActivationAuthority(activation)));
    const custodyPath = mode === 'pool' ? harnessLoginPath(profile, join(directory, 'custody')) : join(directory, 'custody', 'login.json');
    storeHarnessLogin(profile, `sk-ant-oat01-synthetic-${name}-only`, custodyPath);
    if (mode === 'legacy') {
      const record = JSON.parse(readFileSync(custodyPath, 'utf8')); delete record.reference;
      writeFileSync(custodyPath, JSON.stringify(record));
    }
    return row;
  });
  const manifest = join(directory, 'pool.json'); writeFileSync(manifest, JSON.stringify({ version: 1, logins }));
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
import {appendFileSync,readFileSync} from 'node:fs';
import {productionProviderIO} from ${JSON.stringify(absolute('scripts/production-boot-io.mjs'))};
const captured = readFileSync(${JSON.stringify(join(process.cwd(), 'tests/fixtures/provider-failure/claude-limit-result.json'))},'utf8');
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
  else if(command.args[0]==='auth')stdout=JSON.stringify({loggedIn:true,authMethod:'oauth_token',apiProvider:'firstParty',analyticsDisabled:false,
    configDirectory:command.env.CLAUDE_CONFIG_DIR,projectsDirectory:command.env.CLAUDE_CONFIG_DIR+'/projects'});
  else {
   appendFileSync(${JSON.stringify(calls)},JSON.stringify({account,home:command.env.HOME,config:command.env.CLAUDE_CONFIG_DIR,evidence:JSON.parse(JSON.parse(command.stdin).messages[1].content).bindings.evidence})+'\\n');
   if(account==='serving-a'){stdout=captured;code=1;}
   else stdout=JSON.stringify({type:'result',subtype:'success',is_error:false,result:JSON.stringify({reasoning:'The operator asked an ordinary question.',answer:'The second approved login answered.'}),
    session_id:'offline-b',usage:{input_tokens:10,output_tokens:20,cache_creation_input_tokens:0,cache_read_input_tokens:0}});
  }
  return {code,limited:false,stdout,stdoutBytes:Buffer.from(stdout)};
 }});`);
  writeFileSync(loader, `export async function resolve(specifier,context,next){
 if(context.parentURL?.endsWith('/journal-agent.mjs')){
  if(specifier.endsWith('/harness-user.mjs'))return {url:${JSON.stringify(pathToFileURL(harness).href)},shortCircuit:true};
  if(specifier.endsWith('/production-boot-io.mjs'))return {url:${JSON.stringify(pathToFileURL(io).href)},shortCircuit:true};
 }
 return next(specifier,context);
}

`);
  const preload = join(directory, 'jev.mjs');
  writeFileSync(preload, `globalThis.fetch=async()=>new Response(JSON.stringify({model:'jev-1.13.0',answers:Object.fromEntries(
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
      ...(mode === 'pool' ? ['--login-pool', manifest] : []), '--harness-user', 'offline-harness', '--operator-records', join(directory, 'operator-records'), '--model', world.model,
      '--bot-username', world.configuration.botUsername, '--max-cycles', '6', '--max-poll-seconds', '1'];
    const env = { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
      INSTAR_SECRET_PREVIEW_TYPESAFE_KEY: 'synthetic', INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: `http://127.0.0.1:${port}` };
    // Primary account activation uses its own authority too, even before the pool is built.
    args.push('--authority-record', logins[0].authority);
    const run = () => spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8', timeout: 30000, env });
    const first = run(); expect(first.status, first.stderr).toBe(0);
    if (!existsSync(calls)) {
      const observed = openPreviewJournal(join(root, 'journal.encrypted'), OFFLINE_STORAGE_KEY, undefined, undefined, true);
      const detail = observed.view.order.map(turn => ({ id: turn.id, held: turn.held, failure: turn.failureClass, state: turn.modelState }));
      observed.close();
      throw Error(first.stderr + JSON.stringify(detail));
    }
    const rows = readFileSync(calls, 'utf8').trim().split('\n').map(JSON.parse);
    expect(rows[0].account).toBe(mode === 'pool' ? 'serving-a' : 'serving-b'); expect(rows.slice(1).every(row => row.account === 'serving-b')).toBe(true);
    expect(rows.length).toBeGreaterThan(1);
    if (mode === 'pool') {
      const state = JSON.parse(readFileSync(join(root, 'harness-login-pool.json'), 'utf8'));
      expect(state.active).toBe(1); expect(state.switches).toHaveLength(1);
    } else {
      expect(existsSync(join(root, 'harness-login-pool.json'))).toBe(false);
      expect(existsSync(harnessLoginPath(JSON.parse(readFileSync(logins[0].profile, 'utf8')), join(directory, 'custody')))).toBe(true);
    }
    const sends = readFileSync(`${log}.sends`, 'utf8').trim().split('\n').map(JSON.parse);
    const diagnostic = openPreviewJournal(join(root, 'journal.encrypted'), OFFLINE_STORAGE_KEY, undefined, undefined, true);
    const detail = {modelCalls:diagnostic.view.modelCalls, calls:diagnostic.view.calls, limits:diagnostic.view.limits, turns:diagnostic.view.order.map(turn => ({ id: turn.id, held: turn.held, failure: turn.failureClass, state: turn.modelState, answer: turn.answer, notices: turn.answerNotices, reserved:turn.reserved, accepted:turn.accepted }))};
    diagnostic.close();
    expect(sends.filter(row => row.text.includes('next approved login')), JSON.stringify({ sends, detail, rows, stdout:first.stdout, stderr:first.stderr })).toHaveLength(mode === 'pool' ? 1 : 0);
    expect(sends.some(row => row.text.includes('second approved login answered'))).toBe(true);
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), OFFLINE_STORAGE_KEY, undefined, undefined, true);
    expect(journal.view.order[0].modelState).toBe(mode === 'pool' ? 'rejected' : 'complete'); journal.close();
    const before = readFileSync(calls, 'utf8');
    // Withdrawal of B's own sealed authority stops restart before any call; A's grant cannot substitute.
    writeFileSync(logins.at(-1).authority, '{}');
    const withdrawn = run(); expect(withdrawn.status).not.toBe(0); expect(withdrawn.stderr).toContain('refused to start or continue');
    expect(readFileSync(calls, 'utf8')).toBe(before);
  } finally {
    endpoint.kill('SIGTERM');
    await new Promise(resolve => endpoint.once('exit', resolve));
    rmSync(directory, { recursive: true, force: true });
  }
}, 45000);
