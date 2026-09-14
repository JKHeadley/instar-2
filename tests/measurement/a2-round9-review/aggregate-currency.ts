import {writeFileSync} from 'node:fs';
const {m,one,got,measurementA2Fixture:F}=await import(`${process.cwd()}/tests/measurement/a2-round4-review/common.ts`);
const f=F();const obs=[150,10000].map((ttl,i)=>{let o=f.planObservation({subject:'currency:one',sourceEvent:`currency:${i}`,amount:17,at:100,contract:f.eventProducer});f.evidence.splice(f.evidence.findIndex((e:any)=>e.id===o.sourceEvent),1);const evidence=f.admitEvidence(f.evidenceInput({id:o.sourceEvent,observedAt:o.at,freshFor:ttl,claim:o.evidence.claim}));o={...o,evidence,input:{...o.input,evidence}};f.persistObservation(o);return o;});
const h=f.snapshot(),before=f.quantity(obs,h,200),after=f.quantity(obs,h,300),raw={...f.aggregatePolicyInput,id:'aggregate:currency',sourceKind:'programmatic-count'},c=f.withRegistered(raw,f.c),policy=got(m.decodeAggregateMeasurementsPolicy(raw,c));
const req={policy,unit:'tokens',category:'input',dimensions:['feature'],producer:'probe',scope:'scope:ordinary',start:f.clock(0),end:f.clock(200),evaluationClock:f.clock(300),frontier:got(m.currentPeerHistoryBinding(h,c)).frontierDigest};
const earlierInput={...req,quantities:[before]},laterInput={...req,quantities:[after]};
const r={sameQuantityBytes:got(one.canonical(before)).bytes===got(one.canonical(after)).bytes,sameRequestBytes:got(one.canonical(earlierInput)).bytes===got(one.canonical(laterInput)).bytes,earlier:m.aggregateCurrentMeasurements(earlierInput,c),later:m.aggregateCurrentMeasurements(laterInput,c)};
writeFileSync(process.argv[2]!,JSON.stringify(r,null,2));console.log(JSON.stringify(r,null,2));
