import type { BoundaryContext,Clock,DecodeContext,Evidence,HistoricalRead,Inventory,Json,RegisterReadPort,Scope,VerifiedPrincipal } from '../index.js';
import { canonical,consumeResult,decode,decodeMeasurement,historicalGrantLiveness,readHistorical,readHistoricalEvidence,scopeIncludes } from '../index.js';
import { causalCone,causalStanding,decodeHistoricalBody,hashBytes,registerOwnedBody } from '../facts/index.js';
import { decodeOwnedBody } from '../facts/owned.js';
import type { FactContext,FactEnvelope,FactSchema,OwnedBodyContext,OwnedBodyRegistration } from '../facts/index.js';
import type { Result } from '../index.js';
import { IntakeFailure,json,object,requireIntake,same,take,text } from './boundary.js';
import { intakeArrival,intakeWorkRegistration } from './records.js';
import { readRegisterEntry } from '../register/index.js';
import type { RegisterContext,VerifiedRegister } from '../register/index.js';

export const scheduledIntakeKinds=Object.freeze(['intake-scheduled-principal'] as const);

type OwnerRegisterReadPort=Pick<RegisterReadPort,'entries'|'generation'|'sites'>;
type BoundIntakeOwnerRegister=Readonly<{ register: VerifiedRegister; scheduledAdapters: readonly string[] }>;
const verifiedOwnerRegisters=new WeakMap<object,BoundIntakeOwnerRegister>();

function scheduledAdapterIds(register: VerifiedRegister): readonly string[] {
  return register.entries.filter(entry => {
    if(entry.declaration.kind!=='parsers'||entry.declaration.status!=='live') return false;
    const authentication=entry.declaration.requiredFacts.authenticationClass;
    return Array.isArray(authentication)&&authentication.some(row => {
      try {
        const declaration=object(row);
        return declaration.stimulusType==='scheduled-tick'&&declaration.class==='verified';
      } catch { return false; }
    });
  }).map(entry => entry.declaration.id);
}

export function bindIntakeOwnerRegister(readPort: OwnerRegisterReadPort,register: VerifiedRegister,context: RegisterContext,
  adapterId?: string): void {
  const scheduled=new Set(scheduledAdapterIds(register));
  const parsers=register.entries.filter(entry => scheduled.has(entry.declaration.id)
    &&(adapterId===undefined||entry.declaration.id===adapterId));
  requireIntake(parsers.length>0&&parsers.every(entry => {
    const verified=consumeResult(readRegisterEntry(entry.declaration.id,register,context),
      { Success: value => value,Refused: () => undefined });
    return !!verified&&same(verified.declaration,entry.declaration)&&readPort.entries.includes(entry.declaration.id);
  }),
  'scheduled intake: verified adapter declaration differs from decoder register','integrity');
  verifiedOwnerRegisters.set(readPort as object,{ register,scheduledAdapters: Object.freeze(parsers.map(entry => entry.declaration.id)) });
}

export function registeredScheduledIntakeAdapters(register?: VerifiedRegister,readPort?: OwnerRegisterReadPort): readonly string[] {
  const bound=readPort&&verifiedOwnerRegisters.get(readPort as object);
  requireIntake(!register||register===bound?.register,'scheduled intake: owner register was not verified','integrity');
  const declared=bound?.scheduledAdapters??[];
  if(bound&&readPort) requireIntake(declared.every(adapter => readPort.entries.includes(adapter)),
    'scheduled intake: verified adapter declaration differs from decoder register','integrity');
  return Object.freeze([...new Set(declared)].sort());
}

export function scheduledIntakeFactSchemas(scope: Scope): readonly FactSchema[] {
  return [{
    kind: 'intake-scheduled-principal',version: 1,machineScope: 'shared',standing: 'requester',
    action: 'work',scope,causallyBound: false,requiredReferences: [],authority: 'none',
    fields: { principal: { kind: 'constitutional',type: 'VerifiedPrincipal' } }
  }];
}

