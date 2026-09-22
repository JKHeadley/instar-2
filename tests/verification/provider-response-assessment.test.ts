import { expect, it } from 'vitest';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { decodeVerificationRecord, verificationIdentity } from '../../src/verification/index.js';
import type { ProviderResponseSubject } from '../../src/verification/index.js';
import { authorAndAppend } from '../../src/facts/index.js';
import { factsFixture, json, privateKey, refused, value } from '../facts/fixtures.js';
import { loadOwnerReferences } from '../../scripts/register-owner-references.mjs';
import { hash as ownerHash } from '../register/fixtures.js';
import { verificationInput } from './fixture.js';
import { verificationRuntimeFixture } from './runtime-fixture.js';

const hash = (digit: string) => `sha256:${digit.repeat(64)}` as const;
const reference = (id: string, kind: string, digit: string) => ({ owner: 'part-two' as const,
  name: 'FactEnvelope' as const, id, kind, schemaVersion: 1, contentHash: hash(digit) });
const subject: ProviderResponseSubject = {
  seven: { request: reference('seven-request', 'judgment-provider-ProviderJudgmentRequest', '1'),
    prepared: reference('seven-prepared', 'judgment-provider-ProviderJudgmentAttemptRecord', '2'),
    attempt: 'attempt:1', response: reference('seven-response', 'judgment-provider-ProviderJudgmentAttemptRecord', '3') },
  eight: { request: reference('eight-request', 'effect-provider-ProviderEffectRequest', '4'),
    executorObservation: reference('eight-executor', 'effect-provider-ProviderOperationObservation', '5'),
    responseObservation: reference('eight-response', 'effect-provider-ProviderOperationObservation', '6') },
  six: { operation: 'operation:1', consumedReservation: reference('six-consumed', 'transport-AdmissionReservation', '7'),
    dispatchClaim: reference('six-claim', 'transport-AdmissionReservation', '8') },
  submitted: { capture: { reference: 'capture:submitted', hash: hash('9') }, operationDigest: hash('a') },
  route: { provider: 'provider', model: 'model', route: 'route', routeBasis: 'installed route', floorDigest: hash('b'),
    evidence: ['evidence:question'], evidenceDigest: hash('c'), settingsDigest: hash('d'), outputSchemaDigest: hash('e') },
  response: { capture: { reference: 'capture:answer', hash: hash('f') }, answerDigest: hash('f'),
    parserReference: 'parser', parserVersion: '1', evidenceContractReference: 'response-contract', evidenceContractVersion: '1' },
  terminal: { evidence: 'evidence:terminal', capture: { reference: 'capture:terminal', hash: hash('0') },
    rawDigest: hash('1'), sourceEvidence: ['evidence:source'] },
};

it('P9-NF-65 decodes exact v2 output-use variants while retaining the v1 four-predicate interpretation', () => {
  const context = factsFixture().c;
  const legacy = value(decodeVerificationRecord('VerificationAssessment', verificationInput('VerificationAssessment'), context));
  expect(legacy.schemaVersion).toBe(1);
  expect(legacy.predicates.map(row => row.predicate)).toEqual(['occurrence', 'non-occurrence', 'quiescence', 'charge']);

  const base = verificationInput('VerificationPlan');
  const plan = { ...base, schemaVersion: 2, purpose: 'output-use', id: 'response-plan',
    bar: { ...base.bar, predicates: ['occurrence', 'non-occurrence', 'quiescence', 'charge',
      'response-authenticity', 'response-completeness'], subjectDigest: hash('2'), captureRequired: true },
    responseContract: { parserReference: 'parser', parserVersion: '1', evidenceContractReference: 'response-contract',
      evidenceContractVersion: '1', mode: 'single-final-reply' },
    responseRequirements: [
      { predicate: 'response-authenticity', sources: ['source-observer'], minimumStrength: 'observation', requiredContract: 'response-contract' },
      { predicate: 'response-completeness', sources: ['terminal-observer'], minimumStrength: 'observation', requiredContract: 'response-contract' },
    ] } as const;
  const decodedPlan = value(decodeVerificationRecord('VerificationPlan', plan, context));
  expect(decodedPlan).toMatchObject({ schemaVersion: 2, purpose: 'output-use' });

  const request = { ...verificationInput('VerificationRequest'), schemaVersion: 2, purpose: 'output-use', id: 'response-request',
    predicate: undefined, predicates: ['response-authenticity', 'response-completeness'], subject };
  delete (request as { predicate?: unknown }).predicate;
  const decodedRequest = value(decodeVerificationRecord('VerificationRequest', request, context));
  expect(verificationIdentity(decodedRequest).logicalKey).toContain('operation:1');
  refused(decodeVerificationRecord('VerificationRequest', { ...request, predicates: ['response-completeness'] }, context),
    'must ask both response predicates');
  refused(decodeVerificationRecord('VerificationRequest', { ...request, purpose: 'settlement' }, context),
    'type or schema version unknown');
});

