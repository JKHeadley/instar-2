import { afterAll, afterEach, it, expect } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { consumeResult } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { DECLARED_BOUNDARIES, PEER_STANDIN_ID, PROFILE_BOUNDARIES, RECOVERY_BOUNDARIES, SLICE_BOUNDARIES, UNREACHED_BOUNDARIES, cleanup, sliceAssembly } from '../slice/assembly-fixture.js';
import { withinExecution } from '../slice/acceptance.js';
import { SLICE_INPUT } from '../slice/harness.js';

afterAll(cleanup);
// Yield between heavy fixtures so the runner's task-update IPC can flush.
afterEach(async () => { await new Promise<void>(done => setImmediate(done)); });
const detail = (r: unknown) => consumeResult(r as Result<unknown>, { Success: () => null, Refused: x => `${x.reason}: ${x.detail}` });
const ok = (r: unknown) => consumeResult(r as Result<unknown>, { Success: v => v, Refused: x => { throw new Error(`${x.reason}: ${x.detail}`); } });

it('P11-NF-43 P11-NF-49 the public boot path supplies real persistence, intake, run, lease, judgment and effect ports with non-null wiring evidence', async () => {
  const a = sliceAssembly({ profile: 'reply' });
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
  const a = sliceAssembly({ profile: 'reply' });
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
  const strong = sliceAssembly({ profile: 'reply' });
  const status = (a: { adapterContract: () => { capabilities: Record<string, { status: string }> } }, key: string) =>
    a.adapterContract().capabilities[key]?.status;
  expect(status(strong, 'decisiveNonOccurrence')).toBe('supported');
  expect(status(strong, 'applicationAndDeliveryStage')).toBe('supported');
  const opaque = sliceAssembly({ profile: 'reply', adapter: 'telegram-opaque' });
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
  // Declared = fired ∪ honestly-unreached ∪ recovery-only, and each of the last two
  // carries its own reason. Nothing is declared without saying why it is not fired.
  expect([...DECLARED_BOUNDARIES].sort()).toEqual([...SLICE_BOUNDARIES,
    ...Object.keys(UNREACHED_BOUNDARIES), ...Object.keys(RECOVERY_BOUNDARIES)].sort());
  expect(Object.keys(UNREACHED_BOUNDARIES)).toEqual(['grounding']);
  expect(UNREACHED_BOUNDARIES['grounding']).toContain('slice-five-gap.md');
  expect(SLICE_BOUNDARIES).not.toContain('grounding');
  // The conditional close is declared but reached only on a recovery path, so no
  // profile's control list may contain it.
  expect(Object.keys(RECOVERY_BOUNDARIES)).toEqual(['operation-close']);
  expect(RECOVERY_BOUNDARIES['operation-close']).toContain('outbound-reservation');
  expect(SLICE_BOUNDARIES).not.toContain('operation-close');
  // A control execution of a profile fires EXACTLY that profile's declared list, in order.
  const a = sliceAssembly({ profile: 'reply' });
  const report = await a.drive() as { boundariesReached: string[]; cutsFired: unknown[] };
  expect(report.boundariesReached).toEqual([...PROFILE_BOUNDARIES['reply']!]);
  expect(report.cutsFired).toEqual([]);
}, 120000);

it('P11-NF-44 a boundary the enumeration does not declare is refused, so the list cannot drift below what fires', () => {
  const a = sliceAssembly({ profile: 'reply' });
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
  const a = sliceAssembly({ profile: 'reply' });
  const report = await a.drive() as { steps: { step: string; state: string; detail?: string | null }[]; grounding: string };
  const grounding = report.steps.find(s => s.step === 'grounding');
  expect(grounding?.state).toBe('refused');
  expect(grounding?.detail).toContain('grounding capture not bound to the signed message capture field');
  expect(report.grounding).toBe('absent');
}, 120000);

it('P11-NF-26 every minimal-plane projection rebuilds from facts alone with equal canonical bytes', async () => {
  const a = sliceAssembly({ profile: 'reply' });
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
  const a = sliceAssembly({ profile: 'reply', adapter: 'telegram-stage-probe' });
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
  const a = sliceAssembly({ profile: 'reply' });
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
  try { sliceAssembly({ profile: 'reply' }, a.home); } catch (error) { refusal = String((error as Error).message); }
  expect(refusal).toContain('integrity');
  expect(refusal).toContain(reference);
  writeFileSync(file, original);
  // The untampered home boots again, so the refusal was the tampering and nothing else.
  expect(() => sliceAssembly({ profile: 'reply' }, a.home)).not.toThrow();
}, 120000);

