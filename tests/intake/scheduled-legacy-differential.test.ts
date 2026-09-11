import { expect,it } from 'vitest';
import { canonical,consumeResult } from '../../src/index.js';
import type { Json,Result } from '../../src/index.js';
import { signEnvelope,verifyAndAdmit } from '../../src/facts/index.js';
import type { FactEnvelope,FactContext,OwnedBodyRegistration } from '../../src/facts/index.js';
import { generationOf } from '../../src/register/index.js';
import {
  bindIntakeOwnerRegister,intakeStopRegistration,intakeVerifiedActRegistration,
  intakeWorkRegistration,scheduledIntakeWorkRegistration,
} from '../../src/intake/scheduled-a/index.js';
import { intakeFixture,json,message,route,stop,value } from './fixtures.js';

const legacyFixtures=[
  ['receipt-message','intake-receipt'],
  ['receipt-stop','intake-receipt'],
  ['receipt-held','intake-receipt'],
  ['resolved-requester','intake-resolved'],
  ['resolved-bound-operator','intake-resolved'],
  ['admitted-requester','intake-admitted'],
  ['admitted-bound-operator','intake-admitted'],
  ['admitted-cannot-decide','intake-admitted'],
  ['held-binding-request','intake-held'],
  ['held-unresolved','intake-held'],
  ['held-coalesced','intake-held'],
  ['expired-unresolved','intake-expired'],
  ['expired-coalesced','intake-expired'],
  ['collapse-message','intake-collapse'],
  ['mismatch-message','intake-mismatch'],
  ['stop-bound','intake-stop'],
  ['stop-signal-requester','intake-stop-signal'],
  ['verified-act-approved','intake-verified-act'],
  ['verified-act-declined','intake-verified-act'],
  ['conversation-binding-initial','conversation-binding'],
  ['conversation-binding-superseding','conversation-binding'],
] as const;
type LegacyFixtureId=typeof legacyFixtures[number][0];
type LegacyKind=typeof legacyFixtures[number][1];
const modes=['missing','extra','wrong-type','out-of-range','changed-enum'] as const;
type MutationMode=typeof modes[number];

function setup(head: boolean,fixtureId: LegacyFixtureId,kind: LegacyKind) {
  const f=intakeFixture();
  const declarations=structuredClone(f.registerInput.sources.map(row => row.declaration)) as any[];
  declarations.find(row => row.id==='host')!.requiredFacts.authenticationClass.push({
    stimulusType: 'scheduled-tick',class: 'verified',
  });
  const scheduledGovernance=f.govern(declarations).governance;
  const port=f.port();
  switch(fixtureId) {
    case 'receipt-message': case 'resolved-requester': case 'admitted-requester':
      value(port.receive(message('legacy requester fixture'),route)); break;
    case 'receipt-stop': case 'stop-bound':
      f.bind();value(port.receive(stop,route)); break;
    case 'receipt-held': case 'held-unresolved': case 'expired-unresolved':
      consumeResult(port.receive('{}',route),{ Success: () => null,Refused: () => null });
      if(fixtureId==='expired-unresolved') { f.setTime(1200);value(f.port().expireHolds()); }
      break;
    case 'resolved-bound-operator': case 'admitted-bound-operator':
      f.bind();value(port.receive(message('legacy bound fixture'),route)); break;
    case 'admitted-cannot-decide':
      f.bind();value(port.receive(JSON.stringify({
        schemaVersion:1,kind:'message',text:'Please discuss this.',signal:'cannot-decide',
      }),route)); break;
    case 'held-binding-request':
      consumeResult(port.receive(JSON.stringify({
        schemaVersion:1,kind:'binding',principalId:'alice',standing:'operator',
      }),route),{ Success: () => null,Refused: () => null }); break;
    case 'held-coalesced': case 'expired-coalesced':
      for(let n=0;n<4;n++) consumeResult(port.receive('{}',{ ...route,eventId:`held-${n}` }),{
        Success: () => null,Refused: () => null,
      });
      if(fixtureId==='expired-coalesced') { f.setTime(1200);value(f.port().expireHolds()); }
      break;
    case 'collapse-message':
      value(port.receive(message('legacy duplicate fixture'),route));
      value(port.receive(message('legacy duplicate fixture'),route)); break;
    case 'mismatch-message':
      value(port.receive(message('legacy original fixture'),route));
      consumeResult(port.receive(message('legacy changed fixture'),route),{
        Success: () => null,Refused: () => null,
      }); break;
    case 'stop-signal-requester': value(port.receive(stop,route)); break;
    case 'verified-act-approved': {
      const act=f.verifiedAct();value(port.admitVerifiedAct(act.input)); break;
    }
    case 'verified-act-declined': {
      const act=f.verifiedAct({ decision:'decline' });value(port.admitVerifiedAct(act.input)); break;
    }
    case 'conversation-binding-initial': f.bind(); break;
    case 'conversation-binding-superseding': {
      const first=f.bind();f.bind({ supersedes:first.id,identityEpoch:'account-2' }); break;
    }
  }
  const fact=[...f.facts()].reverse().find(candidate => candidate.kind===kind);
  if(!fact) throw new Error(`missing legacy fixture ${fixtureId} (${kind})`);
  const boundary={ site:f.context.site,preserved:f.context.preserved,register:f.context.decode.register };
  const generation=value(generationOf(f.deps.governance.register,f.deps.governance.context));
  if(head) bindIntakeOwnerRegister(
    f.context.decode.register,scheduledGovernance.register,scheduledGovernance.context,f.deps.adapter.id);
  const work=head
    ?value(scheduledIntakeWorkRegistration(boundary,f.deps.author.principal.id,scheduledGovernance.register))
    :value(intakeWorkRegistration(boundary,f.deps.author.principal.id));
  const ownedBodies: OwnedBodyRegistration[]=[
    work,
    value(intakeStopRegistration(boundary,f.deps.author.principal.id)),
    value(intakeVerifiedActRegistration(boundary,f.deps.author.principal.id,{
      owner: 'part-three',name: 'RegisterGeneration',id: generation.id,
    })),
  ];
  const context: FactContext={
    ...f.context,ownedBodies,
    facts: f.facts().slice(0,f.facts().findIndex(candidate => candidate.id===fact.id)),
  };
  return { f,fact,context,fixtureId };
}

