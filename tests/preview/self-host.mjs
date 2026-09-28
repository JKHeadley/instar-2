#!/usr/bin/env node
// Rules 2 and 115 (D14 §9): the native harness develops, tests, packages, installs and exercises a
// local capability unattended, through the public ports every harness has: reasoning through a
// registered model doorway (each attempt durably recorded before it is made), tools only as
// admitted proposals dispatched through one interface, execution through the native adapter and
// Eight's confinement, packaging and activation on the owners' package records.
// This file owns process, clock and filesystem; nothing here widens a grant or runs a shell.
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { hashBytes } from '../../src/facts/index.js';
import { DEVELOPMENT_TOOLS } from '../../src/assembly/index.js';
import { redact } from '../../src/recall/redact.js';
import { appendDurable, createSelfHostHarness, dispatchTool, latchStop, openRecordLog, readDurable, stoppedAt } from './self-host-harness.mjs';
import { createPackageLifecycle } from './self-host-packages.mjs';

export const SELF_HOST_LIMITS = Object.freeze({ rounds: 3, attempts: 3, files: 20, fileBytes: 65536, tools: 8 });
const SAFE_FILE = /^(?!-)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_][A-Za-z0-9_./-]*\.(?:mjs|js|json|md)$/u;
const NAMESPACE = /^agent\.[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;

/** The request the harness sends its doorway: the task, the admitted tool inventory and the plan shape. */
export function selfHostPrompt(task, feedback) {
  return JSON.stringify({ task, feedback: feedback ?? null,
    tools: DEVELOPMENT_TOOLS.map(tool => ({ id: tool.id, phase: tool.phase, grants: tool.grants,
      params: tool.params ? { pattern: tool.params.pattern.source, max: tool.params.max } : null,
      options: tool.options?.map(item => ({ name: item.name, kind: item.kind, required: item.required })) ?? null,
      subcommands: tool.subcommands ? Object.fromEntries(Object.entries(tool.subcommands).map(([name, items]) =>
        [name, items.map(item => ({ name: item.name, kind: item.kind, required: item.required }))])) : null })),
    plan: 'Return only JSON {"files":[{"path":string,"content":string}],"tools":[{"operation":string,"params":[string],"options"?:{},"subcommand"?:string}],'
      + '"package":{"namespace":"agent.<name>","version":"1.0.0","entrypoints":[{"id":string,"path":string}],'
      + '"probe":{"entrypoint":string,"export":string,"input":any,"expect":any}}}. Paths are relative to the package directory; '
      + 'include a node:test file and the package-test tool to run it. Code runs confined: no writes, no network, no child processes, no environment. '
      + 'Use only listed tools; the harness stages and installs after the package tests pass.' });
}

/**
 * The durable provider-attempt ledger: an attempt is recorded before it is made and counted
 * forever, so a restart never resets the allowance; a started attempt without a settled row is
 * an UNKNOWN charged attempt.
 */
export function attemptLedger(root, allowance = SELF_HOST_LIMITS.attempts) {
  const path = join(root, 'attempts.jsonl');
  const rows = key => readDurable(path).filter(row => row.task === key);
  return Object.freeze({
    used: key => rows(key).filter(row => row.state === 'started').length,
    unknown: key => { const all = rows(key); return all.filter(row => row.state === 'started' && !all.some(other => other.state === 'settled' && other.operation === row.operation)).length; },
    begin(key, at) {
      const used = rows(key).filter(row => row.state === 'started').length;
      if (used >= allowance) throw Error(`self-host: provider attempt allowance exhausted (${used} of ${allowance} recorded)`);
      const operation = `self-host:${key.slice(7, 19)}:${used + 1}`;
      appendDurable(path, { task: key, operation, state: 'started', at }); return operation;
    },
    settle(key, operation, outcome, at) { appendDurable(path, { task: key, operation, state: 'settled', outcome, at }); },
  });
}

const parsePlan = text => {
  let plan; try { plan = JSON.parse(text); } catch { throw Error('self-host: plan is not one JSON object'); }
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) throw Error('self-host: plan is not one JSON object');
  const files = Array.isArray(plan.files) ? plan.files : [];
  if (files.length === 0 || files.length > SELF_HOST_LIMITS.files) throw Error('self-host: plan has no bounded file set');
  for (const file of files) if (typeof file?.path !== 'string' || !SAFE_FILE.test(file.path) || typeof file.content !== 'string'
    || Buffer.byteLength(file.content) > SELF_HOST_LIMITS.fileBytes) throw Error('self-host: file outside the package scope');
  return plan;
};

