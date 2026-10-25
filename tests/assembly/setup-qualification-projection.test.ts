import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-expect-error Qualification-only physical adapter.
import { projectTask, decodeVerdict, renderTask, extractReply, digest, verdictSchema } from '../../scripts/setup-qualification.mjs';
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
    const answer = JSON.stringify({ disposition: 'accept', reason: projected.projection.checks.map((r: {name: string; receipt: string}) => `${r.name} ${r.receipt}`).join(', '),
      evidence: projected.projection.checks.map((r: {receipt: string}) => r.receipt) });
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
      expect(renderTask(projected)).toBe(trial.prompt);
      if (trial.disposition === 'observed') expect(decodeVerdict(extractReply(trial.output), projected)).toEqual(trial.verdict);
      else expect(trial.verdict.disposition).toBe('hold');
      expect(trial.constraint.schema).toEqual(verdictSchema(projected));
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
