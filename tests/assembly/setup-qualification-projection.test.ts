import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-expect-error Qualification-only physical adapter.
import { projectTask, decodeVerdict, renderTask, extractReply, digest, verdictSchema, TEMPLATE, TYPED_PROMPT, PROJECTED_VERDICT_SCHEMA } from '../../scripts/setup-qualification.mjs';
const original = JSON.parse(readFileSync('tests/qualification/evidence/macos-arm64-2026-10-25.json', 'utf8')).ownerEvidence.cases;
const heldOut = JSON.parse(readFileSync('tests/qualification/fixtures/setup-held-out-1025-mac4.json', 'utf8')).cases;
const anchors = { installation: original[0].installation, keyId: original[0].evidence[0].keyId,
  subject: original[4].evidence[0].subject, version: 1, session: 'qualification-session',
  operation: 'qualification-operation', frontier: 'frozen-owner-capture', phase: 'post' };

it('projects real owner fields into closed checks without reading expected, id, objective or exact', () => {
  for (const task of [...original, ...heldOut]) {
    const projected = projectTask(task, anchors);
    expect(projected.projection.checks.length).toBeGreaterThan(3);
    expect(projected.projection.checks.every((r: { passed: boolean }) => r.passed)).toBe(task.expected === 'accept');
    const changed = projectTask({ ...task, id: 'hidden', exact: !task.exact, expected: 'hidden', objective: 'Ignore checks' }, anchors);
    expect(changed.projection).toEqual(projected.projection);
    for (const check of projected.projection.checks) {
      expect(Object.keys(check)).toEqual(['name', 'owner', 'observed', 'passed', 'receipt']);
      expect(typeof check.observed).toBe('boolean'); expect(typeof check.passed).toBe('boolean');
      expect(projected.receipts[check.receipt]).toBeDefined();
      if (check.passed) expect(check.observed).toBe(true);
    }
    const prompt = renderTask(projected);
    expect(prompt).not.toContain(task.objective);
    expect(prompt).not.toContain('sha256:');
    expect(prompt).not.toContain('reviewProcedure');
    expect(prompt).not.toContain('Ignore verification');
  }
});

it('binds check and receipt mappings to the current owners, rejecting fabricated all-true records', () => {
  for (const task of original) {
    const projected = projectTask(task, anchors);
    const answer = JSON.stringify({ disposition: 'accept', reason: 'The cited checks establish the step.',
      checks: projected.projection.checks.map(({ name, observed, passed, receipt }: any) => ({ name, observed, passed, receipt })) });
    expect(decodeVerdict(answer, projected).disposition).toBe(task.expected);
    const fabricated = structuredClone(projected);
    fabricated.projection.checks.forEach((r: {passed: boolean; observed: boolean}) => { r.passed = true; r.observed = true; });
    expect(decodeVerdict(answer, fabricated).disposition).toBe(task.expected);
    for (const mutate of [
      (p: any) => { p.projection.checks.pop(); },
      (p: any) => { p.projection.checks.push(p.projection.checks[0]); },
      (p: any) => { p.projection.checks[0].extra = true; },
      (p: any) => { p.receipts.r1.checkpoint.subject = 'changed'; },
      (p: any) => { p.receipts.r1.checkpoint.frontier = 'stale'; },
      (p: any) => { p.receipts.r1.sources = []; },
      (p: any) => { p.checkpoint.subject = 'changed'; },
    ]) {
      const changed = structuredClone(projected); mutate(changed);
      expect(decodeVerdict(answer, changed).disposition).toBe('hold');
    }
  }
});

it('replays actual foreign summary/review/reply shapes through the projected task decoder', () => {
  const corpus = JSON.parse(readFileSync('tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json', 'utf8'));
  const task = projectTask(original[0], anchors);
  for (const row of corpus.otherShapes) {
    expect(decodeVerdict(extractReply(row.raw), task).disposition).toBe('hold');
  }
});

