import { execFileSync } from 'node:child_process';
import { beforeAll, expect, it } from 'vitest';

let result: Record<string, any>;

beforeAll(() => {
  const script = String.raw`
    import { createHash } from 'node:crypto';
    import { execFileSync } from 'node:child_process';
    import { canonical, consumeResult, decode, decodeMeasurement } from './dist/index.js';
    import * as m from './dist/measurement/index.js';
    import * as decodeModule from './dist/measurement/decode.js';
    import { checkP16Coverage, p16Dispositions } from './scripts/check-p16-contract-map.mjs';
    const take = r => consumeResult(r, { Success: v => v, Refused: x => { throw new Error(x.detail); } });
    const kind = r => consumeResult(r, { Success: () => 'Success', Refused: x => 'Refused:' + x.detail });
    const binding = raw => 'measurement-content:' + take(canonical(raw)).hash;
    const model = { type:'MeasurementProducerContract',schemaVersion:2,id:'producer:model',family:'model-call',
      subjectKind:'model-token',producer:'probe',categories:[{name:'input',unit:'tokens',relation:'standalone'}],
      evidencePredicate:'usage-observed',sourceSampleRequired:true,hardwareProfileRequired:false };
    const event = { ...model,id:'producer:event',family:'programmatic-event',subjectKind:'programmatic-count',
      evidencePredicate:'event-observed' };
    const resource = { ...model,id:'producer:resource',family:'resource',subjectKind:'process-resource',
      categories:[{name:'cpu',unit:'ms',relation:'standalone'},{name:'rss',unit:'bytes',relation:'standalone'}],
      evidencePredicate:'resource-observed',hardwareProfileRequired:true };
    const cache = { type:'ReadCachePolicy',schemaVersion:2,id:'cache:fixture',maxRows:2,maxBytes:1024,maxAgeMs:1000,evictionBatch:1 };
    const rule = {className:'agent-worker',requiredTags:['worker']};
    const records = [model,event,resource,cache];
    const entries = ['types.decode','probe','machine-a','machine-b','producer:model','producer:event','producer:resource',
      'usage-observed','event-observed','resource-observed','cache:fixture','hardware:m1','classifier:v1','agent-worker','feature-a',
      'feature-action-observed',
      ...records.map(binding),binding(rule)];
    const register = { generation:{owner:'part-three',name:'RegisterGeneration',id:'generation:1'},entries,
      producers:['probe'],methods:[],actions:{},subjects:{clock:['unix-ms'],'model-token':['tokens'],
      'programmatic-count':['tokens'],'process-resource':['ms','bytes']},sites:{'types.decode':'closed'},keys:{},
      allowRedelegation:false,conflictStanding:{ordinary:'delegate',authority:'operator'} };
    const clockRaw = (at, machine='machine-a') => ({type:'Measurement',schemaVersion:1,
      subject:{kind:'clock',instance:machine},value:at,unit:'unix-ms',at,by:'probe'});
    const captures = {'capture:evidence':'observed bytes'};
    const types = {register,preserved:'capture:input',captures,evidence:[]};
    const context = {site:'types.decode',preserved:'capture:input',register,types,
      registeredContracts:Object.fromEntries(records.map(raw=>[raw.id,binding(raw)]))};
    const clock = at => take(decodeMeasurement('clock',clockRaw(at),types));
    const modelContract=take(m.decodeMeasurementProducerContract(model,context));
    const resourceContract=take(m.decodeMeasurementProducerContract(resource,context));
    const point=(id,at,rss)=>({id,machine:'machine-a',processIncarnation:'p:1',sourceSample:'sample:'+at,at:clock(at),
      hardwareProfile:'hardware:m1',classifierGeneration:'classifier:v1',cadenceMs:60,state:'observed',cpuTimeMs:50,
      monotonicIntervalMs:100,rssBytes:rss,heapBytes:null,heapState:'unsupported'});
    const captureHash='sha256:'+createHash('sha256').update('observed bytes').digest('hex');
    const evidence=(id,value)=>take(decode('Evidence',{type:'Evidence',schemaVersion:1,id,claim:{subject:'feature-a',
      predicate:'feature-action-observed',value},source:'probe',observedAt:clock(100),freshFor:10,
      capture:{reference:'capture:evidence',hash:captureHash},strength:'proof'},types));
    const fired=evidence('fired:e2e','fired'), noop=evidence('noop:e2e','no-op');
    const execution=take(decode('Evidence',{type:'Evidence',schemaVersion:1,id:'execution:e2e',claim:{subject:'run:a',
      predicate:'execution-observed',value:{hardware:'m1',workload:'w1'}},source:'probe',observedAt:clock(100),freshFor:10,
      capture:{reference:'capture:evidence',hash:captureHash},strength:'proof'},types));
    const competingExecution=take(decode('Evidence',{type:'Evidence',schemaVersion:1,id:'execution:e2e',claim:{subject:'run:a',
      predicate:'execution-observed',value:{hardware:'m2',workload:'w1'}},source:'probe',observedAt:clock(100),freshFor:10,
      capture:{reference:'capture:evidence',hash:captureHash},strength:'proof'},types));
    const conflictFired=evidence('feature:conflict:e2e','fired');
    const conflictNoop=evidence('feature:conflict:e2e','no-op');
    const feature={kind:'exchange',classifier:'complete',actionProved:true,negativeProved:false,gradeOnly:false,
      feature:'feature-a',action:'feature-action-observed',evaluationClock:clock(100)};
    const descriptor={processIncarnation:'p:1',pid:7,startEvidence:'s:1',tags:['worker']};
    const second={processIncarnation:'p:2',pid:8,startEvidence:'s:2',tags:[]};
    const invented={...model,categories:[{name:'fictional-token',unit:'tokens',relation:'standalone'}]};
    const changedContext={...context,registeredContracts:{...context.registeredContracts,[invented.id]:binding(invented)}};
    const sampled={...model,id:'producer:quota',family:'quota',subjectKind:'quota',
      categories:[{name:'value',unit:'percent',relation:'standalone'}]};
    const sampledRegister={...register,entries:[...entries,sampled.id,binding(sampled)],
      subjects:{...register.subjects,quota:['percent']}};
    const sampledContext={...context,register:sampledRegister,types:{...types,register:sampledRegister},
      registeredContracts:{...context.registeredContracts,[sampled.id]:binding(sampled)}};
    const claim={kind:'recorded-execution',hardware:'m1',workload:'w1',evidence:['execution:e2e']};
    const incompleteExecution={id:'execution:e2e',observedAt:{value:100},freshFor:10,
      claim:{predicate:'execution-observed',value:{hardware:'m1',workload:'w1'}}};
    const withdrawnRegister={...register,entries:entries.filter(id=>id!=='feature-action-observed')};
    const burnEqual={type:'BurnPolicy',schemaVersion:2,id:'burn:equal',version:'v1',feature:'feature-a',unit:'tokens',
      selections:[{id:'selection:model-exchange',version:'v1',source:'model-exchange',categories:['input'],formula:'sum',
        outputUnit:'tokens',missingCategory:'no-amount'},{id:'selection:programmatic-event',version:'v1',
        source:'programmatic-event',categories:['input'],formula:'sum',outputUnit:'tokens',missingCategory:'no-amount'}],
      minimumEligibleSamples:1,minimumUsageCoverage:.7,entryExcess:50,entryShare:.5,
      recoveryExcess:50,recoveryShare:.5,recoveryWindows:2};
    const burnRegister={...register,entries:[...entries,burnEqual.id,burnEqual.feature,
      'selection:model-exchange','selection:programmatic-event',binding(burnEqual)]};
    const burnContext={...context,register:burnRegister,types:{...types,register:burnRegister},
      registeredContracts:{...context.registeredContracts,[burnEqual.id]:binding(burnEqual)}};
    const rows=p16Dispositions();
    const markers={1:'contract-inventory',3:'registration-current-content',5:'measured-claim',
      22:'quota-coalescing',23:'observational-port',24:'rate-event-populations',25:'cpu-and-byte',
      26:'process-incarnation',27:'limit-plus-one-census',28:'classified-and-unclassified',29:'resource-trend',
      30:'fired-and-no-op',52:'non-executable-exclusion',53:'legacy-additivity'};
    const assertions=rows.filter(row=>!row.status.startsWith('NON-EXECUTABLE')).map(row=>({
      fullName:row.id+' [behavior:'+markers[row.number]+']',title:row.id+' [behavior:'+markers[row.number]+']',status:'passed'}));
    assertions.push({fullName:'P16-NF-04 falsely passed',title:'ordinary passing assertion',status:'passed'});
    const blockedReport={success:true,testResults:['measurement/foundation','integration/measurement','e2e/measurement'].map(name=>({
      name:process.cwd()+'/tests/'+name+'.test.ts',assertionResults:assertions}))};
    const coverageBlocked=(()=>{try{checkP16Coverage(blockedReport);return'accepted';}catch{return'refused';}})();
    const out={
      inventory:p16Dispositions().length,
      cache:take(m.decodeReadCachePolicy(cache,context)).id,
      cacheMissing:kind(m.decodeReadCachePolicy(cache,{...context,register:{...register,entries:entries.filter(x=>x!==cache.id)}})),
      substituted:kind(m.decodeMeasurementProducerContract(invented,changedContext)),
      sampleDisabled:kind(m.decodeMeasurementProducerContract({...sampled,sourceSampleRequired:false},sampledContext)),
      claimTarget:take(m.renderMeasurementClaim({kind:'target',hardware:null,workload:null,evidence:[]},context)),
      claimMeasured:take(m.renderMeasurementClaim(claim,
        {...context,types:{...types,evidence:[execution]}})),
      claimCompeting:kind(m.renderMeasurementClaim(claim,
        {...context,types:{...types,evidence:[execution,competingExecution]}})),
      claimCompetingReversed:kind(m.renderMeasurementClaim(claim,
        {...context,types:{...types,evidence:[competingExecution,execution]}})),
      claimEqualReplay:take(m.renderMeasurementClaim(claim,
        {...context,types:{...types,evidence:[execution,execution]}})),
      claimCopied:kind(m.renderMeasurementClaim(claim,{...context,types:{...types,evidence:[structuredClone(execution)]}})),
      claimIncomplete:kind(m.renderMeasurementClaim(claim,{...context,types:{...types,evidence:[incompleteExecution]}})),
      quota:take(m.coalesceUnknownQuotaEpisodes(['account','account'],[],context)),
      port:Object.keys(m.createMeasurementLedger(context)).sort(),
      rate:take(m.summarizeRateLimitEvents([{id:'open',source:'breaker',kind:'circuit-open',at:clock(0)},
        {id:'quota',source:'session-sentinel',kind:'quota',at:clock(0)}],clock(0),clock(3600000),context)).counts,
      cpu:[take(m.cpuUtilization(point('cpu',100,100),4,'one-core',context)),take(m.cpuUtilization(point('cpu',100,100),4,'whole-machine',context))],
      fractionalBytes:kind(m.admitMeasurementAmount({contract:resourceContract,category:'rss',amount:.5},context)),
      process:[take(m.reconcileProcessIncarnation(descriptor,null,context)),kind(m.reconcileProcessIncarnation(descriptor,false,context))],
      census:take(m.planProcessCensus([descriptor,second],1,context)),
      censusConflict:kind(m.planProcessCensus([descriptor,{...second,pid:7}],2,context)),
      classes:take(m.classifyProcesses([descriptor,second],[rule],context)),
      classPidConflict:kind(m.classifyProcesses([descriptor,{...second,pid:7}],[rule],context)),
      classChanged:kind(m.classifyProcesses([descriptor],[{...rule,requiredTags:['changed']}],context)),
      trend:take(m.resourceTrend([point('r1',100,100),point('r2',160,110)],2,context)),
      trendConflict:kind(m.resourceTrend([point('r1',100,100),point('r1',160,110)],2,context)),
      fired:take(m.classifyFeatureOutcome({...feature,evidence:fired},{...context,types:{...types,evidence:[fired]}})),
      noop:take(m.classifyFeatureOutcome({...feature,actionProved:false,negativeProved:true,evidence:noop},{...context,types:{...types,evidence:[noop]}})),
      competingFeature:kind(m.classifyFeatureOutcome({...feature,evidence:conflictFired},
        {...context,types:{...types,evidence:[conflictFired,conflictNoop]}})),
      competingFeatureReversed:kind(m.classifyFeatureOutcome({...feature,evidence:conflictFired},
        {...context,types:{...types,evidence:[conflictNoop,conflictFired]}})),
      competingFeatureSelectNegative:kind(m.classifyFeatureOutcome({...feature,actionProved:false,negativeProved:true,
        evidence:conflictNoop},{...context,types:{...types,evidence:[conflictFired,conflictNoop]}})),
      equalFeatureReplay:take(m.classifyFeatureOutcome({...feature,evidence:conflictFired},
        {...context,types:{...types,evidence:[conflictFired,conflictFired]}})),
      copiedEvidence:(()=>{const copied=structuredClone(fired);
        return kind(m.classifyFeatureOutcome({...feature,evidence:copied},
          {...context,types:{...types,evidence:[copied]}}));})(),
      alteredCopiedEvidence:(()=>{const copied=structuredClone(fired);const altered={...copied,claim:{...copied.claim,value:'no-op'}};
        return kind(m.classifyFeatureOutcome({...feature,actionProved:false,negativeProved:true,evidence:altered},
          {...context,types:{...types,evidence:[altered]}}));})(),
      absent:take(m.classifyFeatureOutcome({...feature,classifier:'absent',actionProved:false,action:null},context)),
      malformedEvidence:kind(m.classifyFeatureOutcome({...feature,evidence:false},context)),
      foreignClockEvidence:kind(m.classifyFeatureOutcome({...feature,evaluationClock:take(decodeMeasurement('clock',clockRaw(100,'machine-b'),types)),evidence:fired},
        {...context,types:{...types,evidence:[fired]}})),
      actionWithdrawn:kind(m.classifyFeatureOutcome({...feature,evidence:fired},{...context,register:withdrawnRegister,
        types:{...types,register:withdrawnRegister,evidence:[fired]}})),
      burnEqual:kind(m.decodeBurnPolicy(burnEqual,burnContext)),
      coverageBlocked,
      blocked:p16Dispositions().filter(row=>row.status==='NON-EXECUTABLE-UNTIL-slice-A2').length,
      additivity:execFileSync(process.execPath,['scripts/check-p16-additivity.mjs'],{encoding:'utf8'}),
      decodeExports:Object.keys(decodeModule).sort(),modelAmount:take(m.admitMeasurementAmount({contract:modelContract,category:'input',amount:1},context),)
    };
    process.stdout.write(JSON.stringify(out));
  `;
  result = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: process.cwd(), encoding: 'utf8',
  })) as Record<string, any>;
}, 30_000);