function paths(value: unknown,parent: readonly string[]=[]): readonly (readonly string[])[] {
  if(value===null||typeof value!=='object'||Array.isArray(value)) return [];
  return Object.entries(value).flatMap(([key,child]) => {
    const current=[...parent,key];
    return [current,...paths(child,current)];
  });
}

function changed(value: unknown,mode: MutationMode): unknown {
  if(mode==='wrong-type') {
    if(typeof value==='string') return false;
    if(typeof value==='number') return 'wrong-type';
    if(typeof value==='boolean') return { wrong: 'type' };
    if(Array.isArray(value)) return 'wrong-type';
    return false;
  }
  if(mode==='out-of-range') {
    if(typeof value==='string') return 'x'.repeat(1_048_577);
    if(typeof value==='number') return Number.MAX_SAFE_INTEGER+1;
    if(Array.isArray(value)) return Array.from({ length: 4097 },() => null);
    return 'x'.repeat(1_048_577);
  }
  if(mode==='changed-enum') return '__unsupported_enum_value__';
  return value;
}

function mutate(body: Json,path: readonly string[],mode: MutationMode): Json {
  const copy=structuredClone(body) as Record<string,Json>;
  let parent=copy;
  for(const key of path.slice(0,-1)) parent=parent[key] as Record<string,Json>;
  const key=path.at(-1)!;
  if(mode==='missing') delete parent[key];
  else if(mode==='extra') parent[`${key}__extra`]='unexpected';
  else parent[key]=changed(parent[key],mode) as Json;
  return copy;
}

function wire(result: Result<unknown>): unknown {
  return consumeResult<unknown,unknown>(result,{
    Success: accepted => ({ kind: 'Success',value: accepted }),
    Refused: refusal => ({ kind: 'Refused',refusal }),
  });
}

type DifferentialEvidence=Readonly<{
  comparisons: readonly Readonly<{
    fixtureId: LegacyFixtureId;kind: LegacyKind;path: string;mode: MutationMode;base: unknown;head: unknown;
  }>[];
  controls: readonly Readonly<{ fixtureId: LegacyFixtureId;kind: LegacyKind;base: unknown;head: unknown }>[];
  fieldCount: number;
  fixturePaths: ReadonlyMap<LegacyFixtureId,ReadonlySet<string>>;
}>;

const fixtureEvidence=new Map<LegacyFixtureId,DifferentialEvidence>();
function evidenceForFixture(fixtureId: LegacyFixtureId,kind: LegacyKind): DifferentialEvidence {
  const cached=fixtureEvidence.get(fixtureId);
  if(cached) return cached;
  const comparisons: Array<Readonly<{
    fixtureId: LegacyFixtureId;kind: LegacyKind;path: string;mode: MutationMode;base: unknown;head: unknown;
  }>>=[];
  const controls: Array<Readonly<{
    fixtureId: LegacyFixtureId;kind: LegacyKind;base: unknown;head: unknown;
  }>>=[];
  const fixturePaths=new Map<LegacyFixtureId,ReadonlySet<string>>();
  const coveredMutationFields=new Set<string>();
  const base=setup(false,fixtureId,kind),head=setup(true,fixtureId,kind);
  expect(head.fact).toEqual(base.fact);
  const baseControl=wire(verifyAndAdmit(json(base.fact),'machine-a',base.context));
  const headControl=wire(verifyAndAdmit(json(head.fact),'machine-a',head.context));
  controls.push({ fixtureId,kind,base:baseControl,head:headControl });
  const fields=paths(base.fact.body);
  fixturePaths.set(fixtureId,new Set(fields.map(path=>path.join('.'))));
  for(const path of fields) {
    const field=`${fixtureId}:${kind}:${path.join('.')}`;
    if(coveredMutationFields.has(field)) continue;
    coveredMutationFields.add(field);
    for(const mode of modes) {
      const baseSigned=signEnvelope({ ...base.fact,body: mutate(base.fact.body,path,mode) },
        base.f.deps.author.privateKey);
      const headSigned=signEnvelope({ ...head.fact,body: mutate(head.fact.body,path,mode) },
        head.f.deps.author.privateKey);
      const baseResult=wire(verifyAndAdmit(baseSigned,'machine-a',base.context));
      const headResult=wire(verifyAndAdmit(headSigned,'machine-a',head.context));
      comparisons.push({ fixtureId,kind,path: path.join('.'),mode,base: baseResult,head: headResult });
    }
  }
  const evidence={ comparisons,controls,fieldCount:coveredMutationFields.size,fixturePaths };
  fixtureEvidence.set(fixtureId,evidence);
  return evidence;
}