it('P11-NF-45 a durably prepared outbound payload is immutable: a conflicting replacement refuses', async () => {
  const a = sliceAssembly({ profile: 'reply' });
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
  const a = sliceAssembly({ profile: 'reply', adapter: 'telegram-opaque' });
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
  const a = sliceAssembly({ profile: 'reply' });
  a.install();
  const raw = JSON.stringify({ schemaVersion: 1, kind: 'message', text: 'Please classify and acknowledge this request.' });
  ok(a.intake.receive(raw, { channel: 'chat-a', sender: 'platform-alice', identityEpoch: 'account-1', eventId: 'event-1' }));
  const receipt = a.factOfKind('intake-receipt')!;
  const reference = (receipt.body as unknown as { capture: { reference: string } }).capture.reference;
  expect(existsSync(join(a.home, 'intake-captures', reference.slice(7)))).toBe(true);
  expect(readFileSync(join(a.home, 'intake-captures', reference.slice(7)), 'utf8')).toBe(raw);
}, 120000);


it('P11-NF-41 P11-NF-48 six APPLIES the eight settlement, so the outbound operation is resolved and its unused credit released', async () => {
  const a = sliceAssembly({ profile: 'reply' });
  const report = await a.drive() as { sixOperations: { operation: string; role: string; state: string; charge: number;
    resolved: boolean; application: { exposure: number; released: number; unresolved: number; actualCharge: number } | null }[];
    obligations: { operation: string; state: string; owner: string; exposure: string }[];
    boundariesReached: string[]; steps: { step: string; state: string }[] };
  const op = report.sixOperations.find(row => row.role === 'outbound-reply')!;
  expect(op.state).toBe('consumed');
  // Six's OWN accounting row, written through its public settle seam, not eleven's arithmetic.
  expect(op.application).toEqual({ exposure: 3, released: 17, unresolved: 0, actualCharge: 3 });
  expect(op.resolved).toBe(true);
  expect(report.boundariesReached).toContain('settlement-application');
  expect(report.steps.find(s => s.step === 'settlement-application')?.state).toBe('applied');
  // The durable six fact exists exactly once and names the same operation.
  const applications = a.transportFacts().filter(v => (v.record as unknown as { type: string }).type === 'SettlementApplication');
  expect(applications).toHaveLength(1);
  expect((applications[0]!.record as unknown as { operation: string }).operation).toBe(op.operation);
  const applied = report.obligations.find(o => o.state === 'applied-resolved')!;
  expect(applied.owner).toBe('part-six');
  expect(Number(applied.exposure)).toBe(3);
}, 120000);

it('P11-NF-41 the single chain enters BOTH published resolution seams for the model operation and records their exact refusals', async () => {
  const a = sliceAssembly({ profile: 'full' });
  const report = await a.drive() as { steps: { step: string; state: string; detail?: string | null; close?: string }[];
    sixOperations: { role: string; state: string; resolved: boolean }[];
    obligations: { operation: string; state: string; owner: string; blocker: string; exposure: string }[] };
  const resolve = report.steps.find(s => s.step === 'resolve')!;
  expect(resolve.state).toBe('refused');
  // Eight will not mint a settlement for an operation that is not one of its own
  // requests, and six will not close an operation that was dispatched.
  expect(resolve.detail).toContain('missing recorded EffectRequest');
  expect(resolve.close).toContain('close requires a prepared, never-claimed operation');
  const model = report.sixOperations.find(row => row.role === 'model-judgment')!;
  expect(model.state).toBe('consumed');
  expect(model.resolved).toBe(false);
  // Both the unresolvable operation and the attempted resolution stay OWNED with
  // their exposure retained; nothing is quietly dropped.
  const unresolved = report.obligations.find(o => o.state === 'owned-unresolved-model')!;
  expect(Number(unresolved.exposure)).toBe(20);
  const attempted = report.obligations.find(o => o.state === 'owned-pending-unresolvable')!;
  expect(attempted.owner).toBe('part-seven');
  expect(attempted.operation.startsWith('resolve:')).toBe(true);
  // ...and the reply is still blocked at six, for the reason six states.
  expect(report.steps.find(s => s.step === 'outbound')?.state).toBe('blocked-at-six');
}, 180000);

