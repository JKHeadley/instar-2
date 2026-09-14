import type { BoundaryContext,Clock,Hash,HistoricalRead,Inventory,Json,Provenance,RegisterGenerationReference,Scope } from '../index.js';
import { causalCone,causalStanding,hashBytes,registerOwnedBody } from '../facts/index.js';
import { canonical,decode,historicalGrantLiveness,scopeIncludes } from '../index.js';
import { prepareSnapshot } from '../facts/index.js';
import type { FactContext,FactEnvelope,FactSchema,FactSnapshot,FactStatus,OwnedBodyRegistration,OwnedShape } from '../facts/index.js';
import type { Result } from '../index.js';
import { json,object,requireIntake,same,take,text } from './boundary.js';
import type { ProjectionDefinition } from '../projections/index.js';

export const intakeKinds=Object.freeze(['intake-receipt','intake-resolved','intake-admitted','intake-held','intake-expired',
  'intake-collapse','intake-mismatch','intake-stop','intake-stop-signal','conversation-binding'] as const);
export const intakeVerifiedActKinds=Object.freeze(['intake-verified-act','authorization-request'] as const);

// Different scope dimensions are not evidence of disjoint work.
export function intakeScopesOverlap(a: Scope,b: Scope): boolean {
  return a.kind==='organization'||b.kind==='organization'||a.kind!==b.kind||a.members.some(m => b.members.includes(m));
}
// A signed retained observation is not automatically an arrival commitment. P2
// authenticates the envelope; this consumer applies the independent recorder policy.
// It is deliberately total over retained bodies: invalid observations stay inert.
export function intakeArrival(fact: FactEnvelope,observerId: string) {
  try {
    if(fact.kind!=='intake-receipt'||fact.principal.id!==observerId||fact.principal.kind!=='system'
      ||fact.provenance.class!=='verified'||fact.principal.provenance.class!=='verified') return undefined;
    const body=object(fact.body),route=object(JSON.parse(text(body.ingress,'ingress')) as Json);
    const valid=(v: Json|undefined): v is string => typeof v==='string'&&v.length>0&&v.length<=1024;
    if(!valid(body.adapter)||!valid(route.channel)||!valid(route.sender)||!valid(route.identityEpoch)||!valid(route.eventId)
      ||!Object.keys(route).every(k => ['channel','sender','identityEpoch','eventId'].includes(k))
      ||typeof body.rawHash!=='string'||!/^sha256:[a-f0-9]{64}$/.test(body.rawHash)
      ||object(body.capture!).hash!==body.rawHash) return undefined;
    return {
      logicalId: take(canonical([body.adapter,route.channel,route.sender,route.identityEpoch,route.eventId])).hash,
      adapter: body.adapter,rawHash: body.rawHash,
      route: { channel: route.channel,sender: route.sender,identityEpoch: route.identityEpoch,eventId: route.eventId }
    };
  } catch { return undefined; }
}

// Binding writes require the existing P2 operator/conferring ladder. Intake never authors one.
export function intakeFactSchemas(scope: Scope): readonly FactSchema[] {
  const short={ kind: 'text' as const,maxLength: 1024 };
  const shared={
    version: 1,machineScope: 'shared' as const,standing: 'requester' as const,
    action: 'work',scope,causallyBound: false,requiredReferences: [],authority: 'none' as const
  };
  const common={ logicalId: short,receipt: { kind: 'reference' as const },rawHash: short,adapter: short,channel: short,sender: short,identityEpoch: short,eventId: short };
  return [
    { ...shared,kind: 'intake-receipt',fields: { capture: { kind: 'capture' },rawHash: short,adapter: short,
      ingress: { kind: 'text',maxLength: 1048576 } } },
    { ...shared,kind: 'intake-resolved',fields: { ...common,principalId: short,authentication: { kind: 'capture' },binding: short } },
    {
      ...shared,kind: 'intake-admitted',fields: {
        ...common,intent: { kind: 'constitutional',type: 'Intent' },
        work: { kind: 'owned',owner: 'part-four',name: 'IntakeWork' },binding: short
      }
    },
    {
      ...shared,kind: 'intake-held',fields: {
        ...common,input: { kind: 'constitutional',type: 'UnresolvedInput' },
        reason: short,owner: short,expiresAt: { kind: 'integer' },coalescedInto: short
      }
    },
    { ...shared,kind: 'intake-expired',fields: { hold: { kind: 'reference' },terminal: short } },
    { ...shared,kind: 'intake-collapse',fields: { ...common,original: { kind: 'reference' } } },
    { ...shared,kind: 'intake-mismatch',fields: { ...common,original: { kind: 'reference' } } },
    {
      ...shared,kind: 'intake-stop',fields: {
        ...common,binding: { kind: 'reference' },scope: { kind: 'constitutional',type: 'Scope' },
        principalId: short,authentication: { kind: 'capture' },authority: { kind: 'owned',owner: 'part-four',name: 'IntakeStop' }
      }
    },
    { ...shared,kind: 'intake-stop-signal',fields: { ...common,principalId: short,authentication: { kind: 'capture' } } },
    {
      ...shared,kind: 'conversation-binding',standing: 'operator',authority: 'conferring',causallyBound: true,
      fields: {
        adapter: short,channel: short,sender: short,identityEpoch: short,principalId: short,
        grantId: short,scope: { kind: 'constitutional',type: 'Scope' },supersedes: short
      }
    },
  ];
}

