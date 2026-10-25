import { expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, truncateSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error Physical qualification adapter, outside the pure core.
import { verifyWeights, decodeVerdict, extractReply, boundedRun, tokenUsage, PROFILE, MODEL, MODEL_3B, digest, verdictSchema, renderTask } from '../../scripts/setup-qualification.mjs';

function recordBoundary(name: string, result: unknown) {
  const path = process.env.INSTAR_SETUP_BOUNDARY_EVIDENCE;
  if (!path) return;
  const prior = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  writeFileSync(path, JSON.stringify({ ...prior, [name]: result }, null, 2) + '\n', { mode: 0o600 });
}

it('refuses a wrong weights digest before any model can load', async () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-digest-'));
  const file = join(root, 'wrong.gguf'); writeFileSync(file, 'wrong model');
  try {
    await expect(verifyWeights(file)).rejects.toThrow('weights');
    await expect(verifyWeights(file, MODEL_3B)).rejects.toThrow('weights');
    await expect(verifyWeights(file, { ...MODEL, size: 11 })).rejects.toThrow('unknown model pin');
    // Sparse file: equal size, wrong digest, no 1-GiB allocation or load generator.
    truncateSync(file, MODEL.size);
    await expect(verifyWeights(file)).rejects.toThrow('SHA-256');
    recordBoundary('wrongWeights', { wrongSize: 'refused', equalSizeWrongDigest: 'refused', modelLoads: 0 });
  } finally { rmSync(root, { recursive: true }); }
});

it('replays recorded summary, uncertain/undecided Jev, reply review and delivered/empty reply bytes', () => {
  const corpus = JSON.parse(readFileSync(new URL('../preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8'));
  expect(corpus.otherShapes.map((row: { id: string }) => row.id)).toEqual(['summary:715672480', '715672483', '715672482',
    '969389570', '969389923', 'telegram:8994258214:update:715672479', 'telegram:8994258214:update:715672550']);
  for (const row of corpus.otherShapes) {
    // These are real foreign response shapes, never setup approval.
    const result = decodeVerdict(extractReply(row.raw), { id: row.id, exact: true, evidence: [{ id: row.id }] });
    expect(result).toMatchObject({ disposition: 'hold', preserved: row.id });
  }
  const complete = '{"disposition":"accept","reason":"Verified challenge","evidence":["key"]}';
  expect(extractReply(complete + ' [end of text]\n\n\n')).toBe(complete);
  expect(decodeVerdict(extractReply(complete), { id: 'positive', exact: true, evidence: [{ id: 'key' }] }).disposition).toBe('accept');
});

it('refuses the first real Qwen capture without repairing its malformed evidence array', () => {
  const capture = JSON.parse(readFileSync(new URL('../qualification/fixtures/qwen-first-output.json', import.meta.url), 'utf8'));
  expect(decodeVerdict(extractReply(capture.raw), { id: 'key-complete', exact: true, evidence: [{ id: 'key-receipt' }] }))
    .toMatchObject({ disposition: 'hold', reason: 'empty, truncated or malformed output' });
});

it('meters actual b4000 captures without dropping the first generated token', () => {
  const report = JSON.parse(readFileSync(new URL('../qualification/evidence/macos-arm64-2026-10-25.json', import.meta.url), 'utf8'));
  for (const row of report.trials) {
    const measured = tokenUsage(row.diagnostics);
    const evaluations = Number(row.diagnostics.match(/llama_perf_context_print:\s+eval time\s*=[^\n]*?\/\s*(\d+) runs/)[1]);
    expect(measured.outputTokens).toBe(evaluations + 1);
  }
  expect(tokenUsage('').inputTokens).toBeNull();
  expect(tokenUsage('').outputTokens).toBeNull();
});

it('holds an unavailable model and a stop arriving during validation', { timeout: 30000 }, async () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-stop-'));
  const stopFile = join(root, 'stop.json'); writeFileSync(stopFile, '{"stopped":false}');
  const base = { root, stopFile, executable: join(root, 'missing-model'), args: [], stdin: '',
    profile: { ...PROFILE, deadlineMs: 5000 } };
  const unavailable = await boundedRun(base);
  expect(unavailable.disposition).toBe('hold'); expect(unavailable.attempts).toBe(1);
  recordBoundary('unavailable', unavailable);
  const timer = setTimeout(() => writeFileSync(stopFile, '{"stopped":true}'), 250);
  try {
    const stopped = await boundedRun({ ...base, executable: '/bin/sleep', args: ['5'] });
    expect(stopped.disposition).toBe('hold'); expect(stopped.raw.cancellationReason).toBe('stopped');
    recordBoundary('stopDuring', stopped);
  } finally { clearTimeout(timer); }
});