/**
 * One bounded, unattended self-hosting run. `propose(prompt, { operation })` is the harness's
 * reasoning through its model doorway under the durable attempt id. Generated files are written
 * as data only; they execute only inside the native adapter's confined driver. The run ends at an
 * installed, exercised package, a refusal, the stop latch, the attempt allowance or the round limit.
 */
export async function selfHost({ task, propose, repo, root, grants, context, scopes, resolveCredential, now = () => Date.now(),
  wallMs, crashAfterActivating = false, allowance }) {
  for (const path of [repo, root]) if (!isAbsolute(path)) throw Error('self-host: absolute paths required');
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const scope = join(root, 'scope'); mkdirSync(scope, { recursive: true, mode: 0o700 });
  const stopped = stoppedAt(root), log = openRecordLog(root, context), key = hashBytes(task), work = `work:${key.slice(7, 19)}`;
  const phases = join(root, 'self-host.jsonl'), record = row => appendDurable(phases, { ...row, at: now() });
  const harness = createSelfHostHarness({ root, context, stopped, now, log, resolveCredential, wallMs });
  const lifecycle = createPackageLifecycle({ context, log, harness, stopped, work });
  const ledger = attemptLedger(root, allowance);
  const recovered = lifecycle.recover();
  if (recovered.length) record({ phase: 'recovered', outcomes: recovered });
  let feedback = null;
  for (let round = 1; round <= SELF_HOST_LIMITS.rounds; round++) {
    if (stopped()) { record({ phase: 'stopped', round }); return { passed: false, stopped: true, rounds: round - 1, recovered }; }
    const operation = ledger.begin(key, now());
    let reply;
    try { reply = await propose(selfHostPrompt(task, feedback), { operation, stopped }); ledger.settle(key, operation, 'answered', now()); }
    catch (error) { ledger.settle(key, operation, 'failed-charge-unknown', now()); throw error; }
    const plan = parsePlan(reply);
    const real = realpathSync(scope);
    for (const file of plan.files) {
      const path = resolve(real, file.path);
      if (relative(real, path).startsWith('..')) throw Error('self-host: file escapes scope');
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 }); writeFileSync(path, file.content, { mode: 0o600 });
    }
    record({ phase: 'written', round, files: plan.files.map(file => file.path) });
    const declaration = plan.package, tests = new Set();
    const bound = options => {
      if (!declaration || !NAMESPACE.test(declaration.namespace ?? '') || typeof declaration.version !== 'string' || !Array.isArray(declaration.entrypoints))
        throw Error('self-host: package declaration malformed');
      if (options.namespace !== declaration.namespace || options.version !== declaration.version) throw Error('self-host: tool names another package');
      const archive = declaration.entrypoints.map(entry => { if (!SAFE_FILE.test(entry?.path ?? '')) throw Error('self-host: entrypoint outside the package scope');
        const bytes = readFileSync(join(real, entry.path), 'utf8'); return { path: entry.path, bytes, digest: hashBytes(bytes), kind: 'file' }; });
      const testFiles = [...tests].map(path => { const bytes = readFileSync(join(real, path), 'utf8'); return { path, bytes, digest: hashBytes(bytes) }; });
      return lifecycle.stage(declaration, archive, testFiles);
    };
    const ports = {
      'stage-package': options => { const staged = bound(options); return { contentDigest: staged.package.contentDigest, output: `staged ${staged.package.id}` }; },
      'install-package': options => { const outcome = lifecycle.install(bound(options), { crashAfterActivating });
        return { code: outcome.passed ? 0 : 1, passed: outcome.passed, contentDigest: outcome.active, inhibited: outcome.inhibited ?? null,
          output: outcome.passed ? 'installed and active' : `inhibited: ${outcome.evidence.probed?.output ?? ''} ${outcome.evidence.tested?.output ?? ''}` }; },
    };
    const results = [], call = proposal => {
      if (proposal?.operation === 'package-test' && Array.isArray(proposal.params)) for (const path of proposal.params) if (typeof path === 'string') tests.add(path);
      return dispatchTool({ proposal, grants, context, scopes: scopes ?? { roots: [root] }, harness, repo, scope: real, ports, work });
    };
    for (const proposal of Array.isArray(plan.tools) ? plan.tools.slice(0, SELF_HOST_LIMITS.tools) : []) {
      await yieldTurn();
      if (stopped()) break;
      results.push(call(proposal));
    }
    record({ phase: 'tools', round, results: results.map(item => ({ tool: item.tool, code: item.code ?? null, refused: item.refused ?? null,
      observation: item.observation ?? null })) });
    const tested = results.some(item => item.tool === 'package-test' && !item.refused);
    const failed = results.filter(item => !item.refused && item.code !== 0), refused = results.filter(item => item.refused);
    if (!tested || failed.length) { feedback = { round, tested, failed: failed.map(summary), refused: refused.map(summary) }; continue; }
    if (stopped()) { record({ phase: 'stopped', round }); return { passed: false, stopped: true, rounds: round, tools: results, recovered }; }
    const options = { namespace: declaration?.namespace, version: declaration?.version };
    let install = results.find(item => item.tool === 'install-package' && item.passed);
    if (!install) {
      await yieldTurn();
      const staged = call({ operation: 'stage-package', params: [], options });
      results.push(staged);
      if (staged.code !== 0) { feedback = { round, tested, failed: [summary(staged)], refused: [] }; continue; }
      await yieldTurn();
      install = call({ operation: 'install-package', params: [], options });
      results.push(install);
    }
    record({ phase: 'installed', round, namespace: options.namespace, passed: !!install.passed, refused: install.refused ?? null,
      active: lifecycle.active(options.namespace)?.contentDigest ?? null });
    if (!install.passed) { feedback = { round, tested, failed: [summary(install)], refused: [] }; continue; }
    return { namespace: options.namespace, version: options.version, contentDigest: install.contentDigest, passed: true, rounds: round, tools: results, recovered };
  }
  record({ phase: 'exhausted', rounds: SELF_HOST_LIMITS.rounds });
  return { passed: false, rounds: SELF_HOST_LIMITS.rounds, feedback, recovered };
}
/** Each confined run is a bounded synchronous child; the loop yields between them so its host stays responsive. */
const yieldTurn = () => new Promise(done => setImmediate(done));
const summary = item => ({ tool: item.tool, code: item.code ?? null, refused: item.refused ?? null, timedOut: item.timedOut ?? false, output: item.output ?? '' });