/** Additive Part Eleven seam schemas. Legacy Part Four schema composition is unchanged. */
export function intakeVerifiedActFactSchemas(scope: Scope): readonly FactSchema[] {
  const short={ kind: 'text',maxLength: 1024 } as const;
  const shared={ version: 1,machineScope: 'shared' as const,standing: 'requester' as const,action: 'work',scope,
    causallyBound: false,requiredReferences: [] as readonly string[],authority: 'none' as const };
  return [
    { ...shared,kind: 'intake-verified-act',fields: {
      request: { kind: 'reference' as const },requestDigest: short,challenge: short,surface: short,generation: short,
      disposition: short,record: { kind: 'owned' as const,owner: 'part-four',name: 'VerifiedActDisposition' }
    } },
    { ...shared,kind: 'authorization-request',fields: {
      requestId: short,requestDigest: short,action: short,scope: { kind: 'constitutional' as const,type: 'Scope' },audience: short,
      artifact: short,base: short,expiresAt: { kind: 'integer' as const },grantExpiresAt: { kind: 'integer' as const },
      approverId: short,requestedById: short,
      consequence: short,reversibility: short,blockedWork: short,recurrence: { kind: 'text' as const,maxLength: 1048576 },
      requesterProse: { kind: 'text' as const,maxLength: 1048576 },evidence: { kind: 'capture' as const }
    } },
  ];
}

const vaText={ kind: 'text',maxLength: 1048576 } as const;
const vaShort={ kind: 'text',maxLength: 1024 } as const;
const maximumVerifiedActChallengeLifetime=5*60*1000;
const verifiedActShape: OwnedShape={ kind: 'object',fields: {
  type: vaShort,schemaVersion: { kind: 'integer' },request: vaShort,requestDigest: vaShort,decision: vaShort,
  disposition: vaShort,act: vaText,actDigest: vaShort,proof: { kind: 'capture' },challenge: vaShort,
  surface: vaShort,generation: vaShort,action: vaShort,scope: vaText,audience: vaShort,operator: vaShort,
  requestedBy: vaShort,artifact: vaShort,base: vaShort,issuedAt: { kind: 'integer' },expiresAt: { kind: 'integer' },
  emergency: { kind: 'boolean' }
} };

type VerifiedActRecord=Readonly<{
  type: 'VerifiedActDisposition'; schemaVersion: 1; request: string; requestDigest: Hash;
  decision: 'approve'|'decline'; disposition: 'approved'|'declined'|'emergency-stopped'; act: string;
  actDigest: string; proof: { reference: string; hash: Hash }; challenge: string; surface: string;
  generation: string; action: string; scope: string; audience: string; operator: string; requestedBy: string;
  artifact: Hash; base: string; issuedAt: number; expiresAt: number; emergency: boolean;
}>;
export type VerifiedActResolution=Readonly<{ record: VerifiedActRecord; proof: Provenance; emergency: boolean }>;
export type AuthorizationRequestRecurrenceResolution=Readonly<{
  valid: boolean; references: readonly string[]; detail: string|null;
}>;

function exact(v: Record<string,Json>,keys: readonly string[],detail: string): void {
  requireIntake(Object.keys(v).length===keys.length&&Object.keys(v).every(k => keys.includes(k)),detail,'standing');
}
function integer(v: Json|undefined,name: string): number {
  requireIntake(typeof v==='number'&&Number.isSafeInteger(v),`verified act: ${name} must be a safe integer`,'standing'); return v;
}
function hash(v: Json|undefined,name: string): Hash {
  requireIntake(typeof v==='string'&&/^sha256:[a-f0-9]{64}$/.test(v),`verified act: ${name} must be SHA-256`,'standing'); return v as Hash;
}
function body(status: FactStatus): Record<string,Json> { return object(status.body); }

/**
 * Additive Part Four recurrence resolver. Request text only nominates durable
 * history; it never proves recurrence. Every nominated fact must be a clean,
 * causally prior authorization request for the same registered operation class,
 * requester, and exact scope.
 */
