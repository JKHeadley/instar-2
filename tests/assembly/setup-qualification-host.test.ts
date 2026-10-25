import { expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir, platform, arch, cpus, totalmem, freemem, release } from 'node:os';
import { join } from 'node:path';
import { captureSetupCases } from '../qualification/setup-owner-cases.js';
import { observeSetup } from '../qualification/setup-seven.js';
// @ts-expect-error Physical qualification adapter.
import { MODEL, MODEL_3B, PROMPT, TEMPLATE, digest, fileDigest, qualificationProfile, projectTask, TYPED_PROMPT, PROJECTION_SCHEMA } from '../../scripts/setup-qualification.mjs';

it('captures real crypto, recovery, changed signatures and conflicting durable appends', () => {
  const evidence = captureSetupCases(mkdtempSync(join(tmpdir(), 'setup-owners-')));
  expect(evidence.cases).toHaveLength(12);
  expect(evidence.mechanics).toMatchObject({ restoredChallenge: true, countBefore: 1, countAfter: 1,
    conflicting: true, resumedSame: true });
  expect(evidence.coverage.installedPreparationRun).toBe(false);
});

// Explicit opt-in: ordinary test runs never load weights or consume minutes of CPU.
it.skipIf(!process.env.INSTAR_SETUP_QUALIFICATION)('records the pinned real macOS candidate without claiming independent acceptance',
  { timeout: 1200000 }, async () => {
    if (platform() !== 'darwin') throw Error('macOS evidence must be run on macOS');
    const root = process.env.INSTAR_SETUP_QUALIFICATION!;
    mkdirSync(root, { recursive: true, mode: 0o700 });
    const manifest = JSON.parse(readFileSync(join(root, 'artifacts.json'), 'utf8'));
    const stopFile = join(root, 'stop.json');
    // The caller supplies a durable explicit non-stop; never erase a stop on restart.
    expect(JSON.parse(readFileSync(stopFile, 'utf8')).stopped).toBe(false);
    const constrained = process.env.INSTAR_SETUP_CONSTRAINED === '1';
    const typed = process.env.INSTAR_SETUP_TYPED === '1';
    if (typed && !constrained) throw Error('typed replay requires constrained output');
    const modelSize = process.env.INSTAR_SETUP_MODEL ?? '1.5b';
    if (!['1.5b', '3b'].includes(modelSize)) throw Error('unknown qualification model');
    const model = modelSize === '3b' ? MODEL_3B : MODEL;
    const profileName = process.env.INSTAR_SETUP_PROFILE ?? 'default';
    const profile = qualificationProfile(profileName, model, constrained);
    const priorBytes = readFileSync(new URL('../qualification/evidence/macos-arm64-2026-10-25.json', import.meta.url), 'utf8');
    const prior = JSON.parse(priorBytes);
    const caseSet = process.env.INSTAR_SETUP_SET ?? 'original';
    if (!['original', 'held-out'].includes(caseSet)) throw Error('unknown qualification case set');
    if (caseSet === 'held-out' && !constrained) throw Error('held-out requires constrained replay');
    const heldOutPath = 'tests/qualification/fixtures/setup-held-out-1025-mac4.json';
    const heldOutBytes = readFileSync(heldOutPath, 'utf8');
    const heldOutDigest = readFileSync(`${heldOutPath}.sha256`, 'utf8').split(' ')[0];
    expect(digest(heldOutBytes)).toBe(heldOutDigest);
    const ownerEvidence: ReturnType<typeof captureSetupCases> = caseSet === 'held-out'
      ? { ...prior.ownerEvidence, cases: JSON.parse(heldOutBytes).cases }
      : constrained ? prior.ownerEvidence : captureSetupCases(join(root, 'owner-captures'));
    if (constrained && caseSet === 'original') expect(digest(JSON.stringify(ownerEvidence.cases))).toBe(prior.hashes.taskSet);
    const anchors = { installation: prior.ownerEvidence.cases[0].installation,
      keyId: prior.ownerEvidence.cases[0].evidence[0].keyId,
      subject: prior.ownerEvidence.cases[4].evidence[0].subject, version: 1,
      session: 'qualification-session', operation: 'qualification-operation', frontier: 'frozen-owner-capture', phase: 'post' };
    const projectedTasks = typed ? ownerEvidence.cases.map(task => projectTask(task, anchors)) : [];
    const report: Record<string, any> = { schemaVersion: 1, candidate: model, profile, profileName, caseSet,
      heldOutFreeze: { path: heldOutPath, sha256: heldOutDigest, commit: '70b1f612e' },
      generatedAt: new Date().toISOString(), host: { os: platform(), architecture: arch(), release: release(),
        cpu: cpus()[0]?.model, logicalCpus: cpus().length, totalMemoryBytes: totalmem(), availableMemoryBytes: freemem() },
      artifacts: manifest, constrained, typed, projectionSchema: typed ? PROJECTION_SCHEMA : null, projectedTasks, replaySource: caseSet === 'held-out' ? { path: heldOutPath, sha256: heldOutDigest }
        : constrained ? { path: 'tests/qualification/evidence/macos-arm64-2026-10-25.json', sha256: digest(priorBytes) } : null,
      hashes: { prompt: digest(typed ? TYPED_PROMPT : PROMPT), template: digest(TEMPLATE), taskSet: digest(JSON.stringify(ownerEvidence.cases)),
        adapter: await fileDigest('scripts/setup-qualification.mjs'), bridge: await fileDigest('tests/qualification/setup-seven.ts'),
        ownerCaptures: await fileDigest('tests/qualification/setup-owner-cases.ts') },
      independentAssessment: { state: 'pending', reviewer: 'Astra', expectedOutcomes: 'author proposals; reviewer must fix from owner evidence before inspecting answers' },
      implementationSources: Object.fromEntries(['scripts/setup-qualification.mjs', 'tests/qualification/setup-seven.ts',
        'tests/qualification/setup-owner-cases.ts', 'tests/assembly/setup-qualification-host.test.ts'].map(path => {
          const text = readFileSync(path, 'utf8'); return [path, { text, sha256: digest(text) }]; })),
      ownerEvidence, trials: [], supervisionTrials: [], pass: false, qualification: 'unqualified' };
    const save = () => writeFileSync(join(root, 'report.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
    save();
    const start = performance.now();
    const only = process.env.INSTAR_SETUP_CASE;
    const tasks = typed ? projectedTasks : ownerEvidence.cases;
    const selected = only ? tasks.filter((row: { id: string }) => row.id === only) : tasks;
    for (let repetition = 1; repetition <= (only ? 1 : 3); repetition++) {
      for (const task of selected) {
        if (performance.now() - start > profile.attemptMs) throw Error('qualification ceiling reached; partial evidence preserved');
        const trialRoot = join(root, `trial-${repetition}-${task.id}`); mkdirSync(trialRoot, { mode: 0o700 });
        const result = await observeSetup({ root: trialRoot, stopFile, executable: manifest.executable,
          runtimeDigest: manifest.runtimeDigest, weights: manifest.weights, task, constrained, model, profileName });
        const captures = Object.fromEntries(['requestCapture', 'responseCapture', 'accountingCapture'].map(key => {
          const ref = result.seven[key as keyof typeof result.seven] as { hash: string };
          const bytes = readFileSync(join(trialRoot, 'captures', ref.hash.slice(7)), 'utf8');
          expect(`sha256:${digest(bytes)}`).toBe(ref.hash); return [key, bytes]; }));
        report.trials.push({ case: task.id, repetition, expected: task.expected, ...result,
          owner: undefined, seven: { ...result.seven, captures } }); save();
        console.log(`${repetition}/${task.id}: ${result.verdict.disposition} final / ${(result.verdict.candidate ?? result.verdict).disposition} model; ${Math.round(result.elapsedMs)} ms; RSS ${result.raw.resources?.peakMemoryBytes ?? 'unknown'}`);
      }
    }
    report.numericalBar = { total: report.trials.length,
      unsafeCandidateAccepts: report.trials.filter((r: any) => r.expected === 'hold' && (r.verdict.candidate ?? r.verdict).disposition === 'accept').length,
      rejectedPositiveNeighbors: report.trials.filter((r: any) => r.expected === 'accept' && r.verdict.disposition !== 'accept').length,
      inconsistent: selected.filter((task: { id: string }) => new Set(report.trials.filter((r: any) => r.case === task.id).map((r: any) => r.verdict.disposition)).size !== 1).map(task => task.id),
      resourceFailures: report.trials.filter((r: any) => r.disposition !== 'observed').length };
    if (typed && caseSet === 'original' && !only) {
      // Eight fresh-process correct primitive validations, including every per-call byte check.
      // This is a lower-bound proxy: no absent installed pre-step owner evidence is invented.
      const positives = projectedTasks.filter((task: { expected: string }) => task.expected === 'accept');
      const supervisionStart = performance.now();
      for (let index = 0; index < 8; index++) {
        const task = positives[index % positives.length];
        const trialRoot = join(root, `supervision-${index}`); mkdirSync(trialRoot, { mode: 0o700 });
        const result = await observeSetup({ root: trialRoot, stopFile, executable: manifest.executable,
          runtimeDigest: manifest.runtimeDigest, weights: manifest.weights, task, constrained, model, profileName });
        const captures = Object.fromEntries(['requestCapture', 'responseCapture', 'accountingCapture'].map(key => {
          const ref = result.seven[key as keyof typeof result.seven] as { hash: string };
          const bytes = readFileSync(join(trialRoot, 'captures', ref.hash.slice(7)), 'utf8');
          expect(`sha256:${digest(bytes)}`).toBe(ref.hash); return [key, bytes]; }));
        report.supervisionTrials.push({ case: task.id, ...result, owner: undefined, seven: { ...result.seven, captures } }); save();
        console.log(`supervision ${index + 1}/8: ${result.verdict.disposition}; ${Math.round(result.elapsedMs)} ms`);
      }
      report.supervision = { elapsedMs: performance.now() - supervisionStart, targetMs: 120000,
        includes: 'Eight fresh processes, weight/runtime digest verification, load, inference, capture and cleanup; filesystem cache may be warm.',
        limitation: 'Correct primitive postcondition replay; full installed four pre/four post sequence is absent.',
        accepted: report.supervisionTrials.filter((r: any) => r.verdict.disposition === 'accept').length };
    }
    report.reason = 'Full preparation/custodian/recovery/genesis owner run absent; independent assessment pending. Primitive trials cannot qualify distribution.';
    save(); expect(report.trials).toHaveLength(selected.length * (only ? 1 : 3));
  });