it('requires a complete grounded verdict and never lets prose override an exact failure', () => {
  const task = { id: 'backup', evidence: [{ id: 'restore', restored: true }], exact: true };
  const good = JSON.stringify({ disposition: 'accept', reason: 'Restored challenge matches.', evidence: ['restore'] });
  expect(decodeVerdict(good, task).disposition).toBe('accept');
  expect(decodeVerdict(good, { ...task, exact: false }).disposition).toBe('hold');
  for (const bytes of ['', 'accept', '{', '{}', JSON.stringify({ disposition: 'uncertain' }),
    JSON.stringify({ disposition: 'accept', reason: '', evidence: ['restore'] }),
    JSON.stringify({ disposition: 'accept', reason: 'OK', evidence: ['invented'] })]) {
    expect(decodeVerdict(bytes, task).disposition).toBe('hold');
  }
});

it('stops and holds an over-limit child once, with a successful bounded neighbor', { timeout: 30000 }, async () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-limits-'));
  const checkpoint = join(root, 'stop.json'); writeFileSync(checkpoint, '{"stopped":false}');
  const base = { root, stopFile: checkpoint, executable: '/bin/sleep', args: ['2'], stdin: '',
    profile: { ...PROFILE, deadlineMs: 100 } };
  const over = await boundedRun(base);
  expect(over.disposition).toBe('hold'); expect(over.raw.localLimit).toBe('timeout');
  expect(over.attempts).toBe(1);
  recordBoundary('deadline', over);
  const within = await boundedRun({ ...base, executable: '/usr/bin/printf', args: ['ok'],
    profile: { ...PROFILE, deadlineMs: 5000 } });
  expect(within.raw.code).toBe(0); expect(within.raw.stdout).toBe('ok');
  recordBoundary('withinBounds', within);
  writeFileSync(checkpoint, '{"stopped":true}');
  const stopped = await boundedRun({ ...base, executable: '/usr/bin/printf', args: ['should not run'] });
  expect(stopped.raw.stdout).toBe(''); expect(stopped.attempts).toBe(0);
  expect(JSON.parse(readFileSync(checkpoint, 'utf8')).stopped).toBe(true);
  recordBoundary('stopBefore', stopped);
});

it('enforces actual resident-memory termination using a lowered ceiling, without allocating load', { timeout: 30000 }, async () => {
  const root = mkdtempSync(join(tmpdir(), 'setup-memory-'));
  const stopFile = join(root, 'stop.json'); writeFileSync(stopFile, '{"stopped":false}');
  const result = await boundedRun({ root, stopFile, executable: '/bin/sleep', args: ['5'], stdin: '',
    profile: { ...PROFILE, memoryBytes: 1, deadlineMs: 10000 } });
  expect(result.disposition).toBe('hold'); expect(result.raw.localLimit).toBe('memory');
  expect(result.raw.resources.cleanup).toBe('verified'); expect(result.attempts).toBe(1);
  recordBoundary('memory', result);
});

