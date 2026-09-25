// docs/08: preservation -> dedup -> authentication -> resolution -> requester admission.
// No grant/Authorization/Directive producer, model call, session launch or effect lives here.
import { canonical,decode,decodeMeasurement,historicalGrantLiveness,scopeIncludes } from '../index.js';
import type { BoundaryContext,Clock,Directive,FactEnvelopeReference,Json,Provenance,Result,VerifiedPrincipal } from '../index.js';
import { authorAndAppend,causalCone,causalStanding,createFactStore,decodeHistoricalBody,hashBytes,prepareSnapshot } from '../facts/index.js';
import type { FactContext,FactEnvelope,FactStatus } from '../facts/index.js';
import { constructGoverned,generationOf,readEnforcedRecord,readRegisterEntry } from '../register/index.js';
import { foldProjection,readProjection } from '../projections/index.js';
import { boundary,IntakeFailure,json,object,requireIntake,same,take,text } from './boundary.js';
import type { InboundRoute,IntakeDependencies,IntakeDisposition,IntakePort,SenderEvidence,VerifiedActAdmission,VerifiedActDisposition } from './contracts.js';
import { buildVerifiedActRecord,intakeArrival,intakeScopesOverlap,intakeDedupDefinition,intakeFactSchemas,intakeStopRegistration,
  intakeVerifiedActFactSchemas,intakeVerifiedActRegistration,intakeWorkRegistration } from './records.js';

const reference=(f: FactEnvelope): FactEnvelopeReference => Object.freeze({ owner: 'part-two',name: 'FactEnvelope',id: f.id });
type Classified={ kind: 'conversation'; ask: string; flags: readonly 'cannot-decide'[] }|{ kind: 'stop' }|{ kind: 'needs-judgment' };
// Closed slice protocol, not a natural-language classifier or the full command surface.
// A message is pre-decision conversational input; it can exercise no authority here.
export function classifySlicePayload(input: unknown): Classified {
  try {
    const v=object(json(input));
    if(v.schemaVersion!==1) return { kind: 'needs-judgment' };
    if(v.kind==='message'&&typeof v.text==='string'&&v.text.length>0
      &&(v.signal===undefined||v.signal==='cannot-decide')
      &&Object.keys(v).every(k => ['schemaVersion','kind','text','signal'].includes(k)))
      return { kind: 'conversation',ask: v.text,flags: v.signal==='cannot-decide'? ['cannot-decide']:[] };
    if(v.kind==='stop'&&v.command==='/stop'&&Object.keys(v).every(k => ['schemaVersion','kind','command'].includes(k))) return { kind: 'stop' };
    return { kind: 'needs-judgment' };
  } catch { return { kind: 'needs-judgment' }; }
}