export function resolveAuthorizationRequestRecurrence(snapshot: FactSnapshot,current: FactStatus): AuthorizationRequestRecurrenceResolution {
  let references: readonly string[]=[];
  try {
    requireIntake(current.fact.kind==='authorization-request','recurrence evidence: current fact is not an authorization request','standing');
    const currentBody=body(current);
    let parsed: Json;
    try { parsed=JSON.parse(text(currentBody.recurrence,'request.recurrence')) as Json; }
    catch { parsed=null; }
    requireIntake(Array.isArray(parsed)&&parsed.length>0&&parsed.length<=100
      &&parsed.every(item => typeof item==='string'&&item.trim().length>0),
    'recurrence evidence: request must name bounded durable history references','standing');
    references=Object.freeze(parsed as string[]);
    requireIntake(new Set(references).size===references.length&&!references.includes(current.fact.id),
      'recurrence evidence: references must be distinct prior requests','standing');
    const facts=snapshot.entries.map(row => row.fact);
    const cone=new Set(causalCone(current.fact,facts).map(row => row.id));
    for(const reference of references) {
      const matches=snapshot.entries.filter(row => row.fact.id===reference);
      requireIntake(matches.length===1,'recurrence evidence: referenced history is missing or ambiguous','standing');
      const prior=matches[0]!;
      requireIntake(prior.fact.kind==='authorization-request','recurrence evidence: referenced history has the wrong kind','standing');
      requireIntake(cone.has(prior.fact.id)&&prior.fact.at.value<=current.fact.at.value,
        'recurrence evidence: referenced request is not causally prior','standing');
      requireIntake(prior.taint.length===0&&prior.conflicts.length===0,
        'recurrence evidence: referenced request is tainted or conflicted','integrity');
      for(const dependency of prior.fact.predecessors.required) {
        const row=snapshot.entries.find(candidate => candidate.fact.id===dependency);
        requireIntake(row&&cone.has(row.fact.id)&&row.taint.length===0&&row.conflicts.length===0,
          'recurrence evidence: prior request dependencies are incomplete or contested','integrity');
      }
      const priorBody=body(prior);
      requireIntake(priorBody.action===currentBody.action&&priorBody.requestedById===currentBody.requestedById
        &&same(priorBody.scope,currentBody.scope),
      'recurrence evidence: prior request has a different operation classification, requester, or scope','standing');
    }
    return Object.freeze({ valid: true,references,detail: null });
  } catch(error) {
    return Object.freeze({ valid: false,references,detail: error instanceof Error? error.message:'recurrence evidence is unavailable' });
  }
}

function historyValues(snapshot: FactSnapshot) {
  return snapshot.entries.flatMap(r => r.historical);
}
function historical<N extends keyof Inventory>(values: readonly HistoricalRead<Inventory[keyof Inventory]>[],type: N,id: string) {
  return values.find((r): r is HistoricalRead<Inventory[N]> => r.view.type===type&&'id' in r.view&&r.view.id===id);
}
function currentGrant(grantId: string,values: readonly HistoricalRead<Inventory[keyof Inventory]>[],now: Clock,preserved: string) {
  const grant=historical(values,'StandingGrant',grantId);
  if(!grant) return undefined;
  const revocations=values.filter((r): r is HistoricalRead<Inventory['Revocation']> => r.view.type==='Revocation'&&r.view.grantId===grantId);
  return take(historicalGrantLiveness(grant,revocations,now,preserved))==='live'? grant:undefined;
}
function proofInput(c: FactContext,reference: string,expected: Hash): Json {
  const capture=c.captures[reference];
  requireIntake(capture?.status==='available'&&capture.bytes!==null&&capture.hash===expected&&capture.hash===hashBytes(capture.bytes),
    'verified act: proof bundle capture is missing or changed','integrity');
  try { return JSON.parse(capture.bytes) as Json; } catch { throw new Error('verified act: proof bundle is not JSON'); }
}

