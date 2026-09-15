import assert from './assertions.mjs';import {spawn} from 'node:child_process';import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {fileURLToPath} from 'node:url';
import {providerFixture,value,enc} from '../fixture.ts';import {localProvider} from '../http-provider.ts';import {fixture as typesFixture} from '../../fixtures.ts';import {consumeResult} from '../../../src/index.js';
const status=r=>consumeResult(r,{Success:v=>({kind:'Success',value:v}),Refused:r=>({kind:'Refused',detail:r.detail})});
export const cuts=['seven-request','seven-prepared','eight-request','prepared','dispatch-claimed','consumed','executor-accepted','return-capture','seven-receipt','nine-request','seven-resolution'];
export async function runCut(cut) {const http=await localProvider(),directory=mkdtempSync(join(tmpdir(),'astra-provider-cut-'));try{http.respond({state:'complete',bytes:JSON.stringify(typesFixture().decisionInput()),providerOperation:'cut-http',usage:{inputTokens:1,outputTokens:1,charge:3,source:'http'},retryBlocked:false});const killed=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--loader',fileURLToPath(new URL('./cut-loader.mjs',import.meta.url)),fileURLToPath(new URL('./cut-worker.mjs',import.meta.url))],{env:{...process.env,ASTRA_CUT:cut,ASTRA_DIRECTORY:directory,ASTRA_ENDPOINT:http.endpoint,ASTRA_CREDENTIAL:http.credential},stdio:['ignore','pipe','pipe']});let output='';const timer=setTimeout(()=>child.kill('SIGKILL'),180000);child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);child.on('error',reject);child.on('exit',(code,signal)=>{clearTimeout(timer);resolve({code,signal,output});});});assert.ok(killed.output.includes(`ASTRA-CUT:${cut}`),killed.output);assert.equal(killed.signal,'SIGKILL');const expected=['return-capture','seven-receipt','nine-request','seven-resolution'].includes(cut)?1:0;assert.equal(http.requests.length,expected);const f=providerFixture({directory,...http});const pending=value(f.graph.read(f.id));assert.equal(pending.pending.length,1);if(cut==='seven-request') {
 const before=f.all().length;
 assert.equal(status(f.seven.prepare({...f.question,context:'changed after crash'},f.fence)).kind,'Refused');
 f.generation('changed-generation');
 assert.equal(status(f.seven.prepare(f.question,f.fence)).kind,'Refused');
 f.generation(f.run.generation.id);
 assert.equal(f.all().length,before);
}
let prepared;try{prepared=f.prepare();}catch(e){prepared={error:String(e)};}
 const reservations=value(f.six.inspect()).filter(r=>r.record.type==='AdmissionReservation');const final=reservations.at(-1)?.record;
 let replay=null;if(expected||['dispatch-claimed','consumed','executor-accepted'].includes(cut)){assert.ok(final);if(!prepared.error){replay=status(await f.api.dispatch(prepared.request,f.fence));assert.equal(replay.kind,'Refused');}assert.equal(http.requests.length,expected);}
 if(cut!=='seven-resolution'){assert.equal(f.all().filter(f=>f.kind==='judgment-provider-ProviderJudgmentResolution').length,0);}if(cut==='seven-request') assert.ok(!prepared.error, 'valid preparation cannot resume after request-only cut: '+prepared.error);const row={cut,passed:true,calls:expected,pending:1,reservation:final?.state,preparation:prepared.error??'readable',replay:replay?.kind,signal:killed.signal};return row;
 } finally {await http.close();}
}
