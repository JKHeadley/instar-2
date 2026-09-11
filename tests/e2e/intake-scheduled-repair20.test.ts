import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect,it } from 'vitest';
import { canonical,decode } from '../../src/index.js';
import { authorAndAppend,createFactStore } from '../../src/facts/index.js';
import { createIntakePort } from '../../src/intake/scheduled-a/index.js';
import { refused,json,value } from '../intake/fixtures.js';
import { scheduledFixture } from '../intake/scheduled-fixtures.js';

const ref=(id:string)=>({ owner:'part-two' as const,name:'FactEnvelope' as const,id });

it.each(['none','raw','reference','bundled','predecessor'].flatMap(placement =>
  ['normal','receipt-cut','terminal-cut'].map(cut=>({ placement,cut }))))
('P4-ST-105 F1 V213 Directive refusal survives durable restart without a post-receipt record ($placement $cut)',({ placement,cut })=>{
  const directory=mkdtempSync(join(tmpdir(),'instar-p4-repair20-directive-'));
  try {
    const f=scheduledFixture({ directory }); f.grant();
    const tick=f.tick(),discovery=f.discovery(tick.eventId); f.bind();
    const directive=value(decode('Directive',f.f.directiveInput(),{
      ...f.context.decode,grants:f.context.grants.map(row=>row.grant),
    }));
    const baseInput={ raw:tick.raw,route:tick.route,discovery:ref(discovery.fact.id) };
    const admitted:any=value(f.port().receiveScheduledTick(baseInput));
    expect(admitted.kind).toBe('scheduled-admitted');
    const input:any=structuredClone(baseInput);
    if(placement==='raw') input.raw=value(canonical({ ...tick.body,directives:[directive] })).bytes;
    if(placement==='reference') {
      input.raw=f.tick({ calendarPolicyVersion:'cron-v2' }).raw;
      input.discovery.directives=[directive];
    }
    if(['bundled','predecessor'].includes(placement)) {
      const evidence=value(decode('Evidence',{ ...json(discovery.evidence) as any,id:'discovery:repair20-durable' },
        f.context.decode));
      const schema={ ...f.evidenceSchema,kind:'repair20-durable-discovery',fields:{
        evidence:{ kind:'constitutional' as const,type:'Evidence' as const },
        ...(placement==='bundled'?{ directive:{ kind:'constitutional' as const,type:'Directive' as const } }:{}),
      } };
      const directiveSchema={ ...f.f.schema,kind:'repair20-durable-directive',fields:{
        directive:{ kind:'constitutional' as const,type:'Directive' as const },
      } };
      Object.assign(f.context,{ schemas:[...f.context.schemas,schema,directiveSchema] });
      const append=(kind:string,body:any,required:string[]=[])=>value(authorAndAppend({
        kind,schemaVersion:1,machine:'machine-a',principal:json(f.f.alice),
        provenance:json(f.f.alice.provenance),at:json(f.f.now),body,required,
      },f.context,createFactStore(f.context,f.storage),f.deps.author.privateKey));
      const predecessor=placement==='predecessor'
        ?append(directiveSchema.kind,{ directive:json(directive) }):undefined;
      const bundle=append(schema.kind,{
        evidence:json(evidence),...(placement==='bundled'?{ directive:json(directive) }:{}),
      },predecessor?[predecessor.fact.id]:[]);
      expect(bundle.taint).toEqual([]);
      input.discovery=ref(bundle.fact.id);
    }
    const before=f.facts().length,append=f.storage.append.bind(f.storage); let hit=false;
    const storage={ ...f.storage,append(bytes:string,expected:string|null) {
      const result=append(bytes,expected),kind=JSON.parse(bytes).kind;
      if(!hit&&(cut==='receipt-cut'&&kind==='intake-receipt'
        ||cut==='terminal-cut'&&['intake-collapse','intake-mismatch'].includes(kind))) {
        hit=true; throw new Error('repair20 cut after fsync');
      }
      return result;
    } };
    value(createIntakePort({ ...f.deps,storage })).receiveScheduledTick(input);
    const firstSuffix=f.facts().slice(before);
    const restarted=scheduledFixture({ directory }); restarted.installSchemas();
    Object.assign(restarted.context,{ schemas:f.context.schemas });
    const retryBefore=restarted.facts().length,retry=restarted.port().receiveScheduledTick(input);
    const retrySuffix=restarted.facts().slice(retryBefore);
    const pending=value(restarted.port().pendingScheduledAdmissions({
      owner:f.deps.workOwner,frontier:restarted.frontier(),limit:10,after:null,
    }));
    expect(pending.admissions).toEqual([admitted.fact]);
    expect(restarted.facts().filter(fact=>fact.kind==='intake-admitted')).toHaveLength(1);
    if(placement==='none') {
      expect(value(retry).kind).toBe('duplicate');
      expect(hit).toBe(cut!=='normal');
    } else {
      refused(retry,'unsupported-in-slice-a');
      expect(firstSuffix.map(fact=>fact.kind)).toEqual(['intake-receipt']);
      expect(firstSuffix.slice(1)).toEqual([]);
      expect(retrySuffix.map(fact=>fact.kind)).toEqual(['intake-receipt']);
      expect(retrySuffix.slice(1)).toEqual([]);
      expect(hit).toBe(cut==='receipt-cut');
    }
  } finally { rmSync(directory,{ recursive:true,force:true }); }
});

