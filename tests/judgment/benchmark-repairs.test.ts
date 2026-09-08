import { describe, expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import type { BenchmarkRecord, BenchmarkRunRecord, BenchmarkScenario, JudgmentAttemptRecord, JudgmentRequest, JudgmentResolution, ProviderObservation } from '../../src/judgment/index.js';
import { createJudgmentBenchmarkReadPort } from '../../src/judgment/index.js';
import { judgmentFixture, refused, value } from './fixture.js';

function reference<Name extends string>(name: Name, id: string): { owner: 'part-seven'; name: Name; id: string };
function reference<Owner extends string, Name extends string>(name: Name, id: string, owner: Owner): { owner: Owner; name: Name; id: string };
function reference(name: string, id: string, owner = 'part-seven') { return { owner, name, id }; }

async function benchmarkCase() {
  const f = judgmentFixture();
  const answer = value(await f.door.judge(f.input, f.start()));
  const facts = value(f.door.inspect());
  const request = facts.find((row): row is typeof row & { record: JudgmentRequest } => row.record.type === 'JudgmentRequest')!;
  const resolution = facts.find((row): row is typeof row & { record: JudgmentResolution } => row.record.type === 'JudgmentResolution')!;
  const attempts = facts.filter((row): row is typeof row & { record: JudgmentAttemptRecord } => row.record.type === 'JudgmentAttemptRecord');
  const response = attempts.find(row => row.record.phase === 'response-observed')!;
  const digest = value(canonical({ test: 'p7-benchmark-repair' })).hash;
  const replayInput = value(f.captures.put(JSON.stringify({ question: 'held-out question', context: 'held-out context' }), 16_384));
  const record = {
    type: 'BenchmarkRecord', schemaVersion: 1, id: 'record:valid', predecessor: resolution.fact.id,
    provenance: { kind: 'real', request: reference('JudgmentRequest', request.fact.id), generation: request.record.generation, vector: 'vector:1' },
    request: reference('JudgmentRequest', request.fact.id), requestDigest: request.record.inputDigest,
    resolution: reference('JudgmentResolution', resolution.fact.id), run: request.record.run, step: request.record.step,
    logicalKey: request.record.logicalKey, recordingPrincipal: f.alice.id, sourceGeneration: request.record.generation,
    scenarioClass: 'held-out', inputDigest: request.record.inputDigest, compatibilityDigest: digest,
    attempts: attempts.map(row => reference('JudgmentAttemptRecord', row.fact.id)),
    captureReferences: [request.record.question, request.record.context, request.record.submitted, response.record.receipt!],
    decision: { state: 'present', id: answer.decision.id }, conclusionEvidence: answer.decision.conclusion.evidence,
    reasonEvidence: answer.decision.reason.evidence, outcomeReferences: [response.fact.id], usageReferences: [response.fact.id],
  } as unknown as BenchmarkRecord;
  const scenario = {
    type: 'BenchmarkScenario', schemaVersion: 1, id: 'scenario:valid', predecessor: '', version: 'v1',
    source: reference('BenchmarkRecord', ''), sourceGrade: reference('Grade', 'grade:1', 'part-nine'),
    pinnedGeneration: request.record.generation, pinnedVector: 'vector:1', scenarioClass: 'held-out', promotionDecision: 'promotion:1',
    replayInput, originalInputHash: request.record.submitted.hash, transformedInputHash: replayInput.hash,
    transformationVersion: 'remove-answer-outcome-v1', changedSemanticFields: [], unavailableSemanticFields: [],
    excludedAnswerFields: ['answer'], excludedOutcomeFields: ['outcome', 'grade'], floorDigest: digest, outputSchemaDigest: digest,
    evaluationContract: 'evaluation:1', dataScope: 'local', captureAvailability: 'available',
  } as unknown as BenchmarkScenario;
  const run = {
    type: 'BenchmarkRunRecord', schemaVersion: 1, id: 'run:valid', predecessor: '', suite: 'suite', suiteVersion: 'v1',
    scenarios: [{ scenario: reference('BenchmarkScenario', ''), version: 'v1' }], candidates: [{ route: f.host.description.route, samples: 1 }],
    criterionDigest: digest, inputDigest: replayInput.hash, compatibilityDigest: digest, heldOutPartition: 'held-out',
    run: f.run, startedAt: 200, stoppedAt: 201, executions: [{ scenario: reference('BenchmarkScenario', ''),
      candidate: f.host.description.route, ordinal: 0, disposition: 'completed',
      attempt: reference('JudgmentAttemptRecord', response.fact.id), resolution: reference('JudgmentResolution', resolution.fact.id),
      usage: [response.fact.id] }],
  } as unknown as BenchmarkRunRecord;
  return { f, answer, request, resolution, attempts, response, digest, replayInput, record, scenario, run };
}

async function refusedBenchmarkCase() {
  const observation: ProviderObservation = { state: 'rejected', bytes: null, providerOperation: 'fake-operation:1',
    usage: { inputTokens: 11, outputTokens: 0, charge: 2, source: 'captured rejected-request billing receipt' }, retryBlocked: false };
  const f = judgmentFixture({ observation });
  refused(await f.door.judge(f.input, f.start()));
  const facts = value(f.door.inspect());
  const request = facts.find((row): row is typeof row & { record: JudgmentRequest } => row.record.type === 'JudgmentRequest')!;
  const resolution = facts.find((row): row is typeof row & { record: JudgmentResolution } => row.record.type === 'JudgmentResolution')!;
  const attempts = facts.filter((row): row is typeof row & { record: JudgmentAttemptRecord } => row.record.type === 'JudgmentAttemptRecord');
  const response = attempts.find(row => row.record.phase === 'response-observed')!;
  const digest = value(canonical({ test: 'p7-benchmark-refused-repair' })).hash;
  const record = {
    type: 'BenchmarkRecord', schemaVersion: 1, id: 'record:refused', predecessor: resolution.fact.id,
    provenance: { kind: 'real', request: reference('JudgmentRequest', request.fact.id), generation: request.record.generation, vector: 'vector:1' },
    request: reference('JudgmentRequest', request.fact.id), requestDigest: request.record.inputDigest,
    resolution: reference('JudgmentResolution', resolution.fact.id), run: request.record.run, step: request.record.step,
    logicalKey: request.record.logicalKey, recordingPrincipal: f.alice.id, sourceGeneration: request.record.generation,
    scenarioClass: 'held-out', inputDigest: request.record.inputDigest, compatibilityDigest: digest,
    attempts: attempts.map(row => reference('JudgmentAttemptRecord', row.fact.id)),
    captureReferences: [request.record.question, request.record.context, request.record.submitted, response.record.receipt!],
    decision: { state: 'absent' }, conclusionEvidence: [], reasonEvidence: [],
    outcomeReferences: [response.fact.id], usageReferences: [response.fact.id],
  } as unknown as BenchmarkRecord;
  const recordFact = value(f.spine.append(record)).fact;
  const scenario = {
    type: 'BenchmarkScenario', schemaVersion: 1, id: 'scenario:refused', predecessor: recordFact.id, version: 'v1',
    source: reference('BenchmarkRecord', recordFact.id), sourceGrade: reference('Grade', 'grade:1', 'part-nine'),
    pinnedGeneration: request.record.generation, pinnedVector: 'vector:1', scenarioClass: 'held-out', promotionDecision: 'promotion:1',
    replayInput: request.record.submitted, originalInputHash: request.record.submitted.hash, transformedInputHash: request.record.submitted.hash,
    transformationVersion: 'identity-v1', changedSemanticFields: [], unavailableSemanticFields: [], excludedAnswerFields: ['answer'],
    excludedOutcomeFields: ['outcome', 'grade'], floorDigest: digest, outputSchemaDigest: digest, evaluationContract: 'evaluation:1',
    dataScope: 'local', captureAvailability: 'available',
  } as unknown as BenchmarkScenario;
  const scenarioFact = value(f.spine.append(scenario)).fact;
  const run = {
    type: 'BenchmarkRunRecord', schemaVersion: 1, id: 'run:refused', predecessor: scenarioFact.id, suite: 'suite', suiteVersion: 'v1',
    scenarios: [{ scenario: reference('BenchmarkScenario', scenarioFact.id), version: 'v1' }],
    candidates: [{ route: f.host.description.route, samples: 1 }], criterionDigest: digest,
    inputDigest: request.record.submitted.hash, compatibilityDigest: digest, heldOutPartition: 'held-out', run: f.run,
    startedAt: 200, stoppedAt: 201, executions: [{ scenario: reference('BenchmarkScenario', scenarioFact.id),
      candidate: f.host.description.route, ordinal: 0, disposition: 'completed',
      attempt: reference('JudgmentAttemptRecord', response.fact.id), resolution: reference('JudgmentResolution', resolution.fact.id),
      usage: [response.fact.id] }],
  } as unknown as BenchmarkRunRecord;
  return { f, request, resolution, response, recordFact, scenario, scenarioFact, run };
}

function appendRecord(c: Awaited<ReturnType<typeof benchmarkCase>>) {
  return value(c.f.spine.append(c.record)).fact;
}

function appendScenario(c: Awaited<ReturnType<typeof benchmarkCase>>, recordId: string, overrides: Partial<BenchmarkScenario> = {}) {
  const scenario = { ...c.scenario, predecessor: recordId, source: reference('BenchmarkRecord', recordId), ...overrides } as unknown as BenchmarkScenario;
  return { scenario, fact: value(c.f.spine.append(scenario)).fact };
}

function identityScenario(c: Awaited<ReturnType<typeof benchmarkCase>>): Partial<BenchmarkScenario> {
  return { replayInput: c.request.record.submitted, transformedInputHash: c.request.record.submitted.hash, transformationVersion: 'identity-v1' };
}

function validRun(c: Awaited<ReturnType<typeof benchmarkCase>>, scenario: BenchmarkScenario, scenarioId: string, predecessor: string) {
  return { ...c.run, predecessor, inputDigest: scenario.transformedInputHash,
    scenarios: [{ scenario: reference('BenchmarkScenario', scenarioId), version: scenario.version }],
    executions: [{ ...c.run.executions[0], scenario: reference('BenchmarkScenario', scenarioId) }],
  } as unknown as BenchmarkRunRecord;
}

describe('P7 benchmark adversarial admission repairs', { timeout: 30_000 }, () => {
  it('P7-NF-44 P7-NF-47 C1 refuses replay input containing declared answer and outcome fields', async () => {
    const c = await benchmarkCase(), recordFact = appendRecord(c);
    const leaked = value(c.f.captures.put(JSON.stringify({ question: 'held-out', nested: { answer: c.answer.decision }, outcome: true, grade: 'correct' }), 16_384));
    const bad = { ...c.scenario, predecessor: recordFact.id, source: reference('BenchmarkRecord', recordFact.id), replayInput: leaked,
      transformedInputHash: leaked.hash } as unknown as BenchmarkScenario;
    refused(c.f.spine.append(bad), 'contains excluded field');
    expect(appendScenario(c, recordFact.id).fact.id).toBeTruthy();
  });

  it('P7-NF-32 C2 refuses values outside both closed benchmark unions', async () => {
    const c = await benchmarkCase();
    refused(c.f.spine.append({ ...c.record, provenance: { kind: 'banana', fixture: 'fixture:1', productionDerived: false } } as unknown as BenchmarkRecord),
      'unknown benchmark provenance kind');
    refused(c.f.spine.append({ ...c.record, decision: { state: 'banana' } } as unknown as BenchmarkRecord),
      'unknown benchmark Decision state');
    expect(appendRecord(c).id).toBeTruthy();
  });

  it('P7-NF-34 P7-NF-46 C3 binds original hash, transformation version, generation, and vector to the source', async () => {
    const c = await benchmarkCase(), recordFact = appendRecord(c);
    const bad = { ...c.scenario, predecessor: recordFact.id, source: reference('BenchmarkRecord', recordFact.id),
      originalInputHash: 'not-a-hash', pinnedGeneration: 'different-generation', pinnedVector: 'invented-vector', transformationVersion: '' } as unknown as BenchmarkScenario;
    refused(c.f.spine.append(bad), 'scenario lineage');
    expect(appendScenario(c, recordFact.id).fact.id).toBeTruthy();
  });

  it('P7-NF-48 C4 refuses completed executions whose attempt and resolution facts do not exist', async () => {
    const c = await benchmarkCase(), recordFact = appendRecord(c);
    const { scenario, fact: scenarioFact } = appendScenario(c, recordFact.id, identityScenario(c));
    const good = validRun(c, scenario, scenarioFact.id, scenarioFact.id);
    const bad = { ...good, id: 'run:phantom', executions: [{ ...good.executions[0],
      attempt: reference('JudgmentAttemptRecord', 'does-not-exist'), resolution: reference('JudgmentResolution', 'does-not-exist') }] } as unknown as BenchmarkRunRecord;
    refused(c.f.spine.append(bad), 'attempt absent');
    expect(value(c.f.spine.append(good)).fact.id).toBeTruthy();
  });

  it('P7-NF-32 P7-NF-34 C5 refuses scenarios and runs when a current source dependency is tainted', async () => {
    const c = await benchmarkCase(), recordFact = appendRecord(c), { scenario, fact: scenarioFact } = appendScenario(c, recordFact.id);
    const baseRun = validRun(c, scenario, scenarioFact.id, scenarioFact.id);
    const run = { ...baseRun, executions: [{ scenario: reference('BenchmarkScenario', scenarioFact.id), candidate: c.f.host.description.route,
      ordinal: 0, disposition: 'missing', usage: [], detail: 'scenario has not been executed' }] } as unknown as BenchmarkRunRecord;
    const runFact = value(c.f.spine.append(run)).fact;
    const port = createJudgmentBenchmarkReadPort(c.f.spine, c.f.c);
    value(port.readScenario(reference('BenchmarkScenario', scenarioFact.id)));
    value(port.readRun(reference('BenchmarkRunRecord', runFact.id)));
    const originalMetadata = c.f.metadata[c.request.record.submitted.reference]!;
    c.f.metadata[c.request.record.submitted.reference] = { ...originalMetadata, bytes: null, status: 'missing' };
    refused(port.readScenario(reference('BenchmarkScenario', scenarioFact.id)), 'tainted');
    refused(port.readRun(reference('BenchmarkRunRecord', runFact.id)), 'tainted');
    c.f.metadata[c.request.record.submitted.reference] = originalMetadata;
    const replayMetadata = c.f.metadata[c.replayInput.reference]!;
    c.f.metadata[c.replayInput.reference] = { ...replayMetadata, bytes: null, status: 'missing' };
    refused(port.readScenario(reference('BenchmarkScenario', scenarioFact.id)), 'tainted');
    refused(port.readRun(reference('BenchmarkRunRecord', runFact.id)), 'tainted');
    c.f.metadata[c.replayInput.reference] = replayMetadata;
  });

  it('P7-NF-32 P7-NF-33 C6 derives a real manifest from its actual recorder, attempts, Decision, evidence, and captures', async () => {
    const c = await benchmarkCase();
    refused(c.f.spine.append({ ...c.record, recordingPrincipal: 'not-the-recorder' } as unknown as BenchmarkRecord), 'recording principal');
    refused(c.f.spine.append({ ...c.record, attempts: [reference('JudgmentAttemptRecord', 'does-not-exist')] } as unknown as BenchmarkRecord), 'attempts differ');
    refused(c.f.spine.append({ ...c.record, decision: { state: 'absent' } } as unknown as BenchmarkRecord), 'Decision differs');
    refused(c.f.spine.append({ ...c.record, conclusionEvidence: ['invented-evidence'] } as unknown as BenchmarkRecord), 'evidence differs');
    refused(c.f.spine.append({ ...c.record, captureReferences: [c.request.record.submitted] } as unknown as BenchmarkRecord), 'captures differ');
    const fact = appendRecord(c);
    refused(c.f.spine.append({ ...c.record, id: 'record:contradiction', predecessor: fact.id } as unknown as BenchmarkRecord),
      'duplicate logical benchmark manifest');
  });

  it('P7-NF-48 N1 refuses a completed cell backed by an answer to a different replay input', async () => {
    const c = await benchmarkCase(), recordFact = appendRecord(c);
    const { scenario, fact: scenarioFact } = appendScenario(c, recordFact.id);
    const bad = validRun(c, scenario, scenarioFact.id, scenarioFact.id);
    refused(c.f.spine.append(bad), 'input differs');
    const explicitMissing = { ...bad, id: 'run:unexecuted-transform', executions: [{ scenario: reference('BenchmarkScenario', scenarioFact.id),
      candidate: c.f.host.description.route, ordinal: 0, disposition: 'missing', usage: [], detail: 'transformed input was not executed' }] } as unknown as BenchmarkRunRecord;
    expect(value(c.f.spine.append(explicitMissing)).fact.id).toBeTruthy();
  });

  it('P7-NF-48 N2 refuses two completed samples that reuse one execution witness', async () => {
    const c = await benchmarkCase(), recordFact = appendRecord(c);
    const { scenario, fact: scenarioFact } = appendScenario(c, recordFact.id, identityScenario(c));
    const one = validRun(c, scenario, scenarioFact.id, scenarioFact.id);
    const duplicated = { ...one, id: 'run:duplicated-sample', candidates: [{ route: c.f.host.description.route, samples: 2 }],
      executions: [one.executions[0], { ...one.executions[0], ordinal: 1 }] } as unknown as BenchmarkRunRecord;
    refused(c.f.spine.append(duplicated), 'reused one execution witness');
    const honest = { ...duplicated, id: 'run:one-observed-one-missing', executions: [one.executions[0], {
      scenario: reference('BenchmarkScenario', scenarioFact.id), candidate: c.f.host.description.route, ordinal: 1,
      disposition: 'missing', usage: [], detail: 'second sample was not executed',
    }] } as unknown as BenchmarkRunRecord;
    expect(value(c.f.spine.append(honest)).fact.id).toBeTruthy();
  });

  it('P7-NF-32 P7-NF-48 N3 refuses prepared phases as usage/outcome sources while response-backed observations admit', async () => {
    const c = await benchmarkCase();
    const prepared = c.attempts.find(row => row.record.phase === 'prepared')!;
    refused(c.f.spine.append({ ...c.record, usageReferences: [prepared.fact.id], outcomeReferences: [prepared.fact.id] } as unknown as BenchmarkRecord),
      'not a response observation');
    refused(c.f.spine.append({ ...c.record, usageReferences: [prepared.fact.id] } as unknown as BenchmarkRecord), 'not a response observation');
    refused(c.f.spine.append({ ...c.record, outcomeReferences: [prepared.fact.id] } as unknown as BenchmarkRecord), 'not a response observation');
    const recordFact = appendRecord(c);
    const { scenario, fact: scenarioFact } = appendScenario(c, recordFact.id, identityScenario(c));
    const run = validRun(c, scenario, scenarioFact.id, scenarioFact.id);
    refused(c.f.spine.append({ ...run, id: 'run:prepared-usage', executions: [{ ...run.executions[0], usage: [prepared.fact.id] }] } as unknown as BenchmarkRunRecord),
      'not a response observation');
    expect(value(c.f.spine.append(run)).fact.id).toBeTruthy();
  });

  it('P7-NF-48 N5 gives one observed execution witness to at most one planned sample across dispositions and reference forms', async () => {
    const c = await refusedBenchmarkCase();
    expect(c.f.calls).toHaveLength(1);
    const alias = { ...c.scenario, id: 'scenario:refused-alias', predecessor: c.scenarioFact.id } as unknown as BenchmarkScenario;
    const aliasFact = value(c.f.spine.append(alias)).fact;
    const scenario = reference('BenchmarkScenario', c.scenarioFact.id);
    const aliasScenario = reference('BenchmarkScenario', aliasFact.id);
    const run = { ...c.run, predecessor: aliasFact.id } as unknown as BenchmarkRunRecord;
    const completed = run.executions[0]!;
    const observed = { ...completed, disposition: 'refused' as const, detail: 'actual provider refusal; billable usage observed' };
    const attempt = observed.attempt!;
    const resolution = observed.resolution!;
    const { attempt: _attempt, resolution: _resolution, ...withoutLinks } = observed;
    const emptyEvidence = { ...withoutLinks, usage: [] };
    const forms = {
      full: observed,
      attemptOnly: { ...emptyEvidence, attempt },
      resolutionOnly: { ...emptyEvidence, resolution },
      usageOnly: { ...emptyEvidence, usage: observed.usage },
    };
    const duplicate = (id: string, left: typeof observed, right: typeof observed) => ({
      ...run, id, candidates: [{ route: c.f.host.description.route, samples: 2 }], executions: [left, { ...right, ordinal: 1 }],
    } as unknown as BenchmarkRunRecord);

    refused(c.f.spine.append(duplicate('run:n5:refused-refused', observed, observed)), 'reused one execution witness');
    refused(c.f.spine.append(duplicate('run:n5:completed-refused', completed as typeof observed, observed)), 'reused one execution witness');
    refused(c.f.spine.append({ ...run, id: 'run:n5:scenario-alias',
      scenarios: [{ scenario, version: 'v1' }, { scenario: aliasScenario, version: 'v1' }],
      executions: [observed, { ...observed, scenario: aliasScenario }],
    } as unknown as BenchmarkRunRecord), 'reused one execution witness');

    for (const [leftName, left] of Object.entries(forms)) {
      for (const [rightName, right] of Object.entries(forms)) {
        refused(c.f.spine.append(duplicate(`run:n5:forms:${leftName}:${rightName}`, left, right)), 'reused one execution witness');
      }
    }

    const port = createJudgmentBenchmarkReadPort(c.f.spine, c.f.c);
    let predecessor = aliasFact.id;
    const admit = (record: BenchmarkRunRecord) => {
      const fact = value(c.f.spine.append({ ...record, predecessor } as unknown as BenchmarkRunRecord)).fact;
      value(port.readRun(reference('BenchmarkRunRecord', fact.id)));
      predecessor = fact.id;
    };
    admit({ ...run, id: 'run:n5:single-full-witness', executions: [observed] } as unknown as BenchmarkRunRecord);
    for (const disposition of ['missing', 'refused', 'cancelled'] as const) {
      const empty = { scenario, candidate: c.f.host.description.route, ordinal: 1, disposition, usage: [], detail: 'second sample not executed' };
      admit({ ...run, id: `run:n5:refused-empty:${disposition}`, candidates: [{ route: c.f.host.description.route, samples: 2 }],
        executions: [observed, empty] } as unknown as BenchmarkRunRecord);
      admit({ ...run, id: `run:n5:completed-empty:${disposition}`, candidates: [{ route: c.f.host.description.route, samples: 2 }],
        executions: [completed, empty] } as unknown as BenchmarkRunRecord);
    }
    expect(c.f.calls).toHaveLength(1);
  });

  it('P7-NF-48 N4 validates usage and optional references for every non-completed disposition', async () => {
    const c = await benchmarkCase(), prepared = c.attempts.find(row => row.record.phase === 'prepared')!;
    const recordFact = appendRecord(c);
    const { scenario, fact: scenarioFact } = appendScenario(c, recordFact.id, identityScenario(c));
    const run = validRun(c, scenario, scenarioFact.id, scenarioFact.id);
    const nonCompleted = { ...run.executions[0], disposition: 'refused' as const,
      detail: 'provider refused request; usage recorded' };

    for (const disposition of ['missing', 'refused', 'cancelled'] as const) {
      refused(c.f.spine.append({ ...run, id: `run:${disposition}:prepared-usage`, executions: [{
        scenario: reference('BenchmarkScenario', scenarioFact.id), candidate: c.f.host.description.route,
        ordinal: 0, disposition, detail: 'explicit non-completion', usage: [prepared.fact.id],
      }] } as unknown as BenchmarkRunRecord), 'not a response observation');
    }
    refused(c.f.spine.append({ ...run, id: 'run:refused:missing-usage', executions: [{
      ...nonCompleted, usage: ['never-recorded-usage'],
    }] } as unknown as BenchmarkRunRecord), 'not a response observation');
    refused(c.f.spine.append({ ...run, id: 'run:refused:missing-attempt', executions: [{
      ...nonCompleted, attempt: reference('JudgmentAttemptRecord', 'never-recorded-attempt'),
    }] } as unknown as BenchmarkRunRecord), 'attempt absent');
    refused(c.f.spine.append({ ...run, id: 'run:refused:missing-resolution', executions: [{
      ...nonCompleted, resolution: reference('JudgmentResolution', 'never-recorded-resolution'),
    }] } as unknown as BenchmarkRunRecord), 'resolution absent');
    refused(c.f.spine.append({ ...run, id: 'run:refused:wrong-owner-attempt', executions: [{
      ...nonCompleted, attempt: reference('JudgmentAttemptRecord', c.response.fact.id, 'part-nine'),
    }] } as unknown as BenchmarkRunRecord), 'owner/reference mismatch');
    refused(c.f.spine.append({ ...run, id: 'run:refused:wrong-owner-resolution', executions: [{
      ...nonCompleted, resolution: reference('JudgmentResolution', c.resolution.fact.id, 'part-nine'),
    }] } as unknown as BenchmarkRunRecord), 'owner/reference mismatch');

    const observedFact = value(c.f.spine.append({ ...run, id: 'run:refused:observed', executions: [nonCompleted] } as unknown as BenchmarkRunRecord)).fact;
    const port = createJudgmentBenchmarkReadPort(c.f.spine, c.f.c);
    value(port.readRun(reference('BenchmarkRunRecord', observedFact.id)));
    let predecessor = observedFact.id;
    for (const disposition of ['missing', 'refused', 'cancelled'] as const) {
      const fact = value(c.f.spine.append({ ...run, id: `run:${disposition}:empty`, predecessor, executions: [{
        scenario: reference('BenchmarkScenario', scenarioFact.id), candidate: c.f.host.description.route,
        ordinal: 0, disposition, detail: 'not executed', usage: [],
      }] } as unknown as BenchmarkRunRecord)).fact;
      value(port.readRun(reference('BenchmarkRunRecord', fact.id)));
      predecessor = fact.id;
    }
  });
});
