import { decode } from '../../src/index.js';
import { authorAndAppend,createFactStore } from '../../src/facts/index.js';
import { json,value } from './fixtures.js';
import { scheduledOwnerContext,scheduledRepair6Setup } from './scheduled-repair6-fixtures.js';
import { scheduledFixture } from './scheduled-fixtures.js';

export function mismatchedSourceDiscoveryBundle(f: ReturnType<typeof scheduledFixture>,
  discovery: ReturnType<ReturnType<typeof scheduledFixture>['discovery']>) {
  const second=value(decode('Evidence',{
    ...json(discovery.evidence) as Record<string,unknown>,
    id:'repair16:second-discovery',source:'machine-b',
  },f.context.decode));
  const schema={ ...f.evidenceSchema,kind:'repair16-discovery-bundle',fields: {
    first: { kind:'constitutional' as const,type:'Evidence' as const },
    second: { kind:'constitutional' as const,type:'Evidence' as const },
  } };
  Object.assign(f.context,{ schemas: [...f.context.schemas,schema] });
  const context={ ...f.context,decode: { ...f.context.decode,provenance:f.provenance } };
  const fact=value(authorAndAppend({
    kind:schema.kind,schemaVersion:1,machine:'machine-a',principal:json(f.principal),
    provenance:json(f.provenance),at:json(f.f.now),body:json({ first:discovery.evidence,second }),required:[],
  },context,createFactStore(context,f.storage),f.deps.author.privateKey)).fact;
  return { fact,second,schema };
}

export function mismatchedSourceSignedAdmission() {
  const x=scheduledRepair6Setup(),bundle=mismatchedSourceDiscoveryBundle(x.f,x.discovery);
  value(x.f.port().receiveScheduledTick(x.input));
  const admission=x.f.frames.pop() as any,resolution=x.f.frames.pop() as any;
  const context=scheduledOwnerContext(x.f);
  const replacement=value(authorAndAppend({
    kind:resolution.kind,schemaVersion:1,machine:'machine-a',principal:json(resolution.principal),
    provenance:json(resolution.provenance),at:json(resolution.at),body:resolution.body,
    required:resolution.predecessors.required.map((id:string)=>id===x.discovery.fact.id?bundle.fact.id:id),
  },context,createFactStore(context,x.f.storage),x.f.deps.author.privateKey)).fact;
  const required=admission.predecessors.required.map((id:string)=>id===x.discovery.fact.id?bundle.fact.id
    :id===resolution.id?replacement.id:id);
  const signed=x.f.f.next(replacement,{
    kind:admission.kind,principal:admission.principal,provenance:admission.provenance,
    at:admission.at,body:admission.body,
    predecessors:{ ...admission.predecessors,inSegment:replacement.id,required },
  },context);
  return { ...x,bundle,context,signed };
}
