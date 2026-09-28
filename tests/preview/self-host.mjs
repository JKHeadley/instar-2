#!/usr/bin/env node
// Rules 2 and 115 (D14 §9): the native harness develops, tests, packages, installs and exercises a
// local capability unattended, through the same public ports every harness has: reasoning through a
// registered model doorway, tools only as admitted proposals, packaging through the core stager.
// This file owns process, clock and filesystem; nothing here widens a grant or runs a shell.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hashBytes } from '../../src/facts/index.js';
import { DEVELOPMENT_TOOLS, admitToolProposal, stageLocalCapability } from '../../src/assembly/index.js';
import { redact } from '../../src/recall/redact.js';
import { durablePreviewWrite } from './durable-write.js';

export const SELF_HOST_LIMITS = Object.freeze({ rounds: 3, files: 20, fileBytes: 65536, tools: 8, outputBytes: 4096, toolTimeoutMs: 600000 });
const SAFE_FILE = /^(?!-)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_][A-Za-z0-9_./-]*\.(?:mjs|js|json|md)$/u;
const NAMESPACE = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const take = result => { if (result.kind !== 'Success') throw Error(`self-host: refused ${result.detail ?? ''}`); return result.value; };
const tail = text => redact(String(text ?? '')).text.slice(-SELF_HOST_LIMITS.outputBytes);

/** The request the harness sends its doorway: the task, the admitted tool inventory and the plan shape. */
export function selfHostPrompt(task, feedback) {
  return JSON.stringify({ task, feedback: feedback ?? null,
    tools: DEVELOPMENT_TOOLS.map(tool => ({ id: tool.id, phase: tool.phase, grants: tool.grants,
      params: tool.params ? { pattern: tool.params.pattern.source, max: tool.params.max } : null })),
    plan: 'Return only JSON {"files":[{"path":string,"content":string}],"tools":[{"operation":string,"params":[string]}],'
      + '"package":{"namespace":string,"version":string,"entrypoints":[{"id":string,"path":string}],'
      + '"probe":{"entrypoint":string,"export":string,"input":any,"expect":any}}}. Paths are relative to the package directory; '
      + 'include a node:test file and the package-test tool to run it. Use only listed tools.' });
}

/** Admitted process tools run with a fixed argv, no shell, a scrubbed environment and bounded output. */
export function runAdmittedTool(admitted, cwd, env = process.env) {
  if (admitted.run.kind !== 'process') throw Error('self-host: port tools run through their port');
  const [command, ...args] = admitted.run.argv;
  const result = spawnSync(command, args, { cwd, shell: false, encoding: 'utf8', timeout: SELF_HOST_LIMITS.toolTimeoutMs,
    maxBuffer: 16 * 1024 * 1024, env: { PATH: env.PATH ?? '', HOME: env.HOME ?? '', LANG: 'C.UTF-8', NO_COLOR: '1' } });
  return { tool: admitted.tool, code: result.status, signal: result.signal ?? null, output: tail(`${result.stdout ?? ''}${result.stderr ?? ''}`) };
}

