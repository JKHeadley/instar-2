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

const kinds=[
  'intake-receipt','intake-resolved','intake-admitted','intake-held','intake-expired',
  'intake-collapse','intake-mismatch','intake-stop','intake-stop-signal',
  'intake-verified-act','conversation-binding',
] as const;
const modes=['missing','extra','wrong-type','out-of-range','changed-enum'] as const;
type MutationMode=typeof modes[number];

function setup(head: boolean,kind: typeof kinds[number]) {
  const f=intakeFixture();
  const declarations=structuredClone(f.registerInput.sources.map(row => row.declaration)) as any[];
  declarations.find(row => row.id==='host')!.requiredFacts.authenticationClass.push({
    stimulusType: 'scheduled-tick',class: 'verified',
  });
  const scheduledGovernance=f.govern(declarations).governance;
  const port=f.port();
  if(kind==='conversation-binding') f.bind();
  else if(kind==='intake-stop') { f.bind();value(port.receive(stop,route)); }
  else if(kind==='intake-stop-signal') value(port.receive(stop,route));
  else if(kind==='intake-held'||kind==='intake-expired') {
    consumeResult(port.receive('{}',route),{ Success: () => null,Refused: () => null });
    if(kind==='intake-expired') { f.setTime(1200);value(port.expireHolds()); }
  } else if(kind==='intake-verified-act') {
    const act=f.verifiedAct();value(port.admitVerifiedAct(act.input));
  } else {
    value(port.receive(message('repair15 legacy mutation seed'),route));
    if(kind==='intake-collapse') value(port.receive(message('repair15 legacy mutation seed'),route));
    if(kind==='intake-mismatch') consumeResult(port.receive(message('changed'),route),{
      Success: () => null,Refused: () => null,
    });
  }
  const fact=f.facts().find(candidate => candidate.kind===kind);
  if(!fact) throw new Error(`missing legacy seed ${kind}`);
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
  return { f,fact,context };
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

it('P4-PRESERVE-03 generated 32e5961-vs-HEAD mutation Results cover every legacy field and mutation class',()=>{
  const comparisons: Array<Readonly<{
    kind: string;path: string;mode: MutationMode;base: unknown;head: unknown;
  }>>=[];
  let fieldCount=0;
  for(const kind of kinds) {
    const base=setup(false,kind),head=setup(true,kind);
    expect(head.fact).toEqual(base.fact);
    expect(wire(verifyAndAdmit(json(base.fact),'machine-a',base.context)))
      .toEqual(wire(verifyAndAdmit(json(head.fact),'machine-a',head.context)));
    const fields=paths(base.fact.body);
    fieldCount+=fields.length;
    for(const path of fields) for(const mode of modes) {
      const baseSigned=signEnvelope({ ...base.fact,body: mutate(base.fact.body,path,mode) },
        base.f.deps.author.privateKey);
      const headSigned=signEnvelope({ ...head.fact,body: mutate(head.fact.body,path,mode) },
        head.f.deps.author.privateKey);
      const baseResult=wire(verifyAndAdmit(baseSigned,'machine-a',base.context));
      const headResult=wire(verifyAndAdmit(headSigned,'machine-a',head.context));
      comparisons.push({ kind,path: path.join('.'),mode,base: baseResult,head: headResult });
    }
  }
  expect(kinds).toHaveLength(11);
  expect(fieldCount).toBeGreaterThan(0);
  expect(comparisons).toHaveLength(fieldCount*modes.length);
  expect(comparisons.filter(row => value(canonical(row.base)).bytes!==value(canonical(row.head)).bytes))
    .toEqual([]);
  console.log(`P4-PRESERVE-03 differential cases=${comparisons.length+ kinds.length}; fields=${fieldCount}; controls=${kinds.length}`);
},120_000);
