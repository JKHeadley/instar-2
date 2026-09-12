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
  const seenTypes = new Set();

  const unalias = symbol => symbol && (symbol.flags & ts.SymbolFlags.Alias)
    ? checker.getAliasedSymbol(symbol) : symbol;
  const symbolLocation = symbol => symbol?.valueDeclaration ?? symbol?.declarations?.[0];
  const callable = type => type && (checker.getSignaturesOfType(type, ts.SignatureKind.Call).length > 0
    || checker.getSignaturesOfType(type, ts.SignatureKind.Construct).length > 0);

  const staticString = (expression, environment = new Map(), stack = new Set()) => {
    if (ts.isStringLiteral(expression) || ts.isNumericLiteral(expression)
      || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text;
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression)
      || ts.isSatisfiesExpression(expression) || ts.isNonNullExpression(expression)
      || ts.isTypeAssertionExpression(expression)) return staticString(expression.expression, environment, stack);
    if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = staticString(expression.left, environment, stack);
      const right = staticString(expression.right, environment, stack);
      return left === undefined || right === undefined ? undefined : left + right;
    }
    if (ts.isTemplateExpression(expression)) {
      let value = expression.head.text;
      for (const span of expression.templateSpans) {
        const part = staticString(span.expression, environment, stack);
        if (part === undefined) return undefined;
        value += part + span.literal.text;
      }
      return value;
    }
    if (ts.isIdentifier(expression)) {
      const symbol = unalias(checker.getSymbolAtLocation(expression));
      if (!symbol || stack.has(symbol)) return undefined;
      stack.add(symbol);
      const bound = environment.get(symbol);
      const declaration = symbol.valueDeclaration ?? symbol.declarations?.find(ts.isVariableDeclaration);
      const value = bound ? staticString(bound, environment, stack)
        : declaration && (ts.isVariableDeclaration(declaration) || ts.isParameter(declaration))
          && declaration.initializer ? staticString(declaration.initializer, environment, stack)
          : declaration && ts.isEnumMember(declaration) && declaration.initializer
            ? staticString(declaration.initializer, environment, stack) : undefined;
      stack.delete(symbol);
      return value;
    }
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
      const constant = checker.getConstantValue(expression);
      if (constant !== undefined) return String(constant);
      const symbol = unalias(checker.getSymbolAtLocation(ts.isPropertyAccessExpression(expression)
        ? expression.name : expression.argumentExpression));
      const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
      if (declaration && ts.isPropertyAssignment(declaration))
        return staticString(declaration.initializer, environment, stack);
      if (ts.isElementAccessExpression(expression) && expression.argumentExpression) {
        const index = Number(staticString(expression.argumentExpression, environment, stack));
        const base = resolveInitializer(expression.expression, environment);
        if (Number.isInteger(index) && base && ts.isArrayLiteralExpression(base) && base.elements[index])
          return staticString(base.elements[index], environment, stack);
      }
    }
    if (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression)) {
      const method = expression.expression.name.text;
      if (method === 'join') {
        const separator = expression.arguments[0]
          ? staticString(expression.arguments[0], environment, stack) : ',';
        const split = expression.expression.expression;
        if (separator !== undefined && ts.isCallExpression(split)
          && ts.isPropertyAccessExpression(split.expression) && split.expression.name.text === 'split') {
          const value = staticString(split.expression.expression, environment, stack);
          const delimiter = split.arguments[0] ? staticString(split.arguments[0], environment, stack) : undefined;
          if (value !== undefined && delimiter !== undefined) return value.split(delimiter).join(separator);
        }
      }
    }
    return undefined;
  };
  const propertyName = (name, environment = new Map()) => {
    if (!name) return undefined;
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)
      || ts.isNoSubstitutionTemplateLiteral(name)) return name.text;
    return ts.isComputedPropertyName(name) ? staticString(name.expression, environment) : undefined;
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
      if (ts.isYieldExpression(node)) { if (node.expression) visit(node.expression); return; }
      if (node !== body && (ts.isFunctionLike(node) || ts.isClassLike(node))) return;
      ts.forEachChild(node, walk);
    };
    walk(body);
  };

  const resolveInitializer = (expression, environment) => {
    while (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression)
      || ts.isSatisfiesExpression(expression) || ts.isNonNullExpression(expression)
      || ts.isTypeAssertionExpression(expression)) expression = expression.expression;
    if (!ts.isIdentifier(expression)) return expression;
    const symbol = unalias(checker.getSymbolAtLocation(expression));
    const bound = symbol && environment.get(symbol);
    if (bound) return resolveInitializer(bound, environment);
    const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.find(ts.isVariableDeclaration);
    return declaration && ts.isVariableDeclaration(declaration) && declaration.initializer
      ? resolveInitializer(declaration.initializer, environment) : expression;
  };

  const valueDeclaration = expression => {
    if (ts.isFunctionExpression(expression) || ts.isArrowFunction(expression)
      || ts.isClassExpression(expression)) return expression;
    if (!ts.isIdentifier(expression)) return undefined;
    const symbol = unalias(checker.getSymbolAtLocation(expression));
    const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.find(declaration =>
      ts.isFunctionDeclaration(declaration) || ts.isClassDeclaration(declaration));
    if (declaration && (ts.isFunctionDeclaration(declaration) || ts.isClassDeclaration(declaration)))
      return declaration;
    if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer)
      return valueDeclaration(declaration.initializer);
    return undefined;
  };

  const bindName = (name, argument, environment) => {
    if (ts.isIdentifier(name)) {
      const symbol = unalias(checker.getSymbolAtLocation(name));
      if (symbol && argument) environment.set(symbol, argument);
      return;
    }
    const resolved = argument && resolveInitializer(argument, environment);
    for (let index = 0; index < name.elements.length; index++) {
      const element = name.elements[index];
      if (ts.isOmittedExpression(element)) continue;
      let selected;
      if (resolved && ts.isObjectLiteralExpression(resolved)) {
        const key = propertyName(element.propertyName ?? element.name, environment);
        const property = [...resolved.properties].reverse().find(candidate =>
          !ts.isSpreadAssignment(candidate) && propertyName(candidate.name, environment) === key);
        if (property && ts.isPropertyAssignment(property)) selected = property.initializer;
        else if (property && ts.isShorthandPropertyAssignment(property)) selected = property.name;
      } else if (resolved && ts.isArrayLiteralExpression(resolved)) selected = resolved.elements[index];
      bindName(element.name, selected ?? element.initializer, environment);
    }
  };

  const bindParameters = (parameters, argumentsList, parentEnvironment) => {
    const environment = new Map(parentEnvironment);
    for (let index = 0; index < parameters.length; index++) {
      const parameter = parameters[index];
      bindName(parameter.name, argumentsList[index] ?? parameter.initializer, environment);
    }
    return environment;
  };

  const sameSymbol = (expression, symbol) => {
    if (!ts.isIdentifier(expression)) return false;
    return unalias(checker.getSymbolAtLocation(expression)) === symbol;
  };

  const assignmentProperty = (left, symbol, environment) => {
    if (ts.isPropertyAccessExpression(left) && sameSymbol(left.expression, symbol)) return left.name.text;
    if (ts.isElementAccessExpression(left) && sameSymbol(left.expression, symbol)
      && left.argumentExpression) return staticString(left.argumentExpression, environment);
    return undefined;
  };

  const inspectMutations = (symbol, declaration, environment, inspectExpression) => {
    const scope = (() => {
      let current = declaration.parent;
      while (current && !ts.isSourceFile(current) && !ts.isFunctionLike(current)) current = current.parent;
      return current && ts.isFunctionLike(current) ? current.body : current;
    })();
    if (!scope) return;
    const walk = node => {
      if (node !== scope && (ts.isFunctionLike(node) || ts.isClassLike(node))) return;
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        const name = assignmentProperty(node.left, symbol, environment);
        if (name !== undefined) {
          if (forbiddenPermissionExports.has(name) && callable(checker.getTypeAtLocation(node.right))) found.add(name);
          inspectExpression(node.right, environment);
        }
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
        && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'Reflect'
        && node.expression.name.text === 'set' && node.arguments[0]
        && sameSymbol(node.arguments[0], symbol)) {
        const name = node.arguments[1] && staticString(node.arguments[1], environment);
        const value = node.arguments[2];
        if (name && value) {
          if (forbiddenPermissionExports.has(name) && callable(checker.getTypeAtLocation(value))) found.add(name);
          inspectExpression(value, environment);
        }
      }
      ts.forEachChild(node, walk);
    };
    walk(scope);
  };

  const seenSymbols = new Set();
  const inspectSymbol = (symbol, environment, inspectExpression) => {
    const target = unalias(symbol);
    if (!target || seenSymbols.has(target)) return;
    seenSymbols.add(target);
    if (target.flags & ts.SymbolFlags.Value) {
      const location = symbolLocation(target);
      if (location) {
        inspectType(checker.getTypeOfSymbolAtLocation(target, location), location);
        for (const declaration of target.declarations ?? []) if (isVirtual(declaration)) {
          if (ts.isVariableDeclaration(declaration)) {
            if (declaration.initializer) inspectExpression(declaration.initializer, environment);
            inspectMutations(target, declaration, environment, inspectExpression);
          } else if (ts.isExportAssignment(declaration)) inspectExpression(declaration.expression, environment);
          else inspectExpression(declaration, environment);
        }
      }
    }
    if (target.flags & ts.SymbolFlags.Module)
      for (const nested of checker.getExportsOfModule(target)) inspectExport(nested, environment, inspectExpression);
  };

  const inspectProxy = (handler, environment) => {
    const resolved = resolveInitializer(handler, environment);
    if (!resolved || !ts.isObjectLiteralExpression(resolved)) return;
    for (const property of resolved.properties) {
      if (!ts.isMethodDeclaration(property) || propertyName(property.name, environment) !== 'get') continue;
      const keyParameter = property.parameters[1]?.name;
      const keySymbol = keyParameter && ts.isIdentifier(keyParameter)
        ? unalias(checker.getSymbolAtLocation(keyParameter)) : undefined;
      let callableReturn = false; const keys = new Set();
      returnedValues(property.body, expression => {
        if (callable(checker.getTypeAtLocation(expression))) callableReturn = true;
      });
      const walk = node => {
        if (ts.isBinaryExpression(node) && (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
          || node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken)) {
          if (keySymbol && ts.isIdentifier(node.left)
            && unalias(checker.getSymbolAtLocation(node.left)) === keySymbol) {
            const key = staticString(node.right, environment); if (key) keys.add(key);
          }
          if (keySymbol && ts.isIdentifier(node.right)
            && unalias(checker.getSymbolAtLocation(node.right)) === keySymbol) {
            const key = staticString(node.left, environment); if (key) keys.add(key);
          }
        }
        ts.forEachChild(node, walk);
      };
      if (property.body) walk(property.body);
      if (callableReturn) for (const key of keys) if (forbiddenPermissionExports.has(key)) found.add(key);
    }
  };

  const inspectDescriptor = (name, descriptor, environment, inspectExpression) => {
    const resolved = resolveInitializer(descriptor, environment);
    if (!resolved || !ts.isObjectLiteralExpression(resolved)) return;
    for (const property of resolved.properties) {
      const descriptorName = propertyName(property.name, environment);
      if (descriptorName === 'value' && ts.isPropertyAssignment(property)) {
        if (forbiddenPermissionExports.has(name) && callable(checker.getTypeAtLocation(property.initializer)))
          found.add(name);
        inspectExpression(property.initializer, environment);
      } else if (descriptorName === 'get'
        && (ts.isMethodDeclaration(property) || ts.isPropertyAssignment(property))) {
        const getter = ts.isPropertyAssignment(property) ? property.initializer : property;
        const declaration = valueDeclaration(getter) ?? getter;
        const signature = checker.getSignatureFromDeclaration(declaration);
        if (forbiddenPermissionExports.has(name) && signature
          && callable(checker.getReturnTypeOfSignature(signature))) found.add(name);
        inspectExpression(getter, environment);
      }
    }
  };

  const inspectEntries = (entries, environment, inspectExpression) => {
    const resolved = resolveInitializer(entries, environment);
    if (!resolved || !ts.isArrayLiteralExpression(resolved)) return;
    for (const entry of resolved.elements) {
      const tuple = resolveInitializer(ts.isSpreadElement(entry) ? entry.expression : entry, environment);
      if (!tuple || !ts.isArrayLiteralExpression(tuple) || tuple.elements.length < 2) continue;
      const name = staticString(tuple.elements[0], environment);
      const value = tuple.elements[1];
      if (name && forbiddenPermissionExports.has(name) && callable(checker.getTypeAtLocation(value))) found.add(name);
      inspectExpression(value, environment);
    }
  };

  const inspectThisMutations = (body, environment, inspectExpression) => {
    if (!body) return;
    const walk = node => {
      if (node !== body && (ts.isFunctionLike(node) || ts.isClassLike(node))) return;
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && (ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left))
        && node.left.expression.kind === ts.SyntaxKind.ThisKeyword) {
        const name = ts.isPropertyAccessExpression(node.left) ? node.left.name.text
          : node.left.argumentExpression ? staticString(node.left.argumentExpression, environment) : undefined;
        if (name && forbiddenPermissionExports.has(name) && callable(checker.getTypeAtLocation(node.right)))
          found.add(name);
        inspectExpression(node.right, environment);
      }
      ts.forEachChild(node, walk);
    };
    walk(body);
  };

  const inspectExpression = (node, environment = new Map(), stack = new Set()) => {
    if (!node || !isVirtual(node) || stack.has(node)) return;
    stack.add(node);
    if (ts.isVariableDeclaration(node)) {
      if (node.initializer) inspectExpression(node.initializer, environment, stack);
      stack.delete(node); return;
    }
    if (ts.isExportAssignment(node)) {
      inspectExpression(node.expression, environment, stack); stack.delete(node); return;
    }
    if (ts.isIdentifier(node)) {
      const symbol = unalias(checker.getSymbolAtLocation(node));
      const bound = symbol && environment.get(symbol);
      if (bound) inspectExpression(bound, environment, stack);
      else inspectSymbol(symbol, environment, inspectExpression);
      stack.delete(node); return;
    }
    if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)
      || ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node)) {
      if (ts.isFunctionExpression(node) && node.name && forbiddenPermissionExports.has(node.name.text))
        found.add(node.name.text);
      const withDefaults = bindParameters(node.parameters, [], environment);
      returnedValues(node.body, expression => inspectExpression(expression, withDefaults));
      stack.delete(node); return;
    }
    if (ts.isObjectLiteralExpression(node)) {
      for (const property of node.properties) {
        if (ts.isSpreadAssignment(property)) { inspectExpression(property.expression, environment); continue; }
        if (property.name && ts.isPrivateIdentifier(property.name)) continue;
        const name = propertyName(property.name, environment);
        if (ts.isMethodDeclaration(property) && name && forbiddenPermissionExports.has(name)) found.add(name);
        if (ts.isPropertyAssignment(property)) {
          const type = checker.getTypeAtLocation(property.initializer);
          if (name && forbiddenPermissionExports.has(name) && callable(type)) found.add(name);
          inspectExpression(property.initializer, environment);
        } else if (ts.isShorthandPropertyAssignment(property)) {
          if (name && forbiddenPermissionExports.has(name)
            && callable(checker.getTypeAtLocation(property.name))) found.add(name);
          inspectExpression(property.name, environment);
        } else if (ts.isGetAccessorDeclaration(property)) {
          const signature = checker.getSignatureFromDeclaration(property);
          if (name && forbiddenPermissionExports.has(name) && signature
            && callable(checker.getReturnTypeOfSignature(signature))) found.add(name);
          inspectExpression(property, environment);
        } else if (ts.isMethodDeclaration(property)) inspectExpression(property, environment);
      }
      stack.delete(node); return;
    }
    if (ts.isArrayLiteralExpression(node)) {
      for (const element of node.elements) if (!ts.isOmittedExpression(element))
        inspectExpression(ts.isSpreadElement(element) ? element.expression : element, environment);
      stack.delete(node); return;
    }
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      for (const clause of node.heritageClauses ?? []) for (const type of clause.types)
        inspectExpression(type.expression, environment);
      for (const member of node.members) {
        if (member.name && ts.isPrivateIdentifier(member.name)) continue;
        if (ts.isConstructorDeclaration(member)) {
          const constructorEnvironment = bindParameters(member.parameters, [], environment);
          inspectThisMutations(member.body, constructorEnvironment, inspectExpression);
          continue;
        }
        const name = propertyName(member.name, environment);
        if (name && forbiddenPermissionExports.has(name)) {
          if (ts.isMethodDeclaration(member)) found.add(name);
          else if (ts.isPropertyDeclaration(member) && member.initializer
            && callable(checker.getTypeAtLocation(member.initializer))) found.add(name);
          else if (ts.isGetAccessorDeclaration(member)) {
            const signature = checker.getSignatureFromDeclaration(member);
            if (signature && callable(checker.getReturnTypeOfSignature(signature))) found.add(name);
          }
        }
        inspectExpression(member, environment);
      }
      stack.delete(node); return;
    }
    if (ts.isPropertyDeclaration(node)) {
      if (node.initializer) inspectExpression(node.initializer, environment, stack);
      stack.delete(node); return;
    }
    if (ts.isConstructorDeclaration(node)) {
      inspectThisMutations(node.body, bindParameters(node.parameters, [], environment), inspectExpression);
      stack.delete(node); return;
    }
    if (ts.isCallExpression(node)) {
      const target = node.expression;
      const owner = ts.isPropertyAccessExpression(target) && ts.isIdentifier(target.expression)
        ? target.expression.text : undefined;
      const method = ts.isPropertyAccessExpression(target) ? target.name.text : undefined;
      if (owner === 'Object' && method === 'fromEntries' && node.arguments[0])
        inspectEntries(node.arguments[0], environment, inspectExpression);
      else if (owner === 'Object' && method === 'defineProperty' && node.arguments.length >= 3) {
        inspectExpression(node.arguments[0], environment);
        const name = staticString(node.arguments[1], environment);
        if (name) inspectDescriptor(name, node.arguments[2], environment, inspectExpression);
      } else if (owner === 'Object' && method === 'defineProperties' && node.arguments.length >= 2) {
        inspectExpression(node.arguments[0], environment);
        const descriptors = resolveInitializer(node.arguments[1], environment);
        if (descriptors && ts.isObjectLiteralExpression(descriptors)) for (const property of descriptors.properties) {
          const name = !ts.isSpreadAssignment(property) && propertyName(property.name, environment);
          if (name && ts.isPropertyAssignment(property))
            inspectDescriptor(name, property.initializer, environment, inspectExpression);
        }
      } else if (owner === 'Object' && method === 'assign') {
        for (const argument of node.arguments) inspectExpression(argument, environment);
      } else if (owner === 'Promise' && method === 'resolve' && node.arguments[0]) {
        inspectExpression(node.arguments[0], environment);
      } else {
        const declaration = valueDeclaration(target);
        if (declaration && ts.isFunctionLike(declaration)) {
          const callEnvironment = bindParameters(declaration.parameters, node.arguments, environment);
          returnedValues(declaration.body, expression => inspectExpression(expression, callEnvironment));
        }
      }
      inspectType(checker.getTypeAtLocation(node), node);
      stack.delete(node); return;
    }
    if (ts.isNewExpression(node)) {
      const constructor = ts.isIdentifier(node.expression) ? node.expression.text : undefined;
      if (constructor === 'Map' && node.arguments?.[0])
        inspectEntries(node.arguments[0], environment, inspectExpression);
      else if (constructor === 'Set' && node.arguments?.[0])
        inspectExpression(node.arguments[0], environment);
      else if (constructor === 'Proxy' && node.arguments) {
        if (node.arguments[0]) inspectExpression(node.arguments[0], environment);
        if (node.arguments[1]) inspectProxy(node.arguments[1], environment);
      } else {
        const declaration = valueDeclaration(node.expression);
        if (declaration) inspectExpression(declaration, environment);
      }
      inspectType(checker.getTypeAtLocation(node), node);
      stack.delete(node); return;
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      inspectType(checker.getTypeAtLocation(node), node);
      stack.delete(node); return;
    }
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)
      || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node)
      || ts.isTypeAssertionExpression(node) || ts.isSpreadElement(node)) {
      inspectExpression(node.expression, environment, stack);
      stack.delete(node); return;
    }
    if (ts.isConditionalExpression(node)) {
      inspectExpression(node.whenTrue, environment); inspectExpression(node.whenFalse, environment);
      stack.delete(node); return;
    }
    inspectType(checker.getTypeAtLocation(node), node);
    stack.delete(node);
  };

  const inspectExport = (symbol, environment = new Map()) => {
    const target = unalias(symbol);
    if (!target || !(target.flags & (ts.SymbolFlags.Value | ts.SymbolFlags.Module))) return;
    if (forbiddenPermissionExports.has(symbol.getName())) found.add(symbol.getName());
    inspectSymbol(symbol, environment, inspectExpression);
  };
  const publicEntries = program.getSourceFiles().filter(source => virtual.has(resolve(source.fileName)));
  for (const source of publicEntries) {
    const module = checker.getSymbolAtLocation(source);
    if (module) for (const exported of checker.getExportsOfModule(module)) inspectExport(exported);
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
