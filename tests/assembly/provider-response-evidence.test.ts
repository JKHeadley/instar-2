import { createHash } from 'node:crypto';
import { chmodSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import { createClaudeCodeProductionRoute } from '../../src/assembly/production-provider.js';
import { createConfinedProviderInvocation } from '../../src/assembly/index.js';
import { registerProviderResponseEvidenceBounds } from '../../src/assembly/provider-invocation.js';
import { createProviderEffectDoorway } from '../../src/effects/index.js';
import { hashBytes } from '../../src/facts/index.js';
import { factsFixture, value } from '../facts/fixtures.js';
import { providerFixture, enc, refused } from '../model-provider/fixture.js';
// @ts-expect-error Ten physical host is executable JavaScript outside the pure core.
import { productionProviderIO } from '../../scripts/production-boot-io.mjs';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function routeFor(body: string) {
  const f = factsFixture(), root = realpathSync(mkdtempSync(join(tmpdir(), 'provider-response-evidence-')));
  roots.push(root);
  const executable = join(root, 'provider.mjs'), bytes = `#!${process.execPath}\n${body}\n`;
  writeFileSync(executable, bytes); chmodSync(executable, 0o700);
  const route = value(createClaudeCodeProductionRoute({ provider: 'anthropic', model: 'model', route: 'route',
    disclosure: 'bounded test route', credential: value(decode('SecretRef', {
      type: 'SecretRef', schemaVersion: 1, vault: 'vault', name: 'credential' }, f.ctx.decode)),
    context: { ...f.ctx.decode, site: f.c.site, preserved: f.c.preserved }, resolve: () => 'secret', executable,
    artifact: `sha256:${createHash('sha256').update(bytes).digest('hex')}`, workingDirectory: root, io: productionProviderIO,
    adapterEvidenceContract: { reference: 'response-contract', version: '1', parserReference: 'claude-code-json-result',
      parserVersion: '1', endpoint: 'authenticated-provider-endpoint', account: 'authenticated-account',
      credentialReference: 'credential', controller: 'confined-custodian', sourceEvidence: ['evidence:source'],
      terminalEvidence: 'evidence:terminal', terminalReasonField: 'stop_reason',
      successfulFinalReplyReasons: ['end_turn'], strength: 'observation', maxMetadataBytes: 4096,
      maxRawTerminalBytes: 65536, maxCaptureBytes: 200000 } }));
  return { route, bounds: { operation: 'operation:1', deadline: 10000, timeout: 2000,
    maxOutputBytes: 4096, maxTokens: 128, maxCharge: 20, automaticRetries: 0 as const } };
}

it('P9-NF-64 P10-SI-37 preserves split non-ASCII stdout bytes and the exact raw digest before extraction', async () => {
  const terminal = JSON.stringify({ type: 'result', is_error: false, result: 'snowman ☃', session_id: 'session',
    stop_reason: 'end_turn', usage: { input_tokens: 2, output_tokens: 3 }, total_cost_usd: 0.000002 });
  const split = Buffer.from(terminal).indexOf(Buffer.from('☃')) + 1;
  const f = routeFor(`const bytes=Buffer.from(${JSON.stringify(Buffer.from(terminal).toString('base64'))},'base64');
    process.stdout.write(bytes.subarray(0,${split})); setTimeout(()=>process.stdout.write(bytes.subarray(${split})),5);`);
  const observed = await f.route.invoke('submitted', f.bounds);
  expect(observed).toMatchObject({ state: 'complete', bytes: 'snowman ☃', responseEvidenceDraft: {
    eligibility: 'admitted', terminal: { reason: 'successful-final-reply' } } });
  const draft = observed.responseEvidenceDraft!;
  expect(Buffer.from(draft.terminal.rawBase64, 'base64')).toEqual(Buffer.from(terminal));
  expect(draft.terminal.rawDigest).toBe(`sha256:${createHash('sha256').update(Buffer.from(terminal)).digest('hex')}`);
});

it('P9-NF-66 refuses invalid UTF-8 and extra terminal frames even when replacement text or the first frame looks parseable', async () => {
  const valid = JSON.stringify({ type: 'result', is_error: false, result: 'answer', session_id: 'session',
    stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 }, total_cost_usd: 0 });
  const invalid = routeFor(`const a=Buffer.from(${JSON.stringify(Buffer.from(valid).toString('base64'))},'base64');
    const at=a.indexOf(Buffer.from('answer')); process.stdout.write(Buffer.concat([a.subarray(0,at),Buffer.from([0xff]),a.subarray(at+1)]));`);
  expect(await invalid.route.invoke('submitted', invalid.bounds)).toMatchObject({ state: 'uncertain', bytes: null });
  const extra = routeFor(`process.stdout.write(${JSON.stringify(valid + valid)});`);
  expect(await extra.route.invoke('submitted', extra.bounds)).toMatchObject({ state: 'uncertain', bytes: null });
  const unsupported = routeFor(`process.stdout.write(${JSON.stringify(JSON.stringify({ type: 'result', is_error: false,
    result: 'answer', session_id: 'session', stop_reason: 'tool_use', usage: { input_tokens: 1, output_tokens: 1 },
    total_cost_usd: 0 }))});`);
  expect(await unsupported.route.invoke('submitted', unsupported.bounds)).toMatchObject({ state: 'complete',
    responseEvidenceDraft: { eligibility: 'held', terminal: { reason: 'unsupported-terminal-evidence', toolCall: true } } });
});

