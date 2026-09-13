import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import {
  classifyHarnessRuntimeProgress,
  decodeHarnessRuntimeEvent,
} from '../../src/harness-adapters/index.js';
import {
  createHarnessEvidenceHolder,
  createMemoryHarnessAdapterStateStore,
  createRuntimeHandleHolder,
} from '../../src/harness-adapters/holder.js';
// @ts-expect-error the executable repository checker is intentionally plain ESM
import { p13A2Dispositions } from '../../scripts/check-p13-contract-map.mjs';
import { value } from '../facts/fixtures.js';
import { a2Fixture } from './a2-fixture.js';
import { decodedHandle, eventInput, harnessFixture, witnessedEvent } from './fixture.js';

type Fixture = ReturnType<typeof a2Fixture>;

function evidenceFrom(
  fixture: Fixture,
  context: Fixture['owner']['c'] = fixture.owner.c,
  state = fixture.evidenceState,
) {
  return createHarnessEvidenceHolder({
    adapter: fixture.handle.harness,
    artifact: fixture.handle.artifactDigest,
    platform: fixture.handle.platform,
    machine: fixture.handle.machine,
    scope: 'conversation:1',
    maxEvents: 32,
    maxCaptureBytes: 1024,
    context,
    state,
    admission: fixture.port,
    owners: { handles: fixture.handles, current: fixture.owner.host },
  });
}

const favourable = {
  completion: (state: string) => Number(state === 'complete'),
  liveness: (state: string) => Number(state === 'live'),
};

it('A2-UNIT R6-F01 P13-NF-24 P13-NF-28 P13-NF-29 P13-NF-32 P13-NF-33 P13-NF-34 P13-NF-38 P13-NF-46 evidence loss never restores an older favourable lifecycle answer', () => {
  let evidenceLossScenarios = 0;
  for (const kind of ['input-accepted', 'probe-failed', 'process-exited'] as const) {
    const fixture = a2Fixture();
    fixture.evidence.admit(witnessedEvent(fixture, 'heartbeat', {
      id: `r6:${kind}:prior-live`, sourceEvidence: [`r6:${kind}:owner:prior-live`],
      sourceClock: 9, observedAt: 9, streamState: 'closed', childrenState: 'closed',
    }));
    fixture.evidence.admit(witnessedEvent(fixture, 'turn-closed', {
      id: `r6:${kind}:prior-close`, sourceEvidence: [`r6:${kind}:owner:prior-close`],
      sourceClock: 10, observedAt: 10, streamState: 'closed', childrenState: 'closed',
    }));
    const prefix = structuredClone(fixture.owner.raw);
    const later = witnessedEvent(fixture, kind, {
      id: `r6:${kind}:later`, sourceEvidence: [`r6:${kind}:owner:later`],
      sourceClock: 20, observedAt: 20, streamState: 'open', childrenState: 'pending',
      unresolvedOperations: ['operation:r6:pending'],
    });
    expect(fixture.evidence.admit(later)).toMatchObject({ disposition: 'recorded' });
    fixture.owner.time(21);
    const full = {
      completion: fixture.evidence.completion(fixture.handle, 21).state,
      liveness: fixture.evidence.liveness(fixture.handle, 21).state,
    };
    expect(full).toEqual({
      completion: 'pending',
      liveness: kind === 'input-accepted' ? 'live' : kind === 'probe-failed' ? 'unknown' : 'dead',
    });
    const completeHistory = structuredClone(fixture.owner.raw);
    const sourceRow = value(fixture.owner.c.history!.lookup(later.sourceEvidence[0]!));
    if (!sourceRow) throw new Error('later source row must exist before evidence-loss mutation');

    const history = fixture.owner.c.history!;
    const lookupMissingContext = {
      ...fixture.owner.c,
      history: {
        ...history,
        lookup: (reference: string) => reference === later.sourceEvidence[0] || reference === sourceRow.fact.id
          ? fixture.owner.success(null)
          : history.lookup(reference),
      },
    } as Fixture['owner']['c'];
    const lookupMissing = evidenceFrom(fixture, lookupMissingContext);
    const lookupLoss = {
      completion: lookupMissing.completion(fixture.handle, 21).state,
      liveness: lookupMissing.liveness(fixture.handle, 21).state,
    };
    expect(favourable.completion(lookupLoss.completion)).toBeLessThanOrEqual(favourable.completion(full.completion));
    expect(favourable.liveness(lookupLoss.liveness)).toBeLessThanOrEqual(favourable.liveness(full.liveness));
    evidenceLossScenarios++;

    fixture.owner.raw.splice(0, fixture.owner.raw.length, ...prefix);
    const olderPrefix = evidenceFrom(fixture);
    const prefixLoss = {
      completion: olderPrefix.completion(fixture.handle, 21).state,
      liveness: olderPrefix.liveness(fixture.handle, 21).state,
    };
    expect(favourable.completion(prefixLoss.completion)).toBeLessThanOrEqual(favourable.completion(full.completion));
    expect(favourable.liveness(prefixLoss.liveness)).toBeLessThanOrEqual(favourable.liveness(full.liveness));
    evidenceLossScenarios++;

    fixture.owner.raw.splice(0, fixture.owner.raw.length, ...completeHistory);
    const omittedJournal = evidenceFrom(fixture, fixture.owner.c,
      createMemoryHarnessAdapterStateStore(`r6:${kind}:empty-journal`));
    const journalLoss = {
      completion: omittedJournal.completion(fixture.handle, 21).state,
      liveness: omittedJournal.liveness(fixture.handle, 21).state,
    };
    expect(favourable.completion(journalLoss.completion)).toBeLessThanOrEqual(favourable.completion(full.completion));
    expect(favourable.liveness(journalLoss.liveness)).toBeLessThanOrEqual(favourable.liveness(full.liveness));
    evidenceLossScenarios++;
  }
  expect(evidenceLossScenarios).toBe(9);
}, 15_000);