export function buildVerifiedActRecord(raw: Json,c: FactContext,now: Clock,expectedGeneration: string): VerifiedActResolution {
  const input=object(raw);
  exact(input,['request','requestDigest','decision','act','proof','surface','generation'],
    'verified act: caller-authored valid/principal/free-form grant fields are forbidden');
  const request=object(input.request!),generation=object(input.generation!),proof=object(input.proof!);
  exact(request,['owner','name','id'],'verified act: request must be one Part Two fact reference');
  exact(generation,['owner','name','id'],'verified act: generation must be one Part Three reference');
  exact(proof,['reference','hash'],'verified act: proof must be one capture reference');
  requireIntake(request.owner==='part-two'&&request.name==='FactEnvelope','verified act: request owner/type mismatch','standing');
  requireIntake(generation.owner==='part-three'&&generation.name==='RegisterGeneration','verified act: generation owner/type mismatch','standing');
  const bundle=object(proofInput(c,text(proof.reference,'proof.reference'),hash(proof.hash,'proof.hash'))),challengeInput=object(bundle.challenge!);
  // Decode once here only to derive a candidate; resolveVerifiedActRecord repeats
  // the verification and treats every derived byte as an assertion to check.
  const challenge=take(decode('Provenance',challengeInput,{ ...c.decode,preserved: text(request.id,'request.id') }));
  const p=object(challenge.authenticated.payload),decision=text(input.decision,'decision');
  requireIntake(decision==='approve'||decision==='decline','verified act: decision','standing');
  const act=input.act??null,actText=take(canonical(act)).bytes,actDigest=act===null?'none':take(canonical(act)).hash;
  const emergency=p.action==='emergency-stop',disposition=emergency?'emergency-stopped':decision==='decline'?'declined':'approved';
  const record: VerifiedActRecord={ type: 'VerifiedActDisposition',schemaVersion: 1,
    request: text(request.id,'request.id'),requestDigest: hash(input.requestDigest,'requestDigest'),
    decision: decision as 'approve'|'decline',disposition,act: actText,actDigest,
    proof: proof as unknown as VerifiedActRecord['proof'],challenge: text(p.challenge,'challenge'),
    surface: text(input.surface,'surface'),generation: text(generation.id,'generation.id'),action: text(p.action,'action'),
    scope: take(canonical(p.scope)).bytes,audience: text(p.audience,'audience'),operator: text(p.operator,'operator'),
    requestedBy: text(p.requestedBy,'requestedBy'),artifact: hash(p.artifact,'artifact'),base: text(p.base,'base'),
    issuedAt: integer(p.issuedAt,'issuedAt'),expiresAt: integer(p.expiresAt,'expiresAt'),emergency };
  return resolveVerifiedActRecord(json(record),c,now,expectedGeneration,'origin');
}

