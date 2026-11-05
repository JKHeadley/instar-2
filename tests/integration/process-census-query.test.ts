import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { expect, it } from 'vitest';
// @ts-expect-error Physical read adapter is JavaScript.
import { readProcessCensus } from '../../scripts/process-census-query.mjs';
const metadata = '123 1 123 501 44 0:00.01 S Thu Nov 5 05:00:00 2026';
const source = (chunks: string[], code = 0) => () => {
  const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), kill: () => true });
  queueMicrotask(() => { chunks.forEach(c => child.stdout.write(c)); child.stdout.end(); child.emit('close', code); });
  return child;
};
it('retains complete rows and the same first4096 normalized command characters before accumulation', async () => {
  const command = 'node  --flag  '+('x'.repeat(200000));
  const input = metadata+'  '+command+'\n'+metadata.replace('123','124')+'  bash simple\n';
  const output = await readProcessCensus('/bin/ps', [], { spawnProcess: source([input.slice(0,63),input.slice(63,80000),input.slice(80000)]) });
  const expected = metadata+' '+command.trim().split(/\s+/u).join(' ').slice(0,4096)+'\n'+metadata.replace('123','124')+' bash simple\n';
  expect(output).toBe(expected);
});
it('retains UTF8 command prefixes across split buffers with original character semantics', async () => {
  const input=metadata+' '+('😀'.repeat(3000))+'\n';
  const bytes=Buffer.from(input);
  const child = () => {
    const c=Object.assign(new EventEmitter(),{stdout:new PassThrough(),kill:()=>true});
    queueMicrotask(()=>{c.stdout.write(bytes.subarray(0,65));c.stdout.write(bytes.subarray(65));c.emit('close',0)});return c;
  };
  expect(await readProcessCensus('/bin/ps',[],{spawnProcess:child})).toBe(metadata+' '+('😀'.repeat(3000)).slice(0,4096)+'\n');
});
it('keeps normalized materialization at its original bound and reports overflow as unknown', async () => {
  const failures: unknown[]=[];
  expect(await readProcessCensus('/bin/ps',[],{maxBytes:100,spawnProcess:source([metadata+' node first\n'+metadata+' node second\n']),onFailure:(x:unknown)=>failures.push(x)})).toBeNull();
  expect(failures).toEqual([expect.objectContaining({query:'process-census',code:'normalized-output-overflow'})]);
});
it('retains typed spawn failures without raw argv or environment', async () => {
  const failures: unknown[]=[];
  expect(await readProcessCensus('/bin/ps',['private-argv'],{spawnProcess:()=>{throw Object.assign(Error('private'),{code:'EAGAIN'})},onFailure:(x:unknown)=>failures.push(x)})).toBeNull();
  expect(failures).toEqual([expect.objectContaining({code:'EAGAIN'})]);
  expect(JSON.stringify(failures)).not.toMatch(/private/);
});
it('keeps timeout and nonzero status as failed reads', async () => {
  const failures: unknown[]=[];
  const silent=()=>Object.assign(new EventEmitter(),{stdout:new PassThrough(),kill:()=>true});
  expect(await readProcessCensus('/bin/ps',[],{timeoutMs:5,spawnProcess:silent,onFailure:(x:unknown)=>failures.push(x)})).toBeNull();
  expect(failures).toEqual([expect.objectContaining({code:'timeout'})]);
  expect(await readProcessCensus('/bin/ps',[],{spawnProcess:source([metadata+' node\n'],2)})).toBeNull();
  expect(await readProcessCensus('/bin/ps',[],{spawnProcess:source([],1)})).toBeNull();
  expect(await readProcessCensus('/bin/ps',[],{spawnProcess:source([],0)})).toBeNull();
});
