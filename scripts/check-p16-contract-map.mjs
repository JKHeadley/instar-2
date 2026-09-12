// Slice A1 maps only owned record/registration and resource/process/census
// validation. Every A2 semantic row is named exactly as structurally deferred.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const executable = new Set([1, 2, 5, 22, 23, 25, 26, 27, 28, 29, 30, 52]);
const mixed = new Set([3, 24]);
const sliceA2 = new Set([4, 12, 13, 14, 16, 33, 34, 36, 37, 38, 39, 40, 41, 47, 48, 50]);
const behaviors = new Map(Object.entries({
  1: ['contract-inventory', 'p16Dispositions'],
  2: ['architecture-boundary', 'checkP16Architecture'],
  3: ['registration-current-content', 'decodeMeasurementProducerContract'],
  5: ['measured-claim', 'renderMeasurementClaim'],
  22: ['quota-coalescing', 'coalesceUnknownQuotaEpisodes'],
  23: ['observational-port', 'createMeasurementLedger'],
  24: ['rate-event-populations', 'summarizeRateLimitEvents'],
  25: ['cpu-and-byte', 'cpuUtilization'],
  26: ['process-incarnation', 'reconcileProcessIncarnation'],
  27: ['limit-plus-one-census', 'planProcessCensus'],
  28: ['classified-and-unclassified', 'classifyProcesses'],
  29: ['resource-trend', 'resourceTrend'],
  30: ['fired-and-no-op', 'classifyFeatureOutcome'],
  52: ['non-executable-exclusion', 'p16Dispositions'],
  53: ['legacy-additivity', 'check-p16-additivity'],
}).map(([number, value]) => [Number(number), value]));
const dependencies = {
  3: ['seam-response-intake-followup.md', 'seam-response-assembly-followup.md',
    'seam-response-judgment.md', 'SEAM-LEDGER.md row 64'],
  6: ['seam-response-intake-followup.md'],
  7: ['seam-response-judgment.md', 'seam-response-assembly-followup.md',
    'named five/six/eight/nine production wiring'],
  8: ['seam-response-intake-followup.md'],
  9: ['seam-response-assembly-followup.md'],
  10: ['seam-response-assembly-followup.md'],
  11: ['seam-response-judgment.md', 'seam-response-loop-followup.md'],
  15: ['seam-response-declarations.md'],
  17: ['seam-response-declarations.md'],
  18: ['seam-response-declarations.md'],
  19: ['seam-response-declarations.md', 'seam-response-loop-followup.md', 'SEAM-LEDGER.md row 34',
    'seam-response-rungraph-followup.md', 'seam-response-effects-followup.md'],
  20: ['seam-response-declarations.md'],
  21: ['seam-response-intake-followup.md'],
  24: ['seam-response-intake-followup.md #12 observation admission',
    'seam-response-assembly-followup.md P16-P10-process-resource-observation-v1',
    'SEAM-LEDGER.md row 40', 'SEAM-LEDGER.md row 63'],
  31: ['seam-response-judgment.md', 'seam-response-assembly-followup.md'],
  32: ['seam-response-judgment.md', 'seam-response-assembly-followup.md', 'SEAM-LEDGER.md row 73'],
  35: ['seam-response-effects-followup.md'],
  42: ['seam-response-intake-followup.md'],
  43: ['seam-response-loop-followup.md item #25'],
  44: ['seam-response-intake-followup.md'],
  45: ['seam-response-intake-followup.md', 'seam-response-effects-followup.md'],
  46: ['seam-response-assembly-followup.md P16-P10-process-resource-observation-v1',
    'seam-response-intake-followup.md #12 observation admission', 'seam-response-loop-followup.md item #25'],
  49: ['seam-response-declarations.md #11 price/exchange declarations',
    'seam-response-intake-followup.md', 'seam-response-assembly-followup.md', 'seam-response-judgment.md',
    'seam-response-loop-followup.md', 'seam-response-rungraph-followup.md', 'seam-response-effects-followup.md',
    'SEAM-LEDGER.md row 40', 'SEAM-LEDGER.md row 63', 'SEAM-LEDGER.md row 64'],
  51: ['seam-response-effects-followup.md'],
};