it('A2-UNIT R6-F02 P13-NF-25 P13-NF-28 P13-NF-32 P13-NF-34 signed fact references resolve through the same lifecycle path as record references', () => {
  const fixture = a2Fixture();
  const closure = witnessedEvent(fixture, 'turn-closed', {
    id: 'r6:fact-reference:closure', sourceEvidence: ['r6:fact-reference:owner'],
    sourceClock: 20, observedAt: 20, streamState: 'closed', childrenState: 'closed',
  });
  const row = value(fixture.owner.c.history!.lookup(closure.sourceEvidence[0]!));
  if (!row) throw new Error('fact-addressed closure requires its signed source row');
  const factAddressed = value(decodeHarnessRuntimeEvent({ ...closure, sourceEvidence: [row.fact.id] }, fixture.owner.c));
  expect(fixture.port.admitObservation(factAddressed, [], 32)).toMatchObject({ disposition: 'recorded' });
  expect(fixture.evidence.admit(factAddressed)).toMatchObject({ disposition: 'recorded' });
  fixture.owner.time(21);
  expect(fixture.evidence.completion(fixture.handle, 21)).toMatchObject({ state: 'complete' });
});

it('A2-UNIT R6-MONOTONICITY P13-NF-28 P13-NF-29 P13-NF-32 removing each positive liveness and completion witness never improves the decision', () => {
  let evidenceLossScenarios = 0;
  for (const decision of ['liveness', 'completion'] as const) {
    const fixture = a2Fixture();
    const prefix = structuredClone(fixture.owner.raw);
    const event = decision === 'liveness'
      ? witnessedEvent(fixture, 'heartbeat', { id: 'r6:positive:live', sourceEvidence: ['r6:positive:owner:live'],
        sourceClock: 20, observedAt: 20, streamState: 'closed', childrenState: 'closed' })
      : witnessedEvent(fixture, 'turn-closed', { id: 'r6:positive:complete', sourceEvidence: ['r6:positive:owner:complete'],
        sourceClock: 20, observedAt: 20, streamState: 'closed', childrenState: 'closed' });
    expect(fixture.evidence.admit(event)).toMatchObject({ disposition: 'recorded' });
    fixture.owner.time(21);
    const positive = fixture.evidence[decision](fixture.handle, 21).state;
    expect(positive).toBe(decision === 'liveness' ? 'live' : 'complete');
    const fullHistory = structuredClone(fixture.owner.raw);
    const eventRow = value(fixture.owner.c.history!.lookup(event.sourceEvidence[0]!));
    if (!eventRow) throw new Error('positive event requires its signed source row');
    const history = fixture.owner.c.history!;
    const hiddenContext = { ...fixture.owner.c, history: { ...history, lookup: (reference: string) =>
      reference === event.sourceEvidence[0] || reference === eventRow.fact.id
        ? fixture.owner.success(null) : history.lookup(reference) } } as Fixture['owner']['c'];
    const hidden = evidenceFrom(fixture, hiddenContext)[decision](fixture.handle, 21).state;
    expect(favourable[decision](hidden)).toBeLessThanOrEqual(favourable[decision](positive));
    evidenceLossScenarios++;

    fixture.owner.raw.splice(0, fixture.owner.raw.length, ...prefix);
    const older = evidenceFrom(fixture)[decision](fixture.handle, 21).state;
    expect(favourable[decision](older)).toBeLessThanOrEqual(favourable[decision](positive));
    evidenceLossScenarios++;

    fixture.owner.raw.splice(0, fixture.owner.raw.length, ...fullHistory);
    const omitted = evidenceFrom(fixture, fixture.owner.c,
      createMemoryHarnessAdapterStateStore(`r6:positive:${decision}:empty`))[decision](fixture.handle, 21).state;
    expect(favourable[decision](omitted)).toBeLessThanOrEqual(favourable[decision](positive));
    evidenceLossScenarios++;
  }
  expect(evidenceLossScenarios).toBe(6);
});