export function createIntakePort(deps: IntakeDependencies): Result<IntakePort> {
  const initial=deps.context();
  const b: BoundaryContext={ site: 'intake.admit',preserved: initial.preserved,register: initial.decode.register };
  return boundary('IntakeConstruction',b,() => {
    take(constructGoverned('features','intake-slice',deps.governance.register,deps.governance.context));
    take(constructGoverned('parsers',deps.adapter.id,deps.governance.register,deps.governance.context));
    const declaration=deps.governance.register.entries.find(e => e.declaration.id===deps.adapter.id)!.declaration;
    requireIntake(declaration.status==='live','P4-NF-06: intake adapter must be live');
    const contract=object(json(declaration.requiredFacts));
    const eventAuthority=object(contract.eventIdAuthority!);
    requireIntake(text(eventAuthority.mintedBy,'event-id authority')!=='sender'
      &&object(eventAuthority.fallbackFingerprint!).policy==='none','P4-NF-03: slice requires provider-minted stable event ids; no hash fallback');
    requireIntake(typeof eventAuthority.replayWindow==='number'&&eventAuthority.replayWindow>=0,'P4-NF-03: declared replay window required');
    requireIntake(deps.capture.owner==='part-ten'&&deps.storage.owner==='part-ten','P4-NF-01: durable storage owner required');
    requireIntake(Number.isSafeInteger(deps.holdMaxAge)&&deps.holdMaxAge>0
      &&Number.isSafeInteger(deps.holdMaxActive)&&deps.holdMaxActive>0,'P4-NF-15: finite positive hold bounds required');
    requireIntake(Number.isFinite(deps.dedupStalenessBound)&&deps.dedupStalenessBound>0,'P4-NF-03: dedup requires a finite currency bound');
    requireIntake(typeof deps.workOwner==='string'&&deps.workOwner.length>0,'P4-NF-12: work requires declared owner and blocked-on state');
    requireIntake(deps.author.principal.kind==='system'&&deps.author.provenance.class==='verified','P4-NF-09: intake observer requires verified system identity','standing');
    take(decode('VerifiedPrincipal',{ type: 'VerifiedPrincipal',schemaVersion: 1,id: deps.author.principal.id,kind: 'system' },
      { ...initial.decode,provenance: deps.author.principal.provenance }));
    const scope=take(decode('Scope',deps.scope,initial.decode));
    const schemas=intakeFactSchemas(scope);
    for(const schema of schemas) requireIntake(initial.schemas.some(s => same(s,schema)),
      `P4-NF-06/12: required owner schema changed or missing: ${schema.kind}`);
    const verifiedActSchemas=intakeVerifiedActFactSchemas(scope);
    const hasVerifiedActSchemas=verifiedActSchemas.every(schema => initial.schemas.some(s => same(s,schema)));
    const registerGeneration=take(generationOf(deps.governance.register,deps.governance.context));
    const registerGenerationReference={ owner: 'part-three',name: 'RegisterGeneration',id: registerGeneration.id } as const;
    const workRegistration=take(intakeWorkRegistration(b,deps.author.principal.id));
    const stopRegistration=take(intakeStopRegistration(b,deps.author.principal.id));
    const verifiedActRegistration=hasVerifiedActSchemas
      ? take(intakeVerifiedActRegistration(b,deps.author.principal.id,registerGenerationReference)):undefined;
    // Snapshot assembly choices. Only context()/clock()/storage are live provider inputs.
    const adapterId=deps.adapter.id,owner=deps.workOwner,maxAge=deps.holdMaxAge,maxActive=deps.holdMaxActive;
    const authenticate=deps.adapter.authenticate.bind(deps.adapter),parse=deps.adapter.parse.bind(deps.adapter);
    const author=Object.freeze({ ...deps.author });
    let busy=false;
    const identity=(f: FactEnvelope) => take(canonical([object(f.body).logicalId,object(f.body).rawHash])).bytes;

    // Runtime record reads and actual owner calls are colocated for P3's source
    // proof. All gates run after preservation; maintenance/receipt append is not
    // ordinary work admission and must remain available to retain refusals/stop.
    function authenticateSender(raw: string,route: InboundRoute,at: Clock,preserved: string) {
      const g={ ...deps.governance.context,preserved };
      take(constructGoverned('blocking sites','intake.authentication',deps.governance.register,g));
      take(constructGoverned('governed documents','intake.contract',deps.governance.register,g));
      take(readEnforcedRecord('intake.authentication','intake.contract','decode:Provenance',deps.governance.register,g));
      const e=take(authenticate(raw,route,at));
      requireIntake(e.channel===route.channel&&e.sender===route.sender&&e.identityEpoch===route.identityEpoch,'P4-NF-02: evidence does not bind transport route','standing');
      const provenance=take(decode('Provenance',e.provenance,context(preserved).decode));
      const declarations=contract.authenticationClass;
      requireIntake(Array.isArray(declarations)&&declarations.some(d => object(d).stimulusType==='message'&&object(d).class===provenance.class),'P4-NF-02: adapter authentication class overclaim','standing');
      requireIntake(provenance.adapter===adapterId,'P4-NF-02: authentication adapter mismatch','standing');
      return { e,provenance };
    }
    function resolvePrincipal(e: SenderEvidence,provenance: Provenance,preserved: string): VerifiedPrincipal {
      const g={ ...deps.governance.context,preserved };
      take(constructGoverned('blocking sites','intake.resolution',deps.governance.register,g));
      take(readEnforcedRecord('intake.resolution','intake.contract','decode:VerifiedPrincipal',deps.governance.register,g));
      // The registered scheduled parser is the sole system-message exception.
      // Its authenticate callback verifies the source credential, immutable
      // occurrence and live authority before this decoder binds identity.
      requireIntake(e.principalKind==='person'||(adapterId==='scheduled-intake-v1'
        &&e.principalKind==='system'&&provenance.class==='verified'
        &&e.sender===e.principalId&&e.channel.startsWith('scheduled:')),
      'P4-NF-09: system/agent stimuli require the verified scheduled parser','standing');
      return take(decode('VerifiedPrincipal',{ type: 'VerifiedPrincipal',schemaVersion: 1,id: e.principalId,kind: e.principalKind },
        { ...context(preserved).decode,provenance }));
    }
    function stopGate(preserved: string): void {
      const g={ ...deps.governance.context,preserved };
      take(constructGoverned('blocking sites','intake.stop',deps.governance.register,g));
      const gate=take(readRegisterEntry('intake.stop',deps.governance.register,g)).declaration;
      requireIntake(gate.status==='live'&&gate.requiredFacts.authority==='block'
        &&gate.requiredFacts.decidesAlone==='ruled-three'&&gate.requiredFacts.failDirection==='open',
        'P4-NF-06/14: stop requires its live ruled-three, safety-open declaration','integrity');
    }

    function context(preserved: string,principal?: VerifiedPrincipal): FactContext {
      const c=deps.context();
      const ordinaryRegistrations=[...c.ownedBodies?.filter(r => !(r.owner==='part-four'
        &&['IntakeWork','IntakeStop','VerifiedActDisposition'].includes(r.name)))??[],workRegistration,stopRegistration];
      return {
        ...c,preserved,ownedBodies: [...ordinaryRegistrations,...verifiedActRegistration? [verifiedActRegistration]:[]],decode: {
          ...c.decode,preserved,
          principals: [...c.decode.principals??[],author.principal,...principal? [principal]:[]]
        }
      };
    }
    function verifiedActContext(preserved: string): FactContext {
      const c=context(preserved);
      requireIntake(verifiedActRegistration,'verified act: additive intake seam is unavailable because its fact schemas are not installed','standing');
      return c;
    }
    function read(preserved: string,seam=false): readonly FactEnvelope[] {
      const c=seam? verifiedActContext(preserved):context(preserved);
      return [...new Map([...c.facts,...take(createFactStore(c,deps.storage).read())].map(f => [f.id,f])).values()];
    }
    function append(kind: string,body: Json,at: Clock,preserved: string,required: readonly string[]=[],principal?: VerifiedPrincipal,
      directives?: readonly Directive[]): FactEnvelope {
      if(kind==='intake-admitted') {
        const g={ ...deps.governance.context,preserved };
        take(constructGoverned('blocking sites','intake.admission',deps.governance.register,g));
        take(readEnforcedRecord('intake.admission','intake.contract','authorAndAppend',deps.governance.register,g));
      }
      const base=context(preserved,principal);
      const c=directives? { ...base,decode: { ...base.decode,directives } }:base;
      const receipt=take(authorAndAppend({
        kind,schemaVersion: 1,machine: author.machine,principal: json(author.principal),
        provenance: json(author.provenance),at: json(at),body,required: [...new Set(required)]
      },c,createFactStore(c,deps.storage),author.privateKey));
      requireIntake(receipt.taint.length===0,'P4-NF-24: authority-tainted append cannot admit work','integrity');
      return receipt.fact;
    }
    function appendVerifiedAct(record: ReturnType<typeof buildVerifiedActRecord>['record'],at: Clock): FactEnvelope {
      const c=verifiedActContext(record.request);
      const receipt=take(authorAndAppend({ kind: 'intake-verified-act',schemaVersion: 1,machine: author.machine,
        principal: json(author.principal),provenance: json(author.provenance),at: json(at),body: {
          request: record.request,requestDigest: record.requestDigest,challenge: record.challenge,surface: record.surface,
          generation: record.generation,disposition: record.disposition,record: json(record)
        },required: [record.request] },c,createFactStore(c,deps.storage),author.privateKey));
      requireIntake(receipt.taint.length===0,'P4-NF-24: authority-tainted verified act cannot be admitted','integrity');
      return receipt.fact;
    }
    function statuses(preserved: string): readonly FactStatus[] {
      const c=context(preserved),facts=read(preserved);
      return take(prepareSnapshot(facts,{ ...c,facts })).entries;
    }
    function checkDedup(at: Clock,preserved: string): void {
      const g={ ...deps.governance.context,preserved };
      take(constructGoverned('blocking sites','intake.dedup',deps.governance.register,g));
      take(readEnforcedRecord('intake.dedup','intake.contract','readProjection',deps.governance.register,g));
      const c=context(preserved),facts=read(preserved);
      const definition=intakeDedupDefinition([...new Set(c.schemas.map(s => s.kind))],deps.dedupStalenessBound);
      const snapshot=take(prepareSnapshot(facts,{ ...c,facts }));
      const view=take(foldProjection(definition,snapshot,deps.dedupGeneration(),{ ...b,preserved }));
      take(readProjection(view,definition,at,{ ...b,preserved },c.folded));
    }
    function admitVerifiedAct(input: VerifiedActAdmission): Result<VerifiedActDisposition> {
      return boundary('IntakeVerifiedAct',{ ...b,preserved: input?.request?.id??initial.preserved },() => {
        requireIntake(hasVerifiedActSchemas,
          'verified act: additive intake seam is unavailable because its fact schemas are not installed','standing');
        const at=take(decodeMeasurement('clock',deps.clock(),initial.decode));
        take(constructGoverned('parsers',input.surface,deps.governance.register,
          { ...deps.governance.context,preserved: input.proof.reference }));
        const surface=take(readRegisterEntry(input.surface,deps.governance.register,
          { ...deps.governance.context,preserved: input.proof.reference }));
        requireIntake(surface.declaration.status==='live','verified act: surface adapter is not live','standing');
        const facts=read(input.request.id,true),c={ ...verifiedActContext(input.request.id),facts };
        const resolved=buildVerifiedActRecord(json(input),c,at,registerGeneration.id);
        const authentication=surface.declaration.requiredFacts.authenticationClass;
        requireIntake(Array.isArray(authentication)&&authentication.some(row => {
          const v=object(row); return v.stimulusType==='operator-act'&&v.class==='verified';
        }),'verified act: surface adapter is not registered for verified operator acts','standing');
        const record=resolved.record;
        requireIntake(resolved.emergency||c.decode.register.generation.id===registerGeneration.id,
          'verified act: live decoder and loaded register generations differ','stale-base');
        const fact=appendVerifiedAct(record,at);
        return { kind: record.disposition,fact: reference(fact) };
      });
    }
    function expire(at: Clock,preserved: string): number {
      const facts=read(preserved),terminals=new Set(facts.filter(f => f.kind==='intake-expired').map(f => object(f.body).hold));
      const resolved=new Set(facts.filter(f => f.kind==='intake-admitted').map(identity));
      const overdue=facts.filter(f => f.kind==='intake-held'&&!terminals.has(f.id)&&!resolved.has(identity(f))&&Number(object(f.body).expiresAt)<=at.value);
      for(const f of overdue) append('intake-expired',{ hold: f.id,terminal: object(f.body).reason==='needs-judgment'? 'expired-judgment':'expired-unresolved' },at,preserved,[f.id]);
      return overdue.length;
    }
    function hold(reason: string,common: Record<string,Json>,at: Clock,capture: string): never {
      expire(at,capture);
      const facts=read(capture),expired=new Set(facts.filter(f => f.kind==='intake-expired').map(f => object(f.body).hold));
      const resolved=new Set(facts.filter(f => f.kind==='intake-admitted').map(identity));
      const active=facts.filter(f => f.kind==='intake-held'&&!expired.has(f.id)&&!resolved.has(identity(f))&&object(f.body).coalescedInto==='none');
      const group=active.length>=maxActive? active.find(f => object(f.body).channel===common.channel):undefined;
      // Each input still has its own capture + counted hold fact. Only active queue slots coalesce.
      const coalescedInto=active.length>=maxActive? group?.id??'overflow':'none';
      const input=take(decode('UnresolvedInput',{
        type: 'UnresolvedInput',schemaVersion: 1,raw: common.rawHash,
        channel: common.channel,at,reason
      },context(capture).decode));
      const fact=append('intake-held',{
        ...common,input: json(input),reason,owner,
        expiresAt: at.value+maxAge,coalescedInto
      },at,capture,[text(common.receipt,'receipt')]);
      take(boundary('IntakeHeldRefusal',{ ...b,preserved: fact.id },() => {
        throw new IntakeFailure(`P4-NF-10/24/26: preserved hold (${reason}); owner ${owner}`,reason==='unresolved-sender'? 'standing':'policy');
      }));
      throw new Error('unreachable');
    }
    function receive(raw: string,routeInput: InboundRoute): Result<IntakeDisposition> {
      // Ingress is retained uninterpreted; no classification or admission before receipt.
      let preserved=initial.preserved;
      return boundary('IntakeReceive',{ ...b,preserved },() => {
          const at=take(decodeMeasurement('clock',deps.clock(),initial.decode));
          const captured=take(deps.capture.preserve(raw,at)); preserved=captured.reference;
          requireIntake(captured.hash===hashBytes(raw),'P4-NF-01: capture hash differs from received bytes','integrity');
          const receipt=append('intake-receipt',{ capture: json(captured),rawHash: captured.hash,adapter: adapterId,
            ingress: take(canonical(routeInput)).bytes },at,preserved);
          preserved=receipt.id;
          return take(boundary<IntakeDisposition>('IntakePreserved',{ ...b,preserved: receipt.id },() => {
            requireIntake(!busy,'P4-NF-01: overlapping arrival durably queued; recover its receipt','integrity');
            busy=true;
            try {
            const route=object(JSON.parse(text(object(receipt.body).ingress,'ingress')) as Json);
            const channel=text(route.channel,'authenticated channel'),sender=text(route.sender,'transport sender');
            const identityEpoch=text(route.identityEpoch,'identity epoch');
            const logicalId=take(canonical([adapterId,channel,sender,identityEpoch,route.eventId??receipt.id])).hash;
            const common={
              logicalId,receipt: receipt.id,rawHash: captured.hash,adapter: adapterId,channel,sender,identityEpoch,
              eventId: typeof route.eventId==='string'&&route.eventId.length? route.eventId:'missing'
            };
            if(typeof route.eventId!=='string'||route.eventId.length===0) hold('missing-provider-event-id',common,at,preserved);
            requireIntake(intakeArrival(receipt,author.principal.id),'P4-NF-10/24: preserved receipt has an invalid arrival identity');
            const arrivals=read(preserved).filter(f => intakeArrival(f,author.principal.id)?.logicalId===logicalId);
            const original=arrivals[0]!;
            const prior=read(preserved).find(f => ['intake-admitted','intake-stop','intake-stop-signal'].includes(f.kind)&&object(f.body).logicalId===logicalId);
            if(object(original.body).rawHash!==captured.hash) {
              const signal=append('intake-mismatch',{ ...common,original: original.id },at,preserved,[receipt.id,original.id]);
              return take(boundary<IntakeDisposition>('IntakeMismatch',{ ...b,preserved: signal.id },() => { throw new IntakeFailure('P4-NF-03/08: same event id, different arrival bytes; attack signal recorded','integrity'); }));
            }
            // Ordinary duplicate returns no reusable Intent/authority. Stops authenticate again
            // before reasserting; an attacker cannot borrow a prior operator's brake.
            if(prior?.kind==='intake-admitted') {
              checkDedup(at,preserved);
              append('intake-collapse',{ ...common,original: prior.id },at,preserved,[receipt.id,prior.id]);
              return { kind: 'duplicate',logicalId,original: reference(prior) };
            }
            let principal: VerifiedPrincipal;
            try {
              const { e,provenance }=authenticateSender(raw,{ channel,sender,identityEpoch,eventId: route.eventId },at,preserved);
              principal=resolvePrincipal(e,provenance,preserved);
            } catch { return hold('unresolved-sender',common,at,preserved); }
            const rows=statuses(preserved);
            const historicalGrants: NonNullable<FactContext['historicalGrants']>[number][]=[];
            const historicalRevocations: NonNullable<FactContext['historicalRevocations']>[number][]=[];
            const historicalContext={ ...context(preserved),facts: read(preserved),historicalGrants,historicalRevocations };
            for(const r of [...rows].sort((a,b) => causalCone(a.fact,historicalContext.facts).length-causalCone(b.fact,historicalContext.facts).length)) {
              if(!historicalContext.schemas.some(s => s.kind===r.fact.kind&&s.version===r.fact.schemaVersion
                &&Object.values(s.fields).some(f => f.kind==='constitutional'&&['StandingGrant','Revocation'].includes(f.type)))) continue;
              const body=take(decodeHistoricalBody(r.fact,historicalContext,historicalContext.decode));
              historicalGrants.push(...body.grants.map(grant => ({ factId: r.fact.id,grant })));
              historicalRevocations.push(...body.revocations.map(revocation => ({ factId: r.fact.id,revocation })));
            }
            const authorityContext=historicalContext;
            const causalNow=causalStanding(receipt,authorityContext,false).now;
            const candidates=rows.filter(r => r.fact.kind==='conversation-binding'&&object(r.body).adapter===adapterId&&object(r.body).channel===channel);
            const superseded=new Set(candidates.map(r => object(r.body).supersedes));
            const heads=candidates.filter(r => !superseded.has(r.fact.id));
            const matches=(r: FactStatus) => object(r.body).sender===sender&&object(r.body).identityEpoch===identityEpoch&&object(r.body).principalId===principal.id
              &&r.fact.provenance.class==='verified'&&r.conflicts.every(c => c.kind==='revocation-conflict')
              &&!r.taint.includes('evidence-unavailable');
            const grantFor=(r: FactStatus) => historicalGrants.find(g => g.grant.view.id===object(r.body).grantId
              &&g.grant.view.grantee.id===principal.id&&g.grant.view.standing==='operator'
              &&causalCone(r.fact,historicalContext.facts).some(f => f.id===g.factId)
              &&scopeIncludes(take(decode('Scope',g.grant.view.scope,initial.decode)),take(decode('Scope',object(r.body).scope,initial.decode)))
              &&take(historicalGrantLiveness(g.grant,historicalRevocations.filter(v => causalCone(r.fact,historicalContext.facts).some(f => f.id===v.factId)).map(v => v.revocation),
                causalStanding(r.fact,authorityContext,false).now,preserved))==='live');
            const binding=heads.length===1&&matches(heads[0]!)&&grantFor(heads[0]!)
              &&scopeIncludes(take(decode('Scope',object(heads[0]!.body).scope,initial.decode)),scope)
              &&heads[0]!.taint.length===0&&heads[0]!.conflicts.length===0
              &&take(historicalGrantLiveness(grantFor(heads[0]!)!.grant,historicalRevocations.map(r => r.revocation),causalNow,preserved))==='live'? heads[0]:undefined;
            // A stale/contested selection grants no direction. A previously verified binding
            // can still authenticate a stop. Changed identity epochs never select the old account.
            const stopBinding=candidates.find(r => matches(r)&&grantFor(r));
            let classification: Classified;
            try { classification=classifySlicePayload(parse(raw)); }
            catch { return hold('needs-judgment',common,at,preserved); }
            if(classification.kind==='stop') {
              stopGate(preserved);
              if(stopBinding) {
                const reach=take(decode('Scope',object(stopBinding.body).scope,context(preserved).decode));
                const verifiedPrior=rows.find(r => r.fact.id===prior?.id&&r.fact.kind==='intake-stop'&&!r.taint.length&&!r.conflicts.length);
                const stop=verifiedPrior?.fact??append('intake-stop',{
                  ...common,binding: stopBinding.fact.id,
                  scope: json(reach),principalId: principal.id,authentication: json(principal.provenance.record),authority: { type: 'IntakeStop',schemaVersion: 1 }
                },at,preserved,[receipt.id,stopBinding.fact.id],principal);
                return { kind: 'stopped',logicalId,fact: reference(stop),scope: reach,fencingOwner: 'part-six' };
              }
              const signal=prior?.kind==='intake-stop-signal'? prior:append('intake-stop-signal',{ ...common,principalId: principal.id,authentication: json(principal.provenance.record) },at,preserved,[receipt.id],principal);
              return { kind: 'stop-signal',logicalId,fact: reference(signal),priority: 'highest',halts: false };
            }
            const resolution=append('intake-resolved',{
              ...common,principalId: principal.id,
              authentication: json(principal.provenance.record),binding: binding?.fact.id??'none'
            },at,preserved,[receipt.id,...binding? [binding.fact.id]:[]]);
            if(classification.kind==='needs-judgment') return hold('needs-judgment',common,at,preserved);
            expire(at,preserved);
            if(statuses(preserved).some(r => r.fact.kind==='intake-stop'&&!r.conflicts.length&&!r.taint.length
              &&intakeScopesOverlap(take(decode('Scope',object(r.body).scope,context(preserved).decode)),scope))) return hold('stopped',common,at,preserved);
            checkDedup(at,preserved);
            // Requester service is deliberately the only admission class. Bound operator
            // selection is context, not an Authorization or a permission to change governance.
            const directiveRows=rows.flatMap(r => historicalContext.schemas.filter(s => s.kind===r.fact.kind&&s.version===r.fact.schemaVersion)
              .flatMap(s => Object.entries(s.fields).filter(([,field]) => field.kind==='constitutional'&&field.type==='Directive')
                .map(([field]) => ({ row: r,raw: object(object(r.body)[field]!) }))));
            const supersededDirectives=new Set(directiveRows.map(d => d.raw.supersedes));
            const liveDirectives=[...context(preserved).decode.directives?.filter(d => !d.closedBy&&!supersededDirectives.has(d.id)&&scopeIncludes(d.scope,scope))??[]];
            for(const d of directiveRows.filter(d => !d.raw.closedBy&&!supersededDirectives.has(d.raw.id)
              &&scopeIncludes(take(decode('Scope',d.raw.scope,initial.decode)),scope))) {
              const live=d.row.constitutional.find(f => f.value.type==='Directive'&&f.value.id===d.raw.id)?.value;
              requireIntake(live?.type==='Directive'&&!d.row.taint.length&&!d.row.conflicts.length,
                'P4-NF-25: active directive requires a current constitutional value','integrity');
              if(!liveDirectives.some(d => d.id===live.id)) liveDirectives.push(live);
            }
            const required=[receipt.id,resolution.id,...binding? [binding.fact.id]:[]];
            const under: string[]=[];
            for(const directive of liveDirectives) {
              const record=rows.find(r => r.constitutional.some(f => f.value.type==='Directive'&&f.value.id===directive.id)&&!r.taint.length&&!r.conflicts.length);
              requireIntake(record,'P4-NF-25: directive missing from admitted causal position','integrity');
              required.push(record.fact.id); under.push(directive.id);
            }
            const receivedAt=original.at;
            required.push(original.id);
            const intent=take(decode('Intent',{
              type: 'Intent',schemaVersion: 1,id: logicalId,principal,receivedAt,
              via: adapterId,raw: captured.hash,ask: classification.ask,under: under.sort()
            },
              { ...context(preserved,principal).decode,directives: liveDirectives }));
            // A second port may have completed while our adapter callback ran. P2's
            // owner decoder also rejects a causally prior admission at the append seam.
            const committed=read(preserved).find(f => f.kind==='intake-admitted'&&object(f.body).logicalId===logicalId);
            if(committed) {
              requireIntake(object(committed.body).rawHash===captured.hash,'P4-NF-03: concurrent arrival hash mismatch','integrity');
              checkDedup(at,preserved);
              append('intake-collapse',{ ...common,original: committed.id },at,preserved,[receipt.id,committed.id]);
              return { kind: 'duplicate',logicalId,original: reference(committed) };
            }
            const admitted=append('intake-admitted',{
              ...common,intent: json(intent),
              work: {
                type: 'IntakeWork',schemaVersion: 1,owner,blockedOn: 'run-admission',standing: 'requester',
                ...classification.flags.length? { deliveryFlag: 'cannot-decide' }:{}
              },
              binding: binding?.fact.id??'none'
            },at,preserved,required,principal,liveDirectives);
            return {
              kind: 'admitted',logicalId,lastInboundId: common.eventId,intent,fact: reference(admitted),owner,blockedOn: 'run-admission',standing: 'requester',boundOperator: !!binding,
              flags: Object.freeze([...classification.flags])
            };
            } finally { busy=false; }
          }));
      });
    }
    return Object.freeze({
      receive,recover: (receiptId: string) => boundary('IntakeRecovery',{ ...b,preserved: receiptId },() => {
        const receipt=read(receiptId).find(f => f.id===receiptId&&f.kind==='intake-receipt'&&object(f.body).adapter===adapterId);
        requireIntake(receipt,'P4-NF-01: unknown durable intake receipt');
        const arrival=intakeArrival(receipt,author.principal.id);
        requireIntake(arrival,'P4-NF-02/10: preserved observation is not an eligible observer arrival');
        const body=object(receipt.body),capture=context(receiptId).captures[text(object(body.capture!).reference,'capture')];
        requireIntake(capture?.status==='available'&&typeof capture.bytes==='string'&&hashBytes(capture.bytes)===body.rawHash,'P4-NF-01: recovery capture unavailable','integrity');
        return take(receive(capture.bytes,arrival.route));
      }),expireHolds: () => boundary('IntakeExpiry',b,
        () => expire(take(decodeMeasurement('clock',deps.clock(),initial.decode)),initial.preserved)),
      admitVerifiedAct
    });
  });
}