it.each(['none','missing','wrong-owner','wrong-kind','wrong-event'].flatMap(fault =>
  ['normal','receipt-cut','terminal-cut'].map(cut=>({ fault,cut }))))
('P4-ST-105 F2 V217 discovery refusal survives durable restart without a mismatch record ($fault $cut)',({ fault,cut })=>{
  const directory=mkdtempSync(join(tmpdir(),'instar-p4-repair20-witness-'));
  try {
    const f=scheduledFixture({ directory }); const grant=f.grant();
    const tick=f.tick(),discovery=f.discovery(tick.eventId); f.bind();
    const baseInput={ raw:tick.raw,route:tick.route,discovery:ref(discovery.fact.id) };
    const admitted:any=value(f.port().receiveScheduledTick(baseInput));
    expect(admitted.kind).toBe('scheduled-admitted');
    const input:any=structuredClone(baseInput);
    input.raw=f.tick({ calendarPolicyVersion:'cron-v2' }).raw;
    if(fault==='missing') input.discovery.id=`sha256:${'f'.repeat(64)}`;
    if(fault==='wrong-owner') input.discovery.owner='part-five';
    if(fault==='wrong-kind') input.discovery.id=grant.fact.id;
    if(fault==='wrong-event') input.discovery.id=f.discovery(f.tick({ jobInstance:'job:other' }).eventId).fact.id;
    const before=f.facts().length,append=f.storage.append.bind(f.storage); let hit=false;
    const storage={ ...f.storage,append(bytes:string,expected:string|null) {
      const result=append(bytes,expected),kind=JSON.parse(bytes).kind;
      if(!hit&&(cut==='receipt-cut'&&kind==='intake-receipt'
        ||cut==='terminal-cut'&&['intake-collapse','intake-mismatch'].includes(kind))) {
        hit=true; throw new Error('repair20 cut after fsync');
      }
      return result;
    } };
    value(createIntakePort({ ...f.deps,storage })).receiveScheduledTick(input);
    const firstSuffix=f.facts().slice(before);
    const restarted=scheduledFixture({ directory }); restarted.installSchemas();
    Object.assign(restarted.context,{ schemas:f.context.schemas });
    const retryBefore=restarted.facts().length,retry=restarted.port().receiveScheduledTick(input);
    const retrySuffix=restarted.facts().slice(retryBefore);
    const pending=value(restarted.port().pendingScheduledAdmissions({
      owner:f.deps.workOwner,frontier:restarted.frontier(),limit:10,after:null,
    }));
    expect(pending.admissions).toEqual([admitted.fact]);
    expect(restarted.facts().filter(fact=>fact.kind==='intake-admitted')).toHaveLength(1);
    if(fault==='none') {
      refused(retry,'different arrival bytes');
      expect(retrySuffix.map(fact=>fact.kind)).toEqual(['intake-receipt','intake-mismatch']);
      expect(hit).toBe(cut!=='normal');
    } else {
      refused(retry);
      expect(firstSuffix.map(fact=>fact.kind)).toEqual(['intake-receipt']);
      expect(firstSuffix.slice(1)).toEqual([]);
      expect(retrySuffix.map(fact=>fact.kind)).toEqual(['intake-receipt']);
      expect(retrySuffix.slice(1)).toEqual([]);
      expect(hit).toBe(cut==='receipt-cut');
    }
  } finally { rmSync(directory,{ recursive:true,force:true }); }
});
