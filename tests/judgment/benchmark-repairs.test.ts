import { describe, expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import type { BenchmarkRecord, BenchmarkRunRecord, BenchmarkScenario, JudgmentAttemptRecord, JudgmentRequest, JudgmentResolution } from '../../src/judgment/index.js';
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

function appendRecord(c: Awaited<ReturnType<typeof benchmarkCase>>) {
  return value(c.f.spine.append(c.record)).fact;
}

function appendScenario(c: Awaited<ReturnType<typeof benchmarkCase>>, recordId: string) {
  const scenario = { ...c.scenario, predecessor: recordId, source: reference('BenchmarkRecord', recordId) } as unknown as BenchmarkScenario;
  return { scenario, fact: value(c.f.spine.append(scenario)).fact };
}

function validRun(c: Awaited<ReturnType<typeof benchmarkCase>>, scenarioId: string, predecessor: string) {
  return { ...c.run, predecessor,
    scenarios: [{ scenario: reference('BenchmarkScenario', scenarioId), version: 'v1' }],
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
    const c = await benchmarkCase(), recordFact = appendRecord(c), { fact: scenarioFact } = appendScenario(c, recordFact.id);
    const good = validRun(c, scenarioFact.id, scenarioFact.id);
    const bad = { ...good, id: 'run:phantom', executions: [{ ...good.executions[0],
      attempt: reference('JudgmentAttemptRecord', 'does-not-exist'), resolution: reference('JudgmentResolution', 'does-not-exist') }] } as unknown as BenchmarkRunRecord;
    refused(c.f.spine.append(bad), 'attempt absent');
    expect(value(c.f.spine.append(good)).fact.id).toBeTruthy();
  });

  it('P7-NF-32 P7-NF-34 C5 refuses scenarios and runs when a current source dependency is tainted', async () => {
    const c = await benchmarkCase(), recordFact = appendRecord(c), { fact: scenarioFact } = appendScenario(c, recordFact.id);
    const runFact = value(c.f.spine.append(validRun(c, scenarioFact.id, scenarioFact.id))).fact;
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
});
