import { afterAll, afterEach, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { acrossExecutions, withinExecution } from '../slice/acceptance.js';
import { REPLY_BOUNDARIES, SLICE_INPUT, discard, rebuildInFreshProcess, runExecution } from '../slice/harness.js';
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
  const independent = rebuildInFreshProcess(control.home);
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
  const blocked = judgment.report.obligations.find(o => o.blocker === 'part-six');
  expect(blocked?.state).toBe('owned-pending-unadmitted');
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
