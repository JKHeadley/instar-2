import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect,it } from 'vitest';
import { decode } from '../../src/index.js';
import { authorAndAppend,createFactStore } from '../../src/facts/index.js';
import { createIntakePort } from '../../src/intake/scheduled-a/index.js';
import { intakeFixture,json,message,refused,route,value } from '../intake/fixtures.js';
import { scheduledFixture } from '../intake/scheduled-fixtures.js';
import { scheduledOwnerContext,scheduledRepair6Setup } from '../intake/scheduled-repair6-fixtures.js';
import { scheduledRunHarness } from '../intake/scheduled-run-fixtures.js';
import { scheduledEvidenceBundle,scheduledFactReference } from '../intake/scheduled-repair9-fixtures.js';

function declarations(f:ReturnType<typeof intakeFixture>,mode:'plain'|'dual') {
  const rows=structuredClone(f.registerInput.sources.map(source=>source.declaration)) as any[];
  if(mode==='dual') rows.find(row=>row.id==='host')!.requiredFacts.authenticationClass
    .push({ stimulusType:'scheduled-tick',class:'verified' });
  return f.govern(rows).governance;
}

it.each(['intake-receipt','intake-resolved'].flatMap(kind=>
  (['plain','dual'] as const).map(mode=>({ kind,mode }))))
('V114 supporting preservation: durable ordinary recovery preserves the legacy path after $kind with $mode adapter',({ kind,mode })=>{
  const directory=mkdtempSync(join(tmpdir(),'instar-p4-repair10-v114-')),source=intakeFixture({ directory });
  const append=source.storage.append.bind(source.storage); let hit=false;
  const storage={ ...source.storage,append(bytes:string,expected:string|null) {
    const result=append(bytes,expected);
    if(JSON.parse(bytes).kind===kind) { hit=true; throw new Error('cut after real fsync'); }
    return result;
  } };
  refused(value(createIntakePort({ ...source.deps,governance:declarations(source,mode),storage }))
    .receive(message('unchanged ordinary input'),route));
  expect(hit).toBe(true);
  const receipt=(source.frames as any[]).find(fact=>fact.kind==='intake-receipt')!;
  const restarted=intakeFixture({ directory });
  const recovered=value(value(createIntakePort({ ...restarted.deps,governance:declarations(restarted,mode) })).recover(receipt.id));
  expect(recovered.kind).toBe('admitted');
  expect(restarted.facts().filter(fact=>fact.kind==='intake-admitted')).toHaveLength(1);
});

it.each(['single-missing','extra-missing','discovery-missing'].flatMap(mode=>
  [false,true].map(cut=>({ mode,cut }))))
('P4-ST-48 V115 durable partial replication retains without promotion ($mode, lost acknowledgement=$cut)',({ mode,cut })=>{
  const x=scheduledRepair6Setup(),extraReference='reviewer:durable-extra'; let extraFact:ReturnType<typeof scheduledEvidenceBundle>|undefined;
  if(mode!=='single-missing') {
    const captureHash=x.f.f.capture('independent durable observation',extraReference); x.f.syncCaptures();
    const extra=value(decode('Evidence',{ ...json(x.discovery.evidence) as Record<string,unknown>,id:'reviewer:durable-extra',
      claim:{ subject:'other',predicate:'unrelated',value:true },capture:{ reference:extraReference,hash:captureHash } },x.f.context.decode));
    extraFact=scheduledEvidenceBundle(x,{ evidence:extra });
  }
  const admitted=value(x.f.port().receiveScheduledTick(x.input));
  if(admitted.kind!=='scheduled-admitted') throw new Error('expected scheduled admission');
  const original=x.f.frames.pop() as any,context=scheduledOwnerContext(x.f);
  const written=value(authorAndAppend({ kind:original.kind,schemaVersion:1,machine:'machine-a',principal:json(original.principal),
    provenance:json(original.provenance),at:json(original.at),body:original.body,
    required:extraFact?[...original.predecessors.required,extraFact.id]:original.predecessors.required },context,
  createFactStore(context,x.f.storage),x.f.deps.author.privateKey));

  const directory=mkdtempSync(join(tmpdir(),'instar-p4-repair10-v115-')),target=scheduledFixture({ directory });
  target.installSchemas(); Object.assign(target.context,{ schemas:x.f.context.schemas });
  Object.assign(target.f.captures,x.f.f.captures);
  const missing=mode==='extra-missing'?extraReference:x.discovery.evidence.capture.reference;
  const saved=target.f.captures[missing]; if(saved===undefined) throw new Error('expected saved capture');
  target.dropCapture(missing); target.syncCaptures();
  const targetContext=scheduledOwnerContext(target),store=createFactStore(targetContext,target.storage);
  const append=target.storage.append.bind(target.storage); let hit=false,result:any;
  target.storage.append=(bytes,expected)=>{
    const receipt=append(bytes,expected);
    if(cut&&JSON.parse(bytes).kind==='intake-admitted') { hit=true; throw new Error('lost acknowledgement after partial fsync'); }
    return receipt;
  };
  for(const fact of x.f.frames as any[]) {
    const appended=store.append(json(fact),{ peer:fact.machine });
    if(fact.kind==='intake-admitted') result=appended; else value(appended);
  }

  const restarted=scheduledFixture({ directory }); restarted.installSchemas();
  Object.assign(restarted.context,{ schemas:x.f.context.schemas });
  const retained=restarted.facts().filter(fact=>fact.kind==='intake-admitted');
  expect(value(restarted.port().pendingScheduledAdmissions({ owner:admitted.owner,frontier:restarted.frontier(),limit:10,after:null })).admissions)
    .toEqual([]);
  restarted.f.captures[missing]=saved; restarted.syncCaptures();
  if(!retained.length) value(createFactStore(scheduledOwnerContext(restarted),restarted.storage)
    .append(json(written.fact),{ peer:'machine-a' }));
  const harness=scheduledRunHarness(restarted,{ ...admitted,fact:scheduledFactReference(written.fact.id) });
  expect(value(harness.graph.open(harness.run)).run.opening).toEqual(scheduledFactReference(written.fact.id));
  expect(restarted.facts().filter(fact=>fact.kind==='run-opening')).toHaveLength(1);
  expect(retained.map(fact=>fact.id)).toEqual([written.fact.id]);
  expect(hit).toBe(cut);
  if(cut) refused(result); else expect(value<any>(result).taint).toEqual(['evidence-unavailable']);
});
