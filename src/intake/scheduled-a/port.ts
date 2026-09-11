// Slice A is an additive intake composition. The 32e5961 port remains the
// public legacy doorway; this module delegates every legacy operation to it
// and owns only the signed scheduled-tick arm and its read-only projection.
import { canonical,consumeResult,decode,decodeMeasurement,historicalGrantLiveness,scopeIncludes } from '../../index.js';
import type {
  BoundaryContext,Clock,FactEnvelopeReference,HistoricalRead,Intent,Json,Provenance,
  Result,Revocation,StandingGrant,VerifiedPrincipal,
} from '../../index.js';
import {
  authorAndAppend,causalCone,causalStanding,createFactStore,decodeEnvelope,decodeHistoricalBody,
  factId,foldKey,hashBytes,prepareSnapshot,signEnvelope,
} from '../../facts/index.js';
import type { FactContext,FactEnvelope,FactStatus } from '../../facts/index.js';
import { constructGoverned,generationOf,readEnforcedRecord,readRegisterEntry } from '../../register/index.js';
import { foldProjection,readProjection } from '../../projections/index.js';
import { boundary,IntakeFailure,json,object,requireIntake,same,take,text } from '../boundary.js';
import { createIntakePort as createLegacyIntakePort } from '../port.js';
import {
  intakeArrival,intakeDedupDefinition,intakeFactSchemas,intakeStopRegistration,
  intakeVerifiedActRegistration,intakeWorkRegistration,
} from '../records.js';
import {
  bindIntakeOwnerRegister,decodeScheduledTickBody,isScheduledIntakeAdmission,
  registeredScheduledIntakeAdapters,resolveScheduledDiscoveryWitness,scheduledIntakeFactSchemas,
  scheduledIntakeWorkRegistration,validateScheduledIntakeRoute,
} from '../scheduled-records.js';
import type {
  ConstitutionalReference,InboundRoute,PendingScheduledAdmissions,PendingScheduledAdmissionsInput,
  ScheduledIntakeDependencies,ScheduledIntakePort,ScheduledTickAdmission,
} from './contracts.js';

const reference=(fact: FactEnvelope): FactEnvelopeReference => Object.freeze({
  owner: 'part-two',name: 'FactEnvelope',id: fact.id,
});

