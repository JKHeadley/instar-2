// Rules 1, 10, 26, 31, 40, 42, 69, 96. This uses TypeScript's resolved types, not identifier spelling.
import ts from 'typescript';
import { readdirSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { importClosure } from './import-closure.mjs';

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
/** Rule 105 (with 30, 115): the feature-by-channel and feature-by-harness register. Every channel
 * with an adapter declaration has a column, every declared channel operation has an agreeing row,
 * every registered doorway has a harness tuple, and each cell carries evidence or a reason. */
export function lintParityRegister(register = JSON.parse(repoRead('src/conversation/parity.register.json') ?? 'null'),
  declarations = Object.fromEntries(readdirSync('src/conversation').filter(name => name.endsWith('.declarations.json'))
    .map(name => [name.replace('.declarations.json', ''), JSON.parse(repoRead(`src/conversation/${name}`))])),
  read = repoRead, doorways = registeredDoorways()) {
  const issues = [], at = 'src/conversation/parity.register.json';
  const flag = detail => issues.push({ file: at, line: 0, rule: 'R105', detail });
  if (!register || register.type !== 'ParityRegister' || !Array.isArray(register.channels) || !Array.isArray(register.features)
    || !Array.isArray(register.harnessTuples)) { flag('parity register missing or malformed'); return issues; }
  const resolves = ref => ref && typeof ref.file === 'string' && typeof ref.title === 'string' && ref.title.length >= 8
    && [`'${ref.title}'`, `"${ref.title}"`, `\`${ref.title}\``].some(quoted => (read(ref.file) ?? '').includes(quoted));
  const cell = (where, value) => {
    if (!value || !['supported', 'unsupported', 'unproven'].includes(value.status)) return flag(`${where}: no parity cell`);
    if (value.status === 'supported' && !resolves(value.evidence)) flag(`${where}: supported without a resolvable captured test`);
    if (value.status !== 'supported' && !(typeof value.reason === 'string' && value.reason.length >= 10)) flag(`${where}: ${value.status} without a reason`);
  };
  for (const channel of Object.keys(declarations)) if (!register.channels.includes(channel)) flag(`channel ${channel} has an adapter but no parity column`);
  const features = new Map(register.features.map(feature => [feature.id, feature]));
  if (features.size !== register.features.length) flag('duplicate feature row');
  for (const feature of register.features) for (const channel of register.channels) cell(`${feature.id} × ${channel}`, feature.cells?.[channel]);
  for (const [channel, entries] of Object.entries(declarations)) for (const entry of entries)
    for (const metric of entry.requiredFacts?.metrics ?? []) {
      const match = /^([a-z]+)\.operation\.([a-z-]+)\.(supported|inhibited)$/u.exec(metric);
      if (!match) continue;
      const row = features.get(match[2]), status = row?.cells?.[match[1]]?.status;
      if (!row) flag(`declared operation ${metric} has no parity row`);
      else if (match[3] === 'supported' ? status !== 'supported' : status === 'supported')
        flag(`${metric} disagrees with its parity cell (${status})`);
    }
  for (const tuple of register.harnessTuples) cell(`${tuple.harness} × ${tuple.doorway} × ${tuple.platform}`, tuple);
  for (const doorway of doorways) if (!register.harnessTuples.some(tuple => tuple.harness === 'preview-journal-native' && tuple.doorway === doorway))
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