function rfc3339z(value: number): string {
  requireIntake(Number.isSafeInteger(value),'scheduled intake: instant must be integral Unix milliseconds','decode');
  const seconds=Math.floor(value/1000),milliseconds=value-seconds*1000,days=Math.floor(seconds/86400),inDay=seconds-days*86400;
  const z=days+719468,era=Math.floor(z/146097),doe=z-era*146097;
  const yoe=Math.floor((doe-Math.floor(doe/1460)+Math.floor(doe/36524)-Math.floor(doe/146096))/365);
  let year=yoe+era*400;
  const doy=doe-(365*yoe+Math.floor(yoe/4)-Math.floor(yoe/100)),mp=Math.floor((5*doy+2)/153);
  const day=doy-Math.floor((153*mp+2)/5)+1,month=mp+(mp<10?3:-9); year+=month<=2?1:0;
  requireIntake(year>=0&&year<=9999,'scheduled intake: instant exceeds four-digit RFC-3339-Z range','decode');
  const pad=(n: number,width: number) => String(n).padStart(width,'0');
  return `${pad(year,4)}-${pad(month,2)}-${pad(day,2)}T${pad(Math.floor(inDay/3600),2)}:${pad(Math.floor(inDay%3600/60),2)}:${pad(inDay%60,2)}.${pad(milliseconds,3)}Z`;
}

export function decodeScheduledTickBody(raw: string,eventId: string,context: DecodeContext) {
  let tick: Record<string,Json>;
  try { tick=object(JSON.parse(raw) as Json); }
  catch { throw new IntakeFailure('scheduled intake: malformed canonical tick bytes','decode'); }
  const keys=['schemaVersion','jobInstance','scheduledInstant','packageDigest','calendarPolicyVersion','timeZoneDataVersion'];
  requireIntake(Object.keys(tick).length===keys.length&&Object.keys(tick).every(key => keys.includes(key)),
    'scheduled intake: malformed canonical tick body','decode');
  requireIntake(take(canonical(tick)).bytes===raw&&tick.schemaVersion===1,
    'scheduled intake: tick bytes are not canonical schema version 1','decode');
  const jobInstance=text(tick.jobInstance,'scheduled job instance');
  requireIntake(typeof tick.packageDigest==='string'&&/^sha256:[a-f0-9]{64}$/.test(tick.packageDigest),
    'scheduled intake: package digest must be SHA-256','decode');
  text(tick.calendarPolicyVersion,'calendar policy version'); text(tick.timeZoneDataVersion,'time-zone-data version');
  const scheduledInstant=take(decodeMeasurement('clock',tick.scheduledInstant,context));
  requireIntake(scheduledInstant.subject.instance==='scheduled-clock',
    'scheduled intake: canonical tick instant must use the source-independent scheduled clock','decode');
  const expectedEventId=take(canonical([tick.schemaVersion,jobInstance,rfc3339z(scheduledInstant.value)])).hash;
  requireIntake(eventId===expectedEventId,'scheduled intake: event id differs from namespace/job/instant identity','integrity');
  return { tick,jobInstance,scheduledInstant };
}

export type ScheduledHistoryRow=Readonly<{
  fact: FactEnvelope;
  record: HistoricalRead<Inventory[keyof Inventory]>;
}>;

function signedPrincipals(input: Json,fact: FactEnvelope,path: readonly string[],context: FactContext): readonly HistoricalRead<VerifiedPrincipal>[] {
  const originBytes=take(canonical(fact)).bytes,originReference=`origin:${fact.id}`;
  const captures={ ...context.decode.captures,[originReference]: originBytes };
  const captureStatuses=Object.fromEntries(Object.entries(context.captures).map(([reference,value]) => [reference,value.status]));
  const reads=Object.keys(context.decode.register.keys).flatMap(machineKeyId => consumeResult(readHistorical('VerifiedPrincipal',input,{
    origin: { owner:'part-two',name:'FactEnvelope',id:fact.id },
    capture: { reference:originReference,hash:hashBytes(originBytes) },machineKeyId,path
  },{ ...context.decode,preserved:fact.id,captures,captureStatuses }),{
    Success: value => [value],Refused: () => []
  }));
  return [...new Map(reads.map(read => [take(canonical(read.view)).hash,read] as const)).values()];
}