function differentialEvidence(): DifferentialEvidence {
  const evidence=legacyFixtures.map(([fixtureId,kind])=>evidenceForFixture(fixtureId,kind));
  return {
    comparisons:evidence.flatMap(row=>row.comparisons),
    controls:evidence.flatMap(row=>row.controls),
    fieldCount:evidence.reduce((count,row)=>count+row.fieldCount,0),
    fixturePaths:new Map(evidence.flatMap(row=>[...row.fixturePaths])),
  };
}

for(const [fixtureId,kind] of legacyFixtures) it(
  `P4-PRESERVE-03 V189 ${fixtureId} executes every field mutation against 32e5961 behavior`,()=>{
    const { comparisons,controls,fieldCount }=evidenceForFixture(fixtureId,kind);
    expect(comparisons).toHaveLength(fieldCount*modes.length);
    expect(controls).toHaveLength(1);
    expect(controls.filter(row=>value(canonical(row.base)).bytes!==value(canonical(row.head)).bytes)).toEqual([]);
    expect(comparisons.filter(row=>value(canonical(row.base)).bytes!==value(canonical(row.head)).bytes))
      .toEqual([]);
  },120_000);

it('P4-PRESERVE-03 V189 generated mutation Results cover every legacy fixture field and mutation class',()=>{
  const { comparisons,controls,fieldCount }=differentialEvidence();
  expect(new Set(legacyFixtures.map(([,kind])=>kind))).toEqual(new Set([
    'intake-receipt','intake-resolved','intake-admitted','intake-held','intake-expired',
    'intake-collapse','intake-mismatch','intake-stop','intake-stop-signal',
    'intake-verified-act','conversation-binding',
  ]));
  expect(fieldCount).toBeGreaterThan(0);
  expect(comparisons).toHaveLength(fieldCount*modes.length);
  expect(controls).toHaveLength(legacyFixtures.length);
  expect(controls.filter(row=>value(canonical(row.base)).bytes!==value(canonical(row.head)).bytes)).toEqual([]);
  expect(comparisons.filter(row => value(canonical(row.base)).bytes!==value(canonical(row.head)).bytes))
    .toEqual([]);
  console.log(`P4-PRESERVE-03 differential cases=${comparisons.length+controls.length}; fields=${fieldCount}; fixtures=${controls.length}`);
},120_000);

it('P4-PRESERVE-04 P4-PRESERVE-05 V178/V184 fixture-wide inventory executes every accepted legacy fixture mutation',()=>{
  const { fixturePaths,comparisons }=differentialEvidence();
  const expectedFixtureIds: readonly LegacyFixtureId[]=[
    'receipt-message','receipt-stop','receipt-held','resolved-requester','resolved-bound-operator',
    'admitted-requester','admitted-bound-operator','admitted-cannot-decide','held-binding-request',
    'held-unresolved','held-coalesced','expired-unresolved','expired-coalesced','collapse-message',
    'mismatch-message','stop-bound','stop-signal-requester','verified-act-approved',
    'verified-act-declined','conversation-binding-initial','conversation-binding-superseding',
  ];
  expect(legacyFixtures.map(([id])=>id)).toEqual(expectedFixtureIds);
  expect(new Set(expectedFixtureIds).size).toBe(expectedFixtureIds.length);
  expect([...fixturePaths.keys()]).toEqual(expectedFixtureIds);
  for(const fixtureId of expectedFixtureIds) {
    expect(new Set(comparisons.filter(row=>row.fixtureId===fixtureId).map(row=>row.path)))
      .toEqual(fixturePaths.get(fixtureId));
  }
  expect(fixturePaths.get('admitted-cannot-decide')).toContain('work.deliveryFlag');
  expect(fixturePaths.get('admitted-requester')).not.toContain('work.deliveryFlag');
  expect(fixturePaths.get('conversation-binding-superseding')).toContain('supersedes');
  expect(fixturePaths.get('verified-act-approved')).toContain('disposition');
  expect(fixturePaths.get('verified-act-declined')).toContain('disposition');
},120_000);
