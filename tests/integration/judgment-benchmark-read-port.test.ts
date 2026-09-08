import { describe, expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import type { BenchmarkRecord, BenchmarkRunRecord, BenchmarkScenario, JudgmentAttemptRecord, JudgmentRequest } from '../../src/judgment/index.js';
import { createJudgmentBenchmarkReadPort } from '../../src/judgment/index.js';
import { judgmentFixture, refused, value } from '../judgment/fixture.js';

describe('part-seven benchmark records through the signed fact spine', { timeout: 30_000 }, () => {
  it('P7-NF-32 P7-NF-33 P7-NF-46 P7-NF-47 P7-NF-48 reads real provenance, input exclusions, digests, and every execution disposition', async () => {
    const f = judgmentFixture(), answer = value(await f.door.judge(f.input, f.start()));
    const facts = value(f.door.inspect());
    const requestFact = facts.find((row): row is typeof row & { record: JudgmentRequest } => row.record.type === 'JudgmentRequest')!;
    const resolutionFact = facts.find(row => row.record.type === 'JudgmentResolution')!;
    const attemptFacts = facts.filter((row): row is typeof row & { record: JudgmentAttemptRecord } => row.record.type === 'JudgmentAttemptRecord');
    const response = attemptFacts.find(row => row.record.phase === 'response-observed')!;
    const digest = value(canonical({ criterion: 'preserve separate conclusion and reason', route: f.host.description.route })).hash;
    const record: BenchmarkRecord = {
      type: 'BenchmarkRecord', schemaVersion: 1, id: 'benchmark-record:1', predecessor: resolutionFact.fact.id,
      provenance: { kind: 'real', request: { owner: 'part-seven', name: 'JudgmentRequest', id: requestFact.fact.id },
        generation: requestFact.record.generation, vector: 'vector:judgment:1' },
      request: { owner: 'part-seven', name: 'JudgmentRequest', id: requestFact.fact.id }, requestDigest: requestFact.record.inputDigest,
      resolution: { owner: 'part-seven', name: 'JudgmentResolution', id: resolutionFact.fact.id }, run: requestFact.record.run,
      step: requestFact.record.step, logicalKey: requestFact.record.logicalKey, recordingPrincipal: f.alice.id,
      sourceGeneration: requestFact.record.generation, scenarioClass: 'advisory-real-case', inputDigest: requestFact.record.inputDigest,
      compatibilityDigest: digest,
      attempts: attemptFacts.map(row => ({ owner: 'part-seven', name: 'JudgmentAttemptRecord', id: row.fact.id })),
      captureReferences: [requestFact.record.question, requestFact.record.context, requestFact.record.submitted, response.record.receipt!],
      decision: { state: 'present', id: answer.decision.id }, conclusionEvidence: answer.decision.conclusion.evidence,
      reasonEvidence: answer.decision.reason.evidence, outcomeReferences: [response.fact.id], usageReferences: [response.fact.id],
    } as unknown as BenchmarkRecord;
    const recordFact = value(f.spine.append(record)).fact;

    const scenario: BenchmarkScenario = {
      type: 'BenchmarkScenario', schemaVersion: 1, id: 'benchmark-scenario:1', predecessor: recordFact.id, version: 'scenario-v1',
      source: { owner: 'part-seven', name: 'BenchmarkRecord', id: recordFact.id },
      sourceGrade: { owner: 'part-nine', name: 'Grade', id: 'grade:real-case:1' }, pinnedGeneration: requestFact.record.generation,
      pinnedVector: 'vector:judgment:1', scenarioClass: 'advisory-real-case', promotionDecision: 'decision:promote:1',
      replayInput: requestFact.record.submitted, originalInputHash: requestFact.record.submitted.hash,
      transformedInputHash: requestFact.record.submitted.hash, transformationVersion: 'identity-v1', changedSemanticFields: [],
      unavailableSemanticFields: [], excludedAnswerFields: ['decision', 'provider-response'],
      excludedOutcomeFields: ['outcome', 'grade', 'subsequent-conversation'], floorDigest: value(canonical(f.host.floor)).hash,
      outputSchemaDigest: value(canonical({ type: 'Decision', schemaVersion: 1 })).hash,
      evaluationContract: 'part-nine:evaluation-contract:1', dataScope: 'local-authorized-replay', captureAvailability: 'available',
    } as unknown as BenchmarkScenario;
    const scenarioFact = value(f.spine.append(scenario)).fact;

    const run: BenchmarkRunRecord = {
      type: 'BenchmarkRunRecord', schemaVersion: 1, id: 'benchmark-run:1', predecessor: scenarioFact.id,
      suite: 'judgment-advisory', suiteVersion: 'suite-v1',
      scenarios: [{ scenario: { owner: 'part-seven', name: 'BenchmarkScenario', id: scenarioFact.id }, version: scenario.version }],
      candidates: [{ route: f.host.description.route, samples: 1 }], criterionDigest: digest,
      inputDigest: scenario.transformedInputHash, compatibilityDigest: record.compatibilityDigest,
      heldOutPartition: 'partition:held-out:1', run: f.run, startedAt: 200, stoppedAt: 201,
      executions: [{ scenario: { owner: 'part-seven', name: 'BenchmarkScenario', id: scenarioFact.id },
        candidate: f.host.description.route, ordinal: 0, disposition: 'completed',
        attempt: { owner: 'part-seven', name: 'JudgmentAttemptRecord', id: response.fact.id },
        resolution: { owner: 'part-seven', name: 'JudgmentResolution', id: resolutionFact.fact.id }, usage: [response.fact.id] }],
    } as unknown as BenchmarkRunRecord;
    const runFact = value(f.spine.append(run)).fact;

    const port = createJudgmentBenchmarkReadPort(f.spine, f.c);
    expect(value(port.readRecord({ owner: 'part-seven', name: 'BenchmarkRecord', id: recordFact.id }))).toEqual(record);
    expect(value(port.readScenario({ owner: 'part-seven', name: 'BenchmarkScenario', id: scenarioFact.id }))).toEqual(scenario);
    expect(value(port.readRun({ owner: 'part-seven', name: 'BenchmarkRunRecord', id: runFact.id }))).toEqual(run);
    expect(Object.isFrozen(value(port.readRun({ owner: 'part-seven', name: 'BenchmarkRunRecord', id: runFact.id })))).toBe(true);
    refused(f.spine.append({ ...run, id: 'benchmark-run:omitted', predecessor: runFact.id, executions: [] } as unknown as BenchmarkRunRecord),
      'every planned benchmark execution');
  });

  it('P7-NF-46 refuses a synthetic source scenario', async () => {
    const f = judgmentFixture(); value(await f.door.judge(f.input, f.start()));
    const facts = value(f.door.inspect()), request = facts.find(row => row.record.type === 'JudgmentRequest')!;
    const resolution = facts.find(row => row.record.type === 'JudgmentResolution')!;
    if (request.record.type !== 'JudgmentRequest') throw new Error('request missing');
    const synthetic = { type: 'BenchmarkRecord', schemaVersion: 1, id: 'synthetic:1', predecessor: resolution.fact.id,
      provenance: { kind: 'synthetic', fixture: 'decoder-only', productionDerived: false },
      request: { owner: 'part-seven', name: 'JudgmentRequest', id: request.fact.id }, requestDigest: request.record.inputDigest,
      resolution: { owner: 'part-seven', name: 'JudgmentResolution', id: resolution.fact.id }, run: request.record.run, step: request.record.step,
      logicalKey: request.record.logicalKey, recordingPrincipal: f.alice.id, sourceGeneration: request.record.generation,
      scenarioClass: 'synthetic-contract-fixture', inputDigest: request.record.inputDigest, compatibilityDigest: request.record.inputDigest,
      attempts: [], captureReferences: [request.record.submitted], decision: { state: 'absent' }, conclusionEvidence: [], reasonEvidence: [],
      outcomeReferences: [], usageReferences: [] } as unknown as BenchmarkRecord;
    const syntheticFact = value(f.spine.append(synthetic)).fact;
    const badScenario = { type: 'BenchmarkScenario', schemaVersion: 1, id: 'bad-scenario', predecessor: syntheticFact.id, version: 'v1',
      source: { owner: 'part-seven', name: 'BenchmarkRecord', id: syntheticFact.id }, sourceGrade: { owner: 'part-nine', name: 'Grade', id: 'grade:1' },
      pinnedGeneration: request.record.generation, pinnedVector: 'vector:1', scenarioClass: 'test', promotionDecision: 'decision:1',
      replayInput: request.record.submitted, originalInputHash: request.record.submitted.hash, transformedInputHash: request.record.submitted.hash,
      transformationVersion: 'identity-v1', changedSemanticFields: [], unavailableSemanticFields: [], excludedAnswerFields: ['answer'],
      excludedOutcomeFields: ['outcome'], floorDigest: request.record.inputDigest, outputSchemaDigest: request.record.inputDigest,
      evaluationContract: 'evaluation:1', dataScope: 'local', captureAvailability: 'available' } as unknown as BenchmarkScenario;
    refused(f.spine.append(badScenario), 'real source');
  });
});