export function resolveVerifiedActRecord(raw: Json,c: FactContext,now: Clock,expectedGeneration: string,mode: 'origin'|'historical'): VerifiedActResolution {
  const r=object(raw); exact(r,['type','schemaVersion','request','requestDigest','decision','disposition','act','actDigest','proof','challenge',
    'surface','generation','action','scope','audience','operator','requestedBy','artifact','base','issuedAt','expiresAt','emergency'],
  'verified act: caller-authored valid/principal/grant fields are forbidden');
  requireIntake(r.type==='VerifiedActDisposition'&&r.schemaVersion===1,'verified act: record type/version','standing');
  const requestId=text(r.request,'request'),requestDigest=hash(r.requestDigest,'requestDigest');
  const decision=text(r.decision,'decision'); requireIntake(decision==='approve'||decision==='decline','verified act: decision','standing');
  const proof=object(r.proof!); exact(proof,['reference','hash'],'verified act: proof must be one capture reference');
  const bundle=object(proofInput(c,text(proof.reference,'proof.reference'),hash(proof.hash,'proof.hash')));
  exact(bundle,['type','schemaVersion','challenge','act'],'verified act: proof bundle shape');
  requireIntake(bundle.type==='VerifiedActProofBundle'&&bundle.schemaVersion===1,'verified act: proof bundle type/version','standing');
  const challenge=take(decode('Provenance',bundle.challenge,{ ...c.decode,preserved: requestId }));
  requireIntake(challenge.class==='verified','verified act: channel-attested proof cannot complete authority','standing');
  const surface=text(r.surface,'surface');
  requireIntake(challenge.adapter===surface&&c.decode.register.entries.includes(surface),
    'verified act: proof does not come from the registered surface','standing');
  requireIntake(challenge.authenticated.recordType==='verified-operator-challenge','verified act: wrong proof record type','standing');
  const p=object(challenge.authenticated.payload);
  exact(p,['type','schemaVersion','challenge','request','requestDigest','renderingDigest','action','scope','audience','operator','requestedBy',
    'artifact','base','issuedAt','expiresAt','singleUse','decision','actDigest','surface','generation'],'verified act: challenge subject shape');
  requireIntake(p.type==='VerifiedOperatorChallenge'&&p.schemaVersion===1&&p.singleUse===true,'verified act: challenge must be single-use','standing');
  const issuedAt=integer(p.issuedAt,'issuedAt'),expiresAt=integer(p.expiresAt,'expiresAt');
  requireIntake(issuedAt<=challenge.verifiedAt.value&&challenge.verifiedAt.value<=now.value&&now.value<=expiresAt,
    'verified act: challenge is expired, future-dated, or stale','stale-base');
  const generation=text(r.generation,'generation'),emergency=p.action==='emergency-stop';
  // Current-subject checks belong only to the origin admission. A disposition
  // that already passed this decoder at its causal position remains historical
  // evidence after the register advances; replay/new authority still re-enters
  // through origin mode and must match the current generation.
  requireIntake(emergency||mode==='historical'||generation===expectedGeneration,
    'verified act: stale register generation','stale-base');
  requireIntake(same(p.generation,{ owner: 'part-three',name: 'RegisterGeneration',id: generation })
    &&p.surface===surface&&p.request===requestId&&p.requestDigest===requestDigest&&p.challenge===r.challenge&&p.decision===decision,
  'verified act: challenge does not bind the submitted subject','standing');
  requireIntake(challenge.authenticated.principal.kind==='person'&&challenge.authenticated.principal.id===p.operator,
    'verified act: proof operator differs from challenge','standing');
  const facts=[...c.facts],snapshot=take(prepareSnapshot(facts,{ ...c,facts }));
  const requestRows=snapshot.entries.filter(x => x.fact.id===requestId);
  requireIntake(requestRows.length===1,'verified act: missing durable authorization-request reference','standing');
  const request=requestRows[0]!;
  requireIntake(request.fact.kind==='authorization-request','verified act: referenced fact has wrong kind','standing');
  const q=body(request);
  for(const field of ['requestId','requestDigest','action','scope','audience','artifact','base','expiresAt','approverId','requestedById'])
    requireIntake(q[field]!==undefined,`verified act: incomplete request missing ${field}`,'standing');
  const requestKey=text(q.requestId,'requestId');
  const siblings=snapshot.entries.filter(x => x.fact.kind==='authorization-request'&&x.fact.id!==request.fact.id&&body(x).requestId===requestKey);
  const superseding=siblings.find(x => causalCone(x.fact,facts).some(a => a.id===request.fact.id));
  const concurrent=siblings.find(x => !causalCone(x.fact,facts).some(a => a.id===request.fact.id)
    &&!causalCone(request.fact,facts).some(a => a.id===x.fact.id));
  const priorDispositions=snapshot.entries.filter(x => x.fact.kind==='intake-verified-act').map(x => {
    const envelope=body(x),record=object(envelope.record!);
    return { request: text(envelope.request,'prior request'),challenge: text(envelope.challenge,'prior challenge'),
      issuedAt: integer(record.issuedAt,'prior issuedAt'),expiresAt: integer(record.expiresAt,'prior expiresAt') };
  });
  const priorRequest=priorDispositions.find(x => x.request===requestId);
  requireIntake(!priorRequest,'verified act: replayed or already-disposed request','integrity');
  const reusedChallenge=priorDispositions.find(x => x.challenge===p.challenge);
  requireIntake(!reusedChallenge,'verified act: single-use challenge was reused or its lifetime changed','integrity');
  if(!emergency) {
    requireIntake(!superseding,'verified act: authorization request was superseded','stale-base');
    requireIntake(request.taint.length===0,'verified act: authorization request is tainted or incomplete','integrity');
    requireIntake(!concurrent&&request.conflicts.length===0,'verified act: authorization request is conflicted','integrity');
    for(const id of request.fact.predecessors.required) {
      const dependency=snapshot.entries.find(x => x.fact.id===id);
      requireIntake(dependency&&dependency.taint.length===0&&dependency.conflicts.length===0,
        'verified act: request causal dependencies are incomplete or contested','integrity');
    }
  }
  const scope=json(q.scope),scopeValue=take(decode('Scope',scope,c.decode));
  const artifact=hash(q.artifact,'artifact'),base=text(q.base,'base'),action=text(q.action,'action');
  const audience=text(q.audience,'audience'),operator=text(q.approverId,'approverId'),requestedBy=text(q.requestedById,'requestedById');
  requireIntake(Object.hasOwn(c.decode.register.actions,action),'verified act: request action is not registered','standing');
  const calculated=take(canonical({ type: 'AuthorizationRequest',schemaVersion: 1,approver: operator,action,scope,artifact,base })).hash;
  if(!emergency) {
    requireIntake(q.requestDigest===calculated&&requestDigest===calculated,'verified act: stale or inexact request digest','stale-base');
    const renderingDigest=take(canonical(q)).hash;
    requireIntake(p.renderingDigest===renderingDigest,'verified act: signed rendering digest differs from the durable request','stale-base');
    requireIntake(same(p.scope,scope)&&p.action===action&&p.audience===audience&&p.operator===operator&&p.requestedBy===requestedBy
      &&p.artifact===artifact&&p.base===base,'verified act: current base/artifact/scope/audience/operator moved','stale-base');
    const requestExpiresAt=integer(q.expiresAt,'request.expiresAt');
    requireIntake(now.value<=requestExpiresAt&&expiresAt<=requestExpiresAt&&expiresAt-issuedAt<=maximumVerifiedActChallengeLifetime,
      'verified act: authorization request or bounded challenge lifetime expired','stale-base');
    // `origin` validates a new act against the live subject. Historical replay
    // validates the immutable signed request/challenge/act relationships above,
    // but must not reinterpret a once-valid disposition against today's base or
    // artifact. Otherwise unrelated ordinary intake becomes tainted whenever the
    // deployment advances.
    if(mode==='origin') requireIntake(c.decode.currentBase===base&&c.decode.artifact===artifact,
      'verified act: current base or artifact differs from the signed request','stale-base');
  } else requireIntake(p.action==='emergency-stop','verified act: safety-open is reserved for emergency-stop','standing');
  const actText=text(r.act,'act'),act=JSON.parse(actText) as Json;
  const actDigest=act===null?'none':take(canonical(act)).hash;
  requireIntake(r.actDigest===actDigest&&p.actDigest===actDigest,'verified act: proof does not bind the exact act','standing');
  if(decision==='decline') requireIntake(act===null&&bundle.act===null,'verified act: decline cannot carry authority','standing');
  else {
    requireIntake(act!==null&&bundle.act!==null,'verified act: approval requires an independently verified act','standing');
    const actProof=take(decode('Provenance',bundle.act,{ ...c.decode,preserved: requestId }));
    requireIntake(actProof.class==='verified'&&actProof.adapter===surface&&actProof.authenticated.principal.id===operator,
      'verified act: act provenance is not the verified operator surface','standing');
    const a=object(act),type=text(a.type,'act.type');
    requireIntake(['Authorization','StandingGrant','Revocation'].includes(type),'verified act: unexpected Part One authority act','standing');
    const provenance=type==='Authorization'? a.explicitYes:a.source;
    requireIntake(same(provenance,actProof)&&same(actProof.authenticated.payload,
      Object.fromEntries(Object.entries(a).filter(([k]) => !['type','schemaVersion',type==='Authorization'?'explicitYes':'source'].includes(k)))),
    'verified act: authority act differs from independently signed fields','standing');
    if(mode==='origin') take(decode(type as 'Authorization'|'StandingGrant'|'Revocation',act,{ ...c.decode,provenance: actProof,
      now,actAt: now }));
    if(type==='Authorization') {
      exact(a,['type','schemaVersion','id','at','approver','under','action','artifact','base','kind','requestedBy','explicitYes','requestDigest'],
        'verified act: Authorization shape');
      const aa=object(a.action!),approver=object(a.approver!),requester=object(a.requestedBy!);
      requireIntake(aa.kind===action&&same(aa.scope,scope)&&a.artifact===artifact&&a.base===base&&a.requestDigest===requestDigest
        &&approver.id===operator&&requester.id===requestedBy,'verified act: Authorization exceeds or differs from request','standing');
      const values=historyValues(snapshot),grant=currentGrant(text(a.under,'authorization.under'),values,now,requestId);
      requireIntake(grant&&grant.view.grantee.id===operator&&scopeIncludes(grant.view.scope as Scope,scopeValue)
        &&(grant.view.standing==='operator'||grant.view.actions.includes(action)),
      'verified act: current historical standing does not authorize approval','standing');
    } else if(type==='StandingGrant') {
      const grantScope=take(decode('Scope',a.scope,c.decode)),grantee=object(a.grantee!);
      const recurrence=resolveAuthorizationRequestRecurrence(snapshot,request);
      requireIntake(recurrence.valid&&recurrence.references.length>0,
        `verified act: StandingGrant requires matching durable recurrence evidence (${recurrence.detail??'none'})`,'standing');
      const grantExpiresAt=integer(q.grantExpiresAt,'request.grantExpiresAt');
      requireIntake(same(grantScope,scopeValue)&&grantee.id===requestedBy&&integer(a.expiresAt,'StandingGrant.expiresAt')===grantExpiresAt,
        'verified act: StandingGrant scope, grantee, or term differs from the durable request-derived candidate','standing');
      requireIntake((a.standing==='delegate'&&same(a.actions,[action]))||(a.standing==='operator'&&action==='operator-standing'),
        'verified act: free-form grant standing/actions are forbidden','standing');
    } else {
      const values=historyValues(snapshot),target=historical(values,'StandingGrant',text(a.grantId,'revocation.grantId'));
      requireIntake(action==='revoke-standing'&&object(a.by!).id===operator&&target&&same(target.view.scope,scopeValue)
        &&take(canonical(target.view)).hash===artifact,
      'verified act: Revocation exact target/operator/scope differs from request artifact','standing');
    }
  }
  const disposition=emergency?'emergency-stopped':decision==='decline'?'declined':'approved';
  requireIntake(r.disposition===disposition&&r.emergency===emergency,'verified act: disposition is caller-authored','standing');
  const expected: VerifiedActRecord={ type: 'VerifiedActDisposition',schemaVersion: 1,request: requestId,requestDigest,
    decision: decision as 'approve'|'decline',disposition,act: actText,actDigest,proof: proof as unknown as VerifiedActRecord['proof'],
    challenge: text(p.challenge,'challenge'),surface,generation,action,scope: take(canonical(scope)).bytes,audience,operator,requestedBy,
    artifact,base,issuedAt,expiresAt,emergency };
  requireIntake(same(r,expected),'verified act: disposition fields are not owner-derived','standing');
  return { record: Object.freeze(expected),proof: challenge,emergency };
}