function isSignedSystem(principal: HistoricalRead<VerifiedPrincipal>['view']): boolean {
  return principal.kind==='system'&&principal.provenance.class==='verified';
}

// Classification is evidence-only. A canonical tick-shaped person message is
// legacy input; a package-system Intent or a referenced signed system identity
// selects the Slice A validator even if the preserved tick capture is absent.
export function isScheduledIntakeAdmission(fact: FactEnvelope,facts: readonly FactEnvelope[],observerId: string,
  registeredScheduledAdapters: readonly string[],context: FactContext): boolean {
  if(fact.kind!=='intake-admitted'||registeredScheduledAdapters.length===0) return false;
  try {
    const body=object(fact.body),receipt=facts.find(candidate => candidate.id===body.receipt&&candidate.kind==='intake-receipt');
    if(!receipt||!intakeArrival(receipt,observerId)) return false;
    const intent=object(body.intent!),intentPrincipal=object(intent.principal!);
    const signedIntent=signedPrincipals(intentPrincipal,fact,['body','intent','principal'],context);
    if(signedIntent.some(read => isSignedSystem(read.view))) return true;
    const required=new Set(fact.predecessors.required);
    for(const candidate of facts) {
      if(!required.has(candidate.id)||candidate.kind!=='intake-scheduled-principal') continue;
      const principal=object(candidate.body).principal;
      if(principal!==undefined&&signedPrincipals(principal,candidate,['body','principal'],context).some(read => isSignedSystem(read.view))) return true;
    }
    return false;
  } catch { return false; }
}

export function validateScheduledIntakeRoute(adapterInput: Json,channelInput: Json,senderInput: Json,
  identityEpochInput: Json,principalInput: Json,context: DecodeContext,registeredScheduledAdapters: readonly string[]): void {
  const adapter=text(adapterInput,'scheduled adapter'),channel=text(channelInput,'scheduled channel');
  const sender=text(senderInput,'scheduled sender'),identityEpoch=text(identityEpochInput,'scheduled identity epoch');
  requireIntake(context.register.entries.includes(adapter)&&registeredScheduledAdapters.includes(adapter),
    'unsupported-in-slice-a: adapter is not registered for verified scheduled ticks','standing');
  requireIntake(channel.startsWith('scheduled:')&&channel.length>'scheduled:'.length,
    'unsupported-in-slice-a: channel must name its scheduled installation','decode');
  const principal=object(principalInput),provenance=object(principal.provenance!);
  const authenticated=object(provenance.authenticated!),signedPrincipal=object(authenticated.principal!);
  requireIntake(principal.kind==='system'&&principal.id===sender&&provenance.class==='verified'
    &&provenance.adapter===adapter&&authenticated.recordType==='package-system-principal'
    &&signedPrincipal.id===principal.id&&signedPrincipal.kind==='system',
  'unsupported-in-slice-a: admitted principal differs from the signed route','standing');
  requireIntake(object(provenance.record!).hash===identityEpoch,
    'unsupported-in-slice-a: route identity epoch is not bound to the signed package identity','standing');
}

