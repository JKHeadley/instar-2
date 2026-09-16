import { assemblySchemas, createAssemblyRuntime, createAssemblySpine, registerAssemblyBodies } from '../../src/assembly/index.js';
import { consumeResult, decode, decodeMeasurement } from '../../src/index.js';
import type { Clock, FactEnvelopeReference, Json } from '../../src/index.js';
import { authorAndAppend, createFactStore, registerOwnedBody } from '../../src/facts/index.js';
import type { FactContext, FactEnvelope, FactSchema, OwnedShape, SegmentStoragePort } from '../../src/facts/index.js';
import { createRunGraph, recordWire, runFactSchemas, runIdFor } from '../../src/rungraph/index.js';
import { issueProductionGroundingRead, issueProductionGroundingReader } from '../../src/rungraph/types.js';
import type { RunDecodeContext, RunGraphDependencies, RunTransition, RunView } from '../../src/rungraph/index.js';
import { factsFixture, privateKey, json, refused } from '../facts/fixtures.js';
import { assemblyInput } from '../assembly/fixture.js';
import { digest, value } from '../fixtures.js';
import { governanceFixture } from '../rungraph/governance-fixture.js';
export { value, refused, json, digest };
export const ref = (f: FactEnvelope): FactEnvelopeReference => ({ owner: 'part-two', name: 'FactEnvelope', id: f.id });
export function setup(storageFactory?: (fallback: SegmentStoragePort) => SegmentStoragePort, recovery?: {
  admissions: Set<string>; witness: (id: string) => void; worker: string; harness: string; lease: string;
  message: string;
  afterIntake?: () => void;
}, stimulus?: {
  fields: FactSchema['fields'];
  extra?: Readonly<Record<string, FactSchema['fields']>>;
  ownerRecords?: boolean;
  body: (tools: { append: (kind: string, body: Json, required?: readonly string[]) => { fact: FactEnvelope };
    intent: unknown; owner: unknown; hash: string }) => Json;
}) {
  const f = factsFixture(); let now = f.now, liveLease = 'lease:1'; const wire: unknown[] = [];
  const types = { ...f.ctx.decode, provenance: f.bob.provenance,
    register: { ...f.ctx.decode.register, subjects: { ...f.ctx.decode.register.subjects, 'elapsed-time': ['ms'], 'run-work': ['steps'] } } };
  const schemas: FactSchema[] = [
    { ...f.schema, kind: 'stimulus', fields: stimulus?.fields
      ?? { intent: { kind: 'constitutional', type: 'Intent' }, owner: { kind: 'constitutional', type: 'VerifiedPrincipal' }, capture: { kind: 'capture' } } },
    ...Object.entries(stimulus?.extra ?? {}).map(([kind, fields]): FactSchema => {
      const owned = stimulus?.ownerRecords && ({
        'effect-OperationDefinition': ['part-eight', 'OperationDefinition'],
        'effect-EffectRequest': ['part-eight', 'EffectRequest'],
        'effect-OperationObservation': ['part-eight', 'OperationObservation'],
        'transport-AdmissionReservation': ['part-six', 'AdmissionReservation'],
        'transport-Lease': ['part-six', 'Lease'],
      } as const)[kind];
      return { ...f.schema, kind, fields: owned ? { record: { kind: 'owned', owner: owned[0], name: owned[1] } } : fields };
    }),
    { ...f.schema, kind: 'consumption', fields: { worker: { kind: 'text', maxLength: 80 }, harness: { kind: 'text', maxLength: 80 }, hashes: { kind: 'text', maxLength: 65536 }, classes: { kind: 'text', maxLength: 65536 } } },
    { ...f.schema, kind: 'outcome-record', fields: { evidence: { kind: 'constitutional', type: 'Evidence' }, outcome: { kind: 'constitutional', type: 'Outcome' } } },
    { ...f.schema, kind: 'evidence-record', fields: { evidence: { kind: 'constitutional', type: 'Evidence' } } },
    { ...f.schema, kind: 'result-record', fields: { result: { kind: 'constitutional', type: 'Result' } } },
    { ...f.schema, kind: 'next-inbound', fields: { capture: { kind: 'capture' } } },
    f.schema,
  ];
  const message = recovery?.message ?? 'request bytes', hash = f.capture(message, 'message:1');
  const secondHash = f.capture('second input bytes', 'message:2');
  const captures: FactContext['captures'] = { 'message:2': { bytes: 'second input bytes', hash: secondHash, status: 'available', byteLength: 18 }, 'message:1': { bytes: message, hash, status: 'available', byteLength: Buffer.byteLength(message) } };
  let ctx: FactContext = { ...f.ctx, decode: types, schemas, captures };
  let c: RunDecodeContext = { site: ctx.site, preserved: ctx.preserved, register: types.register, types, facts: ctx,
    stimulusKinds: ['stimulus', 'next-inbound'], evidenceSources: { settlement: 'probe', exit: 'probe' } };
  const assemblyHost: any = { machine: 'machine-a', principal: f.bob, scope: f.scope, boundary: f.c, current: () => ({ facts: ctx, generation: types.register.generation.id, stopped: false, clock: now }) };
  const registration = value(runFactSchemas(c));
  const ownerShapes: Readonly<Record<string, Readonly<{ owner: string; name: string; shape: OwnedShape }>>> = {
    'effect-OperationDefinition': { owner: 'part-eight', name: 'OperationDefinition', shape: { kind: 'object', fields: { type: { kind: 'text', maxLength: 80 }, schemaVersion: { kind: 'integer' }, id: { kind: 'text', maxLength: 512 } } } },
    'effect-EffectRequest': { owner: 'part-eight', name: 'EffectRequest', shape: { kind: 'object', fields: { type: { kind: 'text', maxLength: 80 }, schemaVersion: { kind: 'integer' }, id: { kind: 'text', maxLength: 512 }, definition: { kind: 'text', maxLength: 512 }, digest: { kind: 'text', maxLength: 512 }, run: { kind: 'text', maxLength: 512 } } } },
    'effect-OperationObservation': { owner: 'part-eight', name: 'OperationObservation', shape: { kind: 'object', fields: { type: { kind: 'text', maxLength: 80 }, schemaVersion: { kind: 'integer' }, id: { kind: 'text', maxLength: 512 }, operation: { kind: 'text', maxLength: 512 }, claim: { kind: 'text', maxLength: 512 }, digest: { kind: 'text', maxLength: 512 }, run: { kind: 'text', maxLength: 512 }, input: { kind: 'text', maxLength: 512 }, stage: { kind: 'text', maxLength: 80 } } } },
    'transport-AdmissionReservation': { owner: 'part-six', name: 'AdmissionReservation', shape: { kind: 'object', fields: { type: { kind: 'text', maxLength: 80 }, schemaVersion: { kind: 'integer' }, operation: { kind: 'text', maxLength: 512 }, request: { kind: 'text', maxLength: 512 }, state: { kind: 'text', maxLength: 80 }, digest: { kind: 'text', maxLength: 512 }, run: { kind: 'text', maxLength: 512 }, tick: { kind: 'integer' } } } },
    'transport-Lease': { owner: 'part-six', name: 'Lease', shape: { kind: 'object', fields: { type: { kind: 'text', maxLength: 80 }, schemaVersion: { kind: 'integer' }, id: { kind: 'text', maxLength: 512 }, run: { kind: 'text', maxLength: 512 }, incarnation: { kind: 'text', maxLength: 512 } } } },
  };
  const ownerRegistrations = stimulus?.ownerRecords ? Object.entries(ownerShapes).map(([_kind, row]) => value(registerOwnedBody({
    owner: row.owner, name: row.name, currentVersion: 1, versions: { 1: { validate: v => ({ ok: true, value: v }) } }, migrations: {},
    decodeCurrent: input => ({ ok: true, value: input }),
  }, row.shape, f.c))) : [];
  ctx = { ...ctx, schemas: [...schemas, ...registration.schemas, ...assemblySchemas(assemblyHost)], ownedBodies: [...registration.registrations, ...ownerRegistrations, ...value(registerAssemblyBodies(assemblyHost))] }; c = { ...c, facts: ctx };
  const storage = storageFactory?.({ owner: 'part-ten', read: () => wire, append: (bytes, expected) => {
    if ((wire.at(-1) as { contentHash?: string } | undefined)?.contentHash !== (expected ?? undefined)) throw new Error('storage CAS');
    wire.push(JSON.parse(bytes)); return f.success({ kind: 'local-durable' });
  } }) ?? { owner: 'part-ten' as const, read: () => wire, append: (bytes: string) => { wire.push(JSON.parse(bytes)); return f.success({ kind: 'local-durable' as const }); } };
  const store = createFactStore(ctx, storage);
  const append = (kind: string, body: Json, required: readonly string[] = [], schemaVersion = 1) => value(authorAndAppend({ kind, body, required, schemaVersion,
    machine: 'machine-a', principal: json(f.bob), provenance: json(f.bob.provenance), at: json(now) }, ctx, store, privateKey));
  const intent = value(decode('Intent', f.intentInput({ principal: f.bob }), types));
  // Restart harness reconstructs from the durable cause plus installation policy,
  // never from a Run supplied by its dead caller. Existing input is not reauthored.
  const opening = value(store.read()).find(f => f.kind === 'stimulus')
    ?? (stimulus ? append('stimulus', stimulus.body({ append, intent, owner: f.bob, hash })).fact
      : append('stimulus', json({ intent, owner: f.bob, capture: { reference: 'message:1', hash } })).fact);
  recovery?.afterIntake?.();
  const owner = { type: 'VerifiedPrincipal' as const, id: 'bob', fact: ref(opening), field: 'owner' };
  const id = runIdFor(ref(opening)), binding = { owner: 'part-four', name: 'ConversationBinding', id: 'binding:1' } as const;
  const lease = { owner: 'part-six', name: 'Lease', id: 'lease:1' } as const;
  if (recovery) liveLease = recovery.lease;
  let execution = { worker: recovery?.worker ?? 'w', harness: recovery?.harness ?? 'h', ownership: { ...lease, id: liveLease }, context: ref(opening) };
  const run = { type: 'Run', schemaVersion: 1, id, opening: ref(opening), intent: { type: 'Intent', id: intent.id, fact: ref(opening), field: 'intent' },
    directives: [], owner, scope: f.scope, authority: { resolution: ref(opening), grants: [] },
    exitTest: { check: 'probe', version: 'v1', subject: 'artifact', acceptance: digest('complete artifact'), evidenceKinds: ['proof'], freshFor: 1000 },
    budget: { type: 'RunBudget', schemaVersion: 1, id: 'budget:1', bounds: ['bound'], resources: [{ type: 'Measurement', schemaVersion: 1,
      subject: { kind: 'run-work', instance: 'budget:1' }, value: 3, unit: 'steps', at: now, by: 'probe' }],
      maxWorkers: 1, maxProcesses: 1, maxOutstanding: 3, maxChildren: 0, maxDepth: 1, maxAttempts: 3,
      repetitionPolicy: { owner: 'part-six', name: 'LoopPolicy', id: 'loop:1' }, safetyCeiling: f.clock(10000), exhaustedOwner: owner },
    cadence: { bound: 'bound', milliseconds: 3600000 }, nextWake: { owner, at: f.clock(1000), reason: 'continue' }, blockedOn: { kind: 'nothing' },
    resultDestination: { binding, route: ref(opening) }, generation: types.register.generation, createdAt: now, depth: 1 };
  const context = () => ({ ...c, facts: { ...ctx, facts: value(store.read()) } });
  const generation = () => ({ reference: types.register.generation, kinds: ctx.schemas.map(s => s.kind), lineages: {
    'machine-a': { head: { epoch: 0, position: value(store.read()).at(-1)!.segment.position }, observedAt: now.value, closed: false },
  } });
  let groundCounter = value(store.read()).filter(f => f.kind === 'session-grounding').length;
  const admissions = recovery?.admissions ?? new Set<string>();
  const commit = (write: () => import('../../src/index.js').Result<import('../../src/facts/index.js').AppendReceipt>) => {
    const receipt = value(write()); admissions.add(receipt.fact.id); recovery?.witness(receipt.fact.id); return f.success(receipt);
  };
  const deps: RunGraphDependencies = { governance: governanceFixture(c), context: c, store, generation, clock: () => now, groundingPolicy: { entry: 'bound', threshold: 20, maxAge: 50, briefingClasses: ['identity', 'rules', 'directives', 'pending-work'] },
    writer: { owner: 'part-ten', append: (kind, run, record, required) => f.success(append(kind, json({ run, record: recordWire(record) }), required)) },
    admission: { owner: 'part-six', verify: reference => { if (!admissions.has(reference.id)) throw new Error('not admitted by six'); return f.success(reference); },
      execution: (run, ownership) => { if (run !== id || ownership.id !== liveLease) throw new Error('stale execution fence'); return f.success(execution); },
      reservation: (reference, step) => { if (reference.name !== 'AdmissionReservation' || reference.id !== `reservation:${step.operation.key}`) throw new Error('reservation identity mismatch'); return f.success(ref(opening)); },
      create: (_opening, _run, write) => commit(write), commit: (request, write) => {
      if (request.ownership.id !== liveLease) return consumeResult(value(decode('Result', f.refusedInput({ detail: 'stale fence' }), types)), { Refused: r => r, Success: () => { throw new Error('expected refusal'); } }); return commit(write);
    } },
    grounding: { owner: 'part-ten', read: ({ run: view, worker, harness, reason, execution }) => {
      const messages = [{ fact: ref(opening), sequence: opening.segment.position, capture: 'message:1', hash }];
      const consumption = append('consumption', json({ worker, harness, hashes: JSON.stringify(messages.map(m => m.hash)), classes: JSON.stringify(deps.groundingPolicy.briefingClasses) }));
      return f.success({ type: 'SessionGrounding', schemaVersion: 2, id: `ground:${++groundCounter}`, run: id, expected: view.head, worker, harness, reason,
        ownership: execution.ownership, executionContext: execution.context,
        at: now, previousActivity: f.now, elapsed: { type: 'Measurement', schemaVersion: 1, subject: { kind: 'elapsed-time', instance: worker }, value: now.value - f.now.value, unit: 'ms', at: now, by: 'probe' },
        principal: owner, intake: ref(opening), binding, directives: [], generation: types.register.generation,
        frontier: { 'machine-a': { epoch: 0, position: consumption.fact.segment.position } }, knownLineages: ['machine-a'], threshold: 20, messages,
        lastInbound: ref(opening), pendingOperations: view.pending.map(s => s.operation.key), children: [], receipts: [],
        briefingClasses: deps.groundingPolicy.briefingClasses, consumption: ref(consumption.fact) });
    } },
    settlement: { owner: 'part-eight', read: () => { throw new Error('test must supply settlement evidence'); } },
    control: { owner: 'part-four', verify: () => { throw new Error('test must supply verified control'); } },
    exitCheck: { owner: 'part-nine', verify: exit => f.success(exit.check) },
  };
  const graph = value(createRunGraph(deps));
  function start(view: RunView, ground: FactEnvelope, key = 'operation:1') {
    return { type: 'RunTransition', schemaVersion: 1, id: `start:${key}`, run: id, expected: view.head, trigger: ref(opening), kind: 'start', from: view.state, to: 'running',
      responsible: owner, standing: ref(opening), ownership: lease, generation: types.register.generation, at: now,
      blockedOn: { kind: 'step', reference: `step:${key}`, owner, nextObservation: f.clock(1000) }, nextWake: run.nextWake,
      grounding: ref(ground), step: { type: 'RunStep', schemaVersion: 1, id: `step:${key}`, run: id, expected: view.head, kind: 'effect',
        operation: { key, digest: digest({ key, effect: 'test' }), classification: ref(opening) }, evidence: [], directives: [], authorizations: [],
        allocation: { budget: 'budget:1', reservation: { owner: 'part-six', name: 'AdmissionReservation', id: `reservation:${key}` } }, ownership: lease,
        resultDestination: run.resultDestination, generation: types.register.generation } };
  }
  const observe = (view: RunView, kind: 'happened' | 'did-not-happen' | 'uncertain' = 'uncertain') => {
    const evidence = value(decode('Evidence', f.evidenceInput({ id: `observation:${view.head}`, observedAt: now, freshFor: 10000 }), types));
    f.evidence.push(evidence);
    const outcome = value(decode('Outcome', f.raw('Outcome', { kind, evidence: [evidence.id] }), { ...types, evidence: [evidence] }));
    const fact = append('outcome-record', json({ evidence, outcome })).fact;
    return { type: 'RunTransition', schemaVersion: 1, id: `observe:${view.head}`, run: id, expected: view.head, trigger: ref(fact), kind: 'observe', from: view.state, to: 'waiting',
      responsible: owner, standing: ref(opening), ownership: lease, generation: types.register.generation, at: now, blockedOn: view.blockedOn, nextWake: run.nextWake,
      affectedStep: view.pending[0]!.id, outcome: { type: 'Outcome', id: `outcome:${fact.id}`, fact: ref(fact), field: 'outcome' } };
  };
  return { ...f, assemblyHost, ctx, c, context, wire, store, append, deps, graph, run, id, owner, opening, lease, start, observe, generation, admissions,
    setClock: (n: number) => { now = value(decodeMeasurement('clock', f.clockRaw(n), types)); }, fence: () => { liveLease = 'lease:2'; execution = { ...execution, worker: 'replacement', harness: 'h2', ownership: { ...lease, id: liveLease } }; },
    place: (worker: string, harness: string) => { execution = { worker, harness, ownership: { ...lease, id: liveLease },
      context: ref(append('note', json({ identity: `${worker}:${harness}`, amount: '0' })).fact) }; } };
}