/**
 * Reasoning through a registered doorway: the route is created with the real stop latch as its
 * active predicate, and every invocation carries the durable attempt id as its operation.
 */
export function doorwayProposer({ doorwayId, io, profile, activation, model, context, stopped, now = () => Date.now(), provider = 'anthropic',
  prepare, deadlineMs = 180000 }) {
  return import('../../src/assembly/production-provider.js').then(({ DEFAULT_SUBSCRIPTION_DOORWAY, subscriptionConversationPolicy, subscriptionDoorway,
    SUBSCRIPTION_CONVERSATION_FRAMING }) => {
    const doorway = subscriptionDoorway(doorwayId ?? DEFAULT_SUBSCRIPTION_DOORWAY), policy = subscriptionConversationPolicy(model);
    const created = doorway.create({ context, credential: { type: 'SecretRef', schemaVersion: 1, vault: 'preview', name: profile.reference },
      profile, resolveProfile: () => profile, provider, model, route: 'preview-subscription',
      disclosure: 'Self-hosting run; charge UNKNOWN', activation, framing: SUBSCRIPTION_CONVERSATION_FRAMING, io, now, active: () => !stopped(),
      adapterEvidenceContract: { reference: activation.reference, version: activation.profileDigest, ...doorway.contract,
        successfulFinalReplyReasons: [...doorway.contract.successfulFinalReplyReasons], endpoint: profile.loginProfileIdentity,
        account: profile.expectedAccount, credentialReference: profile.reference, controller: 'preview-self-host',
        sourceEvidence: [activation.reference], terminalEvidence: activation.reference, strength: 'attestation',
        maxMetadataBytes: policy.maxMetadataBytes, maxRawTerminalBytes: policy.maxRawTerminalBytes, maxCaptureBytes: policy.maxCaptureBytes } });
    if (created.kind !== 'Success') throw Error(`self-host: doorway refused ${created.detail ?? ''}`);
    const route = created.value;
    return async (prompt, { operation }) => {
      if (stopped()) throw Error('self-host: stop latched before the provider attempt');
      const prepared = prepare({ question: 'Plan the requested local capability as JSON only, inside your answer string.',
        context: JSON.stringify({ request: JSON.parse(prompt) }), id: operation }, model, activation.trial ?? 'self-host', now());
      const result = await route.invoke(prepared, { operation, deadline: now() + deadlineMs, timeout: policy.timeout,
        maxOutputBytes: policy.maxOutputBytes, maxTokens: policy.maxTokens, maxCharge: 0, automaticRetries: 0 });
      if (result.state !== 'complete' || !result.bytes) throw Error(`self-host: model ${result.state}`);
      const value = JSON.parse(result.bytes)?.conclusion?.value;
      if (typeof value !== 'string') throw Error('self-host: model returned no plan');
      return value.trim().replace(/^```(?:json)?\s*|\s*```$/gu, '');
    };
  });
}

