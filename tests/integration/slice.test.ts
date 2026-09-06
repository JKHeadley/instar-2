import { afterAll, afterEach, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { consumeResult } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { PEER_STANDIN_ID, SLICE_BOUNDARIES, cleanup, sliceAssembly } from '../slice/assembly-fixture.js';

afterAll(cleanup);
// Yield between heavy fixtures so the runner's task-update IPC can flush.
afterEach(async () => { await new Promise<void>(done => setImmediate(done)); });
const detail = (r: unknown) => consumeResult(r as Result<unknown>, { Success: () => null, Refused: x => `${x.reason}: ${x.detail}` });
const ok = (r: unknown) => consumeResult(r as Result<unknown>, { Success: v => v, Refused: x => { throw new Error(`${x.reason}: ${x.detail}`); } });

it('P11-NF-43 P11-NF-49 the public boot path supplies real persistence, intake, run, lease, judgment and effect ports with non-null wiring evidence', async () => {
  const a = sliceAssembly();
  expect(a.registerChecks).toEqual(['extract', 'force', 'current']);
  // Owner identity of every consumer-required port, and a real durable segment.
  expect(a.effects.owner).toBe('part-eight');
  expect(a.assessor.owner).toBe('part-nine');
  expect(a.custody.custody.owner).toBe('part-ten');
  expect(a.kinds().length).toBeGreaterThan(25);
  const report = await a.drive();
  // Real delegation evidence: each port left an independent trace outside itself.
  expect(existsSync(join(a.home, 'facts', 'facts.json'))).toBe(true);
  expect(existsSync(join(a.home, 'peer', 'facts.json'))).toBe(true);
  expect(a.factsOfKind('intake-receipt')).toHaveLength(1);
  expect(a.factsOfKind('run-opening')).toHaveLength(1);
  expect(a.transportFacts().some(v => (v.record as unknown as { type: string }).type === 'Lease')).toBe(true);
  expect(a.service.journal().applications).toHaveLength(1);
  // ONE conversation adapter carries both directions: the inbound row the intake
  // admitted and the outbound row the effect applied live in the same service journal.
  expect(a.service.journal().inbound).toHaveLength(1);
  expect((report as { settlement: { outcome: string } | null }).settlement?.outcome).toBe('happened');
  expect(PEER_STANDIN_ID).toContain('STAND-IN');
}, 120000);

it('P11-NF-49 the independent assessment port is consulted, not a no-op: settlement refuses without its evidence', async () => {
  const a = sliceAssembly();
  a.install();
  // Settling an operation that has no independently witnessed delivery evidence
  // must refuse through part nine's port, never default to success.
  expect(detail(a.effects.settle('operation:sha256:absent'))).toMatch(/reservation missing|no independent delivery evidence/);
  await a.drive();
  const settlement = a.factOfKind('effect-EffectSettlement');
  expect(settlement).toBeDefined();
  const operation = (settlement!.body as unknown as { record: { operation: string } }).record.operation;
  // A second settle of the SAME operation is idempotent, not a second effect.
  expect(detail(a.effects.settle(operation))).toBeNull();
  expect(a.factsOfKind('effect-EffectSettlement')).toHaveLength(1);
  expect(a.service.journal().applications).toHaveLength(1);
}, 120000);

it('P11-NF-46 the recorded judgment carries complete capture and meter references and stays inside its floor', async () => {
  const a = sliceAssembly({ profile: 'judgment' });
  const report = await a.drive() as { judgment: { request: string | null; resolution: string | null; disposition: string | null; capture: string | null; meter: string | null } };
  expect(report.judgment.request).toBeTruthy();
  expect(report.judgment.resolution).toBeTruthy();
  expect(report.judgment.disposition).toBe('decided');
  expect(report.judgment.capture).toMatch(/^judgment-capture:sha256:[a-f0-9]{64}$/);
  expect(report.judgment.meter).toMatch(/^judgment-capture:sha256:[a-f0-9]{64}$/);
  const decoded = a.factsOfKind('judgment-JudgmentAttemptRecord')
    .find(f => (f.body as unknown as { record: { phase: string } }).record.phase === 'decode-observed');
  expect(decoded).toBeDefined();
  const decision = (decoded!.body as unknown as { decision?: { floor: { chosen: string; allowed: { actions: string[] } } } }).decision;
  expect(decision?.floor.chosen).toBe('work');
  expect(decision?.floor.allowed.actions).toEqual(['work']);
}, 120000);

it('P11-NF-47 the adapter contract is the ceiling on what any evidence may claim', async () => {
  const strong = sliceAssembly();
  const status = (a: { adapterContract: () => { capabilities: Record<string, { status: string }> } }, key: string) =>
    a.adapterContract().capabilities[key]?.status;
  expect(status(strong, 'decisiveNonOccurrence')).toBe('supported');
  expect(status(strong, 'applicationAndDeliveryStage')).toBe('supported');
  const opaque = sliceAssembly({ adapter: 'telegram-opaque' });
  expect(status(opaque, 'decisiveNonOccurrence')).toBe('unsupported');
  expect(status(opaque, 'exclusionOfDelayedExecution')).toBe('unsupported');
  expect(status(opaque, 'finalCharge')).toBe('unsupported');
  expect(opaque.service.decisive).toBe(false);
  // The declared stage never says human delivery or consumption.
  const contract = JSON.parse(readFileSync('scripts/slice-contracts.json', 'utf8')) as {
    adapters: Record<string, { capabilities: Record<string, { predicate?: string }> }> };
  for (const adapter of Object.values(contract.adapters))
    expect(adapter.capabilities['applicationAndDeliveryStage']?.predicate).toMatch(/NOT human delivery/);
});

it('P11-NF-44 the assembly enumerates its durable boundaries and records every one it reaches', async () => {
  const a = sliceAssembly();
  expect(SLICE_BOUNDARIES).toContain('preservation');
  expect(SLICE_BOUNDARIES).toContain('settlement');
  expect(SLICE_BOUNDARIES.filter(b => b.startsWith('rebuild:'))).toHaveLength(6);
  const report = await a.drive() as { boundariesReached: string[]; cutsFired: unknown[] };
  for (const required of ['preservation', 'authentication', 'standing', 'run-creation', 'outbound-preparation',
    'outbound-claim', 'external-send', 'delivery-evidence', 'settlement']) expect(report.boundariesReached).toContain(required);
  expect(report.cutsFired).toEqual([]);
}, 120000);

it('P11-NF-41 the six seam refuses a second operation for one run, and the refusal is recorded as an owned-pending obligation', async () => {
  const a = sliceAssembly({ profile: 'judgment' });
  const report = await a.drive() as { steps: { step: string; state: string; detail?: string | null }[];
    obligations: { state: string; owner: string; blocker: string; exposure: string }[] };
  const blocked = report.steps.find(s => s.step === 'outbound');
  expect(blocked?.state).toBe('blocked-at-six');
  expect(blocked?.detail).toContain('unresolved execution or charge prohibits a new attempt');
  const pending = report.obligations.find(o => o.state === 'owned-pending-unadmitted' && o.blocker === 'part-six');
  expect(pending, 'the blocked outbound obligation must stay owned and pending').toBeDefined();
  expect(Number(pending!.exposure)).toBe(20);
  expect(a.service.journal().applications).toHaveLength(0);
}, 120000);

it('P11-NF-41 the five grounding seam refuses because the admitted stimulus carries no capture field', async () => {
  const a = sliceAssembly();
  const report = await a.drive() as { steps: { step: string; state: string; detail?: string | null }[]; grounding: string };
  const grounding = report.steps.find(s => s.step === 'grounding');
  expect(grounding?.state).toBe('refused');
  expect(grounding?.detail).toContain('grounding capture not bound to the signed message capture field');
  expect(report.grounding).toBe('absent');
}, 120000);

it('P11-NF-26 every minimal-plane projection rebuilds from facts alone with equal canonical bytes', async () => {
  const a = sliceAssembly();
  await a.drive();
  const rows = a.rebuildAll();
  expect(rows).toHaveLength(6);
  for (const row of rows) { expect(row.equal).toBe('equal'); expect(row.hash).toMatch(/^sha256:[a-f0-9]{64}$/); }
}, 120000);

it.skip('P11-NF-51 P11-NF-52 out of slice scope: a live model provider, a live platform witness and the objective mobile/dashboard floor are not built on this base', () => {
  expect(true).toBe(true);
});

it('P11-NF-53 the declared adapter contracts name the executed conformance fixture', () => {
  const contract = JSON.parse(readFileSync('scripts/slice-contracts.json', 'utf8')) as {
    adapters: Record<string, { capabilities: Record<string, { status: string; conformance?: string }> }> };
  for (const adapter of Object.values(contract.adapters))
    for (const capability of Object.values(adapter.capabilities))
      if (capability.status === 'supported') expect(existsSync(String(capability.conformance)), String(capability.conformance)).toBe(true);
});

it('P11-NF-45 a durably prepared outbound payload is immutable: a conflicting replacement refuses', async () => {
  const a = sliceAssembly();
  await a.drive();
  const source = a.factOfKind('slice-reply-source')!;
  const opening = a.factOfKind('run-opening')!;
  const loop = a.transportFacts().filter(v => (v.record as unknown as { type: string }).type === 'LoopRecord').at(-1)!;
  const body = source.body as unknown as { semanticMessage: string };
  // Same semantic identity, DIFFERENT rendered text. The prepared payload is immutable.
  const conflicting = ok(a.decodeOutboundMessage({ type: 'OutboundMessage', schemaVersion: 1, id: 'slice-message:1',
    semanticMessage: body.semanticMessage, run: (opening.body as unknown as { run: string }).run, speaker: 'bob',
    account: 'bot:slice', conversation: 'chat:slice', text: 'a different rendering of the same reply',
    purpose: 'ordinary-reply', sourceResult: source.id }, a.effectHost));
  expect(detail(a.effects.prepare({ definition: 'slice-reply-definition:1', message: conflicting,
    run: { owner: 'part-five', name: 'Run', id: (opening.body as unknown as { run: string }).run },
    pending: source.id, attempt: 'slice-attempt:1', verificationOwner: 'slice-reply-verifier',
    obligation: loop.fact.id, closure: [], fence: a.liveFence() }))).toContain('immutable effect collision');
  // The recorded payload and the single external application are unchanged.
  expect(a.factsOfKind('effect-OutboundMessage')).toHaveLength(1);
  expect(a.service.journal().applications).toHaveLength(1);
}, 120000);

it('P11-NF-49 the intake capture port really preserves bytes before any admission fact exists', () => {
  const a = sliceAssembly();
  a.install();
  const raw = JSON.stringify({ schemaVersion: 1, kind: 'message', text: 'Please classify and acknowledge this request.' });
  ok(a.intake.receive(raw, { channel: 'chat-a', sender: 'platform-alice', identityEpoch: 'account-1', eventId: 'event-1' }));
  const receipt = a.factOfKind('intake-receipt')!;
  const reference = (receipt.body as unknown as { capture: { reference: string } }).capture.reference;
  expect(existsSync(join(a.home, 'intake-captures', reference.slice(7)))).toBe(true);
  expect(readFileSync(join(a.home, 'intake-captures', reference.slice(7)), 'utf8')).toBe(raw);
}, 120000);