export function paired(options:any={}) {
 const text={kind:'text' as const,maxLength:2048};
 const f=setup(undefined,undefined,{fields:{intent:{kind:'constitutional',type:'Intent'},owner:{kind:'constitutional',type:'VerifiedPrincipal'},capture:{kind:'capture'}},extra:{
  'effect-OperationDefinition':{id:text},
  'effect-EffectRequest':{id:text,definition:text,digest:text,run:text},
  'transport-AdmissionReservation':{operation:text,state:text,digest:text,run:text},
  'transport-Lease':{run:text,incarnation:text},
  'effect-OperationObservation':{operation:text,claim:text,digest:text,run:text,input:text,stage:text},
  'rungraph-briefing-material':{class:text},
 },ownerRecords:true,body:({intent,owner,hash})=>json({intent,owner,capture:{reference:'message:1',hash}})}); const ready=value(f.graph.open(f.run));
 const spine=createAssemblySpine(f.assemblyHost,{context:f.ctx,privateKey},f.store);
 const runtime=createAssemblyRuntime({host:f.assemblyHost,spine} as any);
 const history:any={owner:'part-ten',current:()=>runtime.inspectCurrent(),lookup:(id:string)=>{
  const snap=value(f.store.readForProjection()); const a=value(runtime.inspectCurrent()).find(r=>r.fact.id===id||r.record.id===id); const s=snap.entries.find(r=>r.fact.id===(a?.fact.id??id)||(r.fact.body as any)?.record?.id===id);
  return f.success(s?{fact:s.fact,...(a?{record:a.record}:{}),taint:s.taint,conflicts:[...s.conflicts,...(a?.conflicts??[])],completeness:'complete'}:null);
 },resolve:(r:any)=>runtime.resolve(r),resolveContextDelivery:(r:any)=>runtime.resolve(r)};
 const launch=value(runtime.record('HarnessLaunchSpec',{...assemblyInput('HarnessLaunchSpec'),id:'review-launch',run:f.id,step:'launch-step',input:f.opening.id,incarnation:'incarnation:one',harness:'h'}));
 const lf=value(runtime.inspect()).find(r=>r.record.id===launch.id)!.fact;
 const execution=f.append('transport-Lease',json({record:{type:'Lease',schemaVersion:1,id:'delivery-lease:1',run:f.id,incarnation:'incarnation:one'}})).fact;
 const briefings=f.deps.groundingPolicy.briefingClasses.map(c=>f.append('rungraph-briefing-material',json({class:c})).fact);
 const admission={...f.deps.admission,execution:(run:any,ownership:any)=>{const current=value(f.deps.admission.execution(run,ownership));return f.success({...current,context:ref(execution)})}};
 let count=0; let last:any; let mutation=(s:any,o:any,g:any)=>{};
  function read(req:any) {
  const at=f.deps.clock(), ordinal=++count;
  const definitionId=`delivery-definition:${ordinal}`,requestId=`delivery-request:${ordinal}`,attempt=`delivery-attempt:${ordinal}`;
  f.append('effect-OperationDefinition',json({record:{type:'OperationDefinition',schemaVersion:1,id:definitionId}}));
  const operationKey=`operation:${digest([f.id,requestId,attempt])}`;
  const spec:any={type:'ContextDeliverySpecification',schemaVersion:1,id:`delivery:${ordinal}`,predecessors:[],dependencyFacts:[],launch:lf.id,run:f.id,step:'step:operation:1',input:f.opening.id,inputDigest:f.ctx.captures['message:1']!.hash,incarnation:launch.incarnation,harness:'h',artifactDigest:launch.artifactDigest,machine:launch.machine,generation:f.run.generation.id,executionContext:req.execution.context.id,contextManifest:[{class:'message',reference:'message:1',digest:f.ctx.captures['message:1']!.hash},...briefings.map(row=>({class:(row.body as any).class,reference:row.id,digest:row.contentHash}))],reason:'initial',operation:operationKey,claim:'',previousDelivery:'',controlObservation:''};
  const obs:any={type:'HarnessObservation',schemaVersion:1,id:`consumed:${ordinal}`,predecessors:[],dependencyFacts:[],launch:lf.id,run:f.id,step:spec.step,input:spec.input,incarnation:spec.incarnation,contextDelivery:'',sourceEvidence:[],contextDigests:spec.contextManifest.map((r:any)=>r.digest),generation:spec.generation,causalReferences:[],observedAt:at.value,freshFor:1000,phase:'context-consumed',boundaryEvidence:'',detail:'boundary witness'};
  const g:any={type:'SessionGrounding',schemaVersion:2,id:`ground-review:${count}`,run:f.id,expected:req.run.head,worker:req.worker,harness:req.harness,reason:req.reason,step:spec.step,incarnation:spec.incarnation,contextDeliveryReason:spec.reason,ownership:req.execution.ownership,executionContext:req.execution.context,at,previousActivity:at,elapsed:{type:'Measurement',schemaVersion:1,subject:{kind:'elapsed-time',instance:req.worker},value:0,unit:'ms',at,by:'probe'},principal:f.owner,intake:ref(f.opening),binding:f.run.resultDestination.binding,directives:[],generation:f.run.generation,frontier:{},knownLineages:['machine-a'],threshold:20,messages:[{fact:ref(f.opening),sequence:f.opening.segment.position,capture:'message:1',hash:f.ctx.captures['message:1']!.hash}],lastInbound:ref(f.opening),pendingOperations:req.run.pending.map((s:any)=>s.operation.key),children:[],receipts:[],briefingClasses:f.deps.groundingPolicy.briefingClasses,consumption:ref(f.opening)};
  mutation(spec,obs,g);
  f.append('effect-EffectRequest',json({record:{type:'EffectRequest',schemaVersion:1,id:requestId,definition:definitionId,digest:spec.inputDigest,run:f.id}}));
  const claim=f.append('transport-AdmissionReservation',json({record:{type:'AdmissionReservation',schemaVersion:1,operation:operationKey,request:requestId,state:'dispatch-claimed',digest:spec.inputDigest,run:f.id,tick:ordinal}})).fact;
  spec.claim=claim.id;
  const witness=f.append('effect-OperationObservation',json({record:{type:'OperationObservation',schemaVersion:1,id:`delivery-observation:${ordinal}`,operation:operationKey,claim:claim.id,digest:spec.inputDigest,run:f.id,input:spec.input,stage:'response'}})).fact;
  if (!obs.boundaryEvidence) obs.boundaryEvidence=witness.id;
  if (!obs.sourceEvidence.length) obs.sourceEvidence=[witness.id];
  const sr=value(runtime.recordContextDelivery(spec)); const sf=value(runtime.inspect()).find(r=>r.record.id===sr.id)!.fact;
  obs.contextDelivery=sf.id;
  const or=value(runtime.record('HarnessObservation',obs)); const of=value(runtime.inspect()).find(r=>r.record.id===or.id)!.fact;
  g.consumption=ref(of);g.frontier={'machine-a':{epoch:0,position:of.segment.position}};last={spec:sr,observation:or,grounding:g,sf,of,witness};
  return f.success(g);
 }
 let grounding:any;
 grounding=issueProductionGroundingReader({owner:'part-ten',production:true,read:(req:any)=>{const candidate=value(read(req));return f.success(issueProductionGroundingRead(grounding,req.invocation,candidate))}},'scope:minimal');
 const deps={...f.deps,admission,grounding,assemblyHistory:history};const graph=value(createRunGraph(deps));
 return {...f,ready,runtime,history,spine,launch,lf,graph,deps,read,setMutation:(m:any)=>mutation=m,last:()=>last};
}

