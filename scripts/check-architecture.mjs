// Rules 1, 10, 26, 31, 40, 42, 69, 96. This uses TypeScript's resolved types, not identifier spelling.
import ts from 'typescript';
import { readdirSync } from 'node:fs';
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
function walk(path) { return readdirSync(path, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${path}/${e.name}`) : e.name.endsWith('.ts') ? [`${path}/${e.name}`] : []); }
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const program = createProgram(); const issues = [...lintProgram(program, walk('src')), ...lintIntentSites()];
  if (issues.length) { console.error(JSON.stringify(issues, null, 2)); process.exitCode = 1; }
  else console.log('architecture checks passed');
}