// Slice A resolves one matching Evidence record and never collapses or selects
// among copies. Historical unavailability is honest partiality; every known
// mismatch and every additional matching copy is still refused.
export function resolveScheduledDiscoveryWitness(histories: readonly ScheduledHistoryRow[],required: ReadonlySet<string>,
  eventId: string,causalNow: Clock,preserved: string,decodeContext: DecodeContext,mode: 'origin'|'historical',
  witnessRequired: ReadonlySet<string>=required) {
  const candidates=histories.filter((row): row is { fact: FactEnvelope; record: HistoricalRead<Evidence> } =>
    required.has(row.fact.id)&&row.record.view.type==='Evidence'&&row.record.view.source===row.fact.machine);
  // The signed claim remains independently checkable when its external capture
  // is unavailable. Treat every event- or predicate-related record as a named
  // discovery candidate before consulting capture availability so missing bytes
  // cannot erase a mismatch or a second witness.
  const named=candidates.filter(row => row.record.view.claim.subject===eventId
    ||row.record.view.claim.predicate==='scheduled-discovery');
  requireIntake(named.length===1&&witnessRequired.has(named[0]!.fact.id),
    'unsupported-in-slice-a: exactly one discovery Evidence witness is required','integrity');
  const witness=named[0]!;
  const recorded=witness.record.view;
  requireIntake(recorded.claim.subject===eventId&&recorded.claim.predicate==='scheduled-discovery'
    &&recorded.claim.value===true&&causalNow.value>=recorded.observedAt.value
    &&causalNow.value<=recorded.observedAt.value+recorded.freshFor,
  'unsupported-in-slice-a: discovery Evidence witness is stale or mismatched','integrity');
  if(witness.record.captureStatus!=='available') {
    requireIntake(mode==='historical',
      'unsupported-in-slice-a: discovery Evidence witness is unavailable at append','integrity');
    return { ...witness,partial: true };
  }
  const claim=take(readHistoricalEvidence(witness.record,causalNow,preserved));
  requireIntake(claim.subject===eventId&&claim.predicate==='scheduled-discovery'&&claim.value===true,
    'unsupported-in-slice-a: discovery Evidence witness is stale or mismatched','integrity');
  return { ...witness,partial: false };
}

function scheduledHistories(c: OwnedBodyContext) {
  const cone=causalCone(c.origin,c.facts.facts),coneIds=new Set(cone.map(fact => fact.id));
  const grants=[...c.facts.historicalGrants??[]],revocations=[...c.facts.historicalRevocations??[]];
  const historicalContext={ ...c.facts,historicalGrants: grants,historicalRevocations: revocations };
  for(const fact of [...cone].sort((left,right) => causalCone(left,c.facts.facts).length-causalCone(right,c.facts.facts).length)) {
    const schema=c.facts.schemas.find(candidate => candidate.kind===fact.kind&&candidate.version===fact.schemaVersion);
    if(!Object.values(schema?.fields??{}).some(field => field.kind==='constitutional'
      &&['StandingGrant','Revocation'].includes(field.type))) continue;
    const decoded=take(decodeHistoricalBody(fact,historicalContext,causalStanding(fact,historicalContext,false).decode));
    for(const grant of decoded.grants) if(!grants.some(row => row.factId===fact.id&&row.grant.view.id===grant.view.id))
      grants.push({ factId: fact.id,grant });
    for(const revocation of decoded.revocations) if(!revocations.some(row => row.factId===fact.id
      &&row.revocation.view.id===revocation.view.id)) revocations.push({ factId: fact.id,revocation });
  }
  const histories: ScheduledHistoryRow[]=cone.flatMap(fact => {
    const decoded=take(decodeHistoricalBody(fact,historicalContext,causalStanding(fact,historicalContext,false).decode));
    return decoded.records.filter(record => record.origin.id===fact.id).map(record => ({ fact,record }));
  });
  return { cone,coneIds,grants,revocations,historicalContext,histories };
}

