// Rules 1, 10, 26, 31, 40, 42, 69, 96. This uses TypeScript's resolved types, not identifier spelling.
import ts from 'typescript';
import { readdirSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { importClosure } from './import-closure.mjs';
import { compositionClosure, compositionDigest, currentRuntime } from './composition-digest.mjs';

export function createProgram(extra = {}) {
  const configPath = ts.findConfigFile(process.cwd(), ts.sys.fileExists, 'tsconfig.json');
  const loaded = ts.readConfigFile(configPath, ts.sys.readFile);
  const config = ts.parseJsonConfigFileContent(loaded.config, ts.sys, dirname(configPath));
  const virtual = new Map(Object.entries(extra).map(([path, text]) => [resolve(path), text]));
  const host = ts.createCompilerHost(config.options);
  const originalRead = host.readFile.bind(host); const originalExists = host.fileExists.bind(host);
  host.readFile = p => virtual.get(resolve(p)) ?? originalRead(p);
  host.fileExists = p => virtual.has(resolve(p)) || originalExists(p);
  host.getSourceFile = (path, languageVersion) => {
    const contents = host.readFile(path);
    return contents === undefined ? undefined : ts.createSourceFile(path, contents, languageVersion, true);
  };
  return ts.createProgram([...config.fileNames, ...virtual.keys()], config.options, host);
}

export function lintProgram(program, files) {
  const checker = program.getTypeChecker(); const issues = [];
  const targets = new Set(files.map(p => resolve(p)));
  const owner = (file, name, node) => {
    if (relative(process.cwd(), file).replaceAll('\\', '/') !== `src/${name.file}`) return false;
    for (let n = node; n; n = n.parent) if (ts.isFunctionDeclaration(n) && n.name?.text === name.function) return true;
    return false;
  };
  const tagOf = (node, type = checker.getTypeAtLocation(node)) => {
    const t = checker.getNonNullableType(type); const p = t.getProperty('type');
    return p ? checker.typeToString(checker.getTypeOfSymbolAtLocation(p, node)).replaceAll('"', '') : '';
  };
  const capacityOf = (node, type = checker.getTypeAtLocation(node)) => {
    const t = checker.getNonNullableType(type);
    const p = t.getProperty('kind');
    const kinds = p && checker.typeToString(checker.getTypeOfSymbolAtLocation(p, node));
    return checker.typeToString(t).includes('Capacity') || kinds === '"none" | "applied"' || kinds === '"applied" | "none"';
  };
  const add = (file, node, rule, detail) => issues.push({ file: relative(process.cwd(), file), line: ts.getLineAndCharacterOfPosition(node.getSourceFile(), node.getStart()).line + 1, rule, detail });
  for (const source of program.getSourceFiles()) {
    if (!targets.has(resolve(source.fileName))) continue;
    const file = source.fileName;
    const isCore = relative(process.cwd(), file).replaceAll('\\', '/').startsWith('src/');
    const inspect = (expression, field, node, type = checker.getTypeAtLocation(expression)) => {
      const tag = tagOf(expression, type);
      const allowed = (path, fns) => fns.some(fn => owner(file, { file: path, function: fn }, node));
      if (tag === 'Result' && ['kind', 'value', '*'].includes(field) && !allowed('types/internal.ts', ['consumeResult']))
        add(file, node, 'NF-14', 'Result may only be inspected by consumeResult');
      if (((tag === 'Result' && ['capacity', '*'].includes(field)) || (capacityOf(expression, type) && ['kind', '*'].includes(field)))
        && !allowed('types/internal.ts', ['consumeResult', 'consumeCapacity'])) add(file, node, 'NF-15', 'capacity is success data; use consumeCapacity');
      if (tag === 'Evidence' && ['claim', '*'].includes(field) && !allowed('types/operations.ts', ['readEvidence'])) add(file, node, 'NF-66', 'claim requires freshness doorway');
      if (tag === 'Outcome' && ['kind', '*'].includes(field) && !allowed('types/operations.ts', ['consumeOutcome', 'retryPermission'])) add(file, node, 'NF-46', 'Outcome requires consumption/retry doorway');
      if (tag === 'Conflict' && ['left', 'right', '*'].includes(field) && !allowed('types/operations.ts', ['resolveConflict'])) add(file, node, 'NF-69', 'Conflict side requires resolution doorway');
    };
    const inspectAssignment = (target, type) => {
      if (ts.isBinaryExpression(target) && target.operatorToken.kind === ts.SyntaxKind.EqualsToken) return inspectAssignment(target.left, type);
      if (ts.isObjectLiteralExpression(target)) for (const property of target.properties) {
        const key = property.name;
        const field = key && (ts.isIdentifier(key) || ts.isStringLiteral(key)) ? key.text : '*';
        inspect(target, field, property, type);
        const member = checker.getPropertyOfType(checker.getNonNullableType(type), field);
        if (member && ts.isPropertyAssignment(property)) inspectAssignment(property.initializer, checker.getTypeOfSymbolAtLocation(member, property));
      }
      if (ts.isArrayLiteralExpression(target)) for (const [index, element] of target.elements.entries()) {
        const member = checker.getPropertyOfType(type, String(index));
        const elementType = member ? checker.getTypeOfSymbolAtLocation(member, element) : checker.getIndexTypeOfType(type, ts.IndexKind.Number);
        if (elementType) inspectAssignment(element, elementType);
      }
    };
    const visit = node => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        const spec = node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : '';
        if (isCore && spec && !spec.startsWith('.') && spec !== 'node:crypto') add(file, node, 'NF-52', `core external import ${spec}`);
        if (!isCore && /(?:types\/internal|decode\/(?:decode|canonical|schema))/.test(spec)) add(file, node, 'NF-51', 'private package import');
      }
      if (isCore && (node.kind === ts.SyntaxKind.AnyKeyword || (ts.isIdentifier(node) && ['Date', 'performance', 'fetch', 'process', 'XMLHttpRequest', 'setTimeout', 'setInterval', 'require', 'eval', 'Function'].includes(node.text))))
        add(file, node, 'NF-52', 'ambient I/O, time, process, dynamic code, or any');
      if (isCore && ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) add(file, node, 'NF-52', 'dynamic import');
      if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
        const field = ts.isPropertyAccessExpression(node) ? node.name.text : node.argumentExpression && ts.isStringLiteral(node.argumentExpression) ? node.argumentExpression.text : '*';
        inspect(node.expression, field, node);
      }
      // The binding pattern has the resolved contextual type for parameters, nested
      // bindings, for-of declarations, aliases and rest alike — not only variables.
      if (ts.isObjectBindingPattern(node)) {
        for (const element of node.elements) {
          const key = element.propertyName ?? element.name;
          inspect(node, element.dotDotDotToken ? '*' : ts.isIdentifier(key) || ts.isStringLiteral(key) ? key.text : '*', element);
        }
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken)
        inspectAssignment(node.left, checker.getTypeAtLocation(node.right));
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return issues;
}
/** Rule 10 (NF-10): the live runner's intent-decision sites never branch on a literal
 * meaning classifier. A decision offered to the model (`xDecision`), the structural memory
 * search offer, and model-proposed promise validation may test exact values, but no regular
 * expression over message wording may decide whether judgment happens. Legacy replay decoders
 * are exact protocol readers, named here explicitly. */