export function createScheduledIntakePort(deps: ScheduledIntakeDependencies): Result<ScheduledIntakePort> {
  const initial=deps.context();
  const b: BoundaryContext={ site: 'intake.admit',preserved: initial.preserved,register: initial.decode.register };
  return boundary('ScheduledIntakeConstruction',b,() => {
    // This is deliberately first: all construction and every legacy operation
    // retain the exact 32e5961 implementation and Result behavior.
    const legacy=take(createLegacyIntakePort(deps));
    take(constructGoverned('features','intake-slice',deps.governance.register,deps.governance.context));
    take(constructGoverned('parsers',deps.adapter.id,deps.governance.register,deps.governance.context));
    const declaration=deps.governance.register.entries.find(entry => entry.declaration.id===deps.adapter.id)?.declaration;
    requireIntake(declaration?.status==='live','P4-NF-06: intake adapter must be live');
    const contract=object(json(declaration.requiredFacts));
    const registerWitness=readRegisterEntry(deps.adapter.id,deps.governance.register,deps.governance.context);
    const verifiedGovernanceRegister=consumeResult(registerWitness,{
      Success: () => deps.governance.register,
      Refused: () => undefined,
    });
    const scheduledCapability=Array.isArray(contract.authenticationClass)&&contract.authenticationClass.some(row => {
      const authentication=object(row);
      return authentication.stimulusType==='scheduled-tick'&&authentication.class==='verified';
    });
    const scheduledOwnerRegister=verifiedGovernanceRegister&&scheduledCapability
      ?verifiedGovernanceRegister:undefined;
    if(scheduledOwnerRegister) bindIntakeOwnerRegister(
      initial.decode.register,scheduledOwnerRegister,deps.governance.context,deps.adapter.id);
    const registeredScheduledAdapters=scheduledOwnerRegister
      ?registeredScheduledIntakeAdapters(scheduledOwnerRegister,initial.decode.register)
      :Object.freeze([] as string[]);

    const scope=take(decode('Scope',deps.scope,initial.decode));
    const registerGeneration=take(generationOf(deps.governance.register,deps.governance.context));
    const registerGenerationReference={ owner: 'part-three',name: 'RegisterGeneration',id: registerGeneration.id } as const;
    for(const schema of intakeFactSchemas(scope)) requireIntake(initial.schemas.some(candidate => same(candidate,schema)),
      `P4-NF-06/12: required owner schema changed or missing: ${schema.kind}`);
    const workRegistration=take(intakeWorkRegistration(b,deps.author.principal.id));
    const scheduledWorkRegistration=scheduledOwnerRegister
      ?take(scheduledIntakeWorkRegistration(b,deps.author.principal.id,scheduledOwnerRegister))
      :null;
    const stopRegistration=take(intakeStopRegistration(b,deps.author.principal.id));
    const verifiedActRegistration=take(intakeVerifiedActRegistration(
      b,deps.author.principal.id,registerGenerationReference));
    const adapterId=deps.adapter.id,owner=deps.workOwner;
    const authenticate=deps.adapter.authenticate.bind(deps.adapter);
    const author=Object.freeze({ ...deps.author });
    let busy=false;

    function context(preserved: string,principal?: VerifiedPrincipal): FactContext {
      const current=deps.context();
      return {
        ...current,preserved,
        ownedBodies: [
          ...current.ownedBodies?.filter(registration => !(registration.owner==='part-four'
            &&['IntakeWork','IntakeStop','VerifiedActDisposition'].includes(registration.name)))??[],
          workRegistration,stopRegistration,verifiedActRegistration,
        ],
        decode: {
          ...current.decode,preserved,
          principals: [...current.decode.principals??[],author.principal,...principal?[principal]:[]],
        },
      };
    }

    function scheduledContext(preserved: string,principal?: VerifiedPrincipal): FactContext {
      const current=context(preserved,principal);
      return scheduledWorkRegistration?{
        ...current,
        ownedBodies: [
          ...current.ownedBodies?.filter(registration => registration!==workRegistration)??[],
          scheduledWorkRegistration,
        ],
      }:current;
    }

    function read(preserved: string): readonly FactEnvelope[] {
      const current=context(preserved);
      return [...new Map([
        ...current.facts,...take(createFactStore(current,deps.storage).read()),
      ].map(fact => [fact.id,fact])).values()];
    }

    function statuses(preserved: string): readonly FactStatus[] {
      const current=scheduledContext(preserved),facts=read(preserved);
      return take(prepareSnapshot(facts,{ ...current,facts })).entries;
    }

    function historicalRows(preserved: string) {
      const facts=read(preserved),rows=statuses(preserved);
      const grants=rows.flatMap(row => row.historical
        .filter((record): record is HistoricalRead<StandingGrant> => record.view.type==='StandingGrant'
          &&record.origin.id===row.fact.id)
        .map(grant => ({ row,grant })));
      const revocations=rows.flatMap(row => row.historical
        .filter((record): record is HistoricalRead<Revocation> => record.view.type==='Revocation'));
      return { facts,rows,grants,revocations };
    }

    function append(kind: string,body: Json,at: Clock,preserved: string,
      required: readonly string[]=[],principal?: VerifiedPrincipal,historicalAdmission=false): FactEnvelope {
      if(kind==='intake-admitted') {
        const governance={ ...deps.governance.context,preserved };
        take(constructGoverned('blocking sites','intake.admission',deps.governance.register,governance));
        take(readEnforcedRecord('intake.admission','intake.contract','authorAndAppend',
          deps.governance.register,governance));
      }
      if(historicalAdmission) {
        requireIntake(kind==='intake-admitted'&&principal,
          'scheduled intake: historical admission path is only valid for an identified admission','integrity');
        const base=scheduledContext(preserved,principal);
        const store=createFactStore(base,deps.storage),persisted=take(store.read()),facts=[...base.facts,...persisted];
        const head=facts.filter(fact => fact.machine===author.machine).at(-1);
        const segment={
          machine: author.machine,epoch: head?.segment.epoch??0,position: head?head.segment.position+1:0,
        };
        const signed=signEnvelope({
          type: 'FactEnvelope',envelopeVersion: 1,id: factId(segment),kind,schemaVersion: 1,
          at: json(at),machine: author.machine,principal: json(author.principal),
          provenance: json(author.provenance),segment,prevInSegment: head?.contentHash??base.genesis.hash,
          predecessors: {
            inSegment: head?.id??null,frontier: base.folded,required: [...new Set(required)],
          },body,
        },author.privateKey);
        const historical=historicalRows(preserved);
        const authority={
          ...base,facts,
          historicalGrants: historical.grants.map(({ row,grant }) => ({ factId: row.fact.id,grant })),
          historicalRevocations: historical.revocations.map(record => ({
            factId: record.origin.id,revocation: record,
          })),
        };
        const origin=take(decodeEnvelope(signed,authority,'origin'));
        const standing=causalStanding(origin,authority,true);
        take(decodeHistoricalBody(origin,authority,standing.decode));
        const receipt=take(store.append(signed,{ peer: author.machine }));
        requireIntake(receipt.taint.length===0,
          'P4-NF-24: authority-tainted append cannot admit work','integrity');
        return receipt.fact;
      }
      const base=context(preserved,principal);
      const receipt=take(authorAndAppend({
        kind,schemaVersion: 1,machine: author.machine,principal: json(author.principal),
        provenance: json(author.provenance),at: json(at),body,required: [...new Set(required)],
      },base,createFactStore(base,deps.storage),author.privateKey));
      requireIntake(receipt.taint.length===0,
        'P4-NF-24: authority-tainted append cannot admit work','integrity');
      return receipt.fact;
    }

    function checkDedup(at: Clock,preserved: string): void {
      const governance={ ...deps.governance.context,preserved };
      take(constructGoverned('blocking sites','intake.dedup',deps.governance.register,governance));
      take(readEnforcedRecord('intake.dedup','intake.contract','readProjection',
        deps.governance.register,governance));
      const current=context(preserved),facts=read(preserved);
      const definition=intakeDedupDefinition(
        [...new Set(current.schemas.map(schema => schema.kind))],deps.dedupStalenessBound);
      const snapshot=take(prepareSnapshot(facts,{ ...current,facts }));
      const view=take(foldProjection(definition,snapshot,deps.dedupGeneration(),{ ...b,preserved }));
      take(readProjection(view,definition,at,{ ...b,preserved },current.folded));
    }

    const exact=(value: Record<string,Json>,keys: readonly string[],detail: string) =>
      requireIntake(Object.keys(value).length===keys.length
        &&Object.keys(value).every(key => keys.includes(key)),detail);

    function constitutionalField(row: FactStatus,
      type: 'StandingGrant'|'Evidence'|'VerifiedPrincipal',id: string,preserved: string): string {
      const schema=context(preserved).schemas.find(candidate => candidate.kind===row.fact.kind
        &&candidate.version===row.fact.schemaVersion);
      const body=object(row.body);
      const field=Object.entries(schema?.fields??{}).find(([name,policy]) => policy.kind==='constitutional'
        &&policy.type===type&&object(body[name]!).id===id)?.[0];
      requireIntake(field,
        `scheduled intake: ${type} reference does not select a constitutional fact field`,'integrity');
      return field;
    }

    function scheduledRoute(adapter: string,channel: string): void {
      requireIntake(adapter===adapterId,
        'unsupported-in-slice-a: unregistered scheduled-ingress adapter','standing');
      requireIntake(channel.startsWith('scheduled:')&&channel.length>'scheduled:'.length,
        'scheduled intake: channel must name its installation','decode');
    }

    function scheduledDiscovery(referenceInput: FactEnvelopeReference,eventId: string,at: Clock,preserved: string) {
      const referenceValue=object(json(referenceInput));
      exact(referenceValue,['owner','name','id'],
        'scheduled intake: discovery must be one Part Two fact reference');
      requireIntake(referenceValue.owner==='part-two'&&referenceValue.name==='FactEnvelope',
        'scheduled intake: discovery reference owner/type mismatch','integrity');
      const { rows }=historicalRows(preserved);
      const row=rows.find(candidate => candidate.fact.id===referenceValue.id);
      requireIntake(row&&!row.taint.length&&!row.conflicts.length,
        'scheduled intake: discovery Evidence is missing or contested','integrity');
      const histories=rows.flatMap(candidate => candidate.historical
        .filter(record => record.origin.id===candidate.fact.id)
        .map(record => ({ fact: candidate.fact,record,status: candidate })));
      const selected=resolveScheduledDiscoveryWitness(
        histories,new Set([row.fact.id]),eventId,at,preserved,context(preserved).decode,'origin');
      requireIntake(selected.record.captureStatus==='available',
        'scheduled intake: discovery Evidence is missing or unavailable','integrity');
      const field=constitutionalField(row,'Evidence',selected.record.view.id,preserved);
      return { row,evidence: selected.record,field };
    }

    function scheduledStanding(principal: VerifiedPrincipal,at: Clock,preserved: string,
      allowed?: ReadonlySet<string>,required?: ReadonlySet<string>) {
      const { grants,revocations }=historicalRows(preserved);
      const candidates=grants.filter(({ row,grant }) => (!allowed||allowed.has(row.fact.id))
        &&(!required||required.has(row.fact.id))
        &&(!row.taint.length||!!required&&row.taint.every(taint => taint==='evidence-unavailable'))
        &&!row.conflicts.length&&grant.view.grantee.id===principal.id&&grant.view.grantee.kind==='system'
        &&grant.view.standing==='delegate'&&grant.view.actions.includes('work')
        &&scopeIncludes(take(decode('Scope',grant.view.scope,context(preserved).decode)),scope));
      requireIntake(candidates.length===1,
        'unsupported-in-slice-a: exactly one current covering package-system grant witness is required','standing');
      const selected=candidates[0]!,partial=selected.grant.captureStatus!=='available';
      requireIntake(!partial||!!required,
        'unsupported-in-slice-a: a current covering package-system grant is required','standing');
      if(!partial) requireIntake(take(historicalGrantLiveness(selected.grant,revocations.filter(record =>
        record.view.grantId===selected.grant.view.id&&(!allowed||allowed.has(record.origin.id))),
      at,preserved))==='live',
      'unsupported-in-slice-a: a current covering package-system grant is required','standing');
      const field=constitutionalField(selected.row,'StandingGrant',selected.grant.view.id,preserved);
      return { row: selected.row,grant: selected.grant,field,partial };
    }

    function refuseSliceADirectives(rows: readonly FactStatus[],preserved: string,
      allowed: ReadonlySet<string>): void {
      const directiveBearing=rows.filter(row => allowed.has(row.fact.id)).some(row => {
        const schema=context(preserved).schemas.find(candidate => candidate.kind===row.fact.kind
          &&candidate.version===row.fact.schemaVersion);
        return Object.values(schema?.fields??{}).some(field => field.kind==='constitutional'
          &&field.type==='Directive');
      });
      requireIntake(!directiveBearing,
        'unsupported-in-slice-a: Directive-bearing scheduled history belongs to Slice B','standing');
    }

    function isScheduledAdmission(fact: FactEnvelope,facts: readonly FactEnvelope[],preserved: string): boolean {
      try {
        return isScheduledIntakeAdmission(
          fact,facts,author.principal.id,registeredScheduledAdapters,context(preserved));
      } catch { return false; }
    }

    type ScheduledResolution=
      |{ kind: 'valid';row: FactStatus;principal: VerifiedPrincipal }
      |{ kind: 'partial';row: FactStatus };

    function resolveScheduledAdmission(row: FactStatus,facts: readonly FactEnvelope[],
      preserved: string): ScheduledResolution {
      requireIntake(row.fact.kind==='intake-admitted'&&isScheduledAdmission(row.fact,facts,preserved),
        'scheduled intake: pending reference has wrong kind or subject','integrity');
      const current=context(preserved),snapshot=statuses(preserved),body=object(row.body);
      const intentBody=object(body.intent!);
      try {
        const claimedAsk=object(intentBody.ask!);
        decodeScheduledTickBody(take(canonical(claimedAsk)).bytes,
          text(body.eventId,'scheduled event id'),current.decode);
      } catch {
        throw new IntakeFailure('scheduled intake: admitted Intent differs from the preserved tick','integrity');
      }
      let partial=row.taint.includes('evidence-unavailable');
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
      partial ||= dependencies.some(candidate => candidate.taint.includes('evidence-unavailable'));

      const receiptId=text(body.receipt,'scheduled receipt reference');
      const receipt=dependencies.find(candidate => candidate.fact.id===receiptId);
      requireIntake(receipt?.fact.kind==='intake-receipt',
        'scheduled intake: admission receipt has wrong kind','integrity');
      const arrival=intakeArrival(receipt.fact,author.principal.id);
      requireIntake(arrival&&arrival.logicalId===body.logicalId&&arrival.rawHash===body.rawHash,
        'scheduled intake: admission differs from its preserved receipt','integrity');
      scheduledRoute(arrival.adapter,arrival.route.channel);
      const receiptBody=object(receipt.body),captureInput=object(receiptBody.capture!);
      const captureReference=text(captureInput.reference,'scheduled capture reference');
      const capture=current.captures[captureReference];
      partial ||= capture?.status!=='available';
      if(capture?.status==='available') requireIntake(capture.bytes!==null
        &&capture.hash===captureInput.hash&&capture.hash===body.rawHash
        &&hashBytes(capture.bytes)===capture.hash,
      'scheduled intake: preserved tick capture is missing or changed','integrity');
      const parsed=capture?.status==='available'
        ?decodeScheduledTickBody(capture.bytes!,arrival.route.eventId,current.decode)
        :decodeScheduledTickBody(take(canonical(object(intentBody.ask!))).bytes,
          arrival.route.eventId,current.decode);
      requireIntake(body.adapter===receiptBody.adapter&&body.channel===arrival.route.channel
        &&body.sender===arrival.route.sender&&body.identityEpoch===arrival.route.identityEpoch
        &&body.eventId===arrival.route.eventId,
      'scheduled intake: admission route differs from its preserved receipt','integrity');
      requireIntake(same(intentBody.ask,parsed.tick),
        'scheduled intake: admitted Intent differs from the preserved tick','integrity');

      const intent=row.historical.find((record): record is HistoricalRead<Intent> => record.view.type==='Intent');
      requireIntake(intent,'scheduled intake: admitted Intent is unavailable','integrity');
      partial ||= intent.captureStatus!=='available';
      const originalReceipt=causalCone(row.fact,facts).find(candidate =>
        intakeArrival(candidate,author.principal.id)?.logicalId===body.logicalId);
      requireIntake(originalReceipt&&required.includes(originalReceipt.id),
        'scheduled intake: original receipt is not a signed admission dependency','integrity');
      refuseSliceADirectives(snapshot,preserved,cone);
      requireIntake(intent.view.id===body.logicalId&&intent.view.via===adapterId
        &&intent.view.raw===body.rawHash&&same(intent.view.receivedAt,originalReceipt.at)
        &&same(intent.view.ask,parsed.tick)&&same(intent.view.under,[]),
      'scheduled intake: admitted Intent differs from the preserved tick','integrity');
      requireIntake(row.conflicts.length===0
        &&!row.taint.some(taint => taint!=='evidence-unavailable'),
      'scheduled intake: pending admission is contested','standing');
      const principal=intent.view.principal as VerifiedPrincipal;
      validateScheduledIntakeRoute(arrival.adapter,arrival.route.channel,arrival.route.sender,
        arrival.route.identityEpoch,json(principal),current.decode,registeredScheduledAdapters);

      const histories=snapshot.flatMap(candidate => candidate.historical
        .filter(record => record.origin.id===candidate.fact.id)
        .map(record => ({ fact: candidate.fact,record,status: candidate })));
      const principalCandidates=dependencies.filter(candidate => candidate.fact.kind==='intake-scheduled-principal')
        .flatMap(candidate => candidate.historical.filter(record => record.origin.id===candidate.fact.id
          &&record.view.type==='VerifiedPrincipal')
          .map(record => ({ fact: candidate.fact,record,status: candidate })));
      requireIntake(principalCandidates.length===1,
        'unsupported-in-slice-a: exactly one signed principal witness fact is required','standing');
      const principalIdentity=principalCandidates.filter(candidate =>
        candidate.record.view.type==='VerifiedPrincipal'&&candidate.record.view.id===principal.id);
      requireIntake(principalIdentity.length===1,
        'unsupported-in-slice-a: principal witness is copied or conflicted','standing');
      partial ||= principalCandidates[0]!.record.captureStatus!=='available';
      requireIntake(same(principalCandidates[0]!.record.view,principal),
        'unsupported-in-slice-a: principal witness is unavailable or mismatched','standing');
      const principalRow=dependencies.find(candidate => candidate.fact.id===principalCandidates[0]!.fact.id)!;
      constitutionalField(principalRow,'VerifiedPrincipal',principal.id,preserved);
      const resolved=dependencies.filter(candidate => candidate.fact.kind==='intake-resolved');
      requireIntake(resolved.length===1,
        'scheduled intake: one resolved-principal witness is required','integrity');
      const discovery=resolveScheduledDiscoveryWitness(histories,new Set(required),
        arrival.route.eventId,row.fact.at,preserved,current.decode,'historical',
        new Set(resolved[0]!.fact.predecessors.required));
      partial ||= discovery.partial;
      const discoveryRow=dependencies.find(candidate => candidate.fact.id===discovery.fact.id);
      requireIntake(discoveryRow,
        'scheduled intake: discovery witness is not a signed dependency','integrity');
      constitutionalField(discoveryRow,'Evidence',discovery.record.view.id,preserved);
      const standing=scheduledStanding(principal,row.fact.at,preserved,cone,new Set(required));
      partial ||= standing.partial;
      const standingRows=dependencies.filter(candidate => candidate.historical.some(record =>
        record.view.type==='StandingGrant'&&record.origin.id===candidate.fact.id
        &&record.view.id===standing.grant.view.id&&same(record.view,standing.grant.view)));
      requireIntake(standingRows.length===1,
        'unsupported-in-slice-a: exactly one standing witness is required','standing');
      constitutionalField(standingRows[0]!,'StandingGrant',standing.grant.view.id,preserved);

      const resolvedBody=object(resolved[0]!.body);
      requireIntake(resolvedBody.logicalId===body.logicalId&&resolvedBody.receipt===receipt.fact.id
        &&resolvedBody.rawHash===body.rawHash&&resolvedBody.adapter===body.adapter
        &&resolvedBody.channel===body.channel&&resolvedBody.sender===body.sender
        &&resolvedBody.identityEpoch===body.identityEpoch&&resolvedBody.eventId===body.eventId
        &&resolvedBody.principalId===principal.id&&resolvedBody.binding==='none'
        &&same(resolvedBody.authentication,principal.provenance.record),
      'scheduled intake: resolved-principal witness differs from the admission','integrity');
      requireIntake(resolved[0]!.fact.predecessors.required.includes(receipt.fact.id)
        &&resolved[0]!.fact.predecessors.required.includes(discoveryRow.fact.id)
        &&resolved[0]!.fact.predecessors.required.includes(standingRows[0]!.fact.id),
      'scheduled intake: resolved-principal witness omits signed authority','integrity');
      const work=object(body.work!);
      requireIntake(work.type==='IntakeWork'&&work.schemaVersion===1
        &&typeof work.owner==='string'&&work.owner.length>0&&work.blockedOn==='run-admission'
        &&work.standing==='requester'&&body.binding==='none',
      'scheduled intake: admitted work changed owner or blocked state','standing');
      return partial?{ kind: 'partial',row }:{ kind: 'valid',row,principal };
    }

    function authenticateScheduled(raw: string,route: InboundRoute,at: Clock,preserved: string) {
      const governance={ ...deps.governance.context,preserved };
      take(constructGoverned('blocking sites','intake.authentication',
        deps.governance.register,governance));
      take(constructGoverned('governed documents','intake.contract',
        deps.governance.register,governance));
      take(readEnforcedRecord('intake.authentication','intake.contract','decode:Provenance',
        deps.governance.register,governance));
      const evidence=take(authenticate(raw,route,at));
      requireIntake(evidence.channel===route.channel&&evidence.sender===route.sender
        &&evidence.identityEpoch===route.identityEpoch,
      'P4-NF-02: evidence does not bind transport route','standing');
      const provenance=take(decode('Provenance',evidence.provenance,context(preserved).decode));
      requireIntake(provenance.class==='verified'&&provenance.adapter===adapterId
        &&evidence.principalKind==='system'&&evidence.principalId===route.sender
        &&provenance.authenticated.recordType==='package-system-principal',
      'P4-NF-09: scheduled tick requires a verified package-minted system principal','standing');
      const principal=take(decode('VerifiedPrincipal',{
        type: 'VerifiedPrincipal',schemaVersion: 1,id: evidence.principalId,kind: 'system',
      },{ ...context(preserved).decode,provenance }));
      return { evidence,provenance,principal };
    }

    function receiveScheduledTick(input: ScheduledTickAdmission) {
      let preserved=initial.preserved;
      return boundary('IntakeScheduledReceive',{ ...b,preserved },() => {
        const at=take(decodeMeasurement('clock',deps.clock(),initial.decode));
        const captured=take(deps.capture.preserve(input.raw,at));
        preserved=captured.reference;
        requireIntake(captured.hash===hashBytes(input.raw),
          'P4-NF-01: capture hash differs from scheduled tick bytes','integrity');
        const supplied=object(json(input.route??null));
        const suppliedAdapter=typeof supplied.adapter==='string'?supplied.adapter:'missing';
        const ingress=take(canonical({
          channel: supplied.channel??null,sender: supplied.sender??null,
          identityEpoch: supplied.identityEpoch??null,eventId: supplied.eventId??null,
        })).bytes;
        const receipt=append('intake-receipt',{
          capture: json(captured),rawHash: captured.hash,adapter: suppliedAdapter,ingress,
        },at,preserved);
        preserved=receipt.id;
        return take(boundary('IntakeScheduledPreserved',{ ...b,preserved },() => {
          requireIntake(!busy,'P4-NF-01: overlapping scheduled arrival durably queued','integrity');
          busy=true;
          try {
            exact(supplied,['adapter','channel','sender','identityEpoch','eventId'],
              'scheduled intake: route shape is malformed');
            const routeAdapter=text(supplied.adapter,'scheduled adapter');
            const channel=text(supplied.channel,'scheduled channel');
            const sender=text(supplied.sender,'scheduled sender');
            const identityEpoch=text(supplied.identityEpoch,'signed identity epoch');
            const eventId=text(supplied.eventId,'scheduled event id');
            const logicalId=take(canonical([
              routeAdapter,channel,sender,identityEpoch,eventId,
            ])).hash;
            const common={
              logicalId,receipt: receipt.id,rawHash: captured.hash,adapter: routeAdapter,
              channel,sender,identityEpoch,eventId,
            };
            requireIntake(intakeArrival(receipt,author.principal.id),
              'scheduled intake: preserved receipt has invalid route identity','integrity');

            // Route syntax is validated, but entry into Slice A is selected only
            // after the adapter's signed package-system evidence is verified.
            scheduledRoute(routeAdapter,channel);
            const authenticated=authenticateScheduled(
              input.raw,{ channel,sender,identityEpoch,eventId },at,preserved);
            requireIntake(identityEpoch===authenticated.provenance.record.hash,
              'scheduled intake: route identity epoch is not bound to the signed package identity','standing');
            const principal=authenticated.principal;
            validateScheduledIntakeRoute(routeAdapter,channel,sender,identityEpoch,json(principal),
              context(preserved).decode,registeredScheduledAdapters);
            requireIntake(principal.id===author.principal.id&&same(principal.provenance,author.provenance),
              'scheduled intake: configured author is not the authenticated package system principal','standing');

            const arrivals=read(preserved).filter(fact =>
              intakeArrival(fact,author.principal.id)?.logicalId===logicalId);
            const original=arrivals[0]!;
            if(object(original.body).rawHash!==captured.hash) {
              const signal=append('intake-mismatch',{ ...common,original: original.id },
                at,preserved,[receipt.id,original.id]);
              return take(boundary('IntakeScheduledMismatch',{ ...b,preserved: signal.id },() => {
                throw new IntakeFailure(
                  'P4-NF-03/08: same scheduled event id, different arrival bytes; attack signal recorded',
                  'integrity');
              }));
            }

            const priorFacts=read(preserved);
            const priorRows=statuses(preserved).filter(row =>
              isScheduledAdmission(row.fact,priorFacts,preserved)
              &&object(row.body).logicalId===logicalId);
            requireIntake(priorRows.length<=1,
              'scheduled intake: scheduled admission identity is conflicted','standing');
            if(priorRows.length===1) {
              const prior=resolveScheduledAdmission(priorRows[0]!,read(preserved),preserved);
              requireIntake(prior.kind==='valid',
                'scheduled intake: original admission evidence is unavailable','integrity');
              const suppliedDiscovery=object(json(input.discovery));
              const originalDiscovery=prior.row.fact.predecessors.required.includes(
                text(suppliedDiscovery.id,'scheduled discovery reference'));
              scheduledDiscovery(input.discovery,eventId,originalDiscovery?prior.row.fact.at:at,preserved);
              append('intake-collapse',{ ...common,original: prior.row.fact.id },
                at,preserved,[receipt.id,prior.row.fact.id]);
              return { kind: 'duplicate' as const,logicalId,original: reference(prior.row.fact) };
            }

            checkDedup(at,preserved);
            const { tick,jobInstance,scheduledInstant }=decodeScheduledTickBody(
              input.raw,eventId,context(preserved).decode);
            const discovery=scheduledDiscovery(input.discovery,eventId,at,preserved);
            const standing=scheduledStanding(principal,at,preserved);
            const sliceAFacts=read(preserved),sliceARows=statuses(preserved);
            refuseSliceADirectives(sliceARows,preserved,
              new Set(causalCone(receipt,sliceAFacts).map(fact => fact.id)));
            const principalIdentityScope=take(decode('Scope',{
              type: 'Scope',schemaVersion: 1,kind: 'organization',
            },context(preserved).decode));
            const scheduledPrincipalSchema=scheduledIntakeFactSchemas(principalIdentityScope)[0]!;
            requireIntake(context(preserved).schemas.some(schema => same(schema,scheduledPrincipalSchema)),
              'P4-NF-06/12: required scheduled owner schema changed or missing: intake-scheduled-principal');
            const existingPrincipals=read(preserved).filter(fact =>
              fact.kind==='intake-scheduled-principal'&&same(object(fact.body).principal,principal));
            requireIntake(existingPrincipals.length<=1,
              'unsupported-in-slice-a: multiple principal witness copies belong to Slice B','standing');
            const principalFact=existingPrincipals[0]??append('intake-scheduled-principal',
              { principal: json(principal) },at,preserved,[standing.row.fact.id],principal);
            const resolved=append('intake-resolved',{
              ...common,principalId: principal.id,
              authentication: json(principal.provenance.record),binding: 'none',
            },at,preserved,[receipt.id,discovery.row.fact.id,standing.row.fact.id],principal);

            // Re-resolve the signed witnesses after the durable resolution write.
            const admissionRows=statuses(preserved);
            const admissionDiscovery=scheduledDiscovery(input.discovery,eventId,at,preserved);
            const admissionStanding=scheduledStanding(principal,at,preserved);
            const admissionPrincipal=admissionRows.find(row => row.fact.id===principalFact.id
              &&row.fact.kind==='intake-scheduled-principal'&&!row.taint.length&&!row.conflicts.length
              &&row.historical.some((record): record is HistoricalRead<VerifiedPrincipal> =>
                record.view.type==='VerifiedPrincipal'&&record.captureStatus==='available'
                &&same(record.view,principal)));
            requireIntake(admissionPrincipal,
              'scheduled intake: current signed principal witness is unavailable or contested','standing');
            constitutionalField(admissionPrincipal,'VerifiedPrincipal',principal.id,preserved);
            const intent: Json={
              type: 'Intent',schemaVersion: 1,id: logicalId,principal: json(principal),
              receivedAt: json(original.at),via: adapterId,raw: captured.hash,ask: tick,under: [],
            };
            const committedFacts=read(preserved);
            const committed=statuses(preserved).find(row =>
              isScheduledAdmission(row.fact,committedFacts,preserved)
              &&object(row.body).logicalId===logicalId);
            if(committed) {
              requireIntake(object(committed.body).rawHash===captured.hash,
                'P4-NF-03: concurrent scheduled arrival hash mismatch','integrity');
              const resolvedCommitted=resolveScheduledAdmission(committed,read(preserved),preserved);
              requireIntake(resolvedCommitted.kind==='valid',
                'scheduled intake: committed admission evidence is unavailable','integrity');
              checkDedup(at,preserved);
              append('intake-collapse',{ ...common,original: committed.fact.id },
                at,preserved,[receipt.id,committed.fact.id]);
              return { kind: 'duplicate' as const,logicalId,original: reference(committed.fact) };
            }
            const admitted=append('intake-admitted',{
              ...common,intent,
              work: {
                type: 'IntakeWork',schemaVersion: 1,owner,
                blockedOn: 'run-admission',standing: 'requester',
              },binding: 'none',
            },at,preserved,[
              receipt.id,original.id,resolved.id,admissionPrincipal.fact.id,
              admissionDiscovery.row.fact.id,admissionStanding.row.fact.id,
            ],principal,true);
            const fact=reference(admitted);
            const principalReference: ConstitutionalReference<'VerifiedPrincipal'>={
              type: 'VerifiedPrincipal',id: principal.id,
              fact: reference(admissionPrincipal.fact),field: 'principal',
            };
            const standingReference: ConstitutionalReference<'StandingGrant'>={
              type: 'StandingGrant',id: admissionStanding.grant.view.id,
              fact: reference(admissionStanding.row.fact),field: admissionStanding.field,
            };
            return {
              kind: 'scheduled-admitted' as const,logicalId,fact,owner,
              blockedOn: 'run-admission' as const,
              principal: Object.freeze(principalReference),
              standing: Object.freeze(standingReference),
              scheduledIdentity: Object.freeze({ jobInstance,scheduledInstant }),
            };
          } finally { busy=false; }
        }));
      });
    }

    function pendingScheduledAdmissions(
      input: PendingScheduledAdmissionsInput): Result<PendingScheduledAdmissions> {
      return boundary('PendingScheduledAdmissions',{
        ...b,preserved: input?.after?.id??initial.preserved,
      },() => {
        const ownerInput=text(input.owner,'scheduled intake owner');
        requireIntake(Number.isSafeInteger(input.limit)&&input.limit>0&&input.limit<=100,
          'scheduled intake: page limit must be between 1 and 100','policy');
        const frontier=object(json(input.frontier));
        for(const [machine,value] of Object.entries(frontier)) {
          text(machine,'frontier machine');
          const position=object(value);
          exact(position,['epoch','position'],'scheduled intake: malformed causal frontier');
          requireIntake(Number.isSafeInteger(position.epoch)&&Number(position.epoch)>=0
            &&Number.isSafeInteger(position.position)&&Number(position.position)>=0,
          'scheduled intake: malformed causal frontier','decode');
        }
        const facts=read(initial.preserved);
        const heads=new Map<string,{ epoch: number;position: number }>();
        for(const fact of facts) {
          const prior=heads.get(fact.machine);
          if(!prior||fact.segment.epoch>prior.epoch
            ||fact.segment.epoch===prior.epoch&&fact.segment.position>prior.position) {
            heads.set(fact.machine,{
              epoch: fact.segment.epoch,position: fact.segment.position,
            });
          }
        }
        for(const [machine,value] of Object.entries(frontier)) {
          const requested=object(value),head=heads.get(machine);
          requireIntake(head&&(Number(requested.epoch)<head.epoch
            ||Number(requested.epoch)===head.epoch&&Number(requested.position)<=head.position),
          'scheduled intake: frontier claims unavailable history','stale-base');
        }
        const visible=(fact: FactEnvelope) => {
          const position=frontier[fact.machine];
          return !!position&&(fact.segment.epoch<Number(object(position).epoch)
            ||fact.segment.epoch===Number(object(position).epoch)
              &&fact.segment.position<=Number(object(position).position));
        };
        const snapshot=statuses(initial.preserved);
        const rows=snapshot.filter(row => visible(row.fact)
          &&isScheduledAdmission(row.fact,facts,initial.preserved))
          .sort((left,right) => foldKey(left.fact)<foldKey(right.fact)?-1
            :foldKey(left.fact)>foldKey(right.fact)?1:0);
        const resolved=rows.map(row => resolveScheduledAdmission(row,facts,initial.preserved));
        for(const candidate of resolved) requireIntake(
          causalCone(candidate.row.fact,facts).every(visible),
          'scheduled intake: frontier omits an admission dependency','stale-base');
        const valid=resolved.filter((candidate): candidate is Extract<ScheduledResolution,{ kind: 'valid' }> =>
          candidate.kind==='valid');
        const validIds=new Set(valid.map(candidate => candidate.row.fact.id));
        const historicalContext={ ...context(initial.preserved),facts };
        const opened=new Set(snapshot.filter(row => visible(row.fact)&&row.fact.kind==='run-opening'
          &&row.taint.length===0&&row.conflicts.length===0
          &&causalCone(row.fact,facts).every(visible)).flatMap(row => {
            try {
              const schema=context(initial.preserved).schemas.find(candidate =>
                candidate.kind===row.fact.kind&&candidate.version===row.fact.schemaVersion);
              const recordField=schema?.fields.record;
              requireIntake(recordField?.kind==='owned'&&recordField.owner==='part-five'
                &&recordField.name==='Run',
              'scheduled intake: Run opening owner decoder is missing','integrity');
              const decoded=take(decodeHistoricalBody(row.fact,historicalContext,
                causalStanding(row.fact,historicalContext,false).decode));
              requireIntake(decoded.taint.length===0,
                'scheduled intake: Run opening evidence is unavailable','integrity');
              const record=object(json(decoded.fields.record!)),opening=object(record.opening!);
              requireIntake(record.type==='Run'&&object(row.body).run===record.id,
                'scheduled intake: Run opening subject differs from its owner-decoded record','integrity');
              const id=text(opening.id,'Run opening admission');
              return opening.owner==='part-two'&&opening.name==='FactEnvelope'
                &&validIds.has(id)&&row.fact.predecessors.required.includes(id)?[id]:[];
            } catch { return []; }
          }));
        const selected=resolved.map(candidate => candidate.row)
          .filter(row => object(object(row.body).work!).owner===ownerInput&&!opened.has(row.fact.id));
        let start=0;
        if(input.after!==null) {
          const cursor=object(json(input.after));
          exact(cursor,['owner','name','id'],
            'scheduled intake: cursor must be one Part Two fact reference');
          requireIntake(cursor.owner==='part-two'&&cursor.name==='FactEnvelope',
            'scheduled intake: cursor owner/type mismatch','decode');
          const index=selected.findIndex(row => row.fact.id===cursor.id);
          requireIntake(index>=0,
            'scheduled intake: cursor is not an admission in this owner/frontier','stale-base');
          start=index+1;
        }
        const page=selected.slice(start,start+input.limit);
        const more=start+page.length<selected.length;
        const partial=page.filter(row => !validIds.has(row.fact.id)).map(row => reference(row.fact));
        return Object.freeze({
          admissions: Object.freeze(page.filter(row => validIds.has(row.fact.id))
            .map(row => reference(row.fact))),
          ...(partial.length?{ partial: Object.freeze(partial) }:{}),
          next: more&&page.length?reference(page.at(-1)!.fact):null,
        });
      });
    }

    return Object.freeze({
      receive: legacy.receive,
      recover: legacy.recover,
      expireHolds: legacy.expireHolds,
      admitVerifiedAct: legacy.admitVerifiedAct,
      receiveScheduledTick,
      pendingScheduledAdmissions,
    });
  });
}