export function intakeVerifiedActRegistration(context: BoundaryContext,observerId: string,generation?: RegisterGenerationReference): Result<OwnedBodyRegistration> {
  return registerOwnedBody({
    name: 'VerifiedActDisposition',owner: 'part-four',currentVersion: 1,migrations: {},
    versions: { 1: { validate: value => ({ ok: true,value }) } },
    decodeCurrent: (input,c) => {
      try {
        requireIntake(c.origin.principal.id===observerId&&c.origin.principal.kind==='system'&&c.origin.provenance.class==='verified',
          'verified act: disposition must be recorded by the configured intake observer','standing');
        const cone=causalCone(c.origin,c.facts.facts);
        const record=resolveVerifiedActRecord(input,{ ...c.facts,facts: cone },c.origin.at,
          generation?.id??c.facts.decode.register.generation.id,c.mode).record;
        const origin=object(c.origin.body);
        requireIntake(origin.request===record.request&&origin.requestDigest===record.requestDigest&&origin.challenge===record.challenge
          &&origin.surface===record.surface&&origin.generation===record.generation&&origin.disposition===record.disposition,
        'verified act: fact envelope summary differs from owner record','integrity');
        requireIntake(c.origin.predecessors.required.includes(record.request),'verified act: request is not in causal position','integrity');
        return { ok: true,value: input };
      } catch(e) { return { ok: false,reason: 'standing',detail: e instanceof Error? e.message:'verified act refused' }; }
    }
  },verifiedActShape,context);
}