export function executeInitialLiveInputLifecycle() {
 const f=paired(),g1=value(f.graph.ground(f.id,'w','h','start',f.lease)),first=f.last();
 const running=value(f.graph.transition(f.start(f.ready,g1))),observed=f.observe(running,'happened');
 const outcome=(value(f.store.read()).find(r=>r.id===observed.trigger.id)!.body as any).outcome,step=running.pending[0]!;
 const e=value(decode('Evidence',f.evidenceInput({id:'settled-review',claim:{subject:step.operation.key,predicate:'operation-settled',value:{digest:step.operation.digest,claimClosed:true,chargeSettled:true}},freshFor:10000}),f.ctx.decode));
 const ef=f.append('evidence-record',json({evidence:e})).fact;
 const graph=value(createRunGraph({...f.deps,settlement:{owner:'part-eight' as const,read:(reference:any)=>f.success({record:reference,outcome,claimClosed:true,chargeSettled:true})}}));
 const ready=value(graph.transition({...observed,to:'ready',blockedOn:{kind:'nothing'},settlement:ref(ef)}));
 const second=f.append('next-inbound',json({capture:{reference:'message:2',hash:f.ctx.captures['message:2']!.hash}})).fact;
 f.setMutation((s:any,o:any,g:any)=>{s.reason='live-input';s.previousDelivery=first.sf.id;s.input=second.id;s.inputDigest=f.ctx.captures['message:2']!.hash;s.step='step:operation:2';o.input=s.input;o.step=s.step;g.intake=ref(second);g.lastInbound=ref(second);g.step=s.step;g.contextDeliveryReason=s.reason;g.messages.push({fact:ref(second),sequence:second.segment.position,capture:'message:2',hash:f.ctx.captures['message:2']!.hash});
  s.contextManifest.push({class:'message',reference:'message:2',digest:f.ctx.captures['message:2']!.hash});o.contextDigests=s.contextManifest.map((r:any)=>r.digest);
 });
 const g2=value(graph.ground(f.id,'w','h','start',f.lease)),t=f.start(ready,g2,'operation:2');
 const secondRunning=value(graph.transition({...t,trigger:ref(second)}));
 return {first,firstGrounding:g1,running,ready,secondGrounding:g2,secondRunning,last:f.last()};
}