/** Intent first, then content-addressed files, then the active pointer: a crash at any point recovers. */
export function installLocalCapability(installRoot, staged, now, crashAfterIntent = false) {
  const ns = staged.package.namespace, version = staged.package.version;
  const target = join(installRoot, 'packages', `${ns}@${version}`), intentPath = join(installRoot, `.intent-${ns}.json`);
  durablePreviewWrite(intentPath, { v: 1, namespace: ns, version, contentDigest: staged.package.contentDigest,
    entries: staged.entries.map(entry => ({ path: entry.path, digest: entry.digest, bytes: entry.bytes })), at: now });
  if (crashAfterIntent) throw Error('self-host: simulated crash after install intent');
  return completeInstall(installRoot, ns, now) ?? target;
}
/** Finishes (or re-verifies) an install from its durable intent; idempotent. Returns the package directory. */
export function completeInstall(installRoot, namespace, now) {
  const intentPath = join(installRoot, `.intent-${namespace}.json`);
  if (!existsSync(intentPath)) return null;
  const intent = JSON.parse(readFileSync(intentPath, 'utf8'));
  const target = join(installRoot, 'packages', `${intent.namespace}@${intent.version}`);
  for (const entry of intent.entries) {
    if (hashBytes(entry.bytes) !== entry.digest) throw Error('self-host: install intent changed');
    const path = join(target, entry.path); mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    if (!existsSync(path) || hashBytes(readFileSync(path, 'utf8')) !== entry.digest) writeFileSync(path, entry.bytes, { mode: 0o600 });
  }
  durablePreviewWrite(join(installRoot, 'active', `${intent.namespace}.json`), { v: 1, version: intent.version,
    contentDigest: intent.contentDigest, directory: target, activatedAt: now });
  rmSync(intentPath);
  return target;
}
/** Recovers every interrupted install under a root (run before any new work). */
export function recoverInstalls(installRoot, now) {
  if (!existsSync(installRoot)) return [];
  return readdirSync(installRoot).filter(name => /^\.intent-.+\.json$/u.test(name))
    .map(name => completeInstall(installRoot, name.slice(8, -5), now));
}

const record = (log, row) => writeFileSync(log, `${JSON.stringify(row)}\n`, { flag: 'a', mode: 0o600 });

/**
 * One bounded, unattended self-hosting run. `propose(prompt)` is the harness's reasoning through its
 * model doorway. Everything it proposes is admitted before use; the run ends at a passing
 * installed probe, a refusal, or the round limit, and every step is an observation in the log.
 */