it('constrains structure and observed IDs without leaking expected judgment into the prompt or schema', () => {
  const report = JSON.parse(readFileSync(new URL('../qualification/evidence/macos-arm64-2026-10-25.json', import.meta.url), 'utf8'));
  for (const task of report.ownerEvidence.cases) {
    const schema = verdictSchema(task);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(['disposition', 'reason', 'evidence']);
    expect(schema.properties.disposition.enum).toEqual(['accept', 'hold']);
    expect(schema.properties.reason).toEqual({ type: 'string', minLength: 1, maxLength: 4096 });
    expect(schema.properties.evidence.minItems).toBe(1);
    expect(schema.properties.evidence.items.enum).toEqual(task.evidence.map((row: { id: string }) => row.id));
    const changedExpectation = { ...task, exact: !task.exact, expected: task.expected === 'accept' ? 'hold' : 'accept' };
    expect(verdictSchema(changedExpectation)).toEqual(schema);
    expect(renderTask(changedExpectation)).toBe(renderTask(task));
    const valid = { disposition: task.expected, reason: 'Observed owner evidence.', evidence: schema.properties.evidence.items.enum };
    expect(decodeVerdict(JSON.stringify(valid), task).reason).not.toMatch(/schema|malformed/);
    for (const invalid of [{ ...valid, extra: true }, { ...valid, evidence: [] },
      { ...valid, evidence: ['invented'] }, { ...valid, reason: ' '.repeat(2) },
      { ...valid, reason: 'a'.repeat(4097) }]) {
      expect(decodeVerdict(JSON.stringify(invalid), task)).toMatchObject({ disposition: 'hold', reason: 'incomplete or ungrounded schema' });
    }
  }
});

it('replays both real constrained configurations without hiding unsafe candidates behind exact holds', () => {
  for (const size of ['1.5b', '3b']) {
    const report = JSON.parse(readFileSync(new URL(`../qualification/evidence/macos-arm64-2026-10-25-constrained-${size}.json`, import.meta.url), 'utf8'));
    expect(report.trials).toHaveLength(36);
    for (const row of report.trials) {
      const task = report.ownerEvidence.cases.find((item: { id: string }) => item.id === row.case);
      expect(row.prompt).toBe(renderTask(task));
      expect(row.constraint.schema).toEqual(verdictSchema(task));
      expect(row.constraint.sha256).toBe(digest(JSON.stringify(verdictSchema(task))));
      expect(row.seven.calls).toBe(1);
      expect(row.raw.resources.cleanup).toBe('verified');
      for (const key of ['requestCapture', 'responseCapture', 'accountingCapture']) {
        expect(`sha256:${digest(row.seven.captures[key])}`).toBe(row.seven[key].hash);
      }
      if (row.disposition === 'observed') {
        expect(decodeVerdict(extractReply(row.output), task)).toEqual(row.verdict);
        expect(row.verdict.reason).not.toMatch(/schema|malformed/);
      } else {
        expect(row.verdict).toMatchObject({ disposition: 'hold', reason: 'memory', preserved: task.id });
        expect(row.raw.localLimit).toBe('memory');
      }
    }
    expect(report.pass).toBe(false);
    expect(report.profile.memoryBytes).toBe(PROFILE.memoryBytes);
    expect(report.independentAssessment.state).toBe('pending');
    if (size === '1.5b') {
      expect(report.numericalBar).toMatchObject({ unsafeCandidateAccepts: 6, rejectedPositiveNeighbors: 0, resourceFailures: 0 });
      const unsafe = report.trials.filter((row: any) => row.expected === 'hold' && row.verdict.candidate?.disposition === 'accept');
      expect(unsafe.map((row: any) => row.case)).toEqual(Array(3).fill(['append-fault', 'conflicting-receipts']).flat());
    } else {
      expect(report.candidate).toEqual(MODEL_3B);
      expect(report.numericalBar.resourceFailures).toBe(36);
    }
  }
});
