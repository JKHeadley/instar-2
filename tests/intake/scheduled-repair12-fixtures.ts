import { decode } from '../../src/index.js';
import { authorAndAppend,createFactStore,signEnvelope } from '../../src/facts/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { json,value } from './fixtures.js';
import { scheduledOwnerContext,scheduledRepair6Setup } from './scheduled-repair6-fixtures.js';

export function distinctDirectiveAdmission() {
  const x=scheduledRepair6Setup(); x.f.bind();
  const context={ ...x.f.context.decode,grants:x.f.context.grants.map(row=>row.grant) };
  const first=value(decode('Directive',x.f.f.directiveInput(),context));
  const second=value(decode('Directive',x.f.f.directiveInput({ id:'directive:repair12-second',
    statement:'A second independent direction' }),context));
  Object.assign(x.f.context,{ schemas:[...x.f.context.schemas,{ ...x.f.f.schema,kind:'repair12-directives',fields:{
    first:{ kind:'constitutional' as const,type:'Directive' as const },
    second:{ kind:'constitutional' as const,type:'Directive' as const },
  } }] });
  const directive=value(authorAndAppend({ kind:'repair12-directives',schemaVersion:1,machine:'machine-a',
    principal:json(x.f.f.alice),provenance:json(x.f.f.alice.provenance),at:json(x.f.f.now),
    body:{ first:json(first),second:json(second) },required:[] },x.f.context,
  createFactStore(x.f.context,x.f.storage),x.f.deps.author.privateKey)).fact;
  const admitted=value(x.f.port().receiveScheduledTick(x.input));
  if(admitted.kind!=='scheduled-admitted') throw new Error('expected scheduled admission');
  return { ...x,directive,ids:[first.id,second.id].sort(),admitted };
}

export function missingRecognitionAdmission(mismatchResolution=false) {
  const x=scheduledRepair6Setup(); value(x.f.port().receiveScheduledTick(x.input));
  const original=x.f.frames.pop() as any,context=scheduledOwnerContext(x.f);
  const principal=x.f.facts().find(fact=>fact.kind==='intake-scheduled-principal')!;
  const resolution=x.f.facts().find(fact=>fact.kind==='intake-resolved')!;
  let replacement=resolution;
  if(mismatchResolution) {
    x.f.frames.pop();
    const body=structuredClone(resolution.body) as any; body.channel='mismatched:scheduled-channel';
    replacement=value(authorAndAppend({ kind:resolution.kind,schemaVersion:1,machine:'machine-a',
      principal:json(resolution.principal),provenance:json(resolution.provenance),at:json(resolution.at),body,
      required:resolution.predecessors.required },context,createFactStore(context,x.f.storage),
    x.f.deps.author.privateKey)).fact;
  }
  const required=original.predecessors.required.filter((id:string)=>id!==principal.id&&id!==resolution.id);
  if(mismatchResolution) required.push(replacement.id);
  const previous=x.f.frames.at(-1) as any;
  const candidate=x.f.f.next(previous,{ kind:original.kind,principal:original.principal,provenance:original.provenance,
    at:original.at,body:original.body,predecessors:{ ...original.predecessors,inSegment:previous.id,required } },context) as FactEnvelope;
  return { ...x,context,candidate };
}

export function laterDirectiveCopyAdmission() {
  const x=scheduledRepair6Setup(); x.f.bind();
  const context={ ...x.f.context.decode,grants:x.f.context.grants.map(row=>row.grant) };
  const directive=value(decode('Directive',x.f.f.directiveInput(),context));
  Object.assign(x.f.context,{ schemas:[...x.f.context.schemas,{ ...x.f.f.schema,kind:'repair12-directive-copy',fields:{
    directive:{ kind:'constitutional' as const,type:'Directive' as const },
  } }] });
  const appendCopy=()=>value(authorAndAppend({ kind:'repair12-directive-copy',schemaVersion:1,machine:'machine-a',
    principal:json(x.f.f.alice),provenance:json(x.f.f.alice.provenance),at:json(x.f.f.now),
    body:{ directive:json(directive) },required:[] },x.f.context,createFactStore(x.f.context,x.f.storage),
  x.f.deps.author.privateKey)).fact;
  const earlier=appendCopy(),later=appendCopy();
  const admitted=value(x.f.port().receiveScheduledTick(x.input));
  if(admitted.kind!=='scheduled-admitted') throw new Error('expected scheduled admission');
  const original=x.f.frames.pop() as any;
  const required=original.predecessors.required.filter((id:string)=>id!==earlier.id&&id!==later.id);
  required.push(later.id);
  const candidate=signEnvelope({ ...original,predecessors:{ ...original.predecessors,required } },
    x.f.deps.author.privateKey) as FactEnvelope;
  return { ...x,earlier,later,candidate,owner:admitted.owner };
}
