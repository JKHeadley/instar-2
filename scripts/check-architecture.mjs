// Rules 1, 10, 11, 26, 31, 40, 42, 69, 96. This uses TypeScript's resolved types, not identifier spelling.
// Rule 26 also reaches the live runner: a declared detector module reads state only through the ports
// it is handed (NF-26) — no filesystem, process or clock of its own. That confines the reading; whether
// an observation is genuine is decided by its bound witness, not by this lint.
import ts from 'typescript';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

export const DETECTOR_MODULES = Object.freeze(['tests/preview/proofs.ts', 'tests/preview/capabilities.ts']);
const DETECTOR_AMBIENT = ['Date', 'performance', 'fetch', 'process', 'setTimeout', 'setInterval', 'require', 'eval', 'Function',
  'existsSync', 'statSync', 'lstatSync', 'readFileSync', 'readdirSync', 'execSync', 'execFileSync', 'spawnSync'];
export function lintProgram(program, files, detectors = DETECTOR_MODULES) {
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
    const isDetector = detectors.includes(relative(process.cwd(), file).replaceAll('\\', '/'));
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
        if (isDetector && spec && !spec.startsWith('.')) add(file, node, 'NF-26', `detector module external import ${spec}`);
      }
      if (isCore && (node.kind === ts.SyntaxKind.AnyKeyword || (ts.isIdentifier(node) && ['Date', 'performance', 'fetch', 'process', 'XMLHttpRequest', 'setTimeout', 'setInterval', 'require', 'eval', 'Function'].includes(node.text))))
        add(file, node, 'NF-52', 'ambient I/O, time, process, dynamic code, or any');
      if (isCore && ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) add(file, node, 'NF-52', 'dynamic import');
      if (isDetector && ((ts.isIdentifier(node) && DETECTOR_AMBIENT.includes(node.text))
        || (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword)))
        add(file, node, 'NF-26', 'a detector reads state only through its observation ports');
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
/** Rule 11 (NF-11): recall is by meaning. Every memory retrieval entry point in the live runner
 * selects through the recall owner (`composeRecall`, which fuses the lexical first stage with the
 * derived meaning index and any bound semantic stage). A word-match ranker called anywhere else
 * must be a listed advisory candidate-ranking site, so a new retrieval path cannot silently be
 * word-match only. */
export const RETRIEVAL_SITES = Object.freeze({
  'tests/preview/journal.ts': { owner: 'composeRecall', adapter: 'ownedRecall', rankers: ['selectRecall', 'selectSaidTurns'],
    entryPoints: ['recallFor', 'searchFor'],
    // Bounded advisory offers the model judges: imports, open items, reply provenance, dated turns, summary candidates.
    advisory: ['channelFor', 'relatedOpenFor', 'replyProvenanceFor', 'preparedFor', 'runSummary'] },
});
export function lintRetrievalSites(sources = Object.fromEntries(Object.keys(RETRIEVAL_SITES)
  .map(path => [path, ts.sys.readFile(resolve(path)) ?? '']))) {
  const issues = [];
  for (const [path, text] of Object.entries(sources)) {
    const site = RETRIEVAL_SITES[path];
    if (!site) continue;
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
    const line = node => source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    const called = (node, name) => ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name;
    const found = new Set();
    const visit = (node, enclosing) => {
      let within = enclosing;
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
        && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) within = node.name.text;
      if (ts.isFunctionDeclaration(node) && node.name) within = node.name.text;
      if (called(node, site.adapter) && site.entryPoints.includes(within)) found.add(within);
      if (called(node, site.owner) && within === site.adapter) found.add(site.adapter);
      if (site.rankers.some(name => called(node, name)) && !site.entryPoints.includes(within) && !site.advisory.includes(within))
        issues.push({ file: path, line: line(node), rule: 'NF-11', detail: `${node.expression.text} in ${within ?? 'module scope'} is an unlisted retrieval call site` });
      ts.forEachChild(node, child => visit(child, within));
    };
    visit(source, undefined);
    for (const entry of site.entryPoints) if (!found.has(entry))
      issues.push({ file: path, line: 1, rule: 'NF-11', detail: `${entry} does not select through ${site.adapter}` });
    if (!found.has(site.adapter)) issues.push({ file: path, line: 1, rule: 'NF-11', detail: `${site.adapter} does not call ${site.owner}` });
  }
  return issues;
}
// Rules 41 and 75: the shipped live runner reaches a model only inside its one recording
// boundary. Walk the launcher and every local module it imports; a provider fetch or route
// invocation anywhere else is a bypass. The Telegram bridge (`physical.invoke`) is not a model.
export function lintShippedLauncher(entry, read = path => readFileSync(path, 'utf8'), exists = existsSync) {
  const issues = [], seen = new Set(), queue = [resolve(entry)];
  while (queue.length) {
    const file = queue.shift(); if (seen.has(file)) continue; seen.add(file);
    const text = read(file), lines = text.split('\n');
    let inside = false;
    lines.forEach((line, index) => {
      if (line.includes('// model-call-boundary:start')) inside = file === resolve(entry);
      if (line.includes('// model-call-boundary:end')) inside = false;
      const reaches = /\bfetch\s*\(|\.invoke\s*\(/.test(line.replace(/physical\.invoke\s*\(/g, ''));
      if (reaches && !inside) issues.push({ file: relative(process.cwd(), file), line: index + 1, rule: 'R41-R75',
        detail: 'model call outside the launcher\'s recording boundary' });
    });
    for (const match of text.matchAll(/(?:from|import)\s*\(?\s*'(\.{1,2}\/[^']+)'/g)) {
      const target = resolve(dirname(file), match[1]);
      if (target.includes('/node_modules/')) continue;
      const candidates = [target, target.replace(/\.js$/, '.ts'), target.replace(/\.js$/, '.mjs')];
      const found = candidates.find(candidate => exists(candidate) && !candidate.includes(`${resolve('src')}/`));
      if (found) queue.push(found);
    }
  }
  return issues;
}
function walk(path) { return readdirSync(path, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${path}/${e.name}`) : e.name.endsWith('.ts') ? [`${path}/${e.name}`] : []); }
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const program = createProgram(); const issues = [...lintProgram(program, [...walk('src'), ...DETECTOR_MODULES]), ...lintIntentSites(), ...lintRetrievalSites(), ...lintShippedLauncher('tests/preview/journal-agent.mjs')];
  if (issues.length) { console.error(JSON.stringify(issues, null, 2)); process.exitCode = 1; }
  else console.log('architecture checks passed');
}
