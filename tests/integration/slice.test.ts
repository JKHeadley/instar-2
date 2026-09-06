import { afterAll, afterEach, it, expect } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { consumeResult } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { DECLARED_BOUNDARIES, PEER_STANDIN_ID, PROFILE_BOUNDARIES, SLICE_BOUNDARIES, UNREACHED_BOUNDARIES, cleanup, sliceAssembly } from '../slice/assembly-fixture.js';

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

it('P11-NF-44 the boundary enumeration has one source and is exactly what the assembly fires', async () => {
  // The union is DERIVED from the per-profile lists, never maintained beside them.
  expect(SLICE_BOUNDARIES).toEqual([...new Set(Object.values(PROFILE_BOUNDARIES).flat())]);
  expect(new Set(SLICE_BOUNDARIES).size).toBe(SLICE_BOUNDARIES.length);
  // Declared = fired ∪ honestly-unreached, and the only unreached one carries its reason.
  expect([...DECLARED_BOUNDARIES].sort()).toEqual([...SLICE_BOUNDARIES, ...Object.keys(UNREACHED_BOUNDARIES)].sort());
  expect(Object.keys(UNREACHED_BOUNDARIES)).toEqual(['grounding']);
  expect(UNREACHED_BOUNDARIES['grounding']).toContain('slice-five-gap.md');
  expect(SLICE_BOUNDARIES).not.toContain('grounding');
  // A control execution of a profile fires EXACTLY that profile's declared list, in order.
  const a = sliceAssembly();
  const report = await a.drive() as { boundariesReached: string[]; cutsFired: unknown[] };
  expect(report.boundariesReached).toEqual([...PROFILE_BOUNDARIES['reply']!]);
  expect(report.cutsFired).toEqual([]);
}, 120000);

it('P11-NF-44 a boundary the enumeration does not declare is refused, so the list cannot drift below what fires', () => {
  const a = sliceAssembly();
  expect(() => a.boundary('a-boundary-nobody-declared')).toThrow(/undeclared durable boundary/);
  // ...and a declared one is accepted, so the guard is not simply refusing everything.
  expect(() => a.boundary('preservation')).not.toThrow();
});

it('P11-NF-44 the judgment profile fires exactly its own declared boundary list', async () => {
  const a = sliceAssembly({ profile: 'judgment' });
  const report = await a.drive() as { boundariesReached: string[] };
  expect(report.boundariesReached).toEqual([...PROFILE_BOUNDARIES['judgment']!]);
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

it('P11-NF-47 the declared delivery stage is READ from the adapter contract, not restated as a literal', async () => {
  const contract = JSON.parse(readFileSync('scripts/slice-contracts.json', 'utf8')) as {
    adapters: Record<string, { capabilities: Record<string, { stage?: string }> }> };
  const declared = contract.adapters['telegram-stage-probe']!.capabilities['applicationAndDeliveryStage']!.stage;
  // This contract exists ONLY to differ from the default. If the assembly named a
  // stage of its own, the evidence below would carry that name instead of this one.
  expect(declared).toBe('service-accepted');
  expect(contract.adapters['telegram-slice']!.capabilities['applicationAndDeliveryStage']!.stage).toBe('service-applied');
  const a = sliceAssembly({ adapter: 'telegram-stage-probe' });
  expect(a.declaredStage()).toBe(declared);
  const report = await a.drive() as { declaredStage: string; deliveryEvidence: { stage: string }[]; settlement: unknown };
  expect(report.declaredStage).toBe(declared);
  expect(report.deliveryEvidence.map(e => e.stage)).toEqual([declared]);
  expect(report.settlement).not.toBeNull();
  // The stage is also what the durable fact carries, not only the report.
  const row = a.factOfKind('slice-delivery-evidence')!;
  expect((row.body as unknown as { stage: string }).stage).toBe(declared);
}, 120000);

it('P11-NF-53 every supported capability names one specific test, and the checker binds it to a passing result', () => {
  const contract = JSON.parse(readFileSync('scripts/slice-contracts.json', 'utf8')) as {
    adapters: Record<string, { capabilities: Record<string, { status: string; conformance?: string }> }> };
  let supported = 0;
  for (const [name, adapter] of Object.entries(contract.adapters))
    for (const [capability, row] of Object.entries(adapter.capabilities)) {
      if (row.status !== 'supported') continue;
      supported++;
      // A whole-file reference would let a capability inherit execution from unrelated
      // tests; the binding must name the test.
      expect(String(row.conformance), `${name}.${capability}`).toContain('::');
      const [file, title] = String(row.conformance).split('::');
      expect(existsSync(String(file)), String(file)).toBe(true);
      expect(String(title).trim().length, `${name}.${capability}`).toBeGreaterThan(0);
      expect(readFileSync(String(file), 'utf8'), `${name}.${capability}`).toContain(String(title));
    }
  expect(supported).toBeGreaterThanOrEqual(14);
});

it('P11-NF-49 a tampered durable capture refuses at boot with an integrity failure that names the capture', async () => {
  const a = sliceAssembly();
  await a.drive();
  const receipt = a.factOfKind('intake-receipt')!;
  const reference = (receipt.body as unknown as { capture: { reference: string } }).capture.reference;
  const file = join(a.home, 'intake-captures', reference.slice(7));
  const original = readFileSync(file, 'utf8');
  // Same LENGTH, different bytes: this defeats a size-keyed read cache, so only a
  // content check can catch it.
  const tampered = original.replace('classify', 'clarsify');
  expect(tampered).not.toBe(original);
  expect(tampered.length).toBe(original.length);
  writeFileSync(file, tampered);
  let refusal = '';
  try { sliceAssembly({}, a.home); } catch (error) { refusal = String((error as Error).message); }
  expect(refusal).toContain('integrity');
  expect(refusal).toContain(reference);
  writeFileSync(file, original);
  // The untampered home boots again, so the refusal was the tampering and nothing else.
  expect(() => sliceAssembly({}, a.home)).not.toThrow();
}, 120000);

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

it('P11-NF-47 an opaque adapter still evidences a real application at its declared stage', async () => {
  const a = sliceAssembly({ adapter: 'telegram-opaque' });
  const report = await a.drive() as { declaredStage: string; deliveryEvidence: { stage: string; value: string; decisive: string }[];
    settlement: { outcome: string } | null; externalApplications: unknown[] };
  // The opaque adapter CAN observe its own application; what it cannot do is prove
  // non-occurrence. Its evidence is therefore real, and bounded to the declared stage.
  expect(report.externalApplications).toHaveLength(1);
  expect(report.deliveryEvidence.map(e => [e.value, e.stage])).toEqual([['happened', report.declaredStage]]);
  expect(report.deliveryEvidence[0]!.decisive).toBe('indecisive');
  expect(report.settlement?.outcome).toBe('happened');
  // Replicated(1) prerequisite durability really happened: the peer holds the facts.
  expect(existsSync(join(a.home, 'peer', 'facts.json'))).toBe(true);
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