it('A2-UNIT R6-F04 P13-NF-31 local comparison and duplicate classification execute without crediting production Six admission or grounding', () => {
  const fixture = harnessFixture();
  const first = value(decodeHarnessRuntimeEvent(eventInput('work-transition', {
    id: 'r6:progress:first', sourceEvidence: ['r6:progress:owner:first'],
  }), fixture.owner.c));
  const duplicate = value(decodeHarnessRuntimeEvent({ ...first,
    id: 'r6:progress:duplicate', sourceEvidence: ['r6:progress:owner:duplicate'],
  }, fixture.owner.c));
  expect(classifyHarnessRuntimeProgress(first, [], fixture.owner.c)).toMatchObject({ disposition: 'advancing' });
  expect(classifyHarnessRuntimeProgress(duplicate, [first], fixture.owner.c)).toMatchObject({ disposition: 'duplicate' });

  const row = (p13A2Dispositions() as Array<{ number: number; heldArms?: string }>).find(entry => entry.number === 31)!;
  expect(row.heldArms).toContain('NON-EXECUTABLE-UNTIL-row-83-run-admission-production');
  expect(row.heldArms).toContain('SEAM-LEDGER.md row 38');
  expect(row.heldArms).toContain('SEAM-LEDGER.md row 45');
});

it('A2-UNIT R6-F01 P13-NF-24 P13-NF-32 capacity refusal leaves the owner observation unresolved instead of restoring an older closure', () => {
  const fixture = harnessFixture();
  const handle = decodedHandle(fixture);
  const handles = createRuntimeHandleHolder({ adapter: handle.harness, machine: handle.machine,
    maxHandles: 2, maxAttempts: 2, context: fixture.owner.c,
    state: createMemoryHarnessAdapterStateStore('r6:capacity:handles'), admission: fixture.port });
  handles.put(handle);
  const evidence = createHarnessEvidenceHolder({ adapter: handle.harness, artifact: handle.artifactDigest,
    platform: handle.platform, machine: handle.machine, scope: 'conversation:1', maxEvents: 1,
    maxCaptureBytes: 64, context: fixture.owner.c,
    state: createMemoryHarnessAdapterStateStore('r6:capacity:events'), admission: fixture.port,
    owners: { handles, current: fixture.owner.host } });
  expect(evidence.admit(witnessedEvent(fixture, 'turn-closed', {
    id: 'r6:capacity:closure', sourceEvidence: ['r6:capacity:owner:closure'],
    sourceClock: 10, observedAt: 10, streamState: 'closed', childrenState: 'closed',
  }))).toMatchObject({ disposition: 'recorded' });
  expect(evidence.admit(witnessedEvent(fixture, 'input-accepted', {
    id: 'r6:capacity:pending', sourceEvidence: ['r6:capacity:owner:pending'],
    sourceClock: 20, observedAt: 20, streamState: 'open', childrenState: 'pending',
    unresolvedOperations: ['operation:r6:capacity'],
  }))).toMatchObject({ disposition: 'refused' });
  fixture.owner.time(21);
  expect(evidence.completion(handle, 21)).toMatchObject({ state: 'pending' });
});
