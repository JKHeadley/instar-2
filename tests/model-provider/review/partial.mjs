import assert from './assertions.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { providerFixture, value, enc } from '../fixture.ts';
import { effectFixture } from '../../effects/fixture.ts';
import { privateKey } from '../../facts/fixtures.ts';
import { localProvider } from '../http-provider.ts';
import { consumeResult, consumeOutcome } from '../../../src/index.js';
import { createEffectSettlementAssessmentPort } from '../../../src/verification/index.js';
import { createProviderEffectDoorway, registerProviderEffectBodies, providerEffectSchemas, providerEffectMigrations } from '../../../src/effects/index.js';
import { signEnvelope, decodeEnvelope, prepareSnapshot } from '../../../src/facts/index.js';
const status=r=>consumeResult(r,{Success:v=>({kind:'Success',value:v}),Refused:r=>({kind:'Refused',detail:r.detail})});
const raw=f=>f.body.record;
const count=f=>f.all().filter(f=>f.kind==='effect-provider-ProviderEffectSettlement').length;
function input(f,op){const rows=value(f.six.inspect()).filter(r=>r.record.type==='AdmissionReservation'&&r.record.operation===op);const r=rows.at(-1).record;return {request:{id:r.request,attempt:r.attempt,digest:r.digest,verificationBar:'provider-bar'},reservation:r,claim:rows.find(r=>r.record.state==='dispatch-claimed').fact.id,observations:f.all().filter(f=>f.kind==='effect-provider-ProviderOperationObservation'&&raw(f).operation===op).map(raw),plan:f.plan.id,bar:'provider-bar',generation:f.th.current().generation.id};}

async function fixture(fn){const http=await localProvider();try{const f=providerFixture(http);http.respond({state:'complete',bytes:JSON.stringify(f.decisionInput()),providerOperation:'real-http',usage:{inputTokens:1,outputTokens:1,charge:3,source:'http'},retryBlocked:false});const {prepared,request}=f.prepare();const observed=value(await f.api.dispatch(request,f.fence));return await fn(f,request,observed,prepared,http);}finally{await http.close();}}
function proof(f,q,o){f.evidence(o.operation,q.digest,'operation-occurred');f.evidence(o.operation,q.digest,'charge-settled',3);f.evidence(o.operation,q.digest,'old-executor-quiescent');}
export function registerCases(test) {
test('V22','unavailable unrelated historical capture cannot block clean independent settlement',()=>fixture((f,q,o)=>{proof(f,q,o);const a=value(f.api.assess(o.operation));const unrelated=f.evidence('unrelated-operation','unrelated-digest','operation-occurred');const cap=unrelated.capture;assert.ok(!f.vh.current().evidence.filter(e=>e.id!==unrelated.id).some(e=>e.capture.reference===cap.reference));const old=f.metadata[cap.reference];const bound=input(f,o.operation);const clean=status(f.nine.consumeEffectSettlementAssessment(a,bound,()=>true));assert.equal(clean.kind,'Success');f.metadata[cap.reference]={...old,status:'missing',bytes:null};const out=status(f.nine.consumeEffectSettlementAssessment(a,bound,()=>true));assert.equal(out.kind,'Success',JSON.stringify(out));return out;}));



}