it('P16-NF-01 [behavior:contract-inventory] validates all 53 labels in a fresh process', () => expect(result.inventory).toBe(53));
it('P16-NF-03 [behavior:registration-current-content] rejects missing identity, replacement content, and disabled sampled identity in a fresh process', () => expect(result).toMatchObject({ cache: 'cache:fixture', cacheMissing: expect.stringContaining('Refused'), substituted: expect.stringContaining('Refused'), sampleDisabled: expect.stringContaining('Refused') }));
it('P16-NF-05 [behavior:measured-claim] distinguishes admitted execution from copied, conflicting, and malformed proof in a fresh process', () => expect(result).toMatchObject({ claimTarget: 'target: not measured', claimMeasured: expect.stringContaining('measured execution'), claimCompeting: expect.stringContaining('Refused'), claimCompetingReversed: expect.stringContaining('Refused'), claimEqualReplay: expect.stringContaining('measured execution'), claimCopied: expect.stringContaining('Refused'), claimIncomplete: expect.stringContaining('Refused') }));
it('P16-NF-22 [behavior:quota-coalescing] coalesces repeated missing-state observations in a fresh process', () => expect(result.quota).toEqual({ notices: ['account'], open: ['account'] }));
it('P16-NF-23 [behavior:observational-port] exposes only the observational holder port in a fresh process', () => expect(result).toMatchObject({ port: ['admitAmount', 'owner', 'trend'] }));
it('P16-NF-24 [behavior:rate-event-populations] executes breaker and session rate populations in a fresh process', () => expect(result.rate).toEqual({ 'circuit-open': 1, quota: 1 }));
it('P16-NF-25 [behavior:cpu-and-byte] executes CPU normalization and byte admission in a fresh process', () => expect(result).toMatchObject({ cpu: [50, 12.5], fractionalBytes: expect.stringContaining('Refused') }));
it('P16-NF-26 [behavior:process-incarnation] executes typed absence and malformed process input in a fresh process', () => expect(result.process).toEqual(['missing', expect.stringContaining('Refused')]));
it('P16-NF-27 [behavior:limit-plus-one-census] executes bounded census and PID conflict controls in a fresh process', () => expect(result).toMatchObject({ census: { examined: 1, omitted: 1, truncated: true }, censusConflict: expect.stringContaining('Refused') }));
it('P16-NF-28 [behavior:classified-and-unclassified] executes registered classifier content in a fresh process', () => expect(result).toMatchObject({ classes: { counts: { 'agent-worker': 1 }, unclassified: 1 }, classChanged: expect.stringContaining('Refused'), classPidConflict: expect.stringContaining('Refused') }));
it('P16-NF-29 [behavior:resource-trend] executes complete and conflicting trend identities in a fresh process', () => expect(result).toMatchObject({ trend: { state: 'complete', rssDeltaBytes: 10 }, trendConflict: expect.stringContaining('Refused') }));
it('P16-NF-30 [behavior:fired-and-no-op] executes admitted, conflicting, and copied evidence controls in a fresh process', () => expect(result).toMatchObject({ fired: 'fired', noop: 'no-op', competingFeature: expect.stringContaining('Refused'), competingFeatureReversed: expect.stringContaining('Refused'), competingFeatureSelectNegative: expect.stringContaining('Refused'), equalFeatureReplay: 'fired', copiedEvidence: expect.stringContaining('Refused'), alteredCopiedEvidence: expect.stringContaining('Refused'), absent: 'unclassified', malformedEvidence: expect.stringContaining('Refused'), foreignClockEvidence: expect.stringContaining('Refused'), actionWithdrawn: expect.stringContaining('Refused') }));
it('P16-NF-52 [behavior:non-executable-exclusion] excludes all structural A2 rows and passed blocked claims in a fresh process', () => expect(result).toMatchObject({ blocked: 16, coverageBlocked: 'refused', burnEqual: expect.stringContaining('Refused') }));
it('P16-NF-53 [behavior:legacy-additivity] verifies first-landing scope inapplicability in a fresh process', () => expect(result.additivity).toContain('first-landing additivity inapplicable'));

it('round6 finding 11 fresh emitted module contains no retired A2 validation exports', () => {
  for (const name of ['isDecodedMeasurementReadQuery', 'isDecodedReadCachePolicy',
    'isCurrentAggregateMeasurementsPolicy', 'isCurrentMeasurementTuple', 'isCurrentBurnPolicy'])
    expect(result.decodeExports).not.toContain(name);
});