function validateScheduledIntakeWork(input: Json,c: OwnedBodyContext,registeredScheduledAdapters: readonly string[]): void {
  const body=object(c.origin.body),intent=object(body.intent!),principal=object(intent.principal!) as unknown as VerifiedPrincipal;
  validateScheduledIntakeRoute(body.adapter!,body.channel!,body.sender!,body.identityEpoch!,json(principal),c.facts.decode,
    registeredScheduledAdapters);
  requireIntake(Array.isArray(intent.under)&&intent.under.length===0,
    'unsupported-in-slice-a: scheduled admission cannot carry Directive identities','standing');
  const eventId=text(body.eventId,'scheduled event id'),scheduledAsk=object(intent.ask!);
  try { decodeScheduledTickBody(take(canonical(scheduledAsk)).bytes,eventId,c.facts.decode); }
  catch { throw new IntakeFailure('unsupported-in-slice-a: admitted Intent differs from the canonical tick','integrity'); }
  const receipt=c.facts.facts.find(fact => fact.id===body.receipt&&fact.kind==='intake-receipt');
  requireIntake(receipt,'unsupported-in-slice-a: durable receipt dependency is missing','integrity');
  const receiptBody=object(receipt.body),capturePin=object(receiptBody.capture!);
  const capture=c.facts.captures[text(capturePin.reference,'scheduled capture reference')];
  if(c.mode==='origin'||capture?.status==='available') {
    requireIntake(capture?.status==='available'&&capture.bytes!==null&&capture.hash===capturePin.hash
      &&capture.hash===receiptBody.rawHash&&capture.hash===body.rawHash&&hashBytes(capture.bytes)===capture.hash,
    'unsupported-in-slice-a: preserved tick capture is missing or changed','integrity');
    const parsed=decodeScheduledTickBody(capture.bytes,eventId,c.facts.decode);
    requireIntake(same(scheduledAsk,parsed.tick),
      'unsupported-in-slice-a: admitted Intent differs from the preserved tick','integrity');
  }
  const { cone,coneIds,grants,revocations,historicalContext,histories }=scheduledHistories(c);
  const required=new Set(c.origin.predecessors.required);
  const directiveFields=cone.flatMap(fact => {
    const schema=c.facts.schemas.find(candidate => candidate.kind===fact.kind&&candidate.version===fact.schemaVersion);
    return Object.values(schema?.fields??{}).filter(field => field.kind==='constitutional'&&field.type==='Directive');
  });
  requireIntake(directiveFields.length===0,
    'unsupported-in-slice-a: Directive-bearing scheduled history belongs to Slice B','standing');

  const principalFacts=cone.filter(fact => required.has(fact.id)&&fact.kind==='intake-scheduled-principal');
  const principalCandidates=principalFacts.flatMap(fact => histories.filter(row => row.fact.id===fact.id
    &&row.record.view.type==='VerifiedPrincipal')) as readonly { fact: FactEnvelope; record: HistoricalRead<VerifiedPrincipal> }[];
  requireIntake(principalFacts.length===1&&principalCandidates.length===1,
    'unsupported-in-slice-a: exactly one signed principal witness fact is required','standing');
  const principalWitness=principalCandidates[0]!;
  const principalIdentity=principalCandidates.filter(row => row.record.view.id===principal.id);
  requireIntake(principalIdentity.length===1,
    'unsupported-in-slice-a: principal witness is copied or conflicted','standing');
  requireIntake(c.mode==='historical'||principalWitness.record.captureStatus==='available',
    'unsupported-in-slice-a: principal witness is unavailable','integrity');
  requireIntake(same(principalWitness.record.view,principal),
    'unsupported-in-slice-a: Intent principal disagrees with its signed identity','standing');

  const resolutions=cone.filter(fact => required.has(fact.id)&&fact.kind==='intake-resolved');
  requireIntake(resolutions.length===1,'unsupported-in-slice-a: exactly one resolved-principal witness is required','integrity');
  const resolution=resolutions[0]!;
  const causalNow=causalStanding(c.origin,historicalContext,false).now;
  const discovery=resolveScheduledDiscoveryWitness(histories,required,eventId,causalNow,c.preserved,c.facts.decode,c.mode,
    new Set(resolution.predecessors.required));
  const historicalGrants=grants.filter(row => coneIds.has(row.factId)
    &&row.grant.view.grantee.id===principal.id&&row.grant.view.grantee.kind==='system'
    &&row.grant.view.standing==='delegate'&&row.grant.view.actions.includes('work')
    &&scopeIncludes(take(decode('Scope',row.grant.view.scope,c.facts.decode)),
      c.facts.schemas.find(schema => schema.kind===c.origin.kind&&schema.version===c.origin.schemaVersion)!.scope));
  requireIntake(historicalGrants.length===1&&required.has(historicalGrants[0]!.factId),
    'unsupported-in-slice-a: exactly one referenced live package-system grant witness is required','standing');
  const selectedGrants=historicalGrants,selectedGrantId=selectedGrants[0]!.grant.view.id;
  if(c.mode==='origin'||selectedGrants[0]!.grant.captureStatus==='available') requireIntake(
    selectedGrants.every(row => row.grant.captureStatus==='available')
      &&take(historicalGrantLiveness(selectedGrants[0]!.grant,revocations.filter(row => coneIds.has(row.factId)
        &&row.revocation.view.grantId===selectedGrantId).map(row => row.revocation),causalNow,c.preserved))==='live',
    'unsupported-in-slice-a: referenced package-system grant is unavailable or not live','standing');

  const resolved=object(resolution.body),principalProvenance=object(json(principal.provenance));
  requireIntake(resolution.principal.id===principal.id&&same(json(resolution.principal),json(principal))
    &&same(json(resolution.provenance),principalProvenance)&&same(json(resolution.at),json(c.origin.at)),
  'unsupported-in-slice-a: resolved principal disagrees with the signed identity','standing');
  requireIntake(resolved.logicalId===body.logicalId&&resolved.receipt===receipt.id
    &&resolved.rawHash===body.rawHash&&resolved.adapter===body.adapter&&resolved.channel===body.channel
    &&resolved.sender===body.sender&&resolved.identityEpoch===body.identityEpoch&&resolved.eventId===body.eventId
    &&resolved.principalId===principal.id&&resolved.binding==='none'
    &&same(resolved.authentication,principalProvenance.record),
  'unsupported-in-slice-a: resolved-principal witness differs from the admission','integrity');
  requireIntake(resolution.predecessors.required.includes(receipt.id)
    &&(!discovery||resolution.predecessors.required.includes(discovery.fact.id))
    &&selectedGrants.some(row => resolution.predecessors.required.includes(row.factId)),
  'unsupported-in-slice-a: resolved-principal witness omits signed authority','integrity');
  const decodedResolution=take(decodeHistoricalBody(resolution,historicalContext,
    causalStanding(resolution,historicalContext,false).decode));
  requireIntake(c.mode==='historical'||decodedResolution.taint.length===0,
    'unsupported-in-slice-a: resolved-principal witness is unavailable','integrity');
}