export const INTENT_DECISION_SITES = Object.freeze({
  'tests/preview/journal.ts': { variables: ['summaryDecision', 'search'], decisionProperties: true },
  'tests/preview/agent-commitment.ts': { functions: ['promiseProposals', 'fulfillmentProposals', 'recordedPromises'] },
});
export function lintIntentSites(sources = Object.fromEntries(Object.keys(INTENT_DECISION_SITES)
  .map(path => [path, ts.sys.readFile(resolve(path)) ?? '']))) {
  const issues = [];
  for (const [path, text] of Object.entries(sources)) {
    const site = INTENT_DECISION_SITES[path] ?? {};
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
    const flag = (root, what) => {
      const scan = node => {
        if (node.kind === ts.SyntaxKind.RegularExpressionLiteral)
          issues.push({ file: path, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, rule: 'NF-10',
            detail: `${what} branches on a literal meaning classifier` });
        ts.forEachChild(node, scan);
      };
      scan(root);
    };
    const objectOf = node => { while (node && ts.isParenthesizedExpression(node)) node = node.expression; return node; };
    const visit = node => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && site.variables?.includes(node.name.text) && node.initializer)
        flag(node.initializer, node.name.text);
      if (ts.isFunctionDeclaration(node) && node.name && site.functions?.includes(node.name.text) && node.body) flag(node.body, node.name.text);
      if (site.decisionProperties && ts.isConditionalExpression(node)) {
        const offered = objectOf(node.whenTrue);
        const names = offered && ts.isObjectLiteralExpression(offered) ? offered.properties
          .map(item => item.name && (ts.isIdentifier(item.name) || ts.isStringLiteral(item.name)) ? item.name.text : '')
          .filter(name => name.endsWith('Decision')) : [];
        if (names.length) flag(node.condition, names.join(', '));
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return issues;
}
/** The shipped entry points: the live runner, the native self-hosting command and the production boot command. */
export const LIVE_ENTRY_POINTS = Object.freeze(['tests/preview/journal-agent.mjs', 'tests/preview/self-host.mjs', 'bin/instar-production.mjs']);
const repoRead = path => { try { return readFileSync(resolve(path), 'utf8'); } catch { return null; } };
const repoFile = path => { try { return lstatSync(resolve(path)).isFile(); } catch { return false; } };
/** Shipped client code outside src/: the live runner's closure, the scripts and the bin commands. */
export function shippedClientFiles() {
  const closure = importClosure([...LIVE_ENTRY_POINTS], repoRead, repoFile).files.filter(path => !path.startsWith('src/'));
  const listed = ['scripts', 'bin'].flatMap(dir => readdirSync(dir).filter(name => name.endsWith('.mjs')).map(name => `${dir}/${name}`));
  return [...new Set([...closure, ...listed])].sort();
}

/** Rule 30: the modules that ARE the adapter written for one harness or model doorway. Harness
 * names and harness-specific adapters may appear only here; everything else selects through the
 * adapter interface by a registered id. */
export const HARNESS_ADAPTER_MODULES = Object.freeze([
  'src/harness-adapters/', 'src/assembly/production-session-driver.ts', 'src/assembly/production-provider.ts',
  'scripts/production-session-io.mjs', 'scripts/production-boot-io.mjs',
]);
const HARNESS_NAME = /^(?:claude-code|claude|codex-cli|codex|gemini-cli|gemini|pi-cli|grok-build|grok|aider|cursor|opencode)$/iu;
const HARNESS_ADAPTER_IDENTIFIER = /ClaudeCode|Codex|Gemini|Grok/u;
export function lintHarnessNames(sources) {
  const issues = [];
  for (const [path, text] of Object.entries(sources)) {
    if (HARNESS_ADAPTER_MODULES.some(prefix => path === prefix || prefix.endsWith('/') && path.startsWith(prefix))) continue;
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
    const flag = (node, detail) => issues.push({ file: path, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, rule: 'R30', detail });
    const named = node => node && ts.isStringLiteralLike(node) && HARNESS_NAME.test(node.text);
    const visit = node => {
      if (ts.isBinaryExpression(node) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
        ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(node.operatorToken.kind)
        && (named(node.left) || named(node.right))) flag(node, 'compares against a harness name outside its adapter');
      if (ts.isCaseClause(node) && named(node.expression)) flag(node, 'switches on a harness name outside its adapter');
      if (ts.isIdentifier(node) && HARNESS_ADAPTER_IDENTIFIER.test(node.text)) flag(node, `names the harness-specific ${node.text} outside its adapter`);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return issues;
}

/** Rule 115 (NF-51): shipped clients reach the core through its public ports only. */
export function lintClientImports(sources) {
  const issues = [];
  for (const [path, text] of Object.entries(sources)) {
    for (const { fileName } of ts.preProcessFile(text, true, true).importedFiles)
      if (/(?:types\/internal|decode\/(?:decode|canonical|schema))(?:\.[a-z]+)?$/u.test(fileName))
        issues.push({ file: path, line: 0, rule: 'NF-51', detail: `shipped client imports private core module ${fileName}` });
  }
  return issues;
}

/** Rule 45: truth sources a cutover replaced, with the store that replaced them. */
export const REPLACED_TRUTH_SOURCES = Object.freeze([
  { source: 'preview-state.json', replacedBy: 'journal.encrypted + runs.jsonl', cutover: 'tests/preview/journal-migrate.mjs' },
  { source: 'preview-stage2-state.json', replacedBy: 'journal.encrypted', cutover: 'tests/preview/journal-migrate.mjs' },
  { source: 'successive-state.json', replacedBy: 'journal.encrypted', cutover: 'tests/preview/journal-migrate.mjs' },
]);
/** Every remaining reader of a replaced source, and why it is not a live consumer. A reader the
 * scanner finds but this list does not name fails, and so does a live entry point reaching one. */
export const DECLARED_OLD_STORE_READERS = Object.freeze({
  'tests/preview/journal-migrate.mjs': 'cutover exporter: reads a stopped old root once, read-only',
  'scripts/host-watch.mjs': 'legacy watcher mode only; a journal root selects superviseJournal, which reads runs.jsonl',
  'tests/preview/agent.mjs': 'retired legacy runner for old roots',
  'tests/preview/state.ts': 'retired legacy runner store',
  'tests/preview/successive.ts': 'retired legacy successive-root handoff',
  'tests/preview/stage2-owners.ts': 'retired legacy stage-two owners',
  'tests/preview/recover-slot.ts': 'desk recovery tool for old roots',
  'tests/preview/rerecord-profile.ts': 'desk tool for old roots',
});
/** Loads the static scanner cannot follow (a computed dynamic import), declared with what they load. */
export const DYNAMIC_READERS = Object.freeze({
  'scripts/production-boot.mjs': { loads: [], reason: 'the operator-installed host module named on the command line: outside this repository and bound by the installation record' },
  'tests/preview/self-host.mjs': { loads: [], reason: 'the installed local capability entrypoint, loaded by its content digest from the install root after staging' },
});
export function lintReplacedStores(sources, liveEntries = LIVE_ENTRY_POINTS, read = repoRead, exists = repoFile) {
  const issues = [];
  const closure = importClosure([...liveEntries, ...Object.values(DYNAMIC_READERS).flatMap(item => item.loads)], read, exists);
  for (const item of closure.computed) if (!Object.hasOwn(DYNAMIC_READERS, item.from))
    issues.push({ file: item.from, line: item.line, rule: 'R45', detail: 'computed dynamic import on the live path is undeclared' });
  for (const item of closure.unresolved) issues.push({ file: item.from ?? item.specifier, line: 0, rule: 'R45', detail: `live import ${item.specifier} does not resolve` });
  const literals = REPLACED_TRUTH_SOURCES.map(item => item.source);
  for (const file of closure.files) {
    const text = read(file) ?? '';
    for (const literal of literals) if (text.includes(literal))
      issues.push({ file, line: 0, rule: 'R45', detail: `live consumer still reads the replaced store ${literal}` });
  }
  for (const [path, text] of Object.entries(sources)) {
    if (path === 'scripts/check-architecture.mjs') continue; // these declarations name the sources, they do not read them
    const reads = literals.filter(literal => text.includes(literal));
    if (reads.length && !Object.hasOwn(DECLARED_OLD_STORE_READERS, path) && !closure.files.includes(path))
      issues.push({ file: path, line: 0, rule: 'R45', detail: `undeclared reader of replaced store ${reads.join(', ')}` });
  }
  for (const path of Object.keys(DECLARED_OLD_STORE_READERS))
    if (!literals.some(literal => (read(path) ?? '').includes(literal)))
      issues.push({ file: path, line: 0, rule: 'R45', detail: 'declared old-store reader no longer reads a replaced store; remove the declaration' });
  return issues;
}

/** Rule 115: the model doorway ids registered in the adapter module (the keys of SUBSCRIPTION_DOORWAYS). */
export function registeredDoorways(text = repoRead('src/assembly/production-provider.ts') ?? '') {
  const source = ts.createSourceFile('production-provider.ts', text, ts.ScriptTarget.Latest, true); const ids = [];
  const visit = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'SUBSCRIPTION_DOORWAYS') {
      const find = inner => { if (ts.isObjectLiteralExpression(inner)) { for (const property of inner.properties)
        if (property.name && (ts.isStringLiteral(property.name) || ts.isIdentifier(property.name))) ids.push(property.name.text); return; }
      ts.forEachChild(inner, find); };
      find(node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(source); return ids;
}
/** The register's declaration sources: every `*.declarations.json` under `src/`, keyed by path. */
export function registerDeclarationSources(read = repoRead, root = 'src') {
  const files = path => readdirSync(path, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${path}/${e.name}`)
    : e.name.endsWith('.declarations.json') ? [`${path}/${e.name}`] : []);
  return Object.fromEntries(files(root).sort().map(path => [path, JSON.parse(read(path) ?? '[]')]));
}
/** Rules 30, 105, 115: the native reference harness (a HarnessAdapterPort composition) whose tuple
 * every registered model doorway must carry. */
export const NATIVE_HARNESS = 'preview-self-host-native';
const CHANNEL_SOURCE = /^src\/conversation\/([a-z]+)\.declarations\.json$/u;
const CHANNEL_STATE = /^([a-z]+)\.operation\.([a-z-]+)\.(supported|inhibited|unsupported|unproven)$/u;
const CHANNEL_FACT = /^([a-z]+)\.operation\.([a-z-]+)\.(evidence|reason)=(.+)$/u;
const TUPLE_STATE = /^harness\.([a-z0-9:-]+)\.([a-z0-9-]+)\.([a-z0-9_-]+)\.([a-z-]+)\.(supported|unsupported|unproven)$/u;
const TUPLE_FACT = /^harness\.([a-z0-9:-]+)\.([a-z0-9-]+)\.([a-z0-9_-]+)\.([a-z-]+)\.(evidence|artifact|route|reason|entries|runtime|conformance)=(.+)$/u;
/**
 * Rule 105 (with 30, 115): the feature-by-channel and harness-by-doorway parity matrix, derived
 * from the register's own declarations (the facts the generated register and capability briefing
 * carry), never from a side file. Grammar, as metrics of `features` declarations:
 * - a channel adapter (`src/conversation/<channel>.declarations.json`) declares, per feature,
 *   `<channel>.operation.<feature>.<supported|inhibited|unsupported|unproven>`, plus
 *   `.evidence=<test file>#<test title>` when supported and `.reason=<text>` when unsupported/unproven
 *   (`inhibited` is the adapter's own refusal and is its reason);
 * - any declaration declares a harness tuple cell
 *   `harness.<harness>.<doorway>.<platform>.<mode>.<supported|unsupported|unproven>`, plus, when
 *   supported, `.artifact=<composition id>@<code path>`, `.route=<doorway id>@<registering module>`,
 *   `.entries=<the composition's entry points, comma-separated>` (its files are their static import closure),
 *   `.runtime=node-<version>@<sha256 of the runtime executable>`,
 *   `.conformance=<compositionDigest of that closure on that runtime>` and `.evidence=<test file>#<test title>`,
 *   and `.reason=<text>` otherwise.
 */
export function parityMatrix(sources = registerDeclarationSources()) {
  const channels = [], cells = new Map(), tuples = new Map(), stray = [];
  const cellOf = (map, key, init) => { if (!map.has(key)) map.set(key, { ...init, states: [], evidence: [], reason: [], artifact: [], route: [],
    entries: [], runtime: [], conformance: [] }); return map.get(key); };
  for (const [path, entries] of Object.entries(sources)) {
    const channel = CHANNEL_SOURCE.exec(path)?.[1];
    if (channel) channels.push(channel);
    for (const entry of Array.isArray(entries) ? entries : []) for (const metric of entry?.requiredFacts?.metrics ?? []) {
      if (typeof metric !== 'string') continue;
      const state = CHANNEL_STATE.exec(metric), fact = state ? null : CHANNEL_FACT.exec(metric);
      const tupleState = TUPLE_STATE.exec(metric), tupleFact = tupleState ? null : TUPLE_FACT.exec(metric);
      const channelMatch = state ?? fact;
      if (channelMatch) {
        if (channelMatch[1] !== channel) { stray.push(`${path} declares ${channelMatch[1]} parity cell ${metric}`); continue; }
        const cell = cellOf(cells, `${channelMatch[2]}\0${channel}`, { feature: channelMatch[2], channel, source: path, declaration: entry.id });
        if (state) cell.states.push(state[3]); else cell[fact[3]].push(fact[4]);
      }
      const tupleMatch = tupleState ?? tupleFact;
      if (tupleMatch) {
        const [, harness, doorway, platform, mode] = tupleMatch;
        const cell = cellOf(tuples, [harness, doorway, platform, mode].join('\0'), { harness, doorway, platform, mode, source: path, declaration: entry.id });
        if (tupleState) cell.states.push(tupleState[5]); else cell[tupleFact[5]].push(tupleFact[6]);
      }
    }
  }
  const evidenceOf = value => { const at = value.indexOf('#'); return at < 0 ? { file: value, title: '' } : { file: value.slice(0, at), title: value.slice(at + 1) }; };
  const settle = cell => {
    const { states, evidence, reason, artifact, route, entries, runtime, conformance, ...rest } = cell;
    const status = states.length === 1 ? (states[0] === 'inhibited' ? 'unsupported' : states[0]) : undefined;
    return { ...rest, status, declaredStates: states, ...(states[0] === 'inhibited' ? { inhibited: true } : {}),
      ...(evidence.length ? { evidence: evidence.map(evidenceOf) } : {}), ...(reason.length ? { reason: reason.join('; ') } : {}),
      ...(artifact.length ? { artifact } : {}), ...(route.length ? { route } : {}), ...(entries.length ? { entries } : {}),
      ...(runtime.length ? { runtime } : {}), ...(conformance.length ? { conformance } : {}) };
  };
  const features = [...new Set([...cells.values()].map(cell => cell.feature))].sort().map(id => ({ id,
    cells: Object.fromEntries(channels.flatMap(channel => { const cell = cells.get(`${id}\0${channel}`); return cell ? [[channel, settle(cell)]] : []; })) }));
  return { type: 'ParityMatrix', derivedFrom: Object.keys(sources), channels, features, harnessTuples: [...tuples.values()].map(settle), stray };
}
/** Rule 105 (with 26, 30, 49, 69, 115): each parity cell resolves to its declared evidence. Every
 * channel adapter has a column and every declared feature a cell in each column; each cell has one
 * state; a supported cell cites a test that exists (and, for a harness tuple, an adapter artifact,
 * a registered route and its platform/mode); an unsupported or unproven cell states why; every
 * registered model doorway carries a native harness tuple. */
export function lintParityRegister(sources = registerDeclarationSources(), read = repoRead, doorways = registeredDoorways()) {
  const issues = [], matrix = parityMatrix(sources);
  const flag = (detail, file = 'src/conversation') => issues.push({ file, line: 0, rule: 'R105', detail });
  for (const detail of matrix.stray) flag(detail);
  const resolves = ref => ref && typeof ref.file === 'string' && typeof ref.title === 'string' && ref.title.length >= 8
    && [`'${ref.title}'`, `"${ref.title}"`, `\`${ref.title}\``].some(quoted => (read(ref.file) ?? '').includes(quoted));
  const judge = (where, cell) => {
    if (!cell) return flag(`${where}: no parity cell`);
    if (cell.declaredStates.length !== 1) return flag(`${where} declares ${cell.declaredStates.length ? `more than one parity state (${cell.declaredStates.join(', ')})` : 'no parity state'}`, cell.source);
    if (cell.status === 'supported' && !(cell.evidence?.length === 1 && resolves(cell.evidence[0])))
      flag(`${where}: supported without a resolvable captured test`, cell.source);
    if (cell.status !== 'supported' && cell.evidence) flag(`${where}: ${cell.declaredStates[0]} but cites supporting evidence`, cell.source);
    if (cell.status !== 'supported' && !cell.inhibited && !(typeof cell.reason === 'string' && cell.reason.length >= 10))
      flag(`${where}: ${cell.status} without a reason`, cell.source);
  };
  for (const channel of matrix.channels) if (!matrix.features.some(feature => feature.cells[channel]))
    flag(`channel ${channel} has an adapter but no parity column`, `src/conversation/${channel}.declarations.json`);
  for (const feature of matrix.features) for (const channel of matrix.channels) judge(`${feature.id} × ${channel}`, feature.cells[channel]);
  for (const tuple of matrix.harnessTuples) {
    const where = `${tuple.harness} × ${tuple.doorway} × ${tuple.platform} × ${tuple.mode}`;
    judge(where, tuple);
    if (tuple.status !== 'supported') continue;
    const [artifactId, artifactPath] = tuple.artifact?.length === 1 ? tuple.artifact[0].split('@') : [];
    if (!/^[A-Za-z_]\w*$/u.test(artifactId ?? '') || !artifactPath || !new RegExp(`\\b${artifactId}\\b`, 'u').test(read(artifactPath) ?? ''))
      flag(`${where}: supported without an adapter artifact that names it`, tuple.source);
    const [routeId, routePath] = tuple.route?.length === 1 ? tuple.route[0].split('@') : [];
    if (routeId !== tuple.doorway || !routePath || !registeredDoorways(read(routePath) ?? '').includes(routeId))
      flag(`${where}: supported without its registered route`, tuple.source);
    // D17 §2: support is bound to the exact composition — the static import closure of its declared
    // entry points — and the resolved runtime its conformance ran on.
    const entries = tuple.entries?.length === 1 ? tuple.entries[0].split(',') : [];
    const runtime = tuple.runtime?.length === 1 ? tuple.runtime[0] : null;
    const closure = entries.length ? compositionClosure(entries, read, tuple.source) : { files: [], complete: false };
    if (!entries.length || !closure.complete || !closure.files.includes(artifactPath) || !closure.files.includes(routePath) || !runtime)
      flag(`${where}: supported without complete composition entry points (closure reaching its artifact and route) and runtime`, tuple.source);
    else if (runtime !== currentRuntime()) flag(`${where}: certified on ${runtime}, running ${currentRuntime()}`, tuple.source);
    else {
      const digest = compositionDigest(runtime, closure.files, read);
      if (!digest || tuple.conformance?.length !== 1 || tuple.conformance[0] !== digest)
        flag(`${where}: conformance is not for the current composition bytes (now ${digest ?? 'a missing file'}); re-run its contract and re-declare`, tuple.source);
    }
  }
  for (const doorway of doorways) if (!matrix.harnessTuples.some(tuple => tuple.harness === NATIVE_HARNESS && tuple.doorway === doorway))
    flag(`registered doorway ${doorway} has no native harness tuple`);
  return issues;
}

function walk(path) { return readdirSync(path, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${path}/${e.name}`) : e.name.endsWith('.ts') ? [`${path}/${e.name}`] : []); }
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const program = createProgram(); const clients = shippedClientFiles();
  const shipped = Object.fromEntries([...walk('src'), ...clients].map(path => [path, readFileSync(path, 'utf8')]));
  const clientSources = Object.fromEntries(clients.map(path => [path, shipped[path]]));
  const issues = [...lintProgram(program, walk('src')), ...lintIntentSites(), ...lintHarnessNames(shipped),
    ...lintClientImports(clientSources), ...lintReplacedStores(shipped), ...lintParityRegister()];
  if (issues.length) { console.error(JSON.stringify(issues, null, 2)); process.exitCode = 1; }
  else console.log('architecture checks passed');
}