export async function selfHost({ task, propose, repo, scope, installRoot, grants, context, now = () => Date.now(),
  crashAfterIntent = false }) {
  for (const path of [repo, scope, installRoot]) if (!isAbsolute(path)) throw Error('self-host: absolute paths required');
  mkdirSync(scope, { recursive: true, mode: 0o700 }); mkdirSync(installRoot, { recursive: true, mode: 0o700 });
  const log = join(installRoot, 'self-host.jsonl');
  recoverInstalls(installRoot, now());
  let feedback = null;
  for (let round = 1; round <= SELF_HOST_LIMITS.rounds; round++) {
    const plan = JSON.parse(await propose(selfHostPrompt(task, feedback)));
    const files = Array.isArray(plan?.files) ? plan.files : [];
    if (files.length === 0 || files.length > SELF_HOST_LIMITS.files) throw Error('self-host: plan has no bounded file set');
    for (const file of files) {
      if (typeof file?.path !== 'string' || !SAFE_FILE.test(file.path) || typeof file.content !== 'string'
        || Buffer.byteLength(file.content) > SELF_HOST_LIMITS.fileBytes) throw Error('self-host: file outside the package scope');
      const path = resolve(scope, file.path);
      if (relative(realpathSync(scope), resolve(realpathSync(scope), file.path)).startsWith('..')) throw Error('self-host: file escapes scope');
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 }); writeFileSync(path, file.content, { mode: 0o600 });
    }
    record(log, { phase: 'written', round, files: files.map(file => file.path), at: now() });
    const tools = Array.isArray(plan.tools) ? plan.tools.slice(0, SELF_HOST_LIMITS.tools) : [];
    const results = [];
    for (const proposal of tools) {
      const admitted = admitToolProposal(proposal, grants, context);
      if (admitted.kind !== 'Success') { results.push({ tool: proposal?.operation ?? null, refused: admitted.detail }); continue; }
      results.push(runAdmittedTool(admitted.value, admitted.value.tool === 'package-test' ? scope : repo));
    }
    record(log, { phase: 'tools', round, results: results.map(item => ({ tool: item.tool, code: item.code ?? null,
      refused: item.refused ?? null })), at: now() });
    const tested = results.some(item => item.tool === 'package-test');
    // A refused proposal is reported back but runs nothing; the round passes only on its own tests.
    const failed = results.filter(item => !item.refused && item.code !== 0), refused = results.filter(item => item.refused);
    if (!tested || failed.length) { feedback = { round, tested, failed, refused }; continue; }
    const pkg = plan.package;
    if (!pkg || !NAMESPACE.test(pkg.namespace ?? '') || typeof pkg.version !== 'string' || !Array.isArray(pkg.entrypoints))
      throw Error('self-host: package declaration malformed');
    const archive = pkg.entrypoints.map(entry => { const bytes = readFileSync(resolve(scope, entry.path), 'utf8');
      return { path: entry.path, bytes, digest: hashBytes(bytes), kind: 'file' }; });
    const contentDigest = hashBytes(JSON.stringify(archive.map(entry => [entry.path, entry.digest])));
    const staged = take(stageLocalCapability({ type: 'LocalCapabilityPackage', schemaVersion: 1, id: `package:${pkg.namespace}@${pkg.version}`,
      predecessors: [], dependencyFacts: [], namespace: pkg.namespace, ownerPrincipal: 'agent', version: pkg.version,
      contentDigest, sourceDigest: contentDigest, parent: '', upstream: '', priorPackage: '',
      portRequirements: [{ port: 'OperationAdapterPort', version: '1' }], dependencies: [],
      entrypoints: archive.map((entry, index) => ({ id: pkg.entrypoints[index].id, path: entry.path, digest: entry.digest })),
      declarationIds: [`${pkg.namespace}.operation`], dataScopes: ['workspace'], custodyScopes: [], grants: ['local-install'],
      resources: [{ resource: 'cpu-ms', limit: 1000 }], platforms: [process.platform], modes: ['governed'],
      migrationCompatibility: ['none'], rollbackCompatibility: [pkg.version],
      checks: { unit: results.filter(item => item.tool === 'package-test').map(() => 'package-test'), integration: ['self-host-probe'], lifecycle: ['install-recovery'] },
      maturation: ['dark'], probes: [`probe:${pkg.namespace}`], awarenessSource: `${pkg.namespace}.operation` }, archive, [], context));
    record(log, { phase: 'staged', round, namespace: pkg.namespace, contentDigest, at: now() });
    if (!grants.includes('local-install')) throw Error('self-host: local-install grant absent');
    const directory = installLocalCapability(installRoot, staged, now(), crashAfterIntent);
    record(log, { phase: 'installed', round, namespace: pkg.namespace, directory, at: now() });
    const entry = pkg.entrypoints.find(item => item.id === pkg.probe?.entrypoint);
    if (!entry) throw Error('self-host: probe names no entrypoint');
    const module = await import(`${pathToFileURL(join(directory, entry.path)).href}?digest=${contentDigest}`);
    const actual = await module[pkg.probe.export](pkg.probe.input);
    const passed = JSON.stringify(actual) === JSON.stringify(pkg.probe.expect);
    record(log, { phase: 'exercised', round, namespace: pkg.namespace, passed, at: now() });
    return { namespace: pkg.namespace, version: pkg.version, contentDigest, directory, rounds: round, passed, tools: results };
  }
  record(log, { phase: 'exhausted', rounds: SELF_HOST_LIMITS.rounds, at: now() });
  return { passed: false, rounds: SELF_HOST_LIMITS.rounds, feedback };
}

