import { providerFixture,value } from '../fixture.ts';
const cut=process.env.ASTRA_CUT;
const kill=()=>{process.stdout.write(`ASTRA-CUT:${cut}\n`);process.kill(process.pid,'SIGKILL');};
globalThis.__astraAfterAppend=f=>{const r=f.body.record;const point=r?.type==='ProviderJudgmentRequest'?'seven-request':r?.type==='ProviderJudgmentAttemptRecord'?r.phase==='prepared'?'seven-prepared':'seven-receipt':r?.type==='ProviderEffectRequest'?'eight-request':r?.type==='AdmissionReservation'?r.state:r?.type==='ProviderOperationObservation'&&r.stage==='executor-accepted'?'executor-accepted':r?.type==='VerificationRequest'?'nine-request':r?.type==='ProviderJudgmentResolution'?'seven-resolution':'';if(point===cut)kill();};
globalThis.__astraAfterCapture=()=>{if(cut==='return-capture')kill();};
const f=providerFixture({directory:process.env.ASTRA_DIRECTORY,endpoint:process.env.ASTRA_ENDPOINT,credential:process.env.ASTRA_CREDENTIAL});
const {prepared,request}=f.prepare();const o=value(await f.api.dispatch(request,f.fence));f.evidence(o.operation,request.digest,'operation-occurred');f.evidence(o.operation,request.digest,'charge-settled',3);f.evidence(o.operation,request.digest,'old-executor-quiescent');const a=value(f.api.assess(o.operation)),s=value(f.api.settle(o.operation,a));value(f.six.settle(f.fence,s));value(f.seven.resolve(prepared.request,s,f.fence));throw new Error('cut not fired');
