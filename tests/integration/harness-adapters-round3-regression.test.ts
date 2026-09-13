import { expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { decodeAssemblyRecord } from '../../src/assembly/index.js';
import { createHarnessEvidenceHolder, createMemoryHarnessAdapterStateStore,
  createRuntimeHandleHolder } from '../../src/harness-adapters/holder.js';
import { preventiveCompactionDisposition } from '../../src/harness-adapters/regression-boundaries.js';
import { createIntakePort } from '../../src/intake/index.js';
import { decodeLoopPolicyA1 } from '../../src/transport/loop-a1/index.js';
import type { SharedBreakerLoopPolicy } from '../../src/transport/loop-a1/index.js';
import { assemblyInput } from '../assembly/fixture.js';
import { decodedHandle, digest, harnessFixture, witnessedEvent } from '../harness-adapters/fixture.js';
import { intakeFixture, message, route, value } from '../intake/fixtures.js';
import { setup as runGraphFixture } from '../rungraph/fixtures.js';
import { transportLoopFixture } from '../transport/loop-fixture.js';

function legacyEnumerate(read: () => readonly string[]): readonly string[] {
  try { return read(); } catch { return []; }
}

function legacyNewestRolloutRecovered(worker: string, baseline: number,
  rollouts: readonly Readonly<{ worker: string; bytes: number; observedAt: number }>[]): boolean {
  void worker;
  const newest = [...rollouts].sort((left, right) => right.observedAt - left.observedAt)[0];
  return !!newest && newest.bytes > baseline;
}

function legacyWorkGate(input: Readonly<{
  wired: boolean; enabled: boolean; readable: boolean; dryRun: boolean; busy: boolean;
}>): Readonly<{ action: 'proceed' | 'refuse'; wouldRefuse: boolean }> {
  const wouldRefuse = input.busy;
  if (!input.wired || !input.enabled || !input.readable || input.dryRun)
    return { action: 'proceed', wouldRefuse: input.dryRun && wouldRefuse };
  return { action: input.busy ? 'refuse' : 'proceed', wouldRefuse: false };
}

it('A2-INTEGRATION R3-F06 P13-NF-46 paired legacy incident fixtures execute against real Four Five Six and Part Thirteen safe boundaries', () => {
  // Enumeration: the historical catch-all collapses EACCES/EIO to empty, while
  // the real Four recovery port preserves the receipt and returns typed unknown.
  expect(legacyEnumerate(() => ['pending:one'])).toEqual(['pending:one']);
  expect(legacyEnumerate(() => { throw Object.assign(new Error('EACCES'), { code: 'EACCES' }); })).toEqual([]);
  for (const code of ['EACCES', 'EIO']) {
    const intake = intakeFixture();
    const interrupted = value(createIntakePort({ ...intake.deps, storage: { ...intake.storage,
      append(bytes, head) {
        const receipt = intake.storage.append(bytes, head);
        if ((JSON.parse(bytes) as { kind?: string }).kind === 'intake-receipt')
          throw new Error('cut-after-durable-receipt');
        return receipt;
      },
    } }));
    expect(interrupted.receive(message(), route).kind).toBe('Refused');
    const receipt = intake.facts()[0]!;
    const before = JSON.stringify(intake.frames);
    const broken = value(createIntakePort({ ...intake.deps, storage: { ...intake.storage,
      read() { throw Object.assign(new Error(code), { code }); },
    } }));
    expect(broken.recover(receipt.id)).toMatchObject({ kind: 'Refused', preserved: receipt.id });
    expect(JSON.stringify(intake.frames)).toBe(before);
    expect(value(intake.port().recover(receipt.id)).kind).toBe('admitted');
  }

  // Rollout and work gate: the historical newest-global selection falsely
  // credits worker B. The governed path accepts progress only after a real Five
  // transition for worker A is re-resolved through the holder.
  expect(legacyNewestRolloutRecovered('worker:a', 100, [
    { worker: 'worker:a', bytes: 100, observedAt: 10 },
    { worker: 'worker:b', bytes: 200, observedAt: 20 },
  ])).toBe(true);
  const run = runGraphFixture();
  const ready = value(run.graph.open(run.run));
  const grounding = value(run.graph.ground(run.id, 'w', 'h', 'start', run.lease));
  const running = value(run.graph.transition(run.start(ready, grounding)));
  expect(value(run.graph.read(run.id)).pending).toHaveLength(1);
  for (const legacy of [
    { wired: false, enabled: true, readable: true, dryRun: false, busy: true },
    { wired: true, enabled: false, readable: true, dryRun: false, busy: true },
    { wired: true, enabled: true, readable: false, dryRun: false, busy: true },
    { wired: true, enabled: true, readable: true, dryRun: true, busy: true },
  ]) expect(legacyWorkGate(legacy).action).toBe('proceed');

  const assembly = harnessFixture();
  value(assembly.owner.runtime.record('HarnessLaunchSpec', { ...assemblyInput('HarnessLaunchSpec'),
    id: 'launch:r3-rollout', harness: 'native', artifactDigest: digest('native-artifact'),
    run: run.id, step: running.pending[0]!.id }));
  const handle = decodedHandle(assembly, { launch: 'launch:r3-rollout', run: run.id,
    step: running.pending[0]!.id, processIdentity: 'worker:a' });
  const handles = createRuntimeHandleHolder({ adapter: handle.harness, machine: handle.machine,
    maxHandles: 2, maxAttempts: 4, context: assembly.owner.c,
    state: createMemoryHarnessAdapterStateStore('r3:legacy:handles'), admission: assembly.port });
  handles.put(handle);
  const evidence = createHarnessEvidenceHolder({ adapter: handle.harness, artifact: handle.artifactDigest,
    platform: handle.platform, machine: handle.machine, scope: 'conversation:1', maxEvents: 8,
    maxCaptureBytes: 64, context: assembly.owner.c,
    state: createMemoryHarnessAdapterStateStore('r3:legacy:evidence'), admission: assembly.port,
    owners: { handles, current: assembly.owner.host, work: run.graph } });
  assembly.owner.time(20);
  expect(evidence.progress(handle, 20)).toMatchObject({ state: 'pending' });
  const transition = witnessedEvent(assembly, 'work-transition', { id: 'r3:worker-a-progress',
    launch: handle.launch, run: run.id, step: running.pending[0]!.id, processIdentity: handle.processIdentity,
    predecessor: running.pending[0]!.expected, workSubject: running.pending[0]!.id,
    workPhase: running.state, operation: running.pending[0]!.operation.key });
  expect(evidence.admit(transition)).toMatchObject({ disposition: 'recorded', progress: true });
  expect(evidence.progress(handle, 20)).toMatchObject({ state: 'progressed', event: transition.id });
  const unreadable = createHarnessEvidenceHolder({ adapter: handle.harness, artifact: handle.artifactDigest,
    platform: handle.platform, machine: handle.machine, scope: 'conversation:1', maxEvents: 8,
    maxCaptureBytes: 64, context: assembly.owner.c,
    state: createMemoryHarnessAdapterStateStore('r3:legacy:unreadable-work'), admission: assembly.port,
    owners: { handles, current: assembly.owner.host, work: { read: () => run.graph.read('run:missing') } } });
  const unreadableTransition = witnessedEvent(assembly, 'work-transition', { ...transition,
    id: 'r3:unreadable-work', sourceEvidence: ['observation:r3:unreadable-work'] });
  expect(unreadable.admit(unreadableTransition)).toMatchObject({ disposition: 'refused' });

  // Cooldown: the real Six authority, not a local flag, opens the breaker,
  // refuses the in-cooldown attempt, and alone admits the half-open trial.
  const six = transportLoopFixture();
  const policy = value(decodeLoopPolicyA1({ ...six.sharedPolicy, id: 'r3:p13-breaker', failureThreshold: 1 }, six.c)) as
    SharedBreakerLoopPolicy;
  six.registerPolicy(policy);
  const fence = value(six.api.acquire('r3:acquire', '', 1_000));
  const scheduled = value(six.api.scheduleEpisode({ command: 'r3:schedule', fence,
    currentOwnerRun: six.run, policy, episodeKey: 'r3', operationFamily: 'recovery',
    pressureScope: { target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' },
    sourceVector: six.vector }));
  const episode = { owner: 'part-six' as const, name: 'LoopRecord' as const, id: scheduled.episode };
  six.advance(1);
  value(six.api.admitLoopAttempt({ command: 'r3:first', fence, episode, attempt: 'attempt:r3:first' }));
  const completion = six.appendOutcome('failed', 'attempt:r3:first');
  expect(value(six.api.recordLoopOutcome({ command: 'r3:failed', fence, episode,
    attempt: 'attempt:r3:first', kind: 'failed', failureClass: 'transport', completion,
    jitterPermille: 500, restoration: [] })).state).toBe('open-breaker');
  const cooldown = consumeResult(six.api.admitLoopAttempt({ command: 'r3:cooldown', fence, episode,
    attempt: 'attempt:r3:cooldown' }), { Success: () => '', Refused: refusal => refusal.detail });
  expect(cooldown).toContain('cooldown');
  six.advance(21);
  expect(value(six.api.admitLoopAttempt({ command: 'r3:half-open', fence, episode,
    attempt: 'attempt:r3:trial' })).state).toBe('half-open');

  // Preventive compaction: all 192 historical signal combinations, including
  // disabled/missing readings, cooldown spacing, and dry-run, remain no-action.
  let combinations = 0;
  for (const panePercentage of [null, 0, 49, 50, 90, 100])
    for (const work of ['idle', 'working', 'indeterminate', 'unreadable'] as const)
      for (const elapsed of [0, 10_000])
        for (const spaced of [false, true])
          for (const dryRun of [false, true]) {
            combinations++;
            expect(preventiveCompactionDisposition({ panePercentage, work, elapsed, spaced, dryRun }))
              .toMatchObject({ capability: 'unsupported', action: 'none' });
          }
  expect(combinations).toBe(192);
  expect(value(canonical({ combinations })).hash).toMatch(/^sha256:/);
});