export function p16Dispositions(design = readFileSync(
  'docs/20-measurement-ledgers/13-non-functional-checks-and-activation.md', 'utf8')) {
  const ids = [...design.matchAll(/^\| (P16-NF-(\d+)) \|/gm)]
    .map(match => ({ id: match[1], number: Number(match[2]) }));
  if (ids.length !== 52 || ids.some((row, index) => row.number !== index + 1))
    throw new Error('Part Sixteen design must contain exactly one contiguous P16-NF-01..52 table');
  const rows = [...ids, { id: 'P16-NF-53', number: 53, supplemental: true }];
  return rows.map(row => {
    if (row.number === 53)
      return { ...row, status: 'SUPPLEMENTAL-EXECUTABLE-NON-GOVERNING', dependencies: [] };
    if (sliceA2.has(row.number))
      return { ...row, status: 'NON-EXECUTABLE-UNTIL-slice-A2', dependencies: ['slice-A2'] };
    if (executable.has(row.number)) return { ...row, status: 'EXECUTABLE', dependencies: [] };
    const blocked = dependencies[row.number];
    if (!blocked?.length) throw new Error(`${row.id}: non-executable row has no exact dependency`);
    if (mixed.has(row.number))
      return { ...row, status: `MIXED-EXECUTABLE-A1-PLUS-${blocked.join(' + ')}`, dependencies: blocked };
    return { ...row, status: `NON-EXECUTABLE-UNTIL-${blocked.join(' + ')}`, dependencies: blocked };
  });
}

const forbiddenPermissionExports = new Set(['allow', 'canRun', 'place', 'throttle']);

const hasModifier = (node, kind) => node.modifiers?.some(modifier => modifier.kind === kind) ?? false;