export function scheduledIntakeWorkRegistration(context: BoundaryContext,observerId: string,
  register: VerifiedRegister): Result<OwnedBodyRegistration> {
  const registeredScheduledAdapters=registeredScheduledIntakeAdapters(register,context.register);
  const legacy=take(intakeWorkRegistration(context,observerId));
  return registerOwnedBody({
    name: 'IntakeWork',owner: 'part-four',currentVersion: 1,migrations: {},
    versions: { 1: { validate: value => ({ ok: true,value }) } },
    decodeCurrent: (input,c) => {
      try {
        // The actual 32e5961 registration is the first dispatch. Its opaque,
        // registered runner performs the legacy shape and semantic validation;
        // only a legacy-valid record can reach the additive scheduled arm.
        const legacyResult=decodeOwnedBody('part-four','IntakeWork',input,c.origin,c.mode,
          { ...c.facts,ownedBodies: [
            ...c.facts.ownedBodies?.filter(candidate => !(candidate.owner==='part-four'&&candidate.name==='IntakeWork'))??[],legacy
          ] });
        if(isScheduledIntakeAdmission(c.origin,c.facts.facts,observerId,registeredScheduledAdapters,c.facts))
          validateScheduledIntakeWork(input,c,registeredScheduledAdapters);
        return { ok: true,value: legacyResult.value };
      } catch(e) { return { ok: false,detail: e instanceof Error? e.message:'unsupported-in-slice-a' }; }
    },
  },{
    kind: 'object',fields: {
      type: { kind: 'text',maxLength: 40 },schemaVersion: { kind: 'integer' },
      owner: { kind: 'text',maxLength: 1024 },blockedOn: { kind: 'text',maxLength: 40 },standing: { kind: 'text',maxLength: 40 },
      deliveryFlag: { kind: 'text',maxLength: 40 }
    },optional: ['deliveryFlag']
  },context);
}