it('P11-NF-44 the single-chain profile fires exactly its own declared boundary list, which equals the judgment control\'s', async () => {
  const a = sliceAssembly({ profile: 'full' });
  const report = await a.drive() as { boundariesReached: string[] };
  expect(report.boundariesReached).toEqual([...PROFILE_BOUNDARIES['full']!]);
  // The equality is the finding, not an oversight: the single chain stops exactly
  // where the reduced control stops, because no seam resolves the model operation.
  expect([...PROFILE_BOUNDARIES['full']!]).toEqual([...PROFILE_BOUNDARIES['judgment']!]);
}, 180000);

it('P11-NF-41 P11-NF-48 an operation six RESOLVED stops blocking its run, while an unresolved one keeps blocking it', async () => {
  // The load-bearing rule for the single chain, exercised in BOTH directions through
  // six's PUBLIC reserve seam on this assembly's own durable state. The control
  // reservation below is a probe taken AFTER each execution's report; it is not part
  // of the chain and no predicate reads it.
  const control = (a: { liveFence: () => unknown; factOfKind: (kind: string) => { body: Record<string, never> } | undefined }) => ({
    command: 'slice-control-reserve', fence: a.liveFence(),
    request: { owner: 'part-eight', name: 'EffectRequest', id: 'slice-control-request:1' },
    attempt: 'slice-control-attempt:1', payloadDigest: `sha256:${'a'.repeat(64)}`, charge: 1,
    run: { owner: 'part-five', name: 'Run', id: (a.factOfKind('run-opening')!.body as unknown as { run: string }).run },
    semanticMessage: 'slice-control-semantic:1', durability: 'local-durable' as const, replicas: 0,
  });
  // Resolved by six's settlement application: a new attempt for the same run is ADMITTED.
  const resolved = sliceAssembly({ profile: 'reply' });
  await resolved.drive();
  expect(detail((resolved.transport as unknown as { reserve: (i: unknown) => unknown }).reserve(control(resolved)))).toBeNull();
  // Unresolved model operation: the SAME reservation is refused, with six's own words.
  const blocked = sliceAssembly({ profile: 'full' });
  await blocked.drive();
  expect(detail((blocked.transport as unknown as { reserve: (i: unknown) => unknown }).reserve(control(blocked))))
    .toContain('unresolved execution or charge prohibits a new attempt');
}, 240000);

it('P11-NF-41 P11-NF-48 a REPLACEMENT process reconsumes preserved settlement authority before it can fund new admission', async () => {
  // astra R1: a durable SettlementApplication fact is HISTORY, not live accounting
  // authority. Recovery guarded on the fact's existence, so a replacement process
  // neither reconsumed the authority nor restored the applied obligation, yet the
  // report advertised the operation resolved. A new same-run reservation then refuses
  // — six correctly fails closed — until the settlement is reconsumed through eight.
  const control = (a: { liveFence: () => unknown; factOfKind: (kind: string) => { body: Record<string, never> } | undefined }, id: string) => ({
    command: `slice-reconsume-reserve-${id}`, fence: a.liveFence(),
    request: { owner: 'part-eight', name: 'EffectRequest', id: `slice-reconsume-request:${id}` },
    attempt: `slice-reconsume-attempt:${id}`, payloadDigest: `sha256:${'a'.repeat(64)}`, charge: 1,
    run: { owner: 'part-five', name: 'Run', id: (a.factOfKind('run-opening')!.body as unknown as { run: string }).run },
    semanticMessage: `slice-reconsume-semantic:${id}`, durability: 'local-durable' as const, replicas: 0,
  });
  const isApplication = (v: { record: unknown }) => (v.record as { type: string }).type === 'SettlementApplication';
  // First process: settle and apply. The once-only application row is now durable.
  const first = sliceAssembly({ profile: 'reply' });
  await first.drive();
  const home = first.home;
  expect(first.transportFacts().filter(isApplication)).toHaveLength(1);
  // A REPLACEMENT process on the same durable home: it holds the preserved
  // application row but no live authority yet. Its drive() must reconsume through
  // eight and six — the once-only identity is preserved (still ONE application) —
  // and (re)write the applied-resolved obligation.
  const replacement = sliceAssembly({ profile: 'reply' }, home);
  expect(replacement.transportFacts().filter(isApplication)).toHaveLength(1);
  const report = await replacement.drive() as { obligations: { operation: string; state: string; exposure: string }[];
    steps: { step: string; state: string }[]; sixOperations: { role: string; resolved: boolean }[] };
  // Reconsumption regained live authority: a new same-run reservation is ADMITTED.
  expect(detail((replacement.transport as unknown as { reserve: (i: unknown) => unknown }).reserve(control(replacement, 'after')))).toBeNull();
  // The once-only application identity is preserved: still exactly one, not a second.
  expect(replacement.transportFacts().filter(isApplication)).toHaveLength(1);
  // The derived obligation the guard used to skip is present, and six's op is resolved.
  expect(report.obligations.some(o => o.state === 'applied-resolved')).toBe(true);
  expect(report.sixOperations.find(o => o.role === 'outbound-reply')!.resolved).toBe(true);
  expect(report.steps.some(s => s.step === 'settlement-application' && s.state === 'reconsumed')).toBe(true);
  // Refusal neighbour: an operation six has NOT resolved cannot qualify a new attempt,
  // so recovery may never advertise resolution by preserving a row it cannot reconsume.
  const unresolved = sliceAssembly({ profile: 'full' });
  await unresolved.drive();
  expect(detail((unresolved.transport as unknown as { reserve: (i: unknown) => unknown }).reserve(control(unresolved, 'blocked'))))
    .toContain('unresolved execution or charge prohibits a new attempt');
}, 240000);

