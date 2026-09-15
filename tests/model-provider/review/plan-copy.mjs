import assert from './assertions.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { providerFixture, value, enc } from '../fixture.ts';
import { effectFixture } from '../../effects/fixture.ts';
import { privateKey } from '../../facts/fixtures.ts';
import { localProvider } from '../http-provider.ts';
import { consumeResult, consumeOutcome } from '../../../src/index.js';
import { createEffectSettlementAssessmentPort } from '../../../src/verification/index.js';
import { createProviderEffectDoorway, registerProviderEffectBodies, providerEffectSchemas, providerEffectMigrations } from '../../../src/effects/index.js';
import { signEnvelope, decodeEnvelope, prepareSnapshot, authorAndAppend } from '../../../src/facts/index.js';
const status=r=>consumeResult(r,{Success:v=>({kind:'Success',value:v}),Refused:r=>({kind:'Refused',detail:r.detail})});
const raw=f=>f.body.record;
const count=f=>f.all().filter(f=>f.kind==='effect-provider-ProviderEffectSettlement').length;
function input(f,op){const rows=value(f.six.inspect()).filter(r=>r.record.type==='AdmissionReservation'&&r.record.operation===op);const r=rows.at(-1).record;return {request:{id:r.request,attempt:r.attempt,digest:r.digest,verificationBar:'provider-bar'},reservation:r,claim:rows.find(r=>r.record.state==='dispatch-claimed').fact.id,observations:f.all().filter(f=>f.kind==='effect-provider-ProviderOperationObservation'&&raw(f).operation===op).map(raw),plan:f.plan.id,bar:'provider-bar',generation:f.th.current().generation.id};}

async function fixture(fn){const http=await localProvider();try{const f=providerFixture(http);http.respond({state:'complete',bytes:JSON.stringify(f.decisionInput()),providerOperation:'real-http',usage:{inputTokens:1,outputTokens:1,charge:3,source:'http'},retryBlocked:false});const {prepared,request}=f.prepare();const observed=value(await f.api.dispatch(request,f.fence));return await fn(f,request,observed,prepared,http);}finally{await http.close();}}
function proof(f,q,o){f.evidence(o.operation,q.digest,'operation-occurred');f.evidence(o.operation,q.digest,'charge-settled',3);f.evidence(o.operation,q.digest,'old-executor-quiescent');}
export function registerCases(test) {
for(const different of [false,true]) test(different?'V24':'V23',different?'genuinely conflicting signed plan references refuse':'identical signed plan copy must preserve current assessment acceptance',()=>fixture((f,q,o)=>{proof(f,q,o);const a=value(f.api.assess(o.operation)),i=input(f,o.operation);const before=status(f.nine.consumeEffectSettlementAssessment(a,i,()=>true));assert.equal(before.kind,'Success');const planFact=f.all().find(f=>f.kind==='verification-VerificationPlan');const record=different?{...planFact.body.record,bar:{...planFact.body.record.bar,freshness:99}}:planFact.body.record;value(authorAndAppend({kind:'verification-VerificationPlan',schemaVersion:1,machine:f.th.machine,principal:JSON.parse(JSON.stringify(f.th.principal)),provenance:JSON.parse(JSON.stringify(f.th.principal.provenance)),at:JSON.parse(JSON.stringify(f.clock(100))),body:{record},required:[]},f.context,f.store,privateKey));const out=status(f.nine.consumeEffectSettlementAssessment(a,i,()=>true));assert.equal(out.kind,different?'Refused':'Success',JSON.stringify(out));return out;}));


}