export function closingRun() {
  const f = setup(), ready = value(f.graph.open(f.run));
  const check = value(decode('Evidence', f.evidenceInput({ id: 'exit-read-check', claim: { subject: f.run.exitTest.subject,
    predicate: `exit:${f.run.exitTest.check}:${f.run.exitTest.version}`, value: f.run.exitTest.acceptance }, freshFor: 1000 }), f.ctx.decode));
  const checkFact = f.append('evidence-record', json({ evidence: check })).fact;
  const result = value(decode('Result', { type: 'Result', schemaVersion: 1, kind: 'Success', value: 'terminal artifact', capacity: { kind: 'none' } }, f.ctx.decode));
  const resultFact = f.append('result-record', json({ result })).fact;
  const exit = { type: 'RunExit', schemaVersion: 1, id: 'exit-read-proposal', run: f.id, expected: ready.head, proposer: f.owner,
    standing: ref(f.opening), frontier: ready.source.foldedThrough, at: f.now, kind: 'completed', exitTest: f.run.exitTest,
    check: ref(checkFact), evidence: [{ type: 'Evidence', id: check.id, fact: ref(checkFact), field: 'evidence' }],
    result: { type: 'Result', id: 'result:exit-read', fact: ref(resultFact), field: 'result' }, settledOperations: [] };
  const proposal = { type: 'RunTransition', schemaVersion: 1, id: 'exit-read-propose', run: f.id, expected: ready.head,
    trigger: ref(checkFact), kind: 'propose-exit', from: 'ready', to: 'closing', responsible: f.owner, standing: ref(f.opening), ownership: f.lease,
    generation: f.run.generation, at: f.now, blockedOn: { kind: 'nothing' }, nextWake: f.run.nextWake, exit };
  const closing = value(f.graph.transition(proposal));
  const terminalExit = { ...exit, id: 'exit-read-terminal', expected: closing.head };
  const close = { ...proposal, id: 'exit-read-close', expected: closing.head, kind: 'close', from: 'closing', to: 'completed', exit: terminalExit };
  return { ...f, ready, closing, terminalExit, close };
}

export function completedRun() {
  const f = closingRun();
  const completed = value(f.graph.transition(f.close));
  const closeFact = value(f.store.read()).at(-1)!;
  return { ...f, completed, closeFact };
}
