import { afterAll, afterEach, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { acrossExecutions, withinExecution } from '../slice/acceptance.js';
import { FULL_BOUNDARIES, REPLY_BOUNDARIES, SLICE_INPUT, discard, rebuildInFreshProcess, runExecution } from '../slice/harness.js';
import { PROFILE_BOUNDARIES } from '../slice/boundaries.js';

const homes: string[] = [];
afterAll(() => discard(...homes));
// Yield between heavy fixtures so the runner's task-update IPC can flush.
afterEach(async () => { await new Promise<void>(done => setImmediate(done)); });
const keep = <T extends { home: string }>(execution: T): T => { homes.push(execution.home); return execution; };
const execute = async (options: Parameters<typeof runExecution>[0]) => keep(await runExecution(options));

it('P11-NF-43 P11-NF-49 P11-NF-50 the uninterrupted control execution runs the chain through the public assembly boot path', async () => {
  const control = await execute({ profile: 'reply' });
  expect(control.boots).toBe(1);
  expect(control.report.registerChecks).toEqual(['extract', 'force', 'current']);
  expect(withinExecution(control.report, SLICE_INPUT)).toEqual([]);
  // One admitted input, one durable run, one attributable outbound operation.
  expect(control.report.intake?.boundOperator).toBe(true);
  expect(control.report.run?.owner).toBe('bob');
  expect(control.report.outbound?.observations).toEqual(['executor-accepted', 'response']);
  expect(control.report.externalApplications).toHaveLength(1);
  expect(control.report.settlement).toEqual({ outcome: 'happened', finalCharge: '3', retainedExposure: 3, delayedExecutionExcluded: true });
  // Every projection rebuilt from facts, with recorded accounting.
  expect(control.report.rebuilds.map(r => r.equal)).toEqual(Array(6).fill('equal'));
  expect(control.report.accounting.notifications).toBe(1);
  expect(control.report.accounting.money).toBe(3);
  expect(Number.isSafeInteger(control.report.accounting.peakRssBytes)).toBe(true);
}, 180000);

it('P11-NF-45 within one execution the genesis, checkpoint and fresh-process rebuilds are byte-equal at one pinned vector', async () => {
  const control = await execute({ profile: 'reply' });
  const independent = await rebuildInFreshProcess(control.home);
  expect(independent).toHaveLength(control.report.rebuilds.length);
  for (const row of control.report.rebuilds) {
    const other = independent.find(r => r.projection === row.projection);
    expect(other, row.projection).toBeDefined();
    expect(other!.hash, `${row.projection} genesis vs fresh process`).toBe(row.hash);
    expect(other!.resumedHash, `${row.projection} checkpoint vs fresh process`).toBe(row.hash);
    expect(other!.equal).toBe('equal');
  }
  // Only one fold implementation exists on this base; the second architecture is
  // the repository's CI matrix, and the DONE note says so rather than implying more.
  expect(existsSync(join(control.home, 'checkpoints', 'minimal.intake-ledger.json'))).toBe(true);
}, 180000);

it('P11-NF-44 P11-NF-45 a cut execution keeps stable logical identities and satisfies the across-run semantic predicate', async () => {
  const control = await execute({ profile: 'reply' });
  const cut = await execute({ profile: 'reply', cuts: ['external-send', 'delivery-evidence'] });
  expect(cut.boots).toBe(3);
  expect(cut.firedCuts).toEqual(['external-send', 'delivery-evidence']);
  expect(cut.neverReached).toEqual([]);
  expect(withinExecution(cut.report, SLICE_INPUT)).toEqual([]);
  expect(acrossExecutions(control.report, cut.report)).toEqual([]);
  // A crash after the external effect must never produce a second application.
  expect(cut.report.externalApplications).toHaveLength(1);
  // The replacement observed the already-claimed operation instead of re-invoking it.
  expect(cut.report.obligations.some(o => o.state.startsWith('recovered-'))).toBe(true);
  // Real history is preserved: the cut execution really did restart three times.
  expect(cut.report.accounting.boots).toBe(3);
  expect(control.report.accounting.boots).toBe(1);
}, 240000);

it('P11-NF-47 P11-NF-48 an opaque adapter cut after the dispatch-claim stays owned and uncertain with retained exposure and zero replay', async () => {
  const opaque = await execute({ profile: 'reply', adapter: 'telegram-opaque', cuts: ['outbound-consume'] });
  expect(opaque.firedCuts).toEqual(['outbound-consume']);
  expect(withinExecution(opaque.report, SLICE_INPUT)).toEqual([]);
  expect(opaque.report.settlement).toBeNull();
  expect(opaque.report.externalApplications).toEqual([]);
  const owned = opaque.report.obligations.filter(o => o.state === 'owned-uncertain');
  expect(owned.length).toBeGreaterThan(0);
  expect(Number(owned[owned.length - 1]!.exposure)).toBe(20);
  // No new semantic key, provider route or operation was invoked.
  expect(opaque.report.operations).toHaveLength(1);
  expect(opaque.report.semanticKeys).toHaveLength(1);
  expect(opaque.report.deliveryEvidence).toEqual([]);
  // Every projection rebuild reproduces that pending state.
  const outbound = opaque.report.rebuilds.find(r => r.projection === 'minimal.outbound-obligation')!;
  expect(JSON.stringify(outbound.values)).toContain('owned-uncertain');
  expect(outbound.equal).toBe('equal');
}, 240000);

it('P11-NF-47 the SAME cut on an adapter that CAN prove decisive non-occurrence settles did-not-happen with maximum exposure retained', async () => {
  const decisive = await execute({ profile: 'reply', adapter: 'telegram-slice', cuts: ['outbound-consume'] });
  expect(withinExecution(decisive.report, SLICE_INPUT)).toEqual([]);
  expect(decisive.report.externalApplications).toEqual([]);
  expect(decisive.report.settlement?.outcome).toBe('did-not-happen');
  expect(decisive.report.settlement?.finalCharge).toBeNull();
  expect(decisive.report.settlement?.retainedExposure).toBe(20);
  expect(decisive.report.deliveryEvidence.map(e => [e.value, e.decisive])).toEqual([['did-not-happen', 'decisive']]);
  // Delivery is proved only to the adapter's DECLARED stage, never further.
  for (const row of decisive.report.deliveryEvidence) expect(row.stage).toBe('service-applied');
}, 240000);

it('P11-NF-43 P11-NF-46 the judgment profile makes one bounded model judgment and records the six seam that blocks its reply', async () => {
  const judgment = await execute({ profile: 'judgment' });
  expect(withinExecution(judgment.report, SLICE_INPUT)).toEqual([]);
  expect(judgment.report.judgment.disposition).toBe('decided');
  expect(judgment.report.judgment.capture).toBeTruthy();
  expect(judgment.report.judgment.meter).toBeTruthy();
  expect(judgment.report.reply?.basis).toBe('judgment-resolution');
  // The blocked outbound obligation is owned and pending, never silently dropped.
  const blocked = judgment.report.obligations.find(o => o.operation.startsWith('unreserved:'));
  expect(blocked?.blocker).toBe('part-six');
  expect(blocked?.state).toBe('owned-pending-unadmitted');
  // ...and so is the model operation whose unresolved exposure is what blocks it.
  const model = judgment.report.obligations.find(o => o.state === 'owned-unresolved-model')!;
  expect(model.owner).toBe('part-seven');
  expect(Number(model.exposure)).toBe(20);
  // The reduced control does NOT attempt the resolution; that is the single chain's step.
  expect(judgment.report.steps.some(s => s.step === 'resolve')).toBe(false);
  expect(judgment.report.externalApplications).toEqual([]);
  expect(judgment.report.rebuilds.map(r => r.equal)).toEqual(Array(6).fill('equal'));
}, 180000);

it('P11-NF-44 a cut inside the model exchange leaves the question owned and pending, and never re-asks it', async () => {
  const cut = await execute({ profile: 'judgment', cuts: ['model-invocation'] });
  expect(cut.firedCuts).toEqual(['model-invocation']);
  expect(cut.report.judgment.request).toBeTruthy();
  expect(cut.report.judgment.resolution).toBeNull();
  const step = cut.report.steps.find(s => s.step === 'judgment');
  expect(step?.state).toBe('owned-pending');
  expect(step?.detail).toContain('no repeated invocation');
  // One question, one attempt, one six-owned operation. No reply may be rendered.
  expect(cut.report.operations).toHaveLength(1);
  expect(cut.report.reply).toBeNull();
  expect(withinExecution(cut.report, SLICE_INPUT)).toEqual([]);
}, 240000);

it('P11-NF-45 P11-NF-48 the progress floor separates an honestly owned-pending execution from one that recorded nothing', async () => {
  // Two REAL executions, the shape the desk demonstrated: a judgment control that
  // rendered a reply and prepared an outbound, and a cut before the model answer that
  // legitimately did neither.
  const control = await execute({ profile: 'judgment' });
  const cut = await execute({ profile: 'judgment', cuts: ['model-invocation'] });
  expect(cut.report.reply).toBeNull();
  expect(cut.report.outbound).toBeNull();
  expect(control.report.reply).not.toBeNull();
  expect(control.report.outbound).not.toBeNull();
  // As they really are, both predicates pass: the cut says WHY it stopped.
  expect(withinExecution(cut.report, SLICE_INPUT)).toEqual([]);
  expect(acrossExecutions(control.report, cut.report)).toEqual([]);
  expect(cut.report.obligations.some(o => o.state === 'owned-pending-no-answer')).toBe(true);
  // Strip the owned obligations from that same real report — the ONLY thing that
  // separated "part seven correctly refused to re-ask" from "the chain silently
  // stopped and recorded nothing" — and both predicates must now refuse.
  const silent = { ...cut.report, obligations: [] };
  const within = withinExecution(silent, SLICE_INPUT);
  expect(within.some(v => v.includes('recorded neither progress nor a reason for its absence'))).toBe(true);
  expect(within.some(v => v.includes('rendered no attributable reply and recorded no owned-pending reason'))).toBe(true);
  const across = acrossExecutions(control.report, silent);
  expect(across.some(v => v.includes('cut execution recorded no settlement and no owned obligation'))).toBe(true);
  expect(across.some(v => v.includes('no owned-pending obligation explaining its absence'))).toBe(true);
}, 240000);

it('P11-NF-50 duration and peak memory are measured across every boot, killed boots included', async () => {
  const cut = await execute({ profile: 'reply', cuts: ['external-send', 'delivery-evidence'] });
  const a = cut.report.accounting;
  expect(a.boots).toBe(3);
  // Every boot has a duration row; the two killed boots are bounded by the next start.
  expect(a.perBootDurationMs).toHaveLength(3);
  expect(a.perBootDurationMs.filter(r => r.bounded)).toHaveLength(2);
  expect(a.perBootDurationMs.every(r => Number.isSafeInteger(r.durationMs) && r.durationMs! >= 0)).toBe(true);
  expect(a.measuredBoots).toBeGreaterThanOrEqual(1);
  expect(a.durationMs).toBeGreaterThanOrEqual(Math.max(...a.perBootDurationMs.map(r => r.durationMs ?? 0)));
  // The RSS figure is a high-water mark over many samples, not one instant in the
  // last process: killed boots contributed samples before they died.
  expect(a.peakRssSamples).toBeGreaterThan(a.boots);
  expect(a.peakRssBytes).toBeGreaterThan(0);
  expect(withinExecution(cut.report, SLICE_INPUT)).toEqual([]);
}, 240000);

it('P11-NF-44 the enumerated boundary list matches what the control execution actually reaches', async () => {
  const control = await execute({ profile: 'reply' });
  expect(control.report.boundariesReached).toEqual([...REPLY_BOUNDARIES]);
  expect(control.report.cutsFired).toEqual([]);
  // REPLY_BOUNDARIES is the assembly's own list, not a copy kept beside it.
  expect(REPLY_BOUNDARIES).toBe(PROFILE_BOUNDARIES['reply']);
}, 180000);

it('P11-NF-49 the fixture never reaches into the assembly: the worker only calls the public boot path', async () => {
  const worker = readFileSync('scripts/slice-worker.mjs', 'utf8');
  expect(worker).toContain('bootSliceAssembly');
  expect(worker).not.toMatch(/require\(|__test|recoverFor|privateBoot/);
  const harness = readFileSync('tests/slice/harness.ts', 'utf8');
  expect(harness).toContain('scripts/slice-worker.mjs');
  expect(harness).not.toContain('slice-assembly.mjs');
});

it.skip('P11-NF-51 out of slice scope: a live model provider, live platform credentials and an independent live delivery witness are not built on this base', () => {
  expect(true).toBe(true);
});

it.skip('P11-NF-52 out of slice scope: the objective dashboard and mobile-completion floor belongs to the operator surface, which this brief does not build', () => {
  expect(true).toBe(true);
});

it('P11-NF-43 P11-NF-46 P11-NF-48 the single-chain profile runs section 7 in ONE execution and stops at the seam that has no resolution', async () => {
  const full = await execute({ profile: 'full' });
  expect(full.boots).toBe(1);
  expect(withinExecution(full.report, SLICE_INPUT)).toEqual([]);
  expect(full.report.boundariesReached).toEqual([...FULL_BOUNDARIES]);
  // Section 7's order, in ONE profile: the message is preserved and admitted, one
  // durable run is opened, one bounded model judgment is made through the doorway,
  // and the reply is rendered FROM that recorded resolution.
  expect(full.report.intake?.boundOperator).toBe(true);
  expect(full.report.judgment.disposition).toBe('decided');
  expect(full.report.reply?.basis).toBe('judgment-resolution');
  // Then the resolution step runs, and refuses. Both owned obligations retain their
  // exposure, and no external application happened.
  expect(full.report.steps.find(s => s.step === 'resolve')?.state).toBe('refused');
  const model = full.report.sixOperations.find(o => o.role === 'model-judgment')!;
  expect(model.resolved).toBe(false);
  expect(full.report.obligations.filter(o => o.state.startsWith('owned-')).map(o => Number(o.exposure)))
    .toEqual([0, 20, 20, 20]);
  expect(full.report.externalApplications).toEqual([]);
  expect(full.report.rebuilds.map(r => r.equal)).toEqual(Array(6).fill('equal'));
}, 180000);

it('P11-NF-44 P11-NF-48 a crash between the reservation and its claim is CLOSED, not left wedged: the credit is released', async () => {
  // The dead-fence case. The replacement holds a new lease, so the prepared
  // operation can never be claimed and never settled. Six's conditional close
  // proves from the committed prefix that no dispatch-claim exists.
  const cut = await execute({ profile: 'reply', cuts: ['outbound-reservation'] });
  expect(cut.firedCuts).toEqual(['outbound-reservation']);
  expect(cut.report.steps.find(s => s.step === 'dispatch')?.state).toBe('refused');
  expect(cut.report.steps.find(s => s.step === 'close')?.state).toBe('closed');
  expect(cut.report.boundariesReached).toContain('operation-close');
  const operation = cut.report.sixOperations[0]!;
  expect(operation.state).toBe('closed');
  expect(operation.resolved).toBe(true);
  expect(operation.application).toBeNull();
  // Terminal and unexecuted: the credit is released and no external application exists.
  const closed = cut.report.obligations.find(o => o.state === 'closed-unexecuted')!;
  expect(Number(closed.exposure)).toBe(0);
  expect(cut.report.externalApplications).toEqual([]);
  expect(cut.report.settlement).toBeNull();
  expect(withinExecution(cut.report, SLICE_INPUT)).toEqual([]);
  // The rebuilt projection reproduces the closed state from facts alone.
  const outbound = cut.report.rebuilds.find(r => r.projection === 'minimal.outbound-obligation')!;
  expect(JSON.stringify(outbound.values)).toContain('closed-unexecuted');
  expect(outbound.equal).toBe('equal');
}, 240000);

it('P11-NF-48 on REAL history, a terminal obligation label relabelled over six\'s record is refused', async () => {
  // The desk's R1 reproduction shape, driven on real executions rather than
  // synthesized ones: change NOTHING except the obligation's label and exposure.
  const judgment = await execute({ profile: 'judgment' });
  expect(withinExecution(judgment.report, SLICE_INPUT)).toEqual([]);
  const model = judgment.report.sixOperations.find(o => o.role === 'model-judgment')!;
  // Six's own record: the operation was consumed and is unresolved.
  expect([model.state, model.resolved]).toEqual(['consumed', false]);
  const laundered = { ...judgment.report, obligations: judgment.report.obligations.map(o =>
    o.operation === model.operation ? { ...o, state: 'closed-unexecuted', exposure: '0' } : o) };
  expect(withinExecution(laundered, SLICE_INPUT)
    .some(v => v.includes('obligation closed-unexecuted names an operation six records as consumed'))).toBe(true);

  // The desk's M1 shape (R2), on the same real history: flip ONLY the row's resolved
  // summary to true and drop the obligation naming the operation. The flag then
  // contradicts the state and application in its own row, and is refused by name.
  const m1 = { ...judgment.report,
    sixOperations: judgment.report.sixOperations.map(o =>
      o.operation === model.operation ? { ...o, resolved: true } : o),
    obligations: judgment.report.obligations.filter(o =>
      o.operation !== model.operation && !o.operation.endsWith(`:${model.operation}`)) };
  expect(withinExecution(m1, SLICE_INPUT)
    .some(v => v.includes('the resolved flag for model-judgment contradicts six\'s own state and application'))).toBe(true);

  // The same class on a settlement-bearing execution: a cut after the dispatch-claim
  // leaves six holding an APPLIED but unresolved operation with its exposure retained.
  const cut = await execute({ profile: 'reply', cuts: ['outbound-claim'] });
  expect(withinExecution(cut.report, SLICE_INPUT)).toEqual([]);
  const outbound = cut.report.sixOperations.find(o => o.role === 'outbound-reply')!;
  expect(outbound.resolved).toBe(false);
  expect(outbound.application?.unresolved).toBe(1);
  const applied = cut.report.obligations.filter(o => o.state === 'applied-unresolved');
  expect(applied).toHaveLength(1);
  expect(Number(applied[0]!.exposure)).toBe(20);
  const relabelled = { ...cut.report, obligations: cut.report.obligations.map(o =>
    o.state === 'applied-unresolved' ? { ...o, state: 'closed-unexecuted', exposure: '0' } : o) };
  expect(withinExecution(relabelled, SLICE_INPUT)
    .some(v => v.includes(`obligation closed-unexecuted names an operation six records as ${outbound.state}`))).toBe(true);
  // ...and claiming six RESOLVED it is refused just as squarely.
  const resolvedClaim = { ...cut.report, obligations: cut.report.obligations.map(o =>
    o.state === 'applied-unresolved' ? { ...o, state: 'applied-resolved', exposure: '0' } : o) };
  expect(withinExecution(resolvedClaim, SLICE_INPUT)
    .some(v => v.includes('applied-resolved names an operation six recorded no resolved application for'))).toBe(true);
}, 240000);

it('P11-NF-44 P11-NF-48 a real SIGKILL AT settlement-application restores the applied-resolved obligation on recovery', async () => {
  // astra R1: the cut writes the once-only application row, then dies before the
  // derived obligation. Recovery guarded on the fact, so it neither reconsumed the
  // authority nor restored the obligation. The completed report must now carry the
  // applied-resolved obligation and a resolved operation, reconstructed on recovery.
  const cut = await execute({ profile: 'reply', cuts: ['settlement-application'] });
  expect(cut.firedCuts).toEqual(['settlement-application']);
  expect(cut.boots).toBe(2);
  expect(withinExecution(cut.report, SLICE_INPUT)).toEqual([]);
  const op = cut.report.sixOperations.find(o => o.role === 'outbound-reply')!;
  expect(op.resolved).toBe(true);
  expect(op.application).toEqual({ exposure: 3, released: 17, unresolved: 0, actualCharge: 3 });
  // The obligation the interrupted boot skipped is present, reconstructed on recovery.
  const applied = cut.report.obligations.filter(o => o.state === 'applied-resolved');
  expect(applied).toHaveLength(1);
  expect(Number(applied[0]!.exposure)).toBe(3);
  // The once-only application row survived as exactly one; recovery reconsumed it.
  expect(cut.report.externalApplications).toHaveLength(1);
  expect(cut.report.steps.some(s => s.step === 'settlement-application'
    && (s.state === 'reconsumed-and-restored' || s.state === 'applied'))).toBe(true);
}, 240000);

it('P11-NF-44 P11-NF-48 a real SIGKILL AT operation-close is reconstructed with released credit, in both profiles', async () => {
  // astra R2: operation-close is genuinely cuttable — the first cut creates the
  // dead-fence, the second cuts AT the close, interrupting the terminal obligation.
  // Recovery reconstructs it from six's already-closed record at exposure 0, never
  // recovering, settling, or reclosing. Both profiles' reports must pass the predicate.
  const reply = await execute({ profile: 'reply', cuts: ['outbound-reservation', 'operation-close'] });
  expect(reply.firedCuts).toEqual(['outbound-reservation', 'operation-close']);
  expect(withinExecution(reply.report, SLICE_INPUT)).toEqual([]);
  const replyOp = reply.report.sixOperations.find(o => o.role === 'outbound-reply')!;
  expect([replyOp.state, replyOp.resolved]).toEqual(['closed', true]);
  const replyClosed = [...reply.report.obligations].reverse().find(o => o.operation === replyOp.operation)!;
  expect([replyClosed.state, Number(replyClosed.exposure)]).toEqual(['closed-unexecuted', 0]);
  expect(reply.report.externalApplications).toEqual([]);

  const full = await execute({ profile: 'full', cuts: ['judgment-reservation', 'operation-close'] });
  expect(full.firedCuts).toEqual(['judgment-reservation', 'operation-close']);
  expect(withinExecution(full.report, SLICE_INPUT)).toEqual([]);
  const modelOp = full.report.sixOperations.find(o => o.role === 'model-judgment')!;
  expect([modelOp.state, modelOp.resolved]).toEqual(['closed', true]);
  const modelClosed = [...full.report.obligations].reverse().find(o => o.operation === modelOp.operation)!;
  expect([modelClosed.state, Number(modelClosed.exposure)]).toEqual(['closed-unexecuted', 0]);
  // Neither reconstruction dispatched, settled, or reclosed: no external application.
  expect(full.report.externalApplications).toEqual([]);
}, 300000);