it('P11-NF-48 a temporary authority loss then restoration supersedes the refusal, not leaves it current', async () => {
  // astra C1: reconciling against ANY historical applied obligation with .some() left a
  // superseding refusal current after a verified recovery. The fix reconciles against
  // the LATEST obligation and this boot's outcome, appending a superseding row when it
  // differs — so a restored authority corrects the refusal instead of staying stale.
  const isApplication = (v: { record: unknown }) => (v.record as { type: string }).type === 'SettlementApplication';
  const latestFor = (obs: { operation: string; state: string; exposure: string }[], op: string) =>
    [...obs].reverse().find(o => o.operation === op)!;
  const first = sliceAssembly({ profile: 'reply' });
  await first.drive();
  const home = first.home;
  const opId = first.transportFacts().filter(isApplication)[0]!.record as unknown as { operation: string };
  const operation = opId.operation;

  // Temporary loss: replication is unavailable, so reconsumption refuses and the
  // assembly retains maximum exposure — appropriate while authority is unavailable.
  const loss = sliceAssembly({ profile: 'reply' }, home);
  (loss as unknown as { replicas: { enable: (v: boolean) => void } }).replicas.enable(false);
  const lossReport = await loss.drive() as { obligations: { operation: string; state: string; exposure: string }[] };
  expect(latestFor(lossReport.obligations, operation).state).toBe('owned-unapplied-unsettled');
  expect(Number(latestFor(lossReport.obligations, operation).exposure)).toBe(20);
  expect(loss.transportFacts().filter(isApplication)).toHaveLength(1);

  // Restoration: authority returns, reconsumption succeeds, and a SUPERSEDING
  // applied-resolved obligation replaces the refusal as the current row.
  const restored = sliceAssembly({ profile: 'reply' }, home);
  const restoredReport = await restored.drive() as { obligations: { operation: string; state: string; exposure: string }[] };
  expect(latestFor(restoredReport.obligations, operation).state).toBe('applied-resolved');
  expect(Number(latestFor(restoredReport.obligations, operation).exposure)).toBe(3);
  expect(withinExecution(restoredReport as unknown as Parameters<typeof withinExecution>[0], SLICE_INPUT)).toEqual([]);
  expect(restored.transportFacts().filter(isApplication)).toHaveLength(1);

  // And a further replacement is stable: it stays applied-resolved and passes, and
  // does not churn a new obligation on top of the already-correct current one.
  const again = sliceAssembly({ profile: 'reply' }, home);
  const againReport = await again.drive() as { obligations: { operation: string; state: string; exposure: string }[] };
  expect(latestFor(againReport.obligations, operation).state).toBe('applied-resolved');
  expect(withinExecution(againReport as unknown as Parameters<typeof withinExecution>[0], SLICE_INPUT)).toEqual([]);
  const appliedRows = againReport.obligations.filter(o => o.operation === operation && o.state === 'applied-resolved');
  expect(appliedRows.length).toBeLessThanOrEqual(2); // one restored + at most one steady; never per-boot churn
}, 300000);