it('P10-SI-37 preserves the byte-identical legacy receipt when response evidence is not registered', async () => {
  const legacy = { state: 'complete' as const, bytes: 'legacy answer', providerOperation: 'legacy-call',
    usage: { inputTokens: 1, outputTokens: 2, charge: 3, source: 'legacy bounded observation' }, retryBlocked: false };
  const f = providerFixture({ route: { invoke: async () => legacy } });
  const { request } = f.prepare();
  value(await f.api.dispatch(request, f.fence));
  const response = f.all().find(fact => fact.kind === 'judgment-provider-ProviderJudgmentAttemptRecord'
    && (fact.body as unknown as { record: { phase: string } }).record.phase === 'response-observed')!;
  const receipt = (response.body as unknown as { record: { receipt: { reference: string } } }).record.receipt;
  const bytes = f.metadata[receipt.reference]!.bytes!;
  expect(bytes).toBe(enc(legacy).bytes);
  expect(JSON.parse(bytes)).not.toHaveProperty('responseEvidence');
});

it('P10-SI-37 checks one aggregate capture budget before dispatch', async () => {
  let calls = 0;
  const f = providerFixture({ route: { invoke: async () => { calls++; throw new Error('must not dispatch'); } } });
  const route = Object.freeze({ ...f.route }) as typeof f.route;
  registerProviderResponseEvidenceBounds(route, { parserReference: 'claude-code-json-result', parserVersion: '1',
    evidenceContractReference: 'response-contract', evidenceContractVersion: '1', mode: 'single-final-reply',
    maxMetadataBytes: 32768, maxRawTerminalBytes: 65536, maxCaptureBytes: 1_000_000 });
  const invocation = value(createConfinedProviderInvocation(route, f.six, f.th, f.captures, f.host.boundary, f.store));
  const api = createProviderEffectDoorway({ ...f.dependencies, invocation });
  const { request } = f.prepare();
  refused(await api.dispatch(request, f.fence), 'aggregate capture budget');
  expect(calls).toBe(0);
});

it('P10-SI-37 descriptor copying refuses array accessors without executing them', async () => {
  let getters = 0;
  const malicious: string[] = [];
  Object.defineProperty(malicious, '0', { enumerable: true, configurable: true,
    get: () => { getters++; return 'authority'; } });
  malicious.length = 1;
  const answer = '{}', raw = Buffer.from(JSON.stringify({ type: 'result', is_error: false, result: answer,
    session_id: 'call', stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 }, total_cost_usd: 0 }));
  const f = providerFixture({ route: { invoke: async (bytes) => ({ state: 'complete', bytes: answer,
    providerOperation: 'call', usage: { inputTokens: 1, outputTokens: 1, charge: 0, source: 'test' }, retryBlocked: false,
    responseEvidenceDraft: { eligibility: 'held', contract: { parserReference: 'claude-code-json-result', parserVersion: '1',
      evidenceContractReference: 'response-contract', evidenceContractVersion: '1', mode: 'single-final-reply',
      maxMetadataBytes: 5000, maxRawTerminalBytes: 2048, maxCaptureBytes: 65000 },
    basis: { sourceEvidence: malicious, terminalEvidence: 'terminal', terminalReasonField: 'stop_reason',
      successfulFinalReplyReasons: ['end_turn'] }, source: { controller: '', evidence: [], endpoint: '', account: '',
      credentialReference: '', executableArtifact: `sha256:${'1'.repeat(64)}`, provider: 'test-provider', model: 'model',
      route: 'route', call: 'call', submittedDigest: enc(bytes).hash, strength: 'observation' },
    terminal: { rawBase64: raw.toString('base64'), rawDigest: `sha256:${createHash('sha256').update(raw).digest('hex')}`,
      evidence: 'terminal', reason: 'unsupported-terminal-evidence', providerReason: 'end_turn', limited: false,
      errored: false, cancelled: false, timedOut: false, truncated: false, toolCall: false },
    answer: { extractionContract: 'claude-code-json-result:1', answerDigest: hashBytes(answer) } } }) } });
  const route = Object.freeze({ ...f.route }) as typeof f.route;
  registerProviderResponseEvidenceBounds(route, { parserReference: 'claude-code-json-result', parserVersion: '1',
    evidenceContractReference: 'response-contract', evidenceContractVersion: '1', mode: 'single-final-reply',
    maxMetadataBytes: 5000, maxRawTerminalBytes: 2048, maxCaptureBytes: 65000 });
  const invocation = value(createConfinedProviderInvocation(route, f.six, f.th, f.captures, f.host.boundary, f.store));
  const api = createProviderEffectDoorway({ ...f.dependencies, invocation });
  const { request } = f.prepare();
  value(await api.dispatch(request, f.fence));
  expect(getters).toBe(0);
  const response = f.all().find(fact => fact.kind === 'judgment-provider-ProviderJudgmentAttemptRecord'
    && (fact.body as unknown as { record: { phase: string } }).record.phase === 'response-observed')!;
  const receipt = (response.body as unknown as { record: { receipt: { reference: string } } }).record.receipt;
  expect(JSON.parse(f.metadata[receipt.reference]!.bytes!).state).toBe('uncertain');
});
