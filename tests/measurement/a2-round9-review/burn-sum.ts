import {writeFileSync} from 'node:fs';
const {m,got,measurementA2Fixture:F,closed}=await import(`${process.cwd()}/tests/measurement/a2-round4-review/common.ts`);
const out:any[]=[];
for(const large of [false,true])for(const reverse of [false,true]){
 const f=F();const amounts=[large?Number.MAX_SAFE_INTEGER:10,1,1,1];
 const base=f.planObservation({subject:'sum:baseline',sourceEvent:'sum:b',amount:1,at:50,contract:f.eventProducer});f.persistObservation(base);
 const rows=amounts.map((amount,i)=>f.planObservation({subject:`sum:${i}`,sourceEvent:`sum:e:${i}`,amount,at:250,contract:f.eventProducer}));rows.forEach(f.persistObservation);
 const ordered=reverse?[...rows].reverse():rows;
 const plan=(id:string,start:number,rs:any[],sum:number)=>f.persistBurnWindow({id,start,end:start+200,samples:rs.map(o=>({identity:o.subject,feature:'feature-a',source:'programmatic-event',observations:[o]})),comparisonScopeAmount:sum});
 const b=plan('sum:base',0,[base],1),c=plan('sum:current',200,ordered,ordered.reduce((n,o)=>n+o.amount,0)),h=f.snapshot();
 const win=(p:any)=>got(m.createCurrentBurnWindow({window:p.build(h),sourceHistory:h},f.c));
 const actual=m.evaluateCurrentBurn(f.burnPolicy(),closed,win(c),[win(b)],f.c);
 const expected=amounts.reduce((n,x)=>n+BigInt(x),0n).toString();
 out.push({large,reverse,expectedExactAmount:expected,actual,pass:actual.kind==='Refused'||BigInt(got(actual).currentAmount).toString()===expected});
}
writeFileSync(process.argv[2]!,JSON.stringify(out,null,2));console.log(JSON.stringify(out.map(r=>({large:r.large,reverse:r.reverse,pass:r.pass,expected:r.expectedExactAmount,kind:r.actual.kind,amount:r.actual.value?.currentAmount})),null,2));