it('P9-NF-64 P9-NF-66 keeps six assessment rows distinct and refuses copied or incomplete subjects', () => {
  const context = factsFixture().c;
  const base = verificationInput('VerificationAssessment');
  const rows = [...base.predicates.map(row => ({ ...row })),
    { predicate: 'response-authenticity', verdict: 'satisfied', reason: 'source', evidence: ['evidence:source'], decision: '' },
    { predicate: 'response-completeness', verdict: 'satisfied', reason: 'terminal', evidence: ['evidence:terminal'], decision: hash('3') }];
  const assessment = { ...base, schemaVersion: 2, purpose: 'output-use', id: 'response-assessment', subject,
    evidence: ['evidence:occurrence', 'evidence:source', 'evidence:terminal'], predicates: rows };
  expect(value(decodeVerificationRecord('VerificationAssessment', assessment, context)).predicates).toHaveLength(6);
  refused(decodeVerificationRecord('VerificationAssessment', { ...assessment,
    subject: { ...subject, terminal: { ...subject.terminal, rawDigest: 'copied-digest' } } }, context), 'malformed');
  refused(decodeVerificationRecord('VerificationAssessment', { ...assessment,
    predicates: rows.filter(row => row.predicate !== 'response-authenticity') }, context), 'both response predicates');
});

it('P9-NF-65 refuses external migration wrappers and preserves the exact closed v1 body', () => {
  const context = factsFixture().c, f = verificationRuntimeFixture();
  for (const name of ['VerificationPlan', 'VerificationRequest', 'VerificationAssessment'] as const) {
    const legacy = verificationInput(name);
    expect(value(decodeVerificationRecord(name, legacy, context))).toEqual(legacy);
    refused(decodeVerificationRecord(name, { ...legacy, extra: 'not-v1' }, context), 'undeclared field');
    const wrapper = { type: name, schemaVersion: 2, purpose: 'legacy-settlement', legacy, extra: 'not-owned-migration' };
    refused(decodeVerificationRecord(name, wrapper, context), 'external legacy migration wrapper refused');
    refused(authorAndAppend({ kind: `verification-${name}`, schemaVersion: 1, machine: f.host.machine,
      principal: json(f.host.principal), provenance: json(f.host.principal.provenance), at: json(f.host.current().clock),
      body: json({ record: wrapper }), required: [] }, f.context, f.store, privateKey));
  }
});

it('P9-NF-65 stores legacy and output-use bodies under the unchanged outer family schema', () => {
  const f = verificationRuntimeFixture(), legacy = verificationInput('VerificationPlan');
  value(f.runtime.record('VerificationPlan', legacy));
  const output = { ...legacy, schemaVersion: 2, purpose: 'output-use', id: 'output-plan',
    subject: { ...legacy.subject, scope: f.scope.kind === 'organization' ? 'project-a' : f.scope.members[0]!,
      generation: f.host.current().generation },
    bar: { ...legacy.bar, predicates: ['occurrence', 'non-occurrence', 'quiescence', 'charge',
      'response-authenticity', 'response-completeness'], captureRequired: true },
    responseContract: { parserReference: 'parser', parserVersion: '1', evidenceContractReference: 'contract',
      evidenceContractVersion: '1', mode: 'single-final-reply' },
    responseRequirements: [
      { predicate: 'response-authenticity', sources: ['source'], minimumStrength: 'observation', requiredContract: 'contract' },
      { predicate: 'response-completeness', sources: ['terminal'], minimumStrength: 'observation', requiredContract: 'contract' },
    ] } as const;
  value(f.runtime.record('VerificationPlan', output));
  const stored = value(f.store.read()).filter(fact => fact.kind === 'verification-VerificationPlan');
  expect(stored.map(fact => fact.schemaVersion)).toEqual([1, 1]);
  expect(stored.map(fact => (fact.body as unknown as { record: { schemaVersion: number } }).record.schemaVersion)).toEqual([1, 2]);
});