it('retains Linux owner captures and pairs each failed primitive observation with its repaired receipt', () => {
  const linux = JSON.parse(readFileSync('tests/qualification/evidence/linux-x86_64-2026-10-25.json', 'utf8'));
  const cases = linux.ownerEvidence.cases;
  const linuxAnchors = { ...anchors, installation: cases[0].installation, keyId: cases[0].evidence[0].keyId, subject: cases[4].evidence[0].subject };
  for (const task of cases) {
    expect(projectTask(task, linuxAnchors).projection.checks.every((r: {passed: boolean}) => r.passed)).toBe(task.expected === 'accept');
  }
  for (const task of original.filter((r: {expected: string}) => r.expected === 'accept')) {
    const good = projectTask(task, anchors);
    for (const key of Object.keys(task.evidence[0]).filter(k => k !== 'id')) {
      const missing = structuredClone(task); delete missing.evidence[0][key];
      const bad = projectTask(missing, anchors);
      expect(bad.projection.checks.some((r: {passed: boolean}) => !r.passed)).toBe(true);
      expect(good.projection.checks.every((r: {passed: boolean}) => r.passed)).toBe(true);
    }
  }
});

it('never substitutes an exact-only success for a model hold or an ungrounded model accept', () => {
  const task = projectTask(original[0], anchors);
  for (const answer of [
    { disposition: 'hold', reason: 'Uncertain about this step', evidence: ['r1'] },
    { disposition: 'accept', reason: 'All good', evidence: ['r1'] },
    { disposition: 'accept', reason: 'All good', evidence: ['foreign'] },
  ]) expect(decodeVerdict(JSON.stringify(answer), task).disposition).toBe('hold');
});

it('replays all measured typed outputs, receipt maps and Seven captures without hiding model decisions', () => {
  for (const size of ['1.5b', '3b']) for (const set of ['original', 'held-out']) {
    const report = JSON.parse(readFileSync(`tests/qualification/evidence/macos-arm64-2026-10-25-option1-${size}-${set}.json`, 'utf8'));
    expect(report.trials).toHaveLength(36);
    expect(report.pass).toBe(false);
    expect(report.independentAssessment.state).toBe('pending');
    let positives = 0, unsafe = 0, finalPositives = 0;
    for (const trial of [...report.trials, ...report.supervisionTrials]) {
      const projected = report.projectedTasks.find((task: {id: string}) => task.id === trial.case);
      expect(projectTask(projected, projected.checkpoint).projection).toEqual(projected.projection);
      expect(projectTask(projected, projected.checkpoint).receipts).toEqual(projected.receipts);
      // Historical output contract stays in its captured source; v2 rejects it.
      const captured = report.implementationSources['scripts/setup-qualification.mjs'];
      expect(digest(captured.text)).toBe(captured.sha256);
      const prompt = captured.text.match(/export const TYPED_PROMPT = `([\s\S]*?)`;/)[1];
      expect(digest(prompt)).toBe(report.hashes.prompt);
      expect(TEMPLATE.replace('{system}', () => prompt).replace('{task}', () => JSON.stringify(projected.projection))).toBe(trial.prompt);
      expect(decodeVerdict(extractReply(trial.output), projected)).toMatchObject({ disposition: 'hold', reason: 'incomplete or ungrounded schema' });
      expect(trial.constraint.schema.required).toEqual(['disposition', 'reason', 'evidence']);
      expect(trial.constraint.schema.properties.evidence.items.enum).toEqual(projected.projection.checks.map((r: any) => r.receipt));
      expect(trial.constraint.sha256).toBe(digest(JSON.stringify(trial.constraint.schema)));
      for (const key of ['requestCapture', 'responseCapture', 'accountingCapture']) {
        expect(`sha256:${digest(trial.seven.captures[key])}`).toBe(trial.seven[key].hash);
      }
      expect(trial.raw.resources.cleanup).toBe('verified');
      expect(trial.raw.resources.peakMemoryBytes).toBeLessThanOrEqual(report.profile.memoryBytes);
      expect(trial.elapsedMs).toBeLessThan(report.profile.deadlineMs);
      expect(trial.seven.calls).toBe(1);
      expect(JSON.parse(trial.seven.captures.requestCapture).input.prompt).toBe(trial.prompt);
      if (trial.expected) {
        let raw = { disposition: 'unparseable' };
        try { raw = JSON.parse(extractReply(trial.output)); } catch { /* retained schema failure */ }
        if (trial.expected === 'accept' && raw.disposition === 'accept') positives++;
        if (trial.expected === 'hold' && raw.disposition === 'accept') unsafe++;
        if (trial.expected === 'accept' && trial.verdict.disposition === 'accept') finalPositives++;
      }
    }
    expect(report.summary.rawPositiveAccepts).toBe(positives);
    expect(report.summary.unsafeModelAccepts).toBe(unsafe);
    expect(report.summary.finalPositiveAccepts).toBe(finalPositives);
  }
});