// P4-NF-12 holds at P2 admission too, not only in the convenience constructor.
export function intakeWorkRegistration(context: BoundaryContext,observerId: string): Result<OwnedBodyRegistration> {
  return registerOwnedBody({
    name: 'IntakeWork',owner: 'part-four',currentVersion: 1,migrations: {},
    versions: { 1: { validate: value => ({ ok: true,value }) } },
    decodeCurrent: (input,c) => {
      try {
        const w=object(input);
        requireIntake(c.origin.principal.id===observerId&&c.origin.principal.kind==='system'&&c.origin.provenance.class==='verified',
          'P4-NF-09/12: work must be recorded by the configured verified intake observer');
        text(w.owner,'P4-NF-12: work owner');
        requireIntake(w.blockedOn==='run-admission'&&w.standing==='requester','P4-NF-12: owned requester work must wait on run admission');
        requireIntake(w.deliveryFlag===undefined||w.deliveryFlag==='cannot-decide','P4-NF-13: unknown delivery signal');
        const body=object(c.origin.body),intent=object(body.intent!);
        const receipt=c.facts.facts.find(f => f.id===body.receipt&&f.kind==='intake-receipt');
        requireIntake(receipt&&c.origin.predecessors.required.includes(receipt.id),'P4-NF-01/12: work requires its durable receipt');
        requireIntake(intent.id===body.logicalId&&intent.raw===body.rawHash&&object(receipt.body).rawHash===body.rawHash,
          'P4-NF-01/12: work changed its preserved input identity');
        const cone=causalCone(c.origin,c.facts.facts);
        const arrival=intakeArrival(receipt,observerId);
        requireIntake(arrival,'P4-NF-02/03: receipt is not an eligible observer arrival');
        requireIntake(arrival.logicalId===body.logicalId&&arrival.adapter===body.adapter&&intent.via===arrival.adapter,
          'P4-NF-01/03: work changed receipt route/event identity');
        for(const key of ['channel','sender','identityEpoch','eventId'] as const) requireIntake(same(arrival.route[key],body[key]),'P4-NF-01: work changed ingress');
        const arrivals=cone.filter(f => intakeArrival(f,observerId)?.logicalId===body.logicalId);
        const first=arrivals[0]??receipt;
        requireIntake(object(first.body).rawHash===body.rawHash,'P4-NF-03/08: arrival hash commitment changed');
        requireIntake(same(intent.receivedAt,first.at),'P4-NF-10: work changed original arrival clock');
        requireIntake(!cone.some(f => f.kind==='intake-admitted'&&object(f.body).logicalId===body.logicalId),
          'P4-NF-03: event already admitted in causal history');
        const scope=c.facts.schemas.find(s => s.kind===c.origin.kind&&s.version===c.origin.schemaVersion)!.scope;
        requireIntake(!cone.some(f => f.kind==='intake-stop'&&intakeScopesOverlap(take(decode('Scope',object(f.body).scope,c.facts.decode)),scope)),
          'P4-NF-14: in-cone stop inhibits overlapping work');
        const directives=cone.flatMap(f => c.facts.schemas.filter(s => s.kind===f.kind&&s.version===f.schemaVersion)
          .flatMap(s => Object.entries(s.fields).filter(([,v]) => v.kind==='constitutional'&&v.type==='Directive')
            .map(([field]) => object(object(f.body)[field]!))));
        const superseded=new Set(directives.map(d => d.supersedes));
        const expected=directives.filter(d => !d.closedBy&&!superseded.has(d.id)
          &&scopeIncludes(take(decode('Scope',d.scope,c.facts.decode)),scope)).map(d => text(d.id,'directive id'));
        requireIntake(same([...new Set(expected)].sort(),intent.under),'P4-NF-25: intent omits or changes in-cone directives');
        return { ok: true,value: input };
      } catch(e) { return { ok: false,detail: e instanceof Error? e.message:'P4-NF-12: invalid work' }; }
    },
  },{
    kind: 'object',fields: {
      type: { kind: 'text',maxLength: 40 },schemaVersion: { kind: 'integer' },
      owner: { kind: 'text',maxLength: 1024 },blockedOn: { kind: 'text',maxLength: 40 },standing: { kind: 'text',maxLength: 40 },
      deliveryFlag: { kind: 'text',maxLength: 40 }
    },optional: ['deliveryFlag']
  },context);
}

