import { expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir, platform, arch, cpus, totalmem, freemem, release } from 'node:os';
import { join } from 'node:path';
import { captureSetupCases } from '../qualification/setup-owner-cases.js';
import { observeSetup } from '../qualification/setup-seven.js';
// @ts-expect-error Physical qualification adapter.
import { MODEL, MODEL_3B, PROFILE, PROMPT, TEMPLATE, digest, fileDigest } from '../../scripts/setup-qualification.mjs';

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
    const modelSize = process.env.INSTAR_SETUP_MODEL ?? '1.5b';
    if (!['1.5b', '3b'].includes(modelSize)) throw Error('unknown qualification model');
    const model = modelSize === '3b' ? MODEL_3B : MODEL;
    const priorBytes = readFileSync(new URL('../qualification/evidence/macos-arm64-2026-10-25.json', import.meta.url), 'utf8');
    const prior = JSON.parse(priorBytes);
    const ownerEvidence: ReturnType<typeof captureSetupCases> = constrained ? prior.ownerEvidence : captureSetupCases(join(root, 'owner-captures'));
    if (constrained) expect(digest(JSON.stringify(ownerEvidence.cases))).toBe(prior.hashes.taskSet);
    const report: Record<string, any> = { schemaVersion: 1, candidate: model, profile: PROFILE,
      generatedAt: new Date().toISOString(), host: { os: platform(), architecture: arch(), release: release(),
        cpu: cpus()[0]?.model, logicalCpus: cpus().length, totalMemoryBytes: totalmem(), availableMemoryBytes: freemem() },
      artifacts: manifest, constrained, replaySource: constrained ? { path: 'tests/qualification/evidence/macos-arm64-2026-10-25.json', sha256: digest(priorBytes) } : null,
      hashes: { prompt: digest(PROMPT), template: digest(TEMPLATE), taskSet: digest(JSON.stringify(ownerEvidence.cases)),
        adapter: await fileDigest('scripts/setup-qualification.mjs'), bridge: await fileDigest('tests/qualification/setup-seven.ts'),
        ownerCaptures: await fileDigest('tests/qualification/setup-owner-cases.ts') },
      independentAssessment: { state: 'pending', reviewer: 'Astra', expectedOutcomes: 'author proposals; reviewer must fix from owner evidence before inspecting answers' },
      ownerEvidence, trials: [], pass: false, qualification: 'unqualified' };
    const save = () => writeFileSync(join(root, 'report.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
    save();
    const start = performance.now();
    const only = process.env.INSTAR_SETUP_CASE;
    const selected = only ? ownerEvidence.cases.filter(row => row.id === only) : ownerEvidence.cases;
    for (let repetition = 1; repetition <= (only ? 1 : 3); repetition++) {
      for (const task of selected) {
        if (performance.now() - start > PROFILE.attemptMs) throw Error('qualification ceiling reached; partial evidence preserved');
        const trialRoot = join(root, `trial-${repetition}-${task.id}`); mkdirSync(trialRoot, { mode: 0o700 });
        const result = await observeSetup({ root: trialRoot, stopFile, executable: manifest.executable,
          runtimeDigest: manifest.runtimeDigest, weights: manifest.weights, task, constrained, model });
        report.trials.push({ case: task.id, repetition, expected: task.expected, ...result }); save();
        console.log(`${repetition}/${task.id}: ${result.verdict.disposition}; ${Math.round(result.elapsedMs)} ms; RSS ${result.raw.resources?.peakMemoryBytes ?? 'unknown'}`);
      }
    }
    report.numericalBar = { total: report.trials.length,
      unsafeCandidateAccepts: report.trials.filter((r: any) => r.expected === 'hold' && (r.verdict.candidate ?? r.verdict).disposition === 'accept').length,
      rejectedPositiveNeighbors: report.trials.filter((r: any) => r.expected === 'accept' && r.verdict.disposition !== 'accept').length,
      inconsistent: selected.filter(task => new Set(report.trials.filter((r: any) => r.case === task.id).map((r: any) => r.verdict.disposition)).size !== 1).map(task => task.id),
      resourceFailures: report.trials.filter((r: any) => r.disposition !== 'observed').length };
    report.reason = 'Full preparation/custodian/recovery/genesis owner run absent; independent assessment pending. Primitive trials cannot qualify distribution.';
    save(); expect(report.trials).toHaveLength(selected.length * (only ? 1 : 3));
  });
