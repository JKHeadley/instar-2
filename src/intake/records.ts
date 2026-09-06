import type { BoundaryContext,Json,Scope } from '../index.js';
import { causalCone,causalStanding,registerOwnedBody } from '../facts/index.js';
import { canonical,decode,historicalGrantLiveness,scopeIncludes } from '../index.js';
import type { FactEnvelope,FactSchema,OwnedBodyRegistration } from '../facts/index.js';
import type { Result } from '../index.js';
import { object,requireIntake,same,take,text } from './boundary.js';
import type { ProjectionDefinition } from '../projections/index.js';

export const intakeKinds=Object.freeze(['intake-receipt','intake-resolved','intake-admitted','intake-held','intake-expired',
  'intake-collapse','intake-mismatch','intake-stop','intake-stop-signal','conversation-binding'] as const);

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
