import { describe, expect, it } from 'vitest';
import { capacityPolicyArtifact, createTransportAuthority, createTransportSpine, decodeLoopPolicy,
  registerTransportBodies, transportSchemas } from '../../src/transport/index.js';
import { authorizationRequestDigest, canonical, decodeMeasurement } from '../../src/index.js';
import type { CapacityParentPolicy, CapacityVector, TransportHost } from '../../src/transport/index.js';
import { fixedRecordFixture } from '../assembly/fixed-installation-contract.test.js';
import { intakeFixture } from '../intake/fixtures.js';
import { value, refused } from '../facts/fixtures.js';

function amount(quantity: number) { return { quantity, unit: 'charge', window: 'installation' }; }
export function vector(quantity: number): CapacityVector {
  return { worker: amount(quantity), memory: amount(quantity), storage: amount(quantity),
    queue: amount(quantity), transport: amount(quantity), effect: amount(quantity) };
}
export function responderCapacityFixture(ownerFixture?: ReturnType<typeof intakeFixture>) {
  const { f, writer, admission } = fixedRecordFixture(undefined, ownerFixture ? { fixture: ownerFixture } : {});
  let tick = f.f.now.value;
  const clock = (instant: number) => value(decodeMeasurement('clock', { ...f.f.now, value: instant, at: instant }, f.context.decode));
  const root = f.facts().find(fact => fact.kind === 'genesis-grant')!;
  const fields = { owner: 'part-ten' as const,
    installation: 'host', machine: 'machine-a', scope: admission.scopeId,
    generation: f.context.decode.register.generation.id, ordinaryDomain: 'conversation:capacity',
    responderDomain: 'responder:capacity', grant: root.id,
    parent: vector(100), required: vector(20), validUntil: clock(tick + 400) };
  const artifact = capacityPolicyArtifact(fields);
  f.f.capture(value(canonical(fields)).bytes, artifact); f.syncCaptures();
  const requestDigest = authorizationRequestDigest({ approver: f.f.alice,
    action: { kind: 'work', scope: f.f.scope }, artifact, base: 'host' });
  Object.assign(f.context, { decode: { ...f.context.decode, currentBase: 'host', artifact } });
  const earlierGrants = [...f.context.grants];
  const act = f.verifiedAct({ request: { requestId: 'request:capacity-policy', artifact, base: 'host', requestDigest },
    generation: { owner: 'part-three', name: 'RegisterGeneration', id: fields.generation } });
  const approval = value(f.port().admitVerifiedAct(act.input)).fact.id;
  Object.assign(f.context, { grants: [...earlierGrants, ...f.context.grants] });
  const policy: CapacityParentPolicy = { ...fields, reference: artifact, approval };
  const host: TransportHost = { domain: policy.ordinaryDomain, machine: 'machine-a',
    incarnation: 'worker:capacity', authorityIncarnation: 'authority:capacity', principal: f.f.alice,
    scope: f.f.scope, maxLeaseTerm: 500, budget: 100, capacityPolicy: policy,
    monotonic: () => tick, current: () => ({ decode: f.context.decode, clock: clock(tick),
      generation: { owner: 'part-three', name: 'RegisterGeneration', id: policy.generation }, stopped: false }) };
  Object.assign(f.context, { schemas: [...f.context.schemas, ...transportSchemas(host)],
    ownedBodies: [...f.context.ownedBodies!, ...value(registerTransportBodies(host, admission.boundary))] });
  const spine = createTransportSpine(host, { context: f.context, privateKey: writer.privateKey }, writer.store);
  const api = createTransportAuthority(host, spine, admission.boundary);
  const lease = value(api.acquire('capacity:lease', '', 450));
  const input = { command: 'capacity:reserve', expected: value(api.inspect()).at(-1)!.fact.id,
    fence: lease, installation: 'host', scope: policy.scope, instance: 'minimal-responder-binding',
    approval: policy.approval, grant: policy.grant, allocation: policy.required,
    validUntil: clock(tick + 300) };
  return { f, host, api, spine, policy, lease, input, boundary: admission.boundary,
    clock, advance: (n: number) => { tick += n; } };
}

const fixture = responderCapacityFixture;
function collectedInThisFile(): boolean { try { return expect.getState().testPath?.endsWith('/tests/transport/responder-capacity.test.ts') ?? false; } catch { return false; } }
const describeHere: typeof describe = collectedInThisFile() ? describe : (() => undefined) as unknown as typeof describe;

