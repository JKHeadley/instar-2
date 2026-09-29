import { providerFixture,value } from '../fixture.ts';
const cut=process.env.ASTRA_CUT;
const kill=()=>{process.stdout.write(`ASTRA-CUT:${cut}\n`);process.kill(process.pid,'SIGKILL');};
globalThis.__astraAfterAppend=f=>{const r=f.body.record;const point=r?.type==='ProviderJudgmentRequest'?'seven-request':r?.type==='ProviderJudgmentAttemptRecord'?r.phase==='prepared'?'seven-prepared':'seven-receipt':r?.type==='ProviderEffectRequest'?'eight-request':r?.type==='AdmissionReservation'?r.state:r?.type==='ProviderOperationObservation'&&r.stage==='executor-accepted'?'executor-accepted':r?.type==='VerificationRequest'?'nine-request':r?.type==='ProviderJudgmentResolution'?'seven-resolution':'';if(point===cut)kill();};
// The return-capture marker must mean a captured *successful* provider return. It fired
// after any putReserved, so a transport failure captured as an uncertain observation also
// fired it, and the parent then saw the cut marker and SIGKILL with zero server-observed
// requests. Gate it on the return the fixture actually observed.
let returned=false;
globalThis.__astraAfterCapture=()=>{if(cut==='return-capture'&&returned)kill();};
// The admitted 100 ms transport bound is the contract under test and must not move
// (`the admitted timeout bound cannot be widened by driver defaults` proves a driver
// default cannot widen it). In a freshly spawned child that bound was also paying for the
// one-time lazy initialisation of the HTTP client, so the call could abort before the
// server read it. Warm the client outside the bound: the fixture server refuses an
// unauthenticated probe before recording it, so the exactly-one-request assertion is
// untouched. docs/defects/model-provider-return-capture-flake.md, Rule 37.
await fetch(process.env.ASTRA_ENDPOINT).catch(()=>{});
const f=providerFixture({directory:process.env.ASTRA_DIRECTORY,endpoint:process.env.ASTRA_ENDPOINT,credential:process.env.ASTRA_CREDENTIAL,afterInvoke:()=>{returned=true;}});
const {prepared,request}=f.prepare();const o=value(await f.api.dispatch(request,f.fence));f.evidence(o.operation,request.digest,'operation-occurred');f.evidence(o.operation,request.digest,'charge-settled',3);f.evidence(o.operation,request.digest,'old-executor-quiescent');const a=value(f.api.assess(o.operation)),s=value(f.api.settle(o.operation,a));value(f.six.settle(f.fence,s));value(f.seven.resolve(prepared.request,s,f.fence));throw new Error('cut not fired');