export const SELF_HOST_CONTEXT = Object.freeze({ site: 'preview.journal', preserved: 'preview:self-host', register: {
  generation: { owner: 'part-three', name: 'RegisterGeneration', id: 'preview:register' },
  entries: ['preview.journal', 'preview', 'host'], producers: ['host'], methods: [], actions: {}, subjects: {},
  sites: { 'preview.journal': 'closed', 'types.decode': 'closed' }, keys: {}, allowRedelegation: false,
  conflictStanding: { ordinary: 'delegate', authority: 'operator' } }, captures: {} });
const GRANTS = new Set(['local-install', 'operator-storage-key']);
/** The owner's credential resolution: only the named reference, only from the operator-supplied environment. */
const operatorCredential = reference => reference === 'preview-storage-key' && process.env.INSTAR_SECRET_PREVIEW_STORAGE_KEY
  ? { env: 'INSTAR_SECRET_PREVIEW_STORAGE_KEY', value: process.env.INSTAR_SECRET_PREVIEW_STORAGE_KEY } : null;

const main = async () => {
  const [command, ...rest] = process.argv.slice(2), options = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (!rest[i]?.startsWith('--') || rest[i + 1] === undefined) throw Error('self-host: malformed arguments');
    options[rest[i].slice(2)] = rest[i + 1];
  }
  const usage = 'self-host: usage run --task <text> --root <dir> --activation-record <file> --login-profile <file> --model <id> [--doorway <id>] '
    + '[--grants local-install,operator-storage-key] [--scope-roots <abs>:<abs>] | stop --root <dir>';
  if (!['run', 'stop'].includes(command) || !options.root) throw Error(usage);
  const root = resolve(options.root);
  if (command === 'stop') { latchStop(root, Date.now()); return; }
  const grants = (options.grants ?? 'local-install').split(',');
  if (grants.some(grant => !GRANTS.has(grant))) throw Error('self-host: unknown grant');
  const scopeRoots = (options['scope-roots'] ?? root).split(':').map(path => resolve(path));
  const model = options.model, stopped = stoppedAt(root);
  const { validateSubscriptionActivation, SUBSCRIPTION_CONVERSATION_FRAMING } = await import('../../src/assembly/production-provider.js');
  const { createSubscriptionProviderIO } = await import('../../scripts/production-boot-io.mjs');
  const { prepareJournalEnvelope } = await import('./journal-envelope.js');
  const activation = JSON.parse(readFileSync(options['activation-record'], 'utf8'));
  const profile = JSON.parse(readFileSync(options['login-profile'], 'utf8'));
  validateSubscriptionActivation(activation, profile, model, Date.now(), SUBSCRIPTION_CONVERSATION_FRAMING);
  const propose = await doorwayProposer({ doorwayId: options.doorway, io: createSubscriptionProviderIO({ repository: process.cwd(), stopped }),
    profile, activation, model, context: SELF_HOST_CONTEXT, stopped, prepare: prepareJournalEnvelope });
  const report = await selfHost({ task: options.task, propose, repo: process.cwd(), root, grants, context: SELF_HOST_CONTEXT,
    scopes: { roots: scopeRoots }, resolveCredential: operatorCredential });
  process.stdout.write(`${JSON.stringify({ ...report, tools: report.tools?.map(item => ({ tool: item.tool, code: item.code ?? null,
    refused: item.refused ?? null, observation: item.observation ?? null })) })}\n`);
  if (!report.passed) process.exitCode = 1;
};
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  try { await main(); } catch (error) { process.stderr.write(`self-host refused: ${redact(String(error?.message ?? error)).text}\n`); process.exitCode = 1; }
}