it('P9-NF-64 P9-NF-65 P9-NF-66 registers only the exact Nine, Seven, and Ten fixture/decoder pairs', () => {
  const root = mkdtempSync(join(tmpdir(), 'g6-owner-references-'));
  const manifests = ['register-source/owner-references/part-nine.json', 'register-source/owner-references/part-seven.json',
    'register-source/owner-references/part-ten.json'];
  const artifacts = ['src/verification/index.ts', 'src/verification/records.ts', 'src/judgment/index.ts',
    'src/judgment/provider-path.ts', 'src/assembly/index.ts', 'src/assembly/installation-selection.ts',
    'src/assembly/production-signer-reference.ts', 'tests/verification/provider-response-assessment.test.ts',
    'tests/rungraph/provider-answer-reply.test.ts', 'tests/e2e/fixed-installation-reply.test.ts',
    'tests/assembly/fixed-installation-contract.test.ts', 'tests/assembly/fixed-installation-bootstrap.test.ts'];
  try {
    for (const path of [...manifests, ...artifacts]) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      copyFileSync(path, join(root, path));
    }
    const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=Fixture',
      '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    git('init', '-q'); git('add', '.'); git('commit', '-qm', 'G6 owner references');
    const commit = git('rev-parse', 'HEAD');
    const files = git('ls-tree', '-r', '--name-only', commit).split('\n');
    const originals = Object.fromEntries(manifests.map(path => [path, JSON.parse(readFileSync(join(root, path), 'utf8'))]));
    const load = (changed: Record<string, unknown> = {}) => loadOwnerReferences(root, { commit, files,
      sources: Object.fromEntries(manifests.map(path => [path, JSON.stringify(changed[path] ?? originals[path])])) });
    const loaded = load();
    expect(loaded.catalog.fixtures.map(row => row.id).sort()).toEqual([
      'P10-SI-06', 'P10-SI-09', 'P10-SI-17', 'P10-SI-24', 'P10-SI-37', 'P9-NF-64', 'P9-NF-65', 'P9-NF-66']);
    expect(loaded.decoders.map(row => row.id).sort()).toEqual([
      'decodeCapturedProviderDecision', 'decodeHistoricalInstallationSelection', 'decodeHistoricalProductionSignerReference',
      'decodeHistoricalProviderAnswerAcceptance', 'decodeHistoricalVerificationRecord', 'decodeInstallationSelectionAtOrigin',
      'decodeProductionSignerReferenceAtOrigin', 'decodeProviderAnswerAcceptanceAtOrigin', 'decodeVerificationRecord',
      'decodeVerificationRecordAtOrigin']);
    expect(loaded.catalog.probes).toEqual([]);
    expect(loaded.documents).toEqual([]);

    const artifact = (path: string) => ({ path, hash: ownerHash(readFileSync(join(root, path), 'utf8')) });
    const nineWrong = structuredClone(originals[manifests[0]!] as any);
    nineWrong.fixtures[0].artifact = artifact('tests/rungraph/provider-answer-reply.test.ts');
    expect(() => load({ [manifests[0]!]: nineWrong })).toThrow('wrong-owner inspection artifact');
    const tenWrong37 = structuredClone(originals[manifests[2]!] as any);
    tenWrong37.fixtures.find((row: { id: string }) => row.id === 'P10-SI-37').artifact = artifact('tests/rungraph/provider-answer-reply.test.ts');
    expect(() => load({ [manifests[2]!]: tenWrong37 })).toThrow('wrong-owner inspection artifact');
    const tenWrong24 = structuredClone(originals[manifests[2]!] as any);
    tenWrong24.fixtures.find((row: { id: string }) => row.id === 'P10-SI-24').artifact = artifact('tests/e2e/fixed-installation-reply.test.ts');
    expect(() => load({ [manifests[2]!]: tenWrong24 })).toThrow('wrong-owner inspection artifact');
    const sevenFixture = structuredClone(originals[manifests[1]!] as any);
    sevenFixture.fixtures.push({ id: 'P9-NF-64', stage: 'build',
      artifact: artifact('tests/verification/provider-response-assessment.test.ts') });
    expect(() => load({ [manifests[1]!]: sevenFixture })).toThrow('unknown owner fixture/probe');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
