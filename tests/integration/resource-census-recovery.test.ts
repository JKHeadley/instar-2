import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
// @ts-expect-error Physical owner is JavaScript.
import { createResourceOwner, RESOURCE_CEILINGS, hostQuery } from '../../scripts/resource-owner.mjs';
// @ts-expect-error Physical process adapter is JavaScript.
import { PROCESS_CENSUS_COLUMNS } from '../../scripts/process-census-query.mjs';
import { createHostResourceAllocation } from '../preview/six-host-resources.js';
const oldRead = (file: string,args: string[], failures: string[]): Promise<string|null> => new Promise(resolve => {
  execFile(file,args,{timeout:2000,maxBuffer:1024*1024,env:{PATH:'/usr/bin:/bin'}},(error,stdout)=>{
    if (error && (typeof error.code!=='number'||error.code>1)) { failures.push(String(error.code));resolve(null); }
    else resolve(String(stdout));
  });
});
const drop = async (children: ChildProcess[]) => Promise.all(children.map(child=>new Promise<void>(resolve=>{
  if(child.exitCode!==null||child.signalCode!==null){resolve();return;}child.once('exit',()=>resolve());child.kill('SIGTERM');
})));
it('PREVIEW-RESOURCE-CENSUS-RECOVERY retains nine real Six debits on failed census, then same living owner verifies quiescence and admits the tenth', {timeout:120000}, async()=>{
  const root=mkdtempSync(join(tmpdir(),'resource-census-recovery-'));chmodSync(root,0o700);
  const noise: ChildProcess[]=[];
  try {
    for(let i=0;i<6;i++) {
      const child=spawn(process.execPath,['-e','setTimeout(()=>process.exit(0),110000);setInterval(()=>{},1000)','census-fixture-'+i+'x'.repeat(200000)],{stdio:'ignore',env:{PATH:'/usr/bin:/bin'}});
      noise.push(child);await new Promise<void>((resolve,reject)=>{child.once('spawn',()=>resolve());child.once('error',reject)});
    }
    const censusArgs=['-U',String(process.getuid!()),'-ww','-o',PROCESS_CENSUS_COLUMNS];
    const failures: string[]=[];
    expect(await oldRead('/bin/ps',censusArgs,failures)).toBeNull();
    expect(failures).toContain('ERR_CHILD_PROCESS_STDIO_MAXBUFFER');
    const compact=await hostQuery('/bin/ps',censusArgs);
    expect(compact).not.toBeNull();expect(Buffer.byteLength(compact)).toBeLessThan(1024*1024);
    const inventoryPids=new Set(compact.split('\n').map((line:string)=>Number(line.trim().split(' ')[0])));
    noise.forEach(child=>expect(inventoryPids.has(child.pid)).toBe(true));
    let repaired=false;
    const query=(file:string,args:string[])=>file==='/bin/ps'&&args.includes(PROCESS_CENSUS_COLUMNS)&&!repaired
      ? oldRead(file,args,failures):hostQuery(file,args);
    const allocation=createHostResourceAllocation({root,machine:'machine:census-fixture',ceilings:RESOURCE_CEILINGS,
      incarnation:`census-fixture:${process.pid}`,now:()=>Date.now(),monotonic:()=>performance.now()});
    const ledgerPath=join(root,'owned-launches.json');
    const owner=createResourceOwner();await owner.attach({ledgerPath,statePath:join(root,'resources.json'),allocation,query});
    const program=join(root,'quick.mjs');writeFileSync(program,'process.stdout.write("completed")');
    const input={executable:process.execPath,args:[program],cwd:root,env:{PATH:'/usr/bin:/bin'},stdin:'',timeout:15000,maxBytes:65536};
    for(let i=0;i<9;i++) {
      const result=await owner.execute(input,'answer');
      expect(result).toMatchObject({code:0,stdout:'completed',resources:{cleanup:'unresolved',allocation:{state:'reserved'}}});
    }
    expect(allocation.open()).toHaveLength(9);
    expect(Object.keys(JSON.parse(readFileSync(ledgerPath,'utf8')).launches)).toHaveLength(9);
    expect(await owner.execute({...input,timeout:150},'answer')).toMatchObject({code:null,limited:true,localLimit:'capacity'});
    expect(allocation.open()).toHaveLength(9); // failed census is still unknown
    const ownerBefore=JSON.parse(readFileSync(ledgerPath,'utf8')).launches;
    expect(new Set(Object.values(ownerBefore).map((x: unknown)=>(x as {owner:{pid:number}}).owner.pid))).toEqual(new Set([process.pid]));
    repaired=true; // same owner, same original ceilings and allocation authority
    const tenth=await owner.execute(input,'answer');
    expect(tenth).toMatchObject({code:0,stdout:'completed',resources:{cleanup:'verified',allocation:{state:'returned'}}});
    expect(owner.snapshot().counters.cleanupRecovered).toBe(9);
    expect(allocation.open()).toHaveLength(0);
    expect(JSON.parse(readFileSync(ledgerPath,'utf8')).launches).toEqual({});
    expect(owner.snapshot().outcomes).toContainEqual(expect.objectContaining({kind:'cleanup-reconciled',launches:9}));
    // The unrelated argv holders were fully inventoried and never signalled by the owner.
    noise.forEach(child=>expect(child.exitCode===null&&child.signalCode===null).toBe(true));
  } finally {await drop(noise);rmSync(root,{recursive:true,force:true});}
});
it('keeps the same owners debit while its real recorded descendant survives a denied cleanup', {timeout:30000}, async()=>{
  const root=mkdtempSync(join(tmpdir(),'resource-census-survivor-'));chmodSync(root,0o700);
  const ledgerPath=join(root,'owned-launches.json'),pidPath=join(root,'child-pid');
  let descendant: number|undefined;
  const held: {release:()=>Promise<void>}[]=[];
  try {
    const allocation=createHostResourceAllocation({root,machine:'machine:census-survivor',ceilings:RESOURCE_CEILINGS,
      incarnation:`census-survivor:${process.pid}`,now:()=>Date.now(),monotonic:()=>performance.now()});
    const owner=createResourceOwner();
    await owner.attach({ledgerPath,allocation,signal:()=>{throw Object.assign(Error('fixture denied'),{code:'EPERM'})}});
    const file=join(root,'parent.mjs');
    writeFileSync(file,`import {spawn} from 'node:child_process';import{writeFileSync}from'node:fs';const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'});writeFileSync(${JSON.stringify(pidPath)},String(c.pid));c.unref();process.stdout.write('parent finished');`);
    const input={executable:process.execPath,args:[file],cwd:root,env:{PATH:'/usr/bin:/bin'},stdin:'',timeout:15000,maxBytes:65536};
    expect(await owner.execute(input,'answer')).toMatchObject({code:0,resources:{cleanup:'unresolved',allocation:{state:'reserved'}}});
    descendant=Number(readFileSync(pidPath,'utf8'));expect(Number.isSafeInteger(descendant)).toBe(true);
    // These are actual Six reservations through the shipped API, never fake handles.
    for(let i=0;i<8;i++){const lease=await owner.hold('answer',{timeout:1000});expect(lease).not.toBeNull();held.push(lease)}
    expect(allocation.open()).toHaveLength(9);
    expect(await owner.execute({...input,timeout:200},'answer')).toMatchObject({localLimit:'capacity'});
    expect(owner.snapshot().counters.cleanupRecovered??0).toBe(0);
    expect(allocation.open()).toHaveLength(9);
    const rows=JSON.parse(readFileSync(ledgerPath,'utf8')).launches;
    expect(Object.values(rows).some((row:unknown)=>(row as {members:Record<string,string>}).members[String(descendant)])).toBe(true);
    process.kill(descendant,0); // positive physical survivor, not an assumed missing process
  } finally {
    await Promise.all(held.map(lease=>lease.release()));
    if(descendant){
      const rows=JSON.parse(readFileSync(ledgerPath,'utf8')).launches;
      const recorded=Object.values(rows).map((row:unknown)=>(row as {members:Record<string,string>}).members[String(descendant)]).find(Boolean);
      const now=await hostQuery('/bin/ps',['-p',String(descendant),'-o','lstart=']);
      if(recorded&&now?.trim().split(/\s+/u).join(' ')===recorded)process.kill(descendant,'SIGKILL');
    }
    rmSync(root,{recursive:true,force:true});
  }
});