const main = async () => {
  const [command, ...rest] = process.argv.slice(2), options = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (!rest[i]?.startsWith('--') || rest[i + 1] === undefined) throw Error('self-host: malformed arguments');
    options[rest[i].slice(2)] = rest[i + 1];
  }
  if (command !== 'run') throw Error('self-host: usage run --task <text> --root <dir> --activation-record <file> --login-profile <file> --model <id> [--doorway <id>]');
  const { DEFAULT_SUBSCRIPTION_DOORWAY, subscriptionConversationPolicy, subscriptionDoorway, SUBSCRIPTION_CONVERSATION_FRAMING,
    validateSubscriptionActivation } = await import('../../src/assembly/production-provider.js');
  const { createSubscriptionProviderIO } = await import('../../scripts/production-boot-io.mjs');
  const { prepareJournalEnvelope } = await import('./journal-envelope.js');
  const root = resolve(options.root), model = options.model;
  const activation = JSON.parse(readFileSync(options['activation-record'], 'utf8'));
  const profile = JSON.parse(readFileSync(options['login-profile'], 'utf8'));
  validateSubscriptionActivation(activation, profile, model, Date.now(), SUBSCRIPTION_CONVERSATION_FRAMING);
  const doorway = subscriptionDoorway(options.doorway ?? DEFAULT_SUBSCRIPTION_DOORWAY), policy = subscriptionConversationPolicy(model);
  const context = { site: 'preview.journal', preserved: 'preview:self-host', register: {
    generation: { owner: 'part-three', name: 'RegisterGeneration', id: 'preview:register' },
    entries: ['preview.journal', 'preview', 'host'], producers: ['host'], methods: [], actions: {}, subjects: {},
    sites: { 'preview.journal': 'closed', 'types.decode': 'closed' }, keys: {}, allowRedelegation: false,
    conflictStanding: { ordinary: 'delegate', authority: 'operator' } }, captures: {} };
  let calls = 0;
  const route = take(doorway.create({ context, credential: { type: 'SecretRef', schemaVersion: 1, vault: 'preview', name: profile.reference },
    profile, resolveProfile: () => profile, provider: 'anthropic', model, route: 'preview-subscription',
    disclosure: 'Self-hosting run; charge UNKNOWN', activation, framing: SUBSCRIPTION_CONVERSATION_FRAMING,
    io: createSubscriptionProviderIO({ repository: process.cwd(), stopped: () => false }), now: () => Date.now(), active: () => true,
    adapterEvidenceContract: { reference: activation.reference, version: activation.profileDigest, ...doorway.contract,
      successfulFinalReplyReasons: [...doorway.contract.successfulFinalReplyReasons], endpoint: profile.loginProfileIdentity,
      account: profile.expectedAccount, credentialReference: profile.reference, controller: 'preview-self-host',
      sourceEvidence: [activation.reference], terminalEvidence: activation.reference, strength: 'attestation',
      maxMetadataBytes: policy.maxMetadataBytes, maxRawTerminalBytes: policy.maxRawTerminalBytes, maxCaptureBytes: policy.maxCaptureBytes } }));
  const propose = async prompt => {
    if (++calls > SELF_HOST_LIMITS.rounds) throw Error('self-host: call bound reached');
    const prepared = prepareJournalEnvelope({ question: 'Plan the requested local capability as JSON only, inside your answer string.',
      context: JSON.stringify({ request: JSON.parse(prompt) }), id: `self-host:${calls}` }, model, activation.trial ?? 'self-host', Date.now());
    const result = await route.invoke(prepared, { operation: `self-host:${calls}`, deadline: Date.now() + 180000, timeout: policy.timeout,
      maxOutputBytes: policy.maxOutputBytes, maxTokens: policy.maxTokens, maxCharge: 0, automaticRetries: 0 });
    if (result.state !== 'complete' || !result.bytes) throw Error(`self-host: model ${result.state}`);
    const value = JSON.parse(result.bytes)?.conclusion?.value;
    if (typeof value !== 'string') throw Error('self-host: model returned no plan');
    return value.trim().replace(/^```(?:json)?\s*|\s*```$/gu, '');
  };
  const report = await selfHost({ task: options.task, propose, repo: process.cwd(), scope: join(root, 'scope'),
    installRoot: join(root, 'install'), grants: ['local-install'], context });
  process.stdout.write(`${JSON.stringify({ ...report, tools: report.tools?.map(item => ({ tool: item.tool, code: item.code ?? null })), calls })}\n`);
  if (!report.passed) process.exitCode = 1;
};
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  try { await main(); } catch (error) { process.stderr.write(`self-host refused: ${redact(String(error?.message ?? error)).text}\n`); process.exitCode = 1; }
}