export function findForbiddenMeasurementPermissionExports(sources) {
  const found = new Set();
  const virtual = new Map(Object.entries(sources).map(([file, source]) => [resolve(file), source]));
  const options = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    skipLibCheck: true,
  };
  const host = ts.createCompilerHost(options, true);
  const readFile = host.readFile.bind(host); const fileExists = host.fileExists.bind(host);
  host.readFile = file => virtual.get(resolve(file)) ?? readFile(file);
  host.fileExists = file => virtual.has(resolve(file)) || fileExists(file);
  host.getSourceFile = (file, languageVersion) => {
    const source = host.readFile(file);
    return source === undefined ? undefined : ts.createSourceFile(file, source, languageVersion, true);
  };
  const program = ts.createProgram([...virtual.keys()], options, host);
  const checker = program.getTypeChecker();
  const isVirtual = node => node && virtual.has(resolve(node.getSourceFile().fileName));
  const seenNodes = new Set(); const seenSymbols = new Set(); const seenTypes = new Set();

  const unalias = symbol => symbol && (symbol.flags & ts.SymbolFlags.Alias)
    ? checker.getAliasedSymbol(symbol) : symbol;
  const symbolLocation = symbol => symbol?.valueDeclaration ?? symbol?.declarations?.[0];
  const callable = type => type && (checker.getSignaturesOfType(type, ts.SignatureKind.Call).length > 0
    || checker.getSignaturesOfType(type, ts.SignatureKind.Construct).length > 0);

  const staticString = (expression, stack = new Set()) => {
    if (ts.isStringLiteral(expression) || ts.isNumericLiteral(expression)
      || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text;
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression)
      || ts.isSatisfiesExpression(expression) || ts.isNonNullExpression(expression)
      || ts.isTypeAssertionExpression(expression)) return staticString(expression.expression, stack);
    if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = staticString(expression.left, stack); const right = staticString(expression.right, stack);
      return left === undefined || right === undefined ? undefined : left + right;
    }
    if (ts.isTemplateExpression(expression)) {
      let value = expression.head.text;
      for (const span of expression.templateSpans) {
        const part = staticString(span.expression, stack);
        if (part === undefined) return undefined;
        value += part + span.literal.text;
      }
      return value;
    }
    if (ts.isIdentifier(expression)) {
      const symbol = unalias(checker.getSymbolAtLocation(expression));
      if (!symbol || stack.has(symbol)) return undefined;
      stack.add(symbol);
      const declaration = symbol.valueDeclaration ?? symbol.declarations?.find(ts.isVariableDeclaration);
      const value = declaration && ts.isVariableDeclaration(declaration) && declaration.initializer
        ? staticString(declaration.initializer, stack) : undefined;
      stack.delete(symbol);
      return value;
    }
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
      const constant = checker.getConstantValue(expression);
      if (constant !== undefined) return String(constant);
      const symbol = unalias(checker.getSymbolAtLocation(ts.isPropertyAccessExpression(expression)
        ? expression.name : expression.argumentExpression));
      const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
      if (declaration && ts.isPropertyAssignment(declaration)) return staticString(declaration.initializer, stack);
    }
    return undefined;
  };
  const propertyName = name => {
    if (!name) return undefined;
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)
      || ts.isNoSubstitutionTemplateLiteral(name)) return name.text;
    return ts.isComputedPropertyName(name) ? staticString(name.expression) : undefined;
  };

  const inspectType = (type, location) => {
    if (!type || seenTypes.has(type)) return;
    seenTypes.add(type);
    if (type.isUnionOrIntersection?.()) for (const part of type.types) inspectType(part, location);
    for (const kind of [ts.SignatureKind.Call, ts.SignatureKind.Construct]) {
      for (const signature of checker.getSignaturesOfType(type, kind))
        inspectType(checker.getReturnTypeOfSignature(signature), signature.declaration ?? location);
    }
    for (const property of checker.getPropertiesOfType(type)) {
      const declaration = symbolLocation(property) ?? location;
      const propertyType = checker.getTypeOfSymbolAtLocation(property, declaration);
      if (forbiddenPermissionExports.has(property.getName()) && callable(propertyType))
        found.add(property.getName());
      if (property.declarations?.some(isVirtual)) inspectType(propertyType, declaration);
    }
    for (const kind of [ts.IndexKind.Number, ts.IndexKind.String]) {
      const indexed = checker.getIndexTypeOfType(type, kind);
      if (indexed) inspectType(indexed, location);
    }
  };

  const returnedValues = (body, visit) => {
    if (!body) return;
    if (!ts.isBlock(body)) { visit(body); return; }
    const walk = node => {
      if (ts.isReturnStatement(node)) { if (node.expression) visit(node.expression); return; }
      if (node !== body && (ts.isFunctionLike(node) || ts.isClassLike(node))) return;
      ts.forEachChild(node, walk);
    };
    walk(body);
  };

  const inspectSymbol = symbol => {
    const target = unalias(symbol);
    if (!target || seenSymbols.has(target)) return;
    seenSymbols.add(target);
    if (target.flags & ts.SymbolFlags.Value) {
      const location = symbolLocation(target);
      if (location) {
        inspectType(checker.getTypeOfSymbolAtLocation(target, location), location);
        for (const declaration of target.declarations ?? []) if (isVirtual(declaration)) inspectNode(declaration);
      }
    }
    if (target.flags & ts.SymbolFlags.Module)
      for (const nested of checker.getExportsOfModule(target)) inspectExport(nested);
  };

  const inspectBindingName = name => {
    if (ts.isIdentifier(name)) {
      if (forbiddenPermissionExports.has(name.text)) found.add(name.text);
      inspectSymbol(checker.getSymbolAtLocation(name));
      return;
    }
    for (const element of name.elements) if (!ts.isOmittedExpression(element)) inspectBindingName(element.name);
  };

  const inspectNode = node => {
    if (!node || seenNodes.has(node) || !isVirtual(node)) return;
    seenNodes.add(node);
    if (ts.isVariableDeclaration(node)) {
      inspectBindingName(node.name);
      if (node.initializer) inspectNode(node.initializer);
      return;
    }
    if (ts.isIdentifier(node)) { inspectSymbol(checker.getSymbolAtLocation(node)); return; }
    if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)
      || ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node)) {
      const name = propertyName(node.name);
      if (name && forbiddenPermissionExports.has(name) && !ts.isGetAccessorDeclaration(node)) found.add(name);
      returnedValues(node.body, inspectNode);
      return;
    }
    if (ts.isObjectLiteralExpression(node)) {
      for (const property of node.properties) {
        if (ts.isSpreadAssignment(property)) { inspectNode(property.expression); continue; }
        const name = propertyName(property.name);
        if (ts.isMethodDeclaration(property) && name && forbiddenPermissionExports.has(name)) found.add(name);
        if (ts.isPropertyAssignment(property)) {
          const type = checker.getTypeAtLocation(property.initializer);
          if (name && forbiddenPermissionExports.has(name) && callable(type)) found.add(name);
          inspectNode(property.initializer);
        } else if (ts.isShorthandPropertyAssignment(property)) inspectNode(property.name);
        else if (ts.isMethodDeclaration(property) || ts.isGetAccessorDeclaration(property)) inspectNode(property);
      }
      return;
    }
    if (ts.isArrayLiteralExpression(node)) {
      for (const element of node.elements) if (!ts.isOmittedExpression(element))
        inspectNode(ts.isSpreadElement(element) ? element.expression : element);
      return;
    }
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      for (const clause of node.heritageClauses ?? []) for (const type of clause.types) inspectNode(type.expression);
      for (const member of node.members) inspectNode(member);
      return;
    }
    if (ts.isPropertyDeclaration(node)) {
      const name = propertyName(node.name);
      if (node.initializer) {
        if (name && forbiddenPermissionExports.has(name) && callable(checker.getTypeAtLocation(node.initializer)))
          found.add(name);
        inspectNode(node.initializer);
      }
      return;
    }
    if (ts.isConstructorDeclaration(node)) {
      ts.forEachChild(node, child => {
        if (ts.isBinaryExpression(child) && child.operatorToken.kind === ts.SyntaxKind.EqualsToken
          && (ts.isPropertyAccessExpression(child.left) || ts.isElementAccessExpression(child.left))) {
          const name = ts.isPropertyAccessExpression(child.left) ? child.left.name.text
            : child.left.argumentExpression ? staticString(child.left.argumentExpression) : undefined;
          if (name && forbiddenPermissionExports.has(name) && callable(checker.getTypeAtLocation(child.right)))
            found.add(name);
          inspectNode(child.right);
        }
      });
      return;
    }
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      inspectNode(node.expression);
      for (const argument of node.arguments ?? []) inspectNode(argument);
      const signature = checker.getResolvedSignature(node);
      if (signature) inspectType(checker.getReturnTypeOfSignature(signature), node);
      return;
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      inspectNode(node.expression);
      inspectSymbol(checker.getSymbolAtLocation(ts.isPropertyAccessExpression(node)
        ? node.name : node.argumentExpression));
      return;
    }
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)
      || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node)
      || ts.isTypeAssertionExpression(node) || ts.isSpreadElement(node)) {
      inspectNode(node.expression);
      return;
    }
    ts.forEachChild(node, inspectNode);
  };

  const inspectExport = symbol => {
    if (forbiddenPermissionExports.has(symbol.getName())) found.add(symbol.getName());
    inspectSymbol(symbol);
  };
  const roots = program.getSourceFiles().filter(source => virtual.has(resolve(source.fileName)));
  for (const source of roots) {
    const module = checker.getSymbolAtLocation(source);
    if (module) for (const exported of checker.getExportsOfModule(module)) inspectExport(exported);
    for (const statement of source.statements) {
      if (ts.isExportAssignment(statement)) inspectNode(statement.expression);
      if (ts.isExportDeclaration(statement) && statement.exportClause) {
        if (ts.isNamedExports(statement.exportClause)) for (const element of statement.exportClause.elements) {
          if (forbiddenPermissionExports.has(element.name.text)) found.add(element.name.text);
          inspectSymbol(checker.getSymbolAtLocation(element.name));
        }
        if (ts.isNamespaceExport(statement.exportClause)
          && forbiddenPermissionExports.has(statement.exportClause.name.text)) found.add(statement.exportClause.name.text);
      } else if (hasModifier(statement, ts.SyntaxKind.ExportKeyword)) inspectNode(statement);
    }
  }
  return [...found].sort();
}

