import { expect,it } from 'vitest';
import { authorAndAppend,createFactStore,verifyAndAdmit } from '../../src/facts/index.js';
import { json,refused,value } from './fixtures.js';
import { scheduledRepair6Setup } from './scheduled-repair6-fixtures.js';
import { addSecondGrant,admissionWithSecondGrant,mismatchedIntentPrincipal,resolutionCandidate } from './scheduled-repair14-fixtures.js';

it.each(['person','agent'] as const)
('P4-ST-75 V150 F1 refuses an Intent principal inconsistent with its signed identity (%s)',kind=>{
  const x=mismatchedIntentPrincipal(kind),store=createFactStore(x.context,x.f.storage);
  refused(verifyAndAdmit(json(x.signed),'machine-a',{ ...x.context,facts:x.f.frames as any }),'unsupported-in-slice-a');
  refused(authorAndAppend({ kind:x.original.kind,schemaVersion:1,machine:'machine-a',
    principal:json(x.original.principal),provenance:json(x.original.provenance),at:json(x.original.at),
    body:x.body,required:x.original.predecessors.required },x.context,store,x.f.deps.author.privateKey),
  'unsupported-in-slice-a');
});

it.each(['none','wrong-principal','wrong-binding'] as const)
('P4-ST-76 V153 F2 missing receipt bytes preserve complete partial data but cannot hide %s',mutation=>{
  const x=resolutionCandidate(mutation),saved=x.f.f.captures[x.pin.reference];
  delete x.f.f.captures[x.pin.reference]; Object.assign((x.f.context.captures as any)[x.pin.reference],{ status:'missing',bytes:null });
  const result=verifyAndAdmit(json(x.signed),'machine-a',{ ...x.context,
    decode:{ ...x.context.decode,captures:x.f.f.captures },facts:x.f.frames as any });
  if(mutation==='none') expect(value(result).id).toBe(x.signed.id); else refused(result,'unsupported-in-slice-a');
  if(saved) x.f.f.captures[x.pin.reference]=saved;
});

it('P4-ST-77 V154/V155 F3 uses a deterministic live grant and the admission\'s referenced grant',()=>{
  const live=scheduledRepair6Setup(); addSecondGrant(live);
  expect(value(live.f.port().receiveScheduledTick(live.input)).kind).toBe('scheduled-admitted');
  const x=admissionWithSecondGrant();
  expect(value(x.f.port().pendingScheduledAdmissions({ owner:x.admitted.owner,frontier:x.f.frontier(),limit:10,after:null })).admissions)
    .toEqual([{ owner:'part-two',name:'FactEnvelope',id:x.appended.fact.id }]);
});
