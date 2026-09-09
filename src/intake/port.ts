// docs/08: preservation -> dedup -> authentication -> resolution -> requester admission.
// No grant/Authorization/Directive producer, model call, session launch or effect lives here.
import { canonical,decode,decodeMeasurement,historicalGrantLiveness,readHistoricalEvidence,scopeIncludes } from '../index.js';
import type { BoundaryContext,Clock,Directive,Evidence,FactEnvelopeReference,HistoricalRead,Intent,Json,Provenance,Result,Revocation,StandingGrant,VerifiedPrincipal } from '../index.js';
import { authorAndAppend,causalCone,causalStanding,createFactStore,decodeEnvelope,decodeHistoricalBody,factId,foldKey,hashBytes,prepareSnapshot,signEnvelope } from '../facts/index.js';
import type { FactContext,FactEnvelope,FactStatus } from '../facts/index.js';
import { constructGoverned,generationOf,readEnforcedRecord,readRegisterEntry } from '../register/index.js';
import { wasVerified } from '../register/generator.js';
import { foldProjection,readProjection } from '../projections/index.js';
import { boundary,IntakeFailure,json,object,requireIntake,same,take,text } from './boundary.js';
import type { ConstitutionalReference,InboundRoute,IntakeDependencies,IntakeDisposition,IntakePort,PendingScheduledAdmissions,
  PendingScheduledAdmissionsInput,ScheduledTickAdmission,SenderEvidence,VerifiedActAdmission,VerifiedActDisposition } from './contracts.js';