export function checkP16Architecture() {
  const changed = execFileSync('git', ['diff', '--name-only', 'main'], { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  const allowedGenerated = new Set(['generated/capabilities.md', 'generated/coverage.md', 'generated/glossary.md',
    'generated/register.json', 'generated/rules.md', 'generated/source.json']);
  const allowedExact = new Set(['scripts/check-p16-additivity.mjs', 'scripts/check-p16-contract-map.mjs',
    'tests/integration/measurement.test.ts', 'tests/e2e/measurement.test.ts']);
  const outsideScope = [...new Set([...changed, ...untracked])].filter(file => !file.startsWith('src/measurement/')
    && !file.startsWith('tests/measurement/') && !allowedGenerated.has(file) && !allowedExact.has(file));
  if (outsideScope.length) throw new Error(`P16 changed-file scope exceeded: ${outsideScope.join(', ')}`);
  const files = readdirSync('src/measurement').filter(file => file.endsWith('.ts'));
  const sources = Object.fromEntries(files.map(file => [
    `src/measurement/${file}`, readFileSync(`src/measurement/${file}`, 'utf8'),
  ]));
  const source = Object.values(sources).join('\n');
  const forbiddenExports = findForbiddenMeasurementPermissionExports(sources);
  if (forbiddenExports.length)
    throw new Error(`P16 forbidden measurement permission exports: ${forbiddenExports.join(', ')}`);
  const imports = [...source.matchAll(/from ['"](\.\.\/[^'"]+)['"]/g)].map(match => match[1]);
  const allowed = new Set(['../index.js', '../facts/index.js', '../projections/index.js', '../assembly/index.js']);
  const privateImports = imports.filter(path => !allowed.has(path));
  if (privateImports.length)
    throw new Error(`P16 private earlier-part imports: ${[...new Set(privateImports)].join(', ')}`);
  const index = readFileSync('src/measurement/index.ts', 'utf8');
  const operations = readFileSync('src/measurement/operations.ts', 'utf8');
  const removed = ['createQuantityWitness', 'resolveQuantity', 'aggregateMeasurements', 'resolveAttribution',
    'mergePeerMeasurements', 'createBurnWindow', 'evaluateBurn', 'renderBoundedRead',
    'bindMeasurementReadSource', 'renderCurrentMeasurementRead', 'measurementProjectionDefinition',
    'growthInvestigationLink', 'createBoundedReadCache'];
  for (const name of removed) {
    if (index.includes(name) || operations.includes(`function ${name}`))
      throw new Error(`slice A2 operation remains executable: ${name}`);
  }
  for (const name of ['admitMeasurementAmount', 'reconcileProcessIncarnation',
    'coalesceUnknownQuotaEpisodes', 'resourceTrend']) {
    if (!index.includes(name) || !operations.includes(`function ${name}`))
      throw new Error(`slice A1 operation is not publicly implemented: ${name}`);
  }
  const declarations = JSON.parse(readFileSync('src/measurement/measurement.declarations.json', 'utf8'));
  if (!Array.isArray(declarations) || !declarations.length
    || declarations.some(row => row.status !== 'dark' || row.holds?.length))
    throw new Error('P16 A1 declarations must remain dark and hold-free');
  const proofFiles = [
    ...readdirSync('tests/measurement').filter(file => file.endsWith('.test.ts')).map(file => `tests/measurement/${file}`),
    'tests/integration/measurement.test.ts', 'tests/e2e/measurement.test.ts',
  ];
  const proofIds = [...executable, ...mixed, 53].map(number => `P16-NF-${String(number).padStart(2, '0')}`);
  const tierFiles = [proofFiles.filter(file => file.startsWith('tests/measurement/')),
    proofFiles.filter(file => file.startsWith('tests/integration/')),
    proofFiles.filter(file => file.startsWith('tests/e2e/'))];
  for (const filesForTier of tierFiles) {
    const proof = filesForTier.map(file => readFileSync(file, 'utf8')).join('\n');
    for (const id of proofIds) {
      const number = Number(id.slice(-2)); const [marker, operation] = behaviors.get(number) ?? [];
      if (!marker || !operation || !proof.includes(id) || !proof.includes(`[behavior:${marker}]`)
        || !proof.includes(operation))
        throw new Error(`${filesForTier[0]}: ${id} lacks its executed behavior binding`);
    }
  }
  return { sourceFiles: files.length, imports: [...new Set(imports)].sort(), declarations: declarations.length,
    proofFiles: proofFiles.length, executable: executable.size, mixed: mixed.size, sliceA2: sliceA2.size };
}

export function checkP16Coverage(report, dispositions = p16Dispositions()) {
  if (!report.success) throw new Error('P16 mapping requires a successful actual test run');
  const tiers = ['tests/measurement/', 'tests/integration/', 'tests/e2e/'];
  return dispositions.map(row => {
    const tests = report.testResults.flatMap(file => file.assertionResults
      .filter(test => (test.fullName.match(/\bP16-NF-\d+\b/g) ?? []).includes(row.id))
      .map(test => ({ file: relative(process.cwd(), file.name), title: test.title, status: test.status })));
    const behavior = behaviors.get(row.number);
    const passed = tests.filter(test => test.status === 'passed');
    const passing = tests.filter(test => test.status === 'passed'
      && behavior !== undefined && test.title.includes(`[behavior:${behavior[0]}]`));
    if (row.status === 'EXECUTABLE' || row.status.startsWith('MIXED-EXECUTABLE-')
      || row.status.startsWith('SUPPLEMENTAL-EXECUTABLE-')) {
      for (const tier of tiers) if (!passing.some(test => test.file.startsWith(tier)))
        throw new Error(`${row.id}: A1 row lacks a passing ${tier} fixture`);
    } else if (passed.length) throw new Error(`${row.id}: non-executable row was counted as a pass`);
    return { ...row, tests, passing: passing.length };
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkP16Architecture();
  const rows = checkP16Coverage(JSON.parse(readFileSync('.test-results.json', 'utf8')));
  console.log('| Check | Status | Passing test files |');
  console.log('|---|---|---|');
  for (const row of rows)
    console.log(`| ${row.id} | ${row.status} | ${[...new Set(row.tests.map(test => test.file))].join('; ') || '—'} |`);
  console.log(`${rows.length} labels mapped: ${rows.filter(row => row.status === 'EXECUTABLE').length} executable; ${rows.filter(row => row.status.startsWith('MIXED-EXECUTABLE-')).length} mixed; ${rows.filter(row => row.status === 'NON-EXECUTABLE-UNTIL-slice-A2').length} slice-A2; ${rows.filter(row => row.status.startsWith('NON-EXECUTABLE-') && row.status !== 'NON-EXECUTABLE-UNTIL-slice-A2').length} other blocked; 1 supplemental.`);
}
