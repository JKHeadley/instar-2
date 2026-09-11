import { expect,it } from 'vitest';
import { decode } from '../../src/index.js';
import { authorAndAppend,createFactStore,signEnvelope,verifyAndAdmit } from '../../src/facts/index.js';
import { json,refused,value } from '../intake/fixtures.js';
import { scheduledOwnerContext,scheduledRepair6Setup } from '../intake/scheduled-repair6-fixtures.js';
import { extraScheduledEvidence,scheduledEvidenceBundle } from '../intake/scheduled-repair9-fixtures.js';

it.each(['single-missing','extra-available','extra-missing'] as const)
('P4-ST-49 V112 integration replication retains honest partial Evidence (%s)',mode=>{
  const x=scheduledRepair6Setup();
  let extraFact:ReturnType<typeof scheduledEvidenceBundle>|undefined,extraReference='reviewer:integration-extra';
  if(mode!=='single-missing') {
    const captureHash=x.f.f.capture('independent integration observation',extraReference); x.f.syncCaptures();
    const extra=value(decode('Evidence',{ ...json(x.discovery.evidence) as Record<string,unknown>,id:'reviewer:integration-extra',
      claim:{ subject:'other',predicate:'unrelated-observation',value:true },capture:{ reference:extraReference,hash:captureHash } },
    x.f.context.decode));
    extraFact=scheduledEvidenceBundle(x,{ evidence:extra });
  }
  value(x.f.port().receiveScheduledTick(x.input));
  const original=x.f.frames.pop() as any,context=scheduledOwnerContext(x.f);
  const required=extraFact?[...original.predecessors.required,extraFact.id]:original.predecessors.required;
  value(authorAndAppend({ kind:original.kind,schemaVersion:1,machine:'machine-a',principal:json(original.principal),
    provenance:json(original.provenance),at:json(original.at),body:original.body,required },context,
  createFactStore(context,x.f.storage),x.f.deps.author.privateKey));
  const candidate=x.f.frames.pop() as any,missing=mode==='extra-missing'?extraReference:x.discovery.evidence.capture.reference;
  const saved=x.f.f.captures[missing]; if(saved===undefined) throw new Error('expected saved capture');
  x.f.dropCapture(missing);
  expect(value(verifyAndAdmit(json(candidate),'machine-a',{ ...scheduledOwnerContext(x.f),facts:x.f.frames as any })).id)
    .toBe(candidate.id);
  x.f.f.captures[missing]=saved; x.f.syncCaptures();
  expect(value(verifyAndAdmit(json(candidate),'machine-a',{ ...scheduledOwnerContext(x.f),facts:x.f.frames as any })).id)
    .toBe(candidate.id);
});

it.each(['single','identical'] as const)
('P4-ST-47 V117 integration owner and replay deduplicate immutable discovery identity (%s)',mode=>{
  const x=scheduledRepair6Setup(),bundle=scheduledEvidenceBundle(x,mode==='single'
    ?{ a:x.discovery.evidence }:{ a:x.discovery.evidence,b:x.discovery.evidence });
  value(x.f.port().receiveScheduledTick(x.input));
  const original=x.f.frames.pop() as any,resolution=x.f.frames.pop() as any;
  const context=scheduledOwnerContext(x.f),store=createFactStore(context,x.f.storage);
  const replacement=value(authorAndAppend({ kind:resolution.kind,schemaVersion:1,machine:'machine-a',principal:json(resolution.principal),
    provenance:json(resolution.provenance),at:json(resolution.at),body:resolution.body,
    required:resolution.predecessors.required.map((id:string)=>id===x.discovery.fact.id?bundle.id:id) },context,store,
  x.f.deps.author.privateKey)).fact;
  const required=original.predecessors.required.map((id:string)=>id===x.discovery.fact.id?bundle.id:id===resolution.id?replacement.id:id);
  const signed=signEnvelope({ ...original,predecessors:{ ...original.predecessors,required,inSegment:replacement.id },
    prevInSegment:replacement.contentHash },x.f.deps.author.privateKey);
  const replay=verifyAndAdmit(json(signed),'machine-a',{ ...context,facts:x.f.frames as any });
  const appended=authorAndAppend({ kind:original.kind,schemaVersion:1,machine:'machine-a',principal:json(original.principal),
    provenance:json(original.provenance),at:json(original.at),body:original.body,required },context,store,
  x.f.deps.author.privateKey);
  if(mode==='single') {
    expect(value(replay).id).toBe(original.id);
    expect(value(appended).taint).toEqual([]);
  } else {
    refused(replay,'unsupported-in-slice-a');
    refused(appended,'unsupported-in-slice-a');
  }
});
