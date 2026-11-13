// @ts-nocheck -- real pool, journal and installed binding; physical custody/resource observations injected.
import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installSigninRepair } from './installed-signin-repair.mjs';
import { createHarnessLoginPool } from './harness-login-pool.mjs';
import { openPreviewJournal } from './journal.js';
const roots = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const settle = async () => { for (let i = 0; i < 10; i++) await new Promise(resolve => setTimeout(resolve, 0)); };
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'signin-binding-')); roots.push(root);
  let now = 1000, quiet = true, releaseVerified = true, answer = 'complete';
  const calls = [];
  const journal = openPreviewJournal(join(root, 'journal'), new Uint8Array(32).fill(42), { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'fixture', configurationDigest: 'sha256:fixture', expires: 999999999, maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 131072, cursor: 0 });
  const entries = ['a','b'].map((name,index) => ({index,profile:{reference:name,expectedAccount:`${name}@example.invalid`,configDirectory:`/fixture/${name}`}}));
  const statePath = join(root, 'pool');
  const options = {configuration:{entries,identity:'fixture',threshold:95,current:()=>true},statePath,now:()=>now,machine:'local',validate:()=>{}};
  let pool = createHarnessLoginPool(options); pool.observeSignedOut(entries[0]); pool.select();
  const adapter = {normalSigninAuthorized:()=>true,profile:(entry,machine)=>({reference:entry.profile.reference,account:entry.profile.expectedAccount,machine,ownership:'agent',registered:true,revision:'r1'}),
    resumeRevision:()=>undefined,runNormal:async()=>{calls.push('normal');return answer;},quiescent:async()=>{calls.push('quiescent');return quiet;},cancel:()=>{},
    candidate:async target=>({reference:target.key,account:target.account,current:()=>true,identity:async()=>{calls.push('identity');return 'unknown';},use:async()=>true,publish:async()=>true,close:()=>{}})};
  const bind = extra => installSigninRepair({adapter,pool,entries,machine:'local',owner:'exact-launch',now:()=>now,stopped:()=>false,current:()=>true,eligible:()=>true,
    hold:async()=>({release:async()=>({verified:releaseVerified})}),journal,authority:'fixture',helper:()=>entries[1],recovered:()=>{},...extra});
  return {journal,calls,bind,get pool(){return pool;}, quiet(value){quiet=value;},release(value){releaseVerified=value;},answer(value){answer=value;},advance(ms){now+=ms;},
    interrupted(){const state=JSON.parse(readFileSync(statePath,'utf8'));state.signinRepairs[0].episode={phase:'attempting',owner:'old',attempts:1,startedAt:1000,nextAt:0};
      writeFileSync(statePath,JSON.stringify(state));pool=createHarnessLoginPool(options);
      journal.append({kind:'session-work',at:now,record:{type:'SessionWorkEdge',schemaVersion:1,id:'old',parent:'old-launch',child:'old-child',scope:'normal sign-in',owner:'local',authority:'fixture',
        budget:{steps:1,deadline:999999,maxResultBytes:1024,calls:1,tokens:null},exitTest:'verified outcome',placement:'local',transport:'normal-sign-in adapter',resultDestination:pool.signinRepairs()[0].key,openedAt:now}});
    }};
}
it.each([true,false])('prior child closes only after positive quiescence: %s', async quiet => {
  const f=fixture(); f.interrupted(); f.quiet(quiet); const runner=f.bind();
  try {runner.tick();await settle();await runner.close();expect(f.calls).not.toContain('normal');expect(f.calls).toContain('quiescent');
    expect(Boolean(f.journal.view.activeSessionWork.old)).toBe(!quiet);
    expect(f.pool.state.signinRepairs[0].episode.reason).toBe('uncertain');
    if(quiet)expect(f.journal.sessionWorkRecords().find(row=>row.type==='SessionWorkEdgeClose'&&row.edge==='old').state).toBe('uncertain');
  }finally{await runner.close();f.journal.close();}
});
it('unverified resource cleanup prevents another attempt even after cooldown',async()=>{
  const f=fixture();f.release(false);f.answer('retryable');const runner=f.bind();
  try{runner.tick();await settle();expect(f.calls.filter(x=>x==='normal')).toHaveLength(1);f.advance(5000);runner.tick();await settle();expect(f.calls.filter(x=>x==='normal')).toHaveLength(1);}
  finally{await runner.close();f.journal.close();}
});
it('indeterminate helper admission never claims no healthy login',async()=>{
  const f=fixture(),runner=f.bind({helper:()=> 'unavailable'});
  try{runner.tick();await settle();expect(f.pool.notices()).toEqual([]);expect(f.calls).toEqual([]);}
  finally{await runner.close();f.journal.close();}
});
it('default adapter is inert',async()=>{
  const f=fixture(),runner=f.bind({adapter:null});
  try{runner.tick();await runner.close();expect(f.calls).toEqual([]);expect(f.pool.state.signinRepairs[0].episode).toBeUndefined();}
  finally{f.journal.close();}
});