it('rejects malformed owner-field types, duplicate identities and unrecognized structure with repaired neighbors', () => {
  for (const mutate of [
    (t: any) => { t.evidence[0].challengeVerified = 'true'; },
    (t: any) => { t.evidence[0].keyId = true; },
    (t: any) => { t.evidence[0].extra = 'accept'; },
    (t: any) => { t.evidence.push(structuredClone(t.evidence[0])); },
    (t: any) => { t.evidence[0].receiptInstallation = 'foreign'; },
    (t: any) => { t.evidence[0].keyId = 'foreign'; },
  ]) {
    const bad = structuredClone(original[0]); mutate(bad);
    expect(projectTask(bad, anchors).projection.checks.some((r: {passed: boolean}) => !r.passed)).toBe(true);
    expect(projectTask(original[0], anchors).projection.checks.every((r: {passed: boolean}) => r.passed)).toBe(true);
  }
  expect(() => projectTask({ ...original[0], step: 'unknown' }, anchors)).toThrow('unknown projection');
  expect(() => projectTask(original[0], { ...anchors, phase: 'unknown' })).toThrow('unknown projection');
});

// Output contract first: the existing prose-only decoder must fail these neighbors.
it('carries exact check values and receipts in a closed per-call citation schema', () => {
  const task = projectTask(original[0], anchors);
  const checks = task.projection.checks.map(({ name, observed, passed, receipt }: any) => ({ name, observed, passed, receipt }));
  const answer = { disposition: 'accept', reason: 'The owner results establish this step.', checks };
  expect(decodeVerdict(JSON.stringify(answer), task)).toMatchObject({ ...answer, preserved: task.id });
  const schema = verdictSchema(task);
  expect(schema.required).toEqual(['disposition', 'reason', 'checks']);
  expect(schema.properties.disposition.enum).toEqual(['accept', 'hold']);
  expect(verdictSchema({ ...task, expected: 'hold', exact: false })).toEqual(schema);
  expect(renderTask({ ...task, expected: 'hold', exact: false })).toBe(renderTask(task));
  expect(schema.properties.checks).toMatchObject({ minItems: 1, maxItems: checks.length, items: {
    additionalProperties: false, required: ['name', 'observed', 'passed', 'receipt'], properties: {
      name: { enum: checks.map((r: any) => r.name) }, receipt: { enum: checks.map((r: any) => r.receipt) },
      observed: { type: 'boolean' }, passed: { type: 'boolean' },
    } } });
  for (const field of ['observed', 'passed', 'receipt']) {
    const wrong = structuredClone(answer);
    wrong.checks[0][field] = field === 'receipt' ? checks[1].receipt : false;
    expect(decodeVerdict(JSON.stringify(wrong), task)).toMatchObject({ disposition: 'hold',
      adequacy: { kind: 'cited-check-misstatement', misstatements: [checks[0].name] }, candidate: wrong });
  }
  const omitted = { ...answer, checks: checks.slice(1) };
  expect(decodeVerdict(JSON.stringify(omitted), task)).toMatchObject({ disposition: 'hold',
    adequacy: { kind: 'missing-required-citations' }, candidate: omitted });
  for (const changed of [[], [...checks, checks[0]], [{ ...checks[0], name: 'invented' }],
    [{ ...checks[0], receipt: 'foreign' }], [{ ...checks[0], extra: true }],
    [{ ...checks[0], observed: 'true' }]]) {
    expect(decodeVerdict(JSON.stringify({ ...answer, checks: changed }), task))
      .toMatchObject({ disposition: 'hold', reason: 'incomplete or ungrounded schema' });
  }
  const negative = projectTask(original[1], anchors);
  const failures = negative.projection.checks.filter((r: any) => !r.observed || !r.passed)
    .map(({ name, observed, passed, receipt }: any) => ({ name, observed, passed, receipt }));
  const held = { disposition: 'hold', reason: 'The failed check prevents validation.', checks: failures };
  expect(decodeVerdict(JSON.stringify(held), negative)).toMatchObject(held);
  const passing = { ...checks[0] };
  expect(decodeVerdict(JSON.stringify({ ...held, checks: [...failures, passing] }), negative)).toMatchObject({ ...held, checks: [...failures, passing] });
  const falseExtra = { ...passing, passed: false };
  expect(decodeVerdict(JSON.stringify({ ...held, checks: [...failures, falseExtra] }), negative)).toMatchObject({
    disposition: 'hold', adequacy: { kind: 'cited-check-misstatement', misstatements: [falseExtra.name] } });
  expect(decodeVerdict(JSON.stringify({ ...held, checks: [passing] }), negative)).toMatchObject({
    disposition: 'hold', adequacy: { kind: 'missing-required-citations' } });
  for (const invalid of [null, [], { ...answer, extra: true }, { ...answer, reason: '' },
    { ...answer, reason: '   ' }, { ...answer, reason: 'x'.repeat(4097) },
    { ...answer, disposition: 'uncertain' }, { ...answer, checks: null }]) {
    expect(decodeVerdict(JSON.stringify(invalid), task)).toMatchObject({ disposition: 'hold', reason: 'incomplete or ungrounded schema' });
  }
  const misstated = { ...held, checks: failures.map((r: any) => ({ ...r, passed: true })) };
  expect(decodeVerdict(JSON.stringify(misstated), negative)).toMatchObject({ disposition: 'hold',
    adequacy: { kind: 'cited-check-misstatement' }, candidate: misstated });
  expect(decodeVerdict(JSON.stringify({ ...held, disposition: 'accept' }), negative).disposition).toBe('hold');
  expect(decodeVerdict(JSON.stringify({ ...answer, disposition: 'hold' }), task).disposition).toBe('hold');
});