describeHere('P6-NF-41/42/43 Six standing responder capacity', () => {
  it('reserves in the actual store before any loop, retains its parent debit and reuses the exact command', () => {
    const x = fixture();
    const first = value(x.api.reserveCapacity(x.input));
    expect(first.type).toBe('CapacityReservation');
    expect(value(x.api.inspect()).some(row => row.record.type === 'LoopRecord')).toBe(false);
    expect(value(x.api.inspectCapacity()).parentRemainder.effect.quantity).toBe(80);
    expect(value(x.api.reserveCapacity(x.input))).toEqual(first);
    refused(x.api.reserveCapacity({ ...x.input, allocation: vector(21) }), 'capacity command changed');
  });
  it('refuses foreign domains, changed policy and release without independently proved withdrawal', () => {
    const x = fixture();
    refused(x.api.reserveCapacity({ ...x.input, scope: 'foreign' }), 'capacity policy');
    const first = value(x.api.reserveCapacity(x.input));
    const history = value(x.api.inspectCapacity());
    refused(x.api.releaseCapacity({ command: 'capacity:release', previousCapacity: history.heads[0]!.fact,
      fence: x.lease, validUntil: first.validUntil }), 'withdrawal');
    expect(value(x.api.inspectCapacity()).parentRemainder.effect.quantity).toBe(80);
  });
  it('leaves the ordinary loop slot free, then preserves its one-loop ceiling', () => {
    const x = fixture();
    const run = { owner: 'part-five' as const, name: 'Run' as const, id: 'run:ordinary' };
    value(x.api.reserveCapacity(x.input));
    const policy = value(decodeLoopPolicy({ type: 'LoopPolicy', schemaVersion: 1, id: 'ordinary', maxAttempts: 2, minDelay: 1,
      maxDuration: 100, timeout: 10, concurrency: 1, failDirection: 'closed', breaker: 'stub-closed' }, x.boundary));
    const first = value(x.api.schedule('ordinary:first', x.lease, run, policy));
    expect(first.type).toBe('LoopRecord');
    refused(x.api.schedule('ordinary:second', x.lease, { ...run, id: 'run:second' }, policy), 'one run only');
  });
  it('reconstructs one debit across authorities and a lost append acknowledgment', () => {
    const x = fixture();
    const other = createTransportAuthority(x.host, x.spine, x.boundary);
    const lost = createTransportAuthority(x.host, { ...x.spine, append: (record, required) => {
      const receipt = x.spine.append(record, required);
      if (record.type === 'CapacityReservation') return x.f.f.success(undefined as never);
      return receipt;
    } }, x.boundary);
    refused(lost.reserveCapacity(x.input));
    const head = value(x.api.inspectCapacity());
    expect(head.heads).toHaveLength(1);
    expect(head.parentRemainder.effect.quantity).toBe(80);
    expect(value(other.reserveCapacity(x.input)).capacity).toBe(head.heads[0]!.capacity);
    refused(other.reserveCapacity({ ...x.input, command: 'capacity:second', expected: head.sourceFrontier }), 'unique');
    expect(value(x.api.inspectCapacity()).parentRemainder.effect.quantity).toBe(80);
  });
  it('blocks the old assignment after restart until one guarded rebind preserves its debit', () => {
    const x = fixture();
    const original = value(x.api.reserveCapacity(x.input));
    const prior = value(x.api.inspectCapacity()).heads[0]!;
    Object.assign(x.host, { incarnation: 'worker:capacity:restart',
      authorityIncarnation: 'authority:capacity:restart' });
    const restarted = createTransportAuthority(x.host, x.spine, x.boundary);
    const fence = value(restarted.acquire('capacity:lease:restart', value(restarted.inspect()).at(-1)!.fact.id, 450));
    expect(fence.assignment).not.toBe(x.lease.assignment);
    expect(fence.incarnation).not.toBe(x.lease.incarnation);
    const blocked = value(restarted.inspectCapacity());
    expect(blocked.heads[0]).toMatchObject({ capacity: original.capacity, fact: prior.fact, usable: false });
    expect(blocked.heads[0]!.blocker).not.toBeNull();
    expect(blocked.parentRemainder.effect.quantity).toBe(80);
    const next = value(restarted.rebindCapacity({ command: 'capacity:rebind:restart',
      previousCapacity: prior.fact, fence, validUntil: x.clock(400) }));
    const current = value(restarted.inspectCapacity());
    expect(current.heads).toHaveLength(1);
    expect(current.heads[0]).toMatchObject({ capacity: original.capacity, usable: true, blocker: null });
    expect(current.heads[0]!.record.previousCapacity).toBe(prior.fact);
    expect(next.capacity).toBe(original.capacity);
    expect(current.parentRemainder.effect.quantity).toBe(80);
  });
  it('retains an expired debit and needs a guarded current successor before use', () => {
    const x = fixture();
    value(x.api.reserveCapacity(x.input));
    x.advance(301);
    expect(value(x.api.inspectCapacity()).heads[0]!.blocker).toBe('capacity expired');
    expect(value(x.api.inspectCapacity()).parentRemainder.effect.quantity).toBe(80);
    const old = value(x.api.inspectCapacity()).heads[0]!;
    const successor = value(x.api.rebindCapacity({ command: 'capacity:rebind', previousCapacity: old.fact,
      fence: x.lease, validUntil: x.clock(x.host.monotonic() + 40) }));
    expect(successor.previousCapacity).toBe(old.fact);
    expect(value(x.api.inspectCapacity()).heads[0]!.usable).toBe(true);
    expect(value(x.api.inspectCapacity()).parentRemainder.effect.quantity).toBe(80);
  });
});