// Receiver-side stop validation. A requester cannot mint a stop-shaped fact and
// have a later intake boot mistake the observation for an authenticated brake.
export function intakeStopRegistration(context: BoundaryContext,observerId: string): Result<OwnedBodyRegistration> {
  return registerOwnedBody({
    name: 'IntakeStop',owner: 'part-four',currentVersion: 1,migrations: {},
    versions: { 1: { validate: value => ({ ok: true,value }) } },
    decodeCurrent: (input,c) => {
      try {
        requireIntake(c.origin.principal.id===observerId&&c.origin.principal.kind==='system'&&c.origin.provenance.class==='verified',
          'P4-NF-09/14: stop must be recorded by the configured verified intake observer');
        const body=object(c.origin.body),cone=causalCone(c.origin,c.facts.facts);
        const binding=cone.find(f => f.id===body.binding&&f.kind==='conversation-binding');
        const receipt=cone.find(f => f.id===body.receipt&&f.kind==='intake-receipt');
        requireIntake(binding&&receipt&&object(receipt.body).rawHash===body.rawHash,'P4-NF-01/14: stop lacks bound durable receipt');
        const arrival=intakeArrival(receipt,observerId);
        requireIntake(arrival&&arrival.logicalId===body.logicalId&&arrival.adapter===body.adapter,
          'P4-NF-02/14: stop requires an eligible observer arrival');
        for(const key of ['channel','sender','identityEpoch','eventId'] as const)
          requireIntake(same(arrival.route[key],body[key]),'P4-NF-02/14: stop changed receipt ingress');
        requireIntake(binding.provenance.class==='verified','P4-NF-14: binding act is not verified');
        const b=object(binding.body);
        for(const key of ['adapter','channel','sender','identityEpoch','principalId','scope'])
          requireIntake(same(b[key],body[key]),`P4-NF-14: stop changed binding ${key}`);
        const grant=c.facts.historicalGrants?.find(g => g.grant.view.id===b.grantId&&g.grant.view.grantee.id===b.principalId
          &&g.grant.view.standing==='operator'&&causalCone(binding,c.facts.facts).some(f => f.id===g.factId));
        requireIntake(grant&&scopeIncludes(take(decode('Scope',grant.grant.view.scope,c.facts.decode)),take(decode('Scope',b.scope,c.facts.decode))),
          'P4-NF-14: binding lacks its recorded operator grant');
        const bindingCone=new Set(causalCone(binding,c.facts.facts).map(f => f.id));
        requireIntake(take(historicalGrantLiveness(grant.grant,c.facts.historicalRevocations?.filter(r => bindingCone.has(r.factId)).map(r => r.revocation)??[],
          causalStanding(binding,c.facts,false).now,c.preserved))==='live','P4-NF-14: binding was not valid at its causal position');
        const auth=c.facts.captures[text(object(body.authentication!).reference,'authentication capture')];
        if(auth?.status==='available'&&auth.bytes!==null) {
          const identity=object(object(JSON.parse(auth.bytes) as Json).principal!);
          requireIntake(identity.id===b.principalId&&identity.kind==='person','P4-NF-14: authenticated sender differs from binding');
        } else requireIntake(c.mode==='historical','P4-NF-14: stop authentication evidence unavailable');
        return { ok: true,value: input };
      } catch(e) { return { ok: false,reason: 'standing',detail: e instanceof Error? e.message:'P4-NF-14: invalid stop' }; }
    },
  },{ kind: 'object',fields: { type: { kind: 'text',maxLength: 40 },schemaVersion: { kind: 'integer' } } },context);
}

// This is a P2 fold declaration, not a competing Conflict implementation. Two machines'
// concurrent admissions for the same key retain the existing exclusive-singleton posture.
export function intakeDedupDefinition(kinds: readonly string[],stalenessBound: number): ProjectionDefinition {
  return {
    id: 'intake-dedup',class: 'authority-answering',stalenessBound,retention: 'all-identities',
    decisions: Object.fromEntries(kinds.map(kind => [kind,kind==='intake-admitted'
      ? { kind: 'folds' as const,merge: 'exclusive-singleton' as const,identity: 'logicalId',value: 'receipt' }
      :{ kind: 'ignores' as const,reason: 'Intake admission identity is carried only by intake-admitted.' }]))
  };
}