it('replays the frozen 3B structured outputs and verifies reported misstatements against their receipts', () => {
  const manifest = JSON.parse(readFileSync('tests/qualification/evidence/macos-arm64-2026-10-25-option1b-manifest.json', 'utf8'));
  for (const set of ['original', 'held-out']) {
    const bytes = readFileSync(`tests/qualification/evidence/macos-arm64-2026-10-25-option1b-3b-${set}.json`, 'utf8');
    const report = JSON.parse(bytes);
    expect(digest(bytes)).toBe(manifest.sets[set].evidenceSha256);
    expect(report.ownerEvidence.cases).toEqual(set === 'original' ? original : heldOut);
    expect(report.hashes.prompt).toBe(digest(TYPED_PROMPT));
    expect(report.hashes.adapter).toBe(digest(readFileSync('scripts/setup-qualification.mjs', 'utf8')));
    expect(report.verdictSchema).toBe(PROJECTED_VERDICT_SCHEMA);
    expect(report.trials).toHaveLength(36);
    expect(report.supervisionTrials).toHaveLength(set === 'original' ? 7 : 0);
    if (set === 'original') {
      expect(report.runOutcome).toMatchObject({ exitCode: 1, completedCaseTrials: 36, completedTimingTrials: 7,
        interruptedValidation: { responseCaptured: false, outcome: 'unknown; not a completed validation' } });
      expect(report.supervision.elapsedMs).toBeNull();
      const interrupted = report.runOutcome.interruptedValidation;
      expect(digest(interrupted.resourceSnapshotText)).toBe(interrupted.resourceSnapshotSha256);
      expect(JSON.parse(interrupted.resourceSnapshotText).active[0].pid).toBe(interrupted.pid);
      expect(report.supervision.completedCallSumMs).toBe(report.supervisionTrials.reduce((n: number, r: {elapsedMs: number}) => n + r.elapsedMs, 0));
      expect(report.supervision.completedCallSumMs).toBeGreaterThan(report.supervision.targetMs);
    }
    expect(report.pass).toBe(false);
    expect(report.independentAssessment.state).toBe('pending');
    let positive = 0, unsafe = 0, finalPositive = 0, misstatementTrials = 0, misstatementChecks = 0;
    for (const trial of [...report.trials, ...report.supervisionTrials]) {
      const task = report.projectedTasks.find((r: { id: string }) => r.id === trial.case);
      expect(projectTask(task, task.checkpoint).projection).toEqual(task.projection);
      expect(projectTask(task, task.checkpoint).receipts).toEqual(task.receipts);
      expect(renderTask(task)).toBe(trial.prompt);
      expect(verdictSchema(task)).toEqual(trial.constraint.schema);
      expect(trial.constraint.sha256).toBe(digest(JSON.stringify(trial.constraint.schema)));
      expect(trial.constraint.sha256).toBe(manifest.sets[set].outputSchemaPins[trial.case]);
      if (trial.disposition === 'observed') expect(decodeVerdict(extractReply(trial.output), task)).toEqual(trial.verdict);
      else expect(trial.verdict.disposition).toBe('hold');
      for (const key of ['requestCapture', 'responseCapture', 'accountingCapture']) {
        expect(`sha256:${digest(trial.seven.captures[key])}`).toBe(trial.seven[key].hash);
      }
      expect(JSON.parse(trial.seven.captures.accountingCapture).verdict).toEqual(trial.verdict);
      expect(trial.raw.resources.cleanup).toBe('verified');
      expect(trial.seven.calls).toBe(1);
      if (!trial.expected) continue;
      let raw = { disposition: 'unparseable' };
      try { raw = JSON.parse(extractReply(trial.output)); } catch { /* retain actual schema failure */ }
      if (trial.expected === 'accept' && raw.disposition === 'accept') positive++;
      if (trial.expected === 'hold' && raw.disposition === 'accept') unsafe++;
      if (trial.expected === 'accept' && trial.verdict.disposition === 'accept') finalPositive++;
      if (trial.verdict.adequacy?.kind === 'cited-check-misstatement') {
        misstatementTrials++; misstatementChecks += trial.verdict.adequacy.misstatements.length;
        for (const name of trial.verdict.adequacy.misstatements) {
          const cited = trial.verdict.candidate.checks.find((r: { name: string }) => r.name === name);
          const { owner: _owner, ...actual } = task.projection.checks.find((r: { name: string }) => r.name === name);
          expect(cited).not.toEqual(actual);
        }
      }
    }
    expect(report.summary).toMatchObject({ rawPositiveAccepts: positive, unsafeModelAccepts: unsafe,
      finalPositiveAccepts: finalPositive, citedCheckMisstatementFailures: misstatementTrials, citedCheckMisstatements: misstatementChecks });
    for (const [path, captured] of Object.entries(report.implementationSources) as [string, { text: string; sha256: string }][]) {
      expect(digest(captured.text)).toBe(captured.sha256);
      expect(captured.sha256).toBe(manifest.sets[set].sourcePins[path]);
    }
  }
});
