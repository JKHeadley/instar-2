import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { decodeMeasurement, canonical, schemas } from '../dist/index.js';
import { generateRegister, generationOf, renderRegister, invariantCoverage, implementedInvariants, decodeCheckRun,
  decodeGeneration, loadRegister, decodeExtract, generateAgainstParent, runRegisterChecks, planLandingCompletion } from '../dist/register/index.js';
import { bootstrapDeclarations, bindColocatedDeclarations, buildContext, readCommit, trailingInputs, value, bytes, isDeclarationSource, isActionSource, actionRegistry } from './register-source.mjs';
import { checkWiring, scanSources } from './check-register-wiring.mjs';
import { capabilityBriefing, checkShipped } from './register-shipped.mjs';
import { loadOwnerReferences, mergeOwnerReferences } from './register-owner-references.mjs';
import { ownerDocuments } from '../dist/register/owner-contracts.js';

const hash = input => value(canonical(input)).hash;
const corpus = sources => Object.fromEntries(Object.entries(sources).filter(([p]) => p.startsWith('docs/')).map(([p, text]) => [p, hash(text)]));
const emptyCatalog = { fixtures: [], probes: [], sentinels: [], semanticReviews: [] };
// Derived pin for this repository replay publication. The desk refreshes the
// anchor's document and rule hashes and this literal in the same reviewed PR.
// Operator approval of that PR authorizes publication; this pin grants no runtime authority.
const approvedConversion = 'sha256:7631f3f6132fea261df1d5c0f7327dc81b496ec9f6f98cf91285a36778413c47';
function resolveBuildReferences(root, input, workflow, provider, shape, owner) {
  return (workflow.references ?? []).map(reference => {
    if (reference.provider === 'decoder') {
      if (!(reference.id.startsWith('decode:') && Object.hasOwn(schemas, reference.id.slice(7)))
        && !shape.factSchemas.some(r => r.decoder === reference.id)
        && !owner.decoders.some(r => r.id === reference.id)) throw new Error('unresolved decoder ' + reference.id);
    } else if (reference.provider === 'fixture' || reference.provider === 'probe') {
      const catalog = reference.provider === 'fixture' ? workflow.catalog?.fixtures : workflow.catalog?.probes;
      const entry = catalog?.find(e => e.id === reference.id);
      const artifact = entry?.artifact;
      if (!artifact || !input.files.includes(artifact.path)) throw new Error('unresolved captured source artifact for ' + reference.id);
      const content = input.show(artifact.path);
      if (hash(content) !== artifact.hash) throw new Error('reference artifact hash differs: ' + reference.id);
      if (reference.provider === 'probe' && !(entry.cadence > 0)) throw new Error('probe requires cadence');
    } else {
      if (!provider?.resolveReference || !value(provider.resolveReference(reference))) throw new Error('unresolved verified external reference ' + reference.id);
    }
    return reference;
  });
}
export function build(root, commit, options = {}) {
  const input = readCommit(root, commit);
  const shapeInput = JSON.parse(input.sources['register-source/bootstrap-shape.json']);
  const mode = options.mode;
  if (!['bootstrap', 'replay', 'normal', 'completion'].includes(mode)) throw new Error('Explicit --replay, --bootstrap or --workflow is required; bootstrap is not the normal build');
  const converting = mode === 'bootstrap' || mode === 'replay';
  const nowValue = options.now ?? Date.now();
  let workflow = options.workflow ?? {};
  if (Object.keys(workflow).length && !Object.entries(input.sources).some(([p, content]) => {
    if (!p.startsWith('register-source/') || !p.endsWith('.json')) return false;
    try { return bytes(JSON.parse(content)) === bytes(workflow); } catch { return false; }
  })) throw new Error('workflow/check inputs must match committed source bytes');
  const owner = loadOwnerReferences(root, input);
  // Check explicit workflow presence before adding committed defaults.
  if (!converting) for (const field of ['catalog', 'references'])
    if (!Object.hasOwn(workflow, field)) throw new Error(`normal workflow missing explicit ${field}`);
  workflow = mergeOwnerReferences(workflow, owner);
  const anchor = JSON.parse(input.sources['register-source/bootstrap-anchor.json'] ?? 'null');
  let sources;
  if (converting) {
    if (!anchor || hash(anchor) !== approvedConversion || anchor.phase !== 'converted-unanchored' || anchor.shape !== hash(shapeInput) || bytes(anchor.documents) !== bytes(corpus(input.sources)))
      throw new Error('P3-NF-09: bootstrap differs from bound conversion anchor');
    if (workflow.parent || workflow.extract) throw new Error('Bootstrap transition already anchored; use normal workflow');
    if (mode === 'bootstrap') {
      // This port must verify the current spine's absence of a first entering-
      // force record AND the conversion approval, not accept a caller boolean.
      if (options.provider?.owner !== 'part-two' || !options.provider.verifyBootstrap)
        throw new Error('P3-NF-21: bootstrap needs current part-two conversion/phase verification; offline checks use --replay');
      const binding = { anchor: approvedConversion, commit, checkedAt: nowValue };
      const verified = value(options.provider.verifyBootstrap(binding));
      if (!verified || verified.phase !== 'converted-unanchored' || bytes(verified.binding) !== bytes(binding)
        || verified.fact?.owner !== 'part-two' || verified.fact?.name !== 'FactEnvelope' || !verified.fact.id)
        throw new Error('P3-NF-21: bootstrap already anchored or phase verification stale/mismatched');
    } else if (options.provider) throw new Error('Replay is an offline shape verdict, not a provider-backed bootstrap transition');
    sources = bootstrapDeclarations(input.sources, shapeInput);
  } else {
    for (const field of ['branch', 'catalog', 'runs', 'landedParts', 'references', 'claims', 'extract', 'parent', 'conversion'])
      if (!Object.hasOwn(workflow, field)) throw new Error(`normal workflow missing explicit ${field}`);
    const conversion = workflow.conversion;
    if (!conversion || bytes(conversion.documents) !== bytes(corpus(input.sources)) || !Array.isArray(conversion.sources))
      throw new Error('Normal build requires committed conversion bound to source documents');
    sources = [...conversion.sources, ...Object.entries(input.sources).filter(([p]) => isDeclarationSource(p))
      .flatMap(([path, content]) => JSON.parse(content).map(declaration => ({ path, symbol: declaration.id, declaration })))];
    if (!options.provider || options.provider.owner !== 'part-two') throw new Error('P3-NF-21: normal build needs verified part-two provider');
    const numbers = [...input.sources['docs/01-the-rules.md'].matchAll(/^\| (\d+) \|/gm)].map(m => Number(m[1]));
    for (const n of numbers) if (sources.filter(s => s.declaration.kind === 'rules' && s.declaration.requiredFacts.number === n).length !== 1)
      throw new Error(`P3-NF-23: committed conversion omits/duplicates authoritative rule ${n}`);
  }
  const conversion = { documents: corpus(input.sources), sources: sources.filter(s => !isDeclarationSource(s.path)) };
  for (const binding of owner.documents) {
    const declared = sources.filter(s => s.declaration.id === binding.id);
    if (declared.length !== 1 || declared[0].declaration.kind !== 'governed documents'
      || declared[0].path !== binding.declarationPath
      || declared[0].declaration.requiredFacts.location !== binding.artifact.path)
      throw new Error('governed document binding does not match declaration ' + binding.id);
  }
  for (const id of Object.keys(ownerDocuments)) if (sources.some(s => s.declaration.id === id) && !owner.documents.some(d => d.id === id))
    throw new Error(id + ' requires committed governed document binding');
  const scanned = scanSources(input.code, owner.decoders);
  sources = bindColocatedDeclarations(sources, scanned.constructs);
  const context = { ...buildContext(shapeInput, sources, commit, nowValue, actionRegistry(input.sources)), references: resolveBuildReferences(root, input, workflow, options.provider, shapeInput, owner),
    ...(options.provider?.types ? { authorityTypes: options.provider.types } : {}) };
  const now = value(decodeMeasurement('clock', { type: 'Measurement', schemaVersion: 1, subject: { kind: 'clock', instance: 'build-machine' },
    value: nowValue, unit: 'unix-ms', at: nowValue, by: 'register.generator' }, context.types));
  value(invariantCoverage(context.shape, implementedInvariants, context));
  const extract = converting
    ? { type: 'ChainExtract', schemaVersion: 1, vector: { owner: 'part-two', name: 'FactPositionVector', id: 'genesis:empty-extract' }, rows: [] }
    : workflow.extract;
  const sourceCommit = mode === 'completion' ? workflow.pending?.commit : commit;
  if (mode === 'completion') {
    const reviewed = readCommit(root, sourceCommit);
    if (bytes(reviewed.code) !== bytes(input.code) || bytes(corpus(reviewed.sources)) !== bytes(corpus(input.sources)))
      throw new Error('P3-NF-22: completion changed reviewed code or documents');
  }
  const buildInput = { commit: sourceCommit, complete: true, sources, extract, instances: workflow.instances ?? {} };
  let register;
  let completion;
  if (converting) register = value(generateRegister(buildInput, context));
  else {
    const provider = options.provider;
    const parentGeneration = value(decodeGeneration(workflow.parent?.generation, context));
    const parent = value(loadRegister(workflow.parent?.register, parentGeneration, context, provider, now));
    const e = value(decodeExtract(extract, context)); value(provider.verifyExtract(e));
    if (!value(provider.isCurrent(e.vector, now))) throw new Error('P3-NF-23: current extract is stale');
    const change = workflow.shapeChange ?? null;
    if (change && hash(input.sources[change.document.path]) !== change.document.hash) throw new Error('P3-NF-09: shape-change document bytes do not match approval binding');
    register = value(generateAgainstParent(buildInput, parent, context.shape, change, provider, context));
    if (mode === 'completion') {
      if (!provider.landingStanding) throw new Error('completion requires live system standing provider');
      completion = value(planLandingCompletion(workflow.pending, extract, provider.landingStanding, provider,
        { ...context, types: context.authorityTypes ?? context.types }));
      if (bytes(completion.register) !== bytes(register)) throw new Error('P3-NF-22: completion differs from source regeneration');
    }
  }
  const wiring = checkWiring(register, input.code, scanned);
  if (wiring.issues.length) throw new Error(wiring.issues.join('\n'));
  const shipped = checkShipped(register, input.inventory, scanned.program, owner, input.show);
  if (shipped.length) throw new Error(shipped.join('\n'));
  const observations = register.entries.filter(e => e.declaration.kind === 'blocking sites').flatMap(({ declaration: d }) => {
    const rungs = d.requiredFacts.rungs ?? [d.requiredFacts];
    const report = wiring.reports[Object.keys(input.code).indexOf(d.declaredBy.path)]?.scopes[d.declaredBy.symbol];
    return rungs.filter(r => r.decidesAlone === 'governed-state').map(r => ({ site: d.id, record: r.enforces.record, decoder: r.enforces.decoder, reads: report?.reads ?? [], invokes: report?.invokes ?? [] }));
  });
  const checks = { mode: mode === 'replay' ? 'replay' : converting ? 'bootstrap' : 'normal', branch: workflow.branch ?? 'bootstrap',
    runs: (workflow.runs ?? []).map(r => value(decodeCheckRun(r, context))), catalog: workflow.catalog ?? emptyCatalog, landedParts: workflow.landedParts ?? [], now,
    constructs: wiring.constructs, observations, separations: options.provider?.separations ?? [],
    boundaries: context.shape.kinds.map(k => ({ kind: k.name, language: 'TypeScript imported core ports',
      impossible: ['missing typed declaration argument'], swept: ['resolved static core calls'],
      residual: ['reflection', 'computed ids', 'plugins', 'configuration-loaded routes', ...wiring.residual.map(r => r.reason)] })),
    claims: workflow.claims ?? context.shape.kinds.map(k => ({ kind: k.name, complete: false })),
    bootstrapRules: converting ? anchor.rules : [] };
  const checked = value(runRegisterChecks(register, checks, context));
  const generation = value(generationOf(register, context));
  const outputs = value(renderRegister(register, generation, checked.terms, checked.graph, context));
  const capabilities = { generation: generation.id, commit: register.commit, ...capabilityBriefing(register, input.inventory, input.show) };
  return { input, register, generation, outputs, completion, conversion, graph: checked.graph, capabilities,
    authorityPrerequisites: checked.authorityPrerequisites, ownerArtifacts: owner.artifacts, metrics: {
    entries: register.entries.length, rules: checked.graph.rules.length, terms: register.entries.filter(e => e.declaration.kind === 'terms').length,
    warnings: checked.terms.warnings.length, prerequisites: checked.graph.prerequisites.length } };
}
export async function run(args, root = process.cwd()) {
  const flag = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
  const check = args.includes('--check'); const output = resolve(root, flag('--out') ?? 'generated');
  const manifest = resolve(output, 'source.json');
  const recorded = existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')) : {};
  const commit = flag('--commit') ?? (recorded.commit
    ? recorded.commit
    : execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim());
  const workflowPath = flag('--workflow') ?? flag('--checks') ?? recorded.workflow;
  const workflow = workflowPath ? JSON.parse(readCommit(root, commit).sources[workflowPath] ?? 'null') : undefined;
  if (workflowPath && !workflow) throw new Error('workflow must be a committed register-source JSON input');
  const selectedModes = [['--bootstrap', 'bootstrap'], ['--replay', 'replay']].filter(([flag]) => args.includes(flag));
  if (selectedModes.length > 1 || selectedModes.length && workflow?.mode && workflow.mode !== selectedModes[0][1]) throw new Error('ambiguous bootstrap/replay/normal workflow');
  const provider = flag('--provider') ? (await import(pathToFileURL(resolve(root, flag('--provider'))))).provider : undefined;
  const mode = selectedModes[0]?.[1] ?? workflow?.mode ?? (!workflow ? recorded.mode : undefined);
  const result = build(root, commit, { mode, workflow, provider, ...(flag('--now') ? { now: Number(flag('--now')) } : {}) });
  const tracked = execFileSync('git', ['-C', root, 'ls-files'], { encoding: 'utf8' }).trim().split('\n');
  const live = tracked.filter(p => Object.hasOwn(result.input.sources, p) || p.startsWith('docs/rules/') && p.endsWith('.md')
    || isDeclarationSource(p) || isActionSource(p) || p.startsWith('register-source/') && p.endsWith('.json')).sort();
  if (bytes(live) !== bytes(Object.keys(result.input.sources).sort())) throw new Error('P3-NF-23: source roster changed; regenerate from a new source commit');
  for (const [path, content] of Object.entries({ ...result.input.sources, ...result.input.code, ...result.ownerArtifacts })) if (readFileSync(resolve(root, path), 'utf8').replaceAll('\r\n', '\n') !== content)
    throw new Error(`P3-NF-01: source pin trails ${path}; commit source changes and regenerate`);
  // Documentation, build and package inputs the build consumed (present or absent) are pinned too.
  for (const path of trailingInputs(root, result.input.consumed))
    throw new Error(`P3-NF-01: source pin trails ${path}; commit source changes and regenerate`);
  const files = { 'register.json': result.outputs.register, 'rules.md': result.outputs.ruleBook, 'glossary.md': result.outputs.glossary,
    'capabilities.md': result.outputs.capabilities, 'capabilities.json': JSON.stringify(result.capabilities, null, 2) + '\n', 'coverage.md': result.outputs.coverage, 'shape.json': bytes(result.register.shape) + '\n',
    'fact-schemas.json': bytes(result.register.shape.factSchemas) + '\n', 'conversion.json': bytes(result.conversion) + '\n',
    ...(result.completion ? { 'completion.json': bytes(result.completion) + '\n' } : {}),
    'source.json': JSON.stringify({ commit, generation: result.generation.id, authority: 'shape-only', mode,
      authorityPrerequisites: result.authorityPrerequisites, ...(workflowPath ? { workflow: workflowPath } : {}) }, null, 2) + '\n' };
  if (!check) mkdirSync(output, { recursive: true });
  for (const [name, text] of Object.entries(files)) {
    const path = resolve(output, name);
    if (check) { if (!existsSync(path) || readFileSync(path, 'utf8') !== text) throw new Error(`P3-NF-01/P3-NF-09: generated ${name} differs`); }
    else writeFileSync(path, text);
  }
  console.log(JSON.stringify({ generation: result.generation.id, commit, ...result.metrics, check, authority: 'shape-only', mode }));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