import { buildVerifiedActRecord,intakeArrival,isScheduledIntakeAdmission,intakeScopesOverlap,intakeDedupDefinition,intakeFactSchemas,intakeStopRegistration,
  intakeVerifiedActRegistration,intakeWorkRegistration,scheduledIntakeFactSchemas,decodeScheduledTickBody,validateScheduledIntakeRoute,
  bindIntakeOwnerRegister,registeredScheduledIntakeAdapters } from './records.js';

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
    // Preserve the pre-existing delayed governance refusal: a shape-only
    // register may construct the port, but can authorize nothing after the
    // receipt is preserved. Only an entering-force verified register can add
    // scheduled adapter capabilities to the owner decoder.
    const verifiedGovernanceRegister=wasVerified(deps.governance.register)?deps.governance.register:undefined;
    if(verifiedGovernanceRegister) bindIntakeOwnerRegister(initial.decode.register,verifiedGovernanceRegister);
    const registeredScheduledAdapters=verifiedGovernanceRegister
      ?registeredScheduledIntakeAdapters(verifiedGovernanceRegister,initial.decode.register):Object.freeze([] as string[]);
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
    const registerGeneration=take(generationOf(deps.governance.register,deps.governance.context));
    const registerGenerationReference={ owner: 'part-three',name: 'RegisterGeneration',id: registerGeneration.id } as const;
    // The scheduled principal schema is additive. Existing conversation-only
    // compositions remain constructible and the scheduled arm checks its own
    // schema when that operation is invoked.
    for(const schema of intakeFactSchemas(scope)) requireIntake(initial.schemas.some(s => same(s,schema)),
      `P4-NF-06/12: required owner schema changed or missing: ${schema.kind}`);
    const workRegistration=take(intakeWorkRegistration(b,deps.author.principal.id,verifiedGovernanceRegister));
    const stopRegistration=take(intakeStopRegistration(b,deps.author.principal.id));
    const verifiedActRegistration=take(intakeVerifiedActRegistration(b,deps.author.principal.id,registerGenerationReference));
    // Snapshot assembly choices. Only context()/clock()/storage are live provider inputs.
    const adapterId=deps.adapter.id,owner=deps.workOwner,maxAge=deps.holdMaxAge,maxActive=deps.holdMaxActive;
    const authenticate=deps.adapter.authenticate.bind(deps.adapter),parse=deps.adapter.parse.bind(deps.adapter);
    const author=Object.freeze({ ...deps.author });
    let busy=false;
    const identity=(f: FactEnvelope) => take(canonical([object(f.body).logicalId,object(f.body).rawHash])).bytes;

    // Runtime record reads and actual owner calls are colocated for P3's source
    // proof. All gates run after preservation; maintenance/receipt append is not
    // ordinary work admission and must remain available to retain refusals/stop.
    function authenticateSender(raw: string,route: InboundRoute,at: Clock,preserved: string,stimulusType='message') {
      const g={ ...deps.governance.context,preserved };
      take(constructGoverned('blocking sites','intake.authentication',deps.governance.register,g));
      take(constructGoverned('governed documents','intake.contract',deps.governance.register,g));
      take(readEnforcedRecord('intake.authentication','intake.contract','decode:Provenance',deps.governance.register,g));
      const e=take(authenticate(raw,route,at));
      requireIntake(e.channel===route.channel&&e.sender===route.sender&&e.identityEpoch===route.identityEpoch,'P4-NF-02: evidence does not bind transport route','standing');
      const provenance=take(decode('Provenance',e.provenance,context(preserved).decode));
      const declarations=contract.authenticationClass;
      requireIntake(Array.isArray(declarations)&&declarations.some(d => object(d).stimulusType===stimulusType&&object(d).class===provenance.class),'P4-NF-02: adapter authentication class overclaim','standing');
      requireIntake(provenance.adapter===adapterId,'P4-NF-02: authentication adapter mismatch','standing');
      return { e,provenance };
    }
    function resolvePrincipal(e: SenderEvidence,provenance: Provenance,preserved: string,expected: 'person'|'system'='person'): VerifiedPrincipal {
      const g={ ...deps.governance.context,preserved };
      take(constructGoverned('blocking sites','intake.resolution',deps.governance.register,g));
      take(readEnforcedRecord('intake.resolution','intake.contract','decode:VerifiedPrincipal',deps.governance.register,g));
      requireIntake(e.principalKind===expected,expected==='person'
        ? 'P4-NF-09: system/agent stimuli are out of this message slice; locality grants nothing'
        : 'P4-NF-09: scheduled intake requires a system principal','standing');
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
      return {
        ...c,preserved,ownedBodies: [...c.ownedBodies?.filter(r => !(r.owner==='part-four'&&['IntakeWork','IntakeStop','VerifiedActDisposition'].includes(r.name)))??[],
          workRegistration,stopRegistration,verifiedActRegistration],decode: {
          ...c.decode,preserved,
          principals: [...c.decode.principals??[],author.principal,...principal? [principal]:[]]
        }
      };
    }
    function read(preserved: string): readonly FactEnvelope[] {
      const c=context(preserved);
      return [...new Map([...c.facts,...take(createFactStore(c,deps.storage).read())].map(f => [f.id,f])).values()];
    }
    function append(kind: string,body: Json,at: Clock,preserved: string,required: readonly string[]=[],principal?: VerifiedPrincipal,
      directives?: readonly Directive[],historicalAdmission=false): FactEnvelope {
      if(kind==='intake-admitted') {
        const g={ ...deps.governance.context,preserved };
        take(constructGoverned('blocking sites','intake.admission',deps.governance.register,g));
        take(readEnforcedRecord('intake.admission','intake.contract','authorAndAppend',deps.governance.register,g));
      }
      const base=context(preserved,principal);
      const c=directives? { ...base,decode: { ...base.decode,directives } }:base;
      if(historicalAdmission) {
        requireIntake(kind==='intake-admitted'&&principal,
          'scheduled intake: historical admission path is only valid for an identified admission','integrity');
        const store=createFactStore(base,deps.storage),persisted=take(store.read()),facts=[...base.facts,...persisted];
        const head=facts.filter(fact => fact.machine===author.machine).at(-1);
        const segment={ machine: author.machine,epoch: head?.segment.epoch??0,position: head?head.segment.position+1:0 };
        const signed=signEnvelope({
          type: 'FactEnvelope',envelopeVersion: 1,id: factId(segment),kind,schemaVersion: 1,
          at: json(at),machine: author.machine,principal: json(author.principal),provenance: json(author.provenance),segment,
          prevInSegment: head?.contentHash??base.genesis.hash,
          predecessors: { inSegment: head?.id??null,frontier: base.folded,required: [...new Set(required)] },body
        },author.privateKey);
        // The local author is checked as a live principal and against the origin
        // frontier first. The body is then reconstructed through P1/P2's signed
        // historical decoder, which supplies the directive issuer/grant lineage
        // without turning any HistoricalRead view into live authority. The final
        // append repeats that same historical validation before fsync.
        const historical=historicalRows(preserved);
        const authority={ ...base,facts,
          historicalGrants: historical.grants.map(({ row,grant }) => ({ factId: row.fact.id,grant })),
          historicalRevocations: historical.revocations.map(record => ({ factId: record.origin.id,revocation: record })) };
        const origin=take(decodeEnvelope(signed,authority,'origin'));
        const standing=causalStanding(origin,authority,true);
        take(decodeHistoricalBody(origin,authority,standing.decode));
        const receipt=take(store.append(signed,{ peer: author.machine }));
        requireIntake(receipt.taint.length===0,'P4-NF-24: authority-tainted append cannot admit work','integrity');
        return receipt.fact;
      }
      const receipt=take(authorAndAppend({
        kind,schemaVersion: 1,machine: author.machine,principal: json(author.principal),
        provenance: json(author.provenance),at: json(at),body,required: [...new Set(required)]
      },c,createFactStore(c,deps.storage),author.privateKey));
      requireIntake(receipt.taint.length===0,'P4-NF-24: authority-tainted append cannot admit work','integrity');
      return receipt.fact;
    }
    function appendVerifiedAct(record: ReturnType<typeof buildVerifiedActRecord>['record'],at: Clock): FactEnvelope {
      try {
        const g={ ...deps.governance.context,preserved: record.request };
        take(constructGoverned('blocking sites','intake.verified-act',deps.governance.register,g));
        take(readEnforcedRecord('intake.verified-act','intake.contract','authorAndAppend',deps.governance.register,g));
      } catch(e) { if(!record.emergency) throw e; }
      const c=context(record.request);
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
        const at=take(decodeMeasurement('clock',deps.clock(),initial.decode));
        take(constructGoverned('parsers',input.surface,deps.governance.register,
          { ...deps.governance.context,preserved: input.proof.reference }));
        const surface=take(readRegisterEntry(input.surface,deps.governance.register,
          { ...deps.governance.context,preserved: input.proof.reference }));
        requireIntake(surface.declaration.status==='live','verified act: surface adapter is not live','standing');
        const facts=read(input.request.id),c={ ...context(input.request.id),facts };
        const resolved=buildVerifiedActRecord(json(input),c,at,registerGeneration.id);
        const authentication=surface.declaration.requiredFacts.authenticationClass;
        requireIntake(Array.isArray(authentication)&&authentication.some(row => {
          const v=object(row); return v.stimulusType==='operator-act'&&v.class==='verified';
        }),'verified act: surface adapter is not registered for verified operator acts','standing');
        const record=resolved.record;
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
    const exact=(value: Record<string,Json>,keys: readonly string[],detail: string) =>
      requireIntake(Object.keys(value).length===keys.length&&Object.keys(value).every(key => keys.includes(key)),detail);
    function historicalRows(preserved: string) {
      const facts=read(preserved),rows=statuses(preserved);
      const grants=rows.flatMap(row => row.historical
        .filter((record): record is HistoricalRead<StandingGrant> => record.view.type==='StandingGrant')
        .map(grant => ({ row,grant })));
      const revocations=rows.flatMap(row => row.historical
        .filter((record): record is HistoricalRead<Revocation> => record.view.type==='Revocation'));
      return { facts,rows,grants,revocations };
    }
    function constitutionalField(row: FactStatus,type: 'StandingGrant'|'Evidence'|'VerifiedPrincipal'|'Directive',id: string,preserved: string): string {
      const schema=context(preserved).schemas.find(s => s.kind===row.fact.kind&&s.version===row.fact.schemaVersion);
      const body=object(row.body);
      const field=Object.entries(schema?.fields??{}).find(([name,policy]) => policy.kind==='constitutional'
        &&policy.type===type&&object(body[name]!).id===id)?.[0];
      requireIntake(field,`scheduled intake: ${type} reference does not select a constitutional fact field`,'integrity');
      return field;
    }
    function scheduledRoute(adapter: string,channel: string): void {
      requireIntake(adapter===adapterId,'scheduled intake: unregistered scheduled-ingress adapter','standing');
      requireIntake(channel.startsWith('scheduled:')&&channel.length>'scheduled:'.length,
        'scheduled intake: channel must name its installation','decode');
    }
    function scheduledDiscovery(referenceInput: FactEnvelopeReference,eventId: string,at: Clock,preserved: string) {
      const referenceValue=object(json(referenceInput));
      exact(referenceValue,['owner','name','id'],'scheduled intake: discovery must be one Part Two fact reference');
      requireIntake(referenceValue.owner==='part-two'&&referenceValue.name==='FactEnvelope',
        'scheduled intake: discovery reference owner/type mismatch','integrity');
      const { rows }=historicalRows(preserved),row=rows.find(candidate => candidate.fact.id===referenceValue.id);
      requireIntake(row&&!row.taint.length&&!row.conflicts.length,'scheduled intake: discovery Evidence is missing or contested','integrity');
      const evidence=row.historical.find((record): record is HistoricalRead<Evidence> => record.view.type==='Evidence');
      requireIntake(evidence&&evidence.captureStatus==='available','scheduled intake: discovery Evidence is missing or unavailable','integrity');
      const claim=take(readHistoricalEvidence(evidence,at,preserved));
      requireIntake(claim.subject===eventId&&claim.predicate==='scheduled-discovery'&&claim.value===true,
        'scheduled intake: discovery Evidence does not bind the event id','integrity');
      requireIntake(typeof evidence.view.source==='string'&&evidence.view.source===row.fact.machine,
        'scheduled intake: discovery source machine is not recorded by its Evidence','integrity');
      const field=constitutionalField(row,'Evidence',evidence.view.id,preserved);
      return { row,evidence,field };
    }
    function scheduledStanding(principal: VerifiedPrincipal,at: Clock,preserved: string,allowed?: ReadonlySet<string>) {
      const { grants,revocations }=historicalRows(preserved);
      const candidates=grants.filter(({ row,grant }) => (!allowed||allowed.has(row.fact.id))&&!row.taint.length&&!row.conflicts.length
        &&grant.captureStatus==='available'&&grant.view.grantee.id===principal.id&&grant.view.grantee.kind==='system'
        &&grant.view.standing==='delegate'&&grant.view.actions.includes('work')
        &&scopeIncludes(take(decode('Scope',grant.view.scope,context(preserved).decode)),scope)
        &&take(historicalGrantLiveness(grant,revocations.filter(r => r.view.grantId===grant.view.id
          &&(!allowed||allowed.has(r.origin.id))),at,preserved))==='live');
      const identities=[...new Set(candidates.map(candidate => candidate.grant.view.id))];
      requireIntake(identities.length===1,'scheduled intake: one current covering package-system grant is required','standing');
      // Repeated, independently signed witnesses for the same immutable grant
      // are one grant identity. Snapshot comparison has already contested any
      // disagreement, so retain a deterministic valid witness.
      const selected=candidates.filter(candidate => candidate.grant.view.id===identities[0])
        .sort((left,right) => foldKey(left.row.fact)<foldKey(right.row.fact)?-1:foldKey(left.row.fact)>foldKey(right.row.fact)?1:0)[0]!;
      const field=constitutionalField(selected.row,'StandingGrant',selected.grant.view.id,preserved);
      return { row: selected.row,grant: selected.grant,field };
    }
    function scheduledDirectives(rows: readonly FactStatus[],preserved: string,allowed: ReadonlySet<string>) {
      const witnessed=rows.filter(row => allowed.has(row.fact.id)).flatMap(row => {
        const schema=context(preserved).schemas.find(candidate => candidate.kind===row.fact.kind
          &&candidate.version===row.fact.schemaVersion);
        return Object.entries(schema?.fields??{}).filter(([,field]) => field.kind==='constitutional'&&field.type==='Directive')
          .map(([field]) => {
            const raw=object(object(row.body)[field]!);
            const records=row.historical.filter((record): record is HistoricalRead<Directive> => record.view.type==='Directive'
              &&record.view.id===raw.id);
            requireIntake(records.length===1&&records[0]!.captureStatus==='available'
              &&row.taint.length===0&&row.conflicts.length===0,
            'P4-NF-25: directive requires one available, uncontested historical witness','integrity');
            constitutionalField(row,'Directive',records[0]!.view.id,preserved);
            // The historical wrapper is the authority for a retained record. A
            // live constitutional value is optional reader context and must not
            // become a second availability requirement after the signed origin,
            // capture, subject and conflict checks above have all succeeded.
            return { row,field,directive: records[0]! };
          });
      });
      const superseded=new Set(witnessed.flatMap(candidate => candidate.directive.view.supersedes? [candidate.directive.view.supersedes]:[]));
      const active=witnessed.filter(candidate => !candidate.directive.view.closedBy&&!superseded.has(candidate.directive.view.id)
        &&scopeIncludes(take(decode('Scope',candidate.directive.view.scope,context(preserved).decode)),scope));
      const identities=[...new Set(active.map(candidate => candidate.directive.view.id))].sort();
      return identities.map(id => active.filter(candidate => candidate.directive.view.id===id)
        .sort((left,right) => foldKey(left.row.fact)<foldKey(right.row.fact)?-1:foldKey(left.row.fact)>foldKey(right.row.fact)?1:0)[0]!);
    }
    function isScheduledAdmission(fact: FactEnvelope,facts: readonly FactEnvelope[]): boolean {
      try { return isScheduledIntakeAdmission(fact,facts,author.principal.id,registeredScheduledAdapters); }
      catch { return false; }
    }
    type ScheduledResolution={ kind: 'valid'; row: FactStatus; principal: VerifiedPrincipal }|{ kind: 'partial' };
    function resolveScheduledAdmission(row: FactStatus,facts: readonly FactEnvelope[],preserved: string): ScheduledResolution {
      requireIntake(row.fact.kind==='intake-admitted'&&isScheduledAdmission(row.fact,facts),
        'scheduled intake: pending reference has wrong kind or subject','integrity');
      const c=context(preserved),snapshot=statuses(preserved),body=object(row.body),intentBody=object(body.intent!);
      try {
        const claimedAsk=object(intentBody.ask!);
        decodeScheduledTickBody(take(canonical(claimedAsk)).bytes,text(body.eventId,'scheduled event id'),c.decode);
      } catch { throw new IntakeFailure('scheduled intake: admitted Intent differs from the preserved tick','integrity'); }
      if(row.taint.includes('evidence-unavailable')) return { kind: 'partial' };
      const cone=new Set(causalCone(row.fact,facts).map(fact => fact.id));
      const required=row.fact.predecessors.required;
      const dependencies=required.map(id => snapshot.find(candidate => candidate.fact.id===id));
      requireIntake(dependencies.every((candidate): candidate is FactStatus => !!candidate),
        'scheduled intake: pending admission dependency is missing','integrity');
      requireIntake(dependencies.every(candidate => cone.has(candidate.fact.id)),
        'scheduled intake: pending admission dependency lies outside its signed cone','integrity');
      requireIntake(dependencies.every(candidate => candidate.conflicts.length===0
        &&!candidate.taint.some(taint => taint!=='evidence-unavailable')),
      'scheduled intake: pending admission dependency is contested','standing');
      if(dependencies.some(candidate => candidate.taint.includes('evidence-unavailable'))) return { kind: 'partial' };

      const receiptId=text(body.receipt,'scheduled receipt reference');
      const receipt=dependencies.find(candidate => candidate.fact.id===receiptId);
      requireIntake(receipt?.fact.kind==='intake-receipt','scheduled intake: admission receipt has wrong kind','integrity');
      const arrival=intakeArrival(receipt.fact,author.principal.id);
      requireIntake(arrival&&arrival.logicalId===body.logicalId&&arrival.rawHash===body.rawHash,
        'scheduled intake: admission differs from its preserved receipt','integrity');
      scheduledRoute(arrival.adapter,arrival.route.channel);
      const receiptBody=object(receipt.body),captureInput=object(receiptBody.capture!);
      const captureReference=text(captureInput.reference,'scheduled capture reference');
      const capture=c.captures[captureReference];
      if(capture?.status!=='available') return { kind: 'partial' };
      requireIntake(capture.bytes!==null&&capture.hash===captureInput.hash&&capture.hash===body.rawHash
        &&hashBytes(capture.bytes)===capture.hash,'scheduled intake: preserved tick capture is missing or changed','integrity');
      const parsed=decodeScheduledTickBody(capture.bytes,arrival.route.eventId,c.decode);
      requireIntake(body.adapter===receiptBody.adapter&&body.channel===arrival.route.channel&&body.sender===arrival.route.sender
        &&body.identityEpoch===arrival.route.identityEpoch&&body.eventId===arrival.route.eventId,
      'scheduled intake: admission route differs from its preserved receipt','integrity');
      requireIntake(same(intentBody.ask,parsed.tick),
        'scheduled intake: admitted Intent differs from the preserved tick','integrity');

      const intent=row.historical.find((record): record is HistoricalRead<Intent> => record.view.type==='Intent');
      requireIntake(intent?.captureStatus==='available','scheduled intake: admitted Intent is unavailable','integrity');
      const originalReceipt=causalCone(row.fact,facts).find(candidate => intakeArrival(candidate,author.principal.id)?.logicalId===body.logicalId);
      requireIntake(originalReceipt&&required.includes(originalReceipt.id),
        'scheduled intake: original receipt is not a signed admission dependency','integrity');
      const directives=scheduledDirectives(snapshot,preserved,cone);
      const directiveIds=directives.map(candidate => candidate.directive.view.id);
      requireIntake(directives.every(candidate => dependencies.some(dependency => dependency.fact.id===candidate.row.fact.id)),
        'P4-NF-25: admitted directive is not a signed dependency','integrity');
      requireIntake(intent.view.id===body.logicalId&&intent.view.via===adapterId&&intent.view.raw===capture.hash
        &&same(intent.view.receivedAt,originalReceipt.at)&&same(intent.view.ask,parsed.tick)&&same(intent.view.under,directiveIds),
      'scheduled intake: admitted Intent differs from the preserved tick','integrity');
      requireIntake(row.conflicts.length===0&&!row.taint.some(taint => taint!=='evidence-unavailable'),
        'scheduled intake: pending admission is contested','standing');
      const principal=intent.view.principal as VerifiedPrincipal;
      validateScheduledIntakeRoute(arrival.adapter,arrival.route.channel,arrival.route.sender,
        arrival.route.identityEpoch,json(principal),c.decode,registeredScheduledAdapters);

      const principalRows=dependencies.filter(candidate => candidate.fact.kind==='intake-scheduled-principal'
        &&candidate.historical.some(record => record.view.type==='VerifiedPrincipal'&&same(record.view,principal)));
      requireIntake(principalRows.length>0,'scheduled intake: principal witness is missing or mismatched','standing');
      for(const principalRow of principalRows) constitutionalField(principalRow,'VerifiedPrincipal',principal.id,preserved);
      const discoveryRows=dependencies.filter(candidate => candidate.historical.some(record => record.view.type==='Evidence'));
      requireIntake(discoveryRows.length===1,'scheduled intake: one discovery witness is required','integrity');
      const discovery=scheduledDiscovery(reference(discoveryRows[0]!.fact),arrival.route.eventId,row.fact.at,preserved);
      requireIntake(required.includes(discovery.row.fact.id),'scheduled intake: discovery witness is not a signed dependency','integrity');
      const standing=scheduledStanding(principal,row.fact.at,preserved,cone);
      const standingRows=dependencies.filter(candidate => candidate.historical.some(record => record.view.type==='StandingGrant'
        &&record.view.id===standing.grant.view.id&&same(record.view,standing.grant.view)));
      requireIntake(standingRows.length>0,'scheduled intake: standing witness is not a signed dependency','standing');
      for(const standingRow of standingRows) constitutionalField(standingRow,'StandingGrant',standing.grant.view.id,preserved);

      const resolved=dependencies.filter(candidate => candidate.fact.kind==='intake-resolved');
      requireIntake(resolved.length===1,'scheduled intake: one resolved-principal witness is required','integrity');
      const resolvedBody=object(resolved[0]!.body);
      requireIntake(resolvedBody.logicalId===body.logicalId&&resolvedBody.receipt===receipt.fact.id
        &&resolvedBody.rawHash===body.rawHash&&resolvedBody.adapter===body.adapter&&resolvedBody.channel===body.channel
        &&resolvedBody.sender===body.sender&&resolvedBody.identityEpoch===body.identityEpoch&&resolvedBody.eventId===body.eventId
        &&resolvedBody.principalId===principal.id&&resolvedBody.binding==='none'
        &&same(resolvedBody.authentication,principal.provenance.record),
      'scheduled intake: resolved-principal witness differs from the admission','integrity');
      const work=object(body.work!);
      requireIntake(work.type==='IntakeWork'&&work.schemaVersion===1&&typeof work.owner==='string'&&work.owner.length>0
        &&work.blockedOn==='run-admission'&&work.standing==='requester'&&body.binding==='none',
      'scheduled intake: admitted work changed owner or blocked state','standing');
      return { kind: 'valid',row,principal };
    }
    function receiveScheduledTick(input: ScheduledTickAdmission): Result<IntakeDisposition> {
      let preserved=initial.preserved;
      return boundary('IntakeScheduledReceive',{ ...b,preserved },() => {
        const at=take(decodeMeasurement('clock',deps.clock(),initial.decode));
        const captured=take(deps.capture.preserve(input.raw,at)); preserved=captured.reference;
        requireIntake(captured.hash===hashBytes(input.raw),'P4-NF-01: capture hash differs from scheduled tick bytes','integrity');
        const suppliedRoute=input.route as InboundRoute|undefined;
        const supplied=object(json(suppliedRoute??null));
        const suppliedAdapter=typeof supplied.adapter==='string'? supplied.adapter:'missing';
        const ingress=take(canonical({ channel: supplied.channel??null,sender: supplied.sender??null,
          identityEpoch: supplied.identityEpoch??null,eventId: supplied.eventId??null })).bytes;
        const receipt=append('intake-receipt',{ capture: json(captured),rawHash: captured.hash,adapter: suppliedAdapter,ingress },at,preserved);
        preserved=receipt.id;
        return take(boundary<IntakeDisposition>('IntakeScheduledPreserved',{ ...b,preserved },() => {
          requireIntake(!busy,'P4-NF-01: overlapping scheduled arrival durably queued','integrity');
          busy=true;
          try {
            exact(supplied,['adapter','channel','sender','identityEpoch','eventId'],'scheduled intake: route shape is malformed');
            const routeAdapter=text(supplied.adapter,'scheduled adapter'),channel=text(supplied.channel,'scheduled channel');
            const sender=text(supplied.sender,'scheduled sender'),identityEpoch=text(supplied.identityEpoch,'signed identity epoch');
            const eventId=text(supplied.eventId,'scheduled event id');
            const logicalId=take(canonical([routeAdapter,channel,sender,identityEpoch,eventId])).hash;
            const common={ logicalId,receipt: receipt.id,rawHash: captured.hash,adapter: routeAdapter,channel,sender,identityEpoch,eventId };
            requireIntake(intakeArrival(receipt,author.principal.id),'scheduled intake: preserved receipt has invalid route identity','integrity');
            scheduledRoute(routeAdapter,channel);
            const arrivals=read(preserved).filter(f => intakeArrival(f,author.principal.id)?.logicalId===logicalId);
            const original=arrivals[0]!;
            if(object(original.body).rawHash!==captured.hash) {
              const signal=append('intake-mismatch',{ ...common,original: original.id },at,preserved,[receipt.id,original.id]);
              return take(boundary<IntakeDisposition>('IntakeScheduledMismatch',{ ...b,preserved: signal.id },() => {
                throw new IntakeFailure('P4-NF-03/08: same scheduled event id, different arrival bytes; attack signal recorded','integrity');
              }));
            }
            const priorFacts=read(preserved);
            const priorRows=statuses(preserved).filter(row => isScheduledAdmission(row.fact,priorFacts)&&object(row.body).logicalId===logicalId);
            requireIntake(priorRows.length<=1,'scheduled intake: scheduled admission identity is conflicted','standing');
            if(priorRows.length===1) {
              const prior=resolveScheduledAdmission(priorRows[0]!,read(preserved),preserved);
              requireIntake(prior.kind==='valid','scheduled intake: original admission evidence is unavailable','integrity');
              const suppliedDiscovery=object(json(input.discovery));
              const originalDiscovery=prior.row.fact.predecessors.required.includes(text(suppliedDiscovery.id,'scheduled discovery reference'));
              scheduledDiscovery(input.discovery,eventId,originalDiscovery? prior.row.fact.at:at,preserved);
              append('intake-collapse',{ ...common,original: prior.row.fact.id },at,preserved,[receipt.id,prior.row.fact.id]);
              return { kind: 'duplicate',logicalId,original: reference(prior.row.fact) };
            }
            const authentication=contract.authenticationClass;
            requireIntake(Array.isArray(authentication)&&authentication.some(row => {
              const declared=object(row); return declared.stimulusType==='scheduled-tick'&&declared.class==='verified';
            }),'scheduled intake: adapter is not registered for verified scheduled ticks','standing');
            checkDedup(at,preserved);
            const { tick,jobInstance,scheduledInstant }=decodeScheduledTickBody(input.raw,eventId,context(preserved).decode);
            const authenticated=authenticateSender(input.raw,{ channel,sender,identityEpoch,eventId },at,preserved,'scheduled-tick');
            requireIntake(authenticated.provenance.class==='verified'&&authenticated.e.principalKind==='system'
              &&authenticated.e.principalId===sender&&authenticated.provenance.authenticated.recordType==='package-system-principal',
            'P4-NF-09: scheduled tick requires a verified package-minted system principal','standing');
            requireIntake(identityEpoch===authenticated.provenance.record.hash,
              'scheduled intake: route identity epoch is not bound to the signed package identity','standing');
            const principal=resolvePrincipal(authenticated.e,authenticated.provenance,preserved,'system');
            validateScheduledIntakeRoute(routeAdapter,channel,sender,identityEpoch,json(principal),context(preserved).decode,
              registeredScheduledAdapters);
            requireIntake(principal.id===author.principal.id&&same(principal.provenance,author.provenance),
              'scheduled intake: configured author is not the authenticated package system principal','standing');
            const discovery=scheduledDiscovery(input.discovery,eventId,at,preserved);
            const standing=scheduledStanding(principal,at,preserved);
            const scheduledPrincipalSchema=scheduledIntakeFactSchemas(scope)[0]!;
            requireIntake(context(preserved).schemas.some(schema => same(schema,scheduledPrincipalSchema)),
              'P4-NF-06/12: required scheduled owner schema changed or missing: intake-scheduled-principal');
            const existingPrincipal=read(preserved).find(f => f.kind==='intake-scheduled-principal'
              &&same(object(f.body).principal,principal));
            const principalFact=existingPrincipal??append('intake-scheduled-principal',{ principal: json(principal) },at,preserved,
              [standing.row.fact.id],principal);
            const resolved=append('intake-resolved',{ ...common,principalId: principal.id,
              authentication: json(principal.provenance.record),binding: 'none' },at,preserved,
            [receipt.id,discovery.row.fact.id,standing.row.fact.id],principal);
            // Re-resolve every authority-bearing dependency after the durable
            // resolution append. The append-side owner decoder repeats these
            // checks against the exact current segment, closing the same race for
            // direct signed append and replication paths.
            const admissionFacts=read(preserved),admissionRows=statuses(preserved);
            const directiveCone=new Set(causalCone(resolved,admissionFacts).map(fact => fact.id));
            const admissionDiscovery=scheduledDiscovery(input.discovery,eventId,at,preserved);
            const admissionStanding=scheduledStanding(principal,at,preserved);
            const admissionPrincipal=admissionRows.find(row => row.fact.id===principalFact.id
              &&row.fact.kind==='intake-scheduled-principal'&&!row.taint.length&&!row.conflicts.length
              &&row.historical.some((record): record is HistoricalRead<VerifiedPrincipal> => record.view.type==='VerifiedPrincipal'
                &&record.captureStatus==='available'&&same(record.view,principal)));
            requireIntake(admissionPrincipal,'scheduled intake: current signed principal witness is unavailable or contested','standing');
            constitutionalField(admissionPrincipal,'VerifiedPrincipal',principal.id,preserved);
            const directives=scheduledDirectives(admissionRows,preserved,directiveCone);
            const intent: Json={ type: 'Intent',schemaVersion: 1,id: logicalId,principal: json(principal),receivedAt: json(original.at),
              via: adapterId,raw: captured.hash,ask: tick,under: directives.map(candidate => candidate.directive.view.id) };
            const committedFacts=read(preserved);
            const committed=statuses(preserved).find(row => isScheduledAdmission(row.fact,committedFacts)&&object(row.body).logicalId===logicalId);
            if(committed) {
              requireIntake(object(committed.body).rawHash===captured.hash,'P4-NF-03: concurrent scheduled arrival hash mismatch','integrity');
              const resolvedCommitted=resolveScheduledAdmission(committed,read(preserved),preserved);
              requireIntake(resolvedCommitted.kind==='valid','scheduled intake: committed admission evidence is unavailable','integrity');
              checkDedup(at,preserved);
              append('intake-collapse',{ ...common,original: committed.fact.id },at,preserved,[receipt.id,committed.fact.id]);
              return { kind: 'duplicate',logicalId,original: reference(committed.fact) };
            }
            const admitted=append('intake-admitted',{ ...common,intent,
              work: { type: 'IntakeWork',schemaVersion: 1,owner,blockedOn: 'run-admission',standing: 'requester' },binding: 'none'
            },at,preserved,[receipt.id,original.id,resolved.id,admissionPrincipal.fact.id,admissionDiscovery.row.fact.id,admissionStanding.row.fact.id,
              ...directives.map(candidate => candidate.row.fact.id)],principal,undefined,true);
            const fact=reference(admitted);
            const principalReference: ConstitutionalReference<'VerifiedPrincipal'>={ type: 'VerifiedPrincipal',id: principal.id,
              fact: reference(admissionPrincipal.fact),field: 'principal' };
            const standingReference: ConstitutionalReference<'StandingGrant'>={ type: 'StandingGrant',id: admissionStanding.grant.view.id,
              fact: reference(admissionStanding.row.fact),field: admissionStanding.field };
            return { kind: 'scheduled-admitted',logicalId,fact,owner,blockedOn: 'run-admission',
              principal: Object.freeze(principalReference),standing: Object.freeze(standingReference),
              scheduledIdentity: Object.freeze({ jobInstance,scheduledInstant }) };
          } finally { busy=false; }
        }));
      });
    }
    function pendingScheduledAdmissions(input: PendingScheduledAdmissionsInput): Result<PendingScheduledAdmissions> {
      return boundary('PendingScheduledAdmissions',{ ...b,preserved: input?.after?.id??initial.preserved },() => {
        const ownerInput=text(input.owner,'scheduled intake owner');
        requireIntake(Number.isSafeInteger(input.limit)&&input.limit>0&&input.limit<=100,
          'scheduled intake: page limit must be between 1 and 100','policy');
        const frontier=object(json(input.frontier));
        for(const [machine,value] of Object.entries(frontier)) {
          text(machine,'frontier machine'); const position=object(value);
          exact(position,['epoch','position'],'scheduled intake: malformed causal frontier');
          requireIntake(Number.isSafeInteger(position.epoch)&&Number(position.epoch)>=0
            &&Number.isSafeInteger(position.position)&&Number(position.position)>=0,
          'scheduled intake: malformed causal frontier','decode');
        }
        const facts=read(initial.preserved),heads=new Map<string,{ epoch: number; position: number }>();
        for(const fact of facts) { const prior=heads.get(fact.machine);
          if(!prior||fact.segment.epoch>prior.epoch||(fact.segment.epoch===prior.epoch&&fact.segment.position>prior.position))
            heads.set(fact.machine,{ epoch: fact.segment.epoch,position: fact.segment.position });
        }
        for(const [machine,value] of Object.entries(frontier)) { const requested=object(value),head=heads.get(machine);
          requireIntake(head&&(Number(requested.epoch)<head.epoch||Number(requested.epoch)===head.epoch&&Number(requested.position)<=head.position),
            'scheduled intake: frontier claims unavailable history','stale-base');
        }
        const visible=(fact: FactEnvelope) => { const position=frontier[fact.machine]; return !!position
          &&(fact.segment.epoch<Number(object(position).epoch)||fact.segment.epoch===Number(object(position).epoch)
            &&fact.segment.position<=Number(object(position).position)); };
        const snapshot=statuses(initial.preserved);
        const rows=snapshot.filter(row => visible(row.fact)&&isScheduledAdmission(row.fact,facts))
          .sort((left,right) => foldKey(left.fact)<foldKey(right.fact)?-1:foldKey(left.fact)>foldKey(right.fact)?1:0);
        const resolved=rows.map(row => resolveScheduledAdmission(row,facts,initial.preserved));
        const valid=resolved.filter((candidate): candidate is Extract<ScheduledResolution,{ kind: 'valid' }> => candidate.kind==='valid');
        for(const candidate of valid) requireIntake(causalCone(candidate.row.fact,facts).every(visible),
          'scheduled intake: frontier omits an admission dependency','stale-base');
        const validIds=new Set(valid.map(candidate => candidate.row.fact.id));
        const historicalContext={ ...context(initial.preserved),facts };
        const opened=new Set(snapshot.filter(row => visible(row.fact)&&row.fact.kind==='run-opening'
          &&row.taint.length===0&&row.conflicts.length===0&&causalCone(row.fact,facts).every(visible)).flatMap(row => {
          try {
            const schema=context(initial.preserved).schemas.find(candidate => candidate.kind===row.fact.kind
              &&candidate.version===row.fact.schemaVersion);
            const recordField=schema?.fields.record;
            requireIntake(recordField?.kind==='owned'&&recordField.owner==='part-five'&&recordField.name==='Run',
              'scheduled intake: Run opening owner decoder is missing','integrity');
            // A clean P2 status is necessary but the consuming projection still
            // re-runs Part Five's historical owner decoder over the signed cone.
            // The outer subject is then bound to that decoded Run rather than
            // trusting either raw field independently.
            const decoded=take(decodeHistoricalBody(row.fact,historicalContext,
              causalStanding(row.fact,historicalContext,false).decode));
            requireIntake(decoded.taint.length===0,'scheduled intake: Run opening evidence is unavailable','integrity');
            const record=object(json(decoded.fields.record!)),opening=object(record.opening!);
            requireIntake(record.type==='Run'&&object(row.body).run===record.id,
              'scheduled intake: Run opening subject differs from its owner-decoded record','integrity');
            const id=text(opening.id,'Run opening admission');
            return opening.owner==='part-two'&&opening.name==='FactEnvelope'&&validIds.has(id)
              &&row.fact.predecessors.required.includes(id)? [id]:[];
          } catch { return []; }
        }));
        const selected=valid.map(candidate => candidate.row)
          .filter(row => object(object(row.body).work!).owner===ownerInput&&!opened.has(row.fact.id));
        let start=0;
        if(input.after!==null) {
          const cursor=object(json(input.after)); exact(cursor,['owner','name','id'],'scheduled intake: cursor must be one Part Two fact reference');
          requireIntake(cursor.owner==='part-two'&&cursor.name==='FactEnvelope','scheduled intake: cursor owner/type mismatch','decode');
          const index=selected.findIndex(row => row.fact.id===cursor.id);
          requireIntake(index>=0,'scheduled intake: cursor is not an admission in this owner/frontier','stale-base'); start=index+1;
        }
        const page=selected.slice(start,start+input.limit),more=start+page.length<selected.length;
        return Object.freeze({ admissions: Object.freeze(page.map(row => reference(row.fact))),
          next: more&&page.length? reference(page.at(-1)!.fact):null });
      });
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
      receive,receiveScheduledTick,pendingScheduledAdmissions,
      recover: (receiptId: string) => boundary('IntakeRecovery',{ ...b,preserved: receiptId },() => {
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
