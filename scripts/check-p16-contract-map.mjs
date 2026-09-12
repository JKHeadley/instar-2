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

/**
 * Resolve the runtime values reachable from the supplied module exports.
 *
 * The TypeScript checker remains the authority for callability.  The small
 * value graph below supplies only information that TypeScript deliberately
 * erases (constant property keys, alias-preserving mutations, and the final
 * value selected by spreads/assignments/descriptors).  It never treats a
 * spelling as a permission by itself.
 */
function inspectMeasurementPermissionExports(sources) {
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
  const violations = [];
  const environments = new Map();
  const evaluatingSymbols = new Set();
  const inspectedTypes = new Set();
  const inspectedValues = new Set();
  const preciseValuePaths = new Set();

  const unalias = symbol => {
    if (!symbol || !(symbol.flags & ts.SymbolFlags.Alias)) return symbol;
    try { return checker.getAliasedSymbol(symbol); } catch { return undefined; }
  };
  const symbolLocation = symbol => symbol?.valueDeclaration
    ?? symbol?.declarations?.find(declaration => !ts.isSourceFile(declaration));
  const nodeType = node => {
    if (!node || ts.isSourceFile(node)) return undefined;
    try { return checker.getTypeAtLocation(node); } catch { return undefined; }
  };
  const symbolType = (symbol, fallback) => {
    const location = symbolLocation(symbol) ?? (fallback && !ts.isSourceFile(fallback) ? fallback : undefined);
    if (!symbol || !location) return undefined;
    try { return checker.getTypeOfSymbolAtLocation(symbol, location); } catch { return undefined; }
  };
  const typeParts = type => type?.isUnionOrIntersection?.() ? type.types.flatMap(typeParts) : type ? [type] : [];
  const isUnanalyzableType = type => typeParts(type).some(part => (part.flags
    & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0);
  const isCallableType = type => typeParts(type).some(part => {
    try {
      return checker.getSignaturesOfType(part, ts.SignatureKind.Call).length > 0
        || checker.getSignaturesOfType(part, ts.SignatureKind.Construct).length > 0;
    } catch { return false; }
  });
  const addViolation = (status, name, path, reason) => {
    if (!violations.some(row => row.status === status && row.name === name && row.path === path))
      violations.push({ status, name, path, reason });
  };
  const checkForbiddenPosition = (name, type, path, provedCallable = false) => {
    if (!forbiddenPermissionExports.has(name)) return;
    if (isUnanalyzableType(type)) {
      addViolation('unanalyzable', name, path, 'reachable-permission-type-unanalyzable');
    } else if (provedCallable || isCallableType(type)) {
      addViolation('refused', name, path, 'reachable-callable-permission');
    } else if (!type) {
      addViolation('unanalyzable', name, path, 'reachable-permission-type-unresolvable');
    }
  };

  const value = (kind, node, extra = {}) => ({ kind, node, type: nodeType(node), ...extra });
  const unknownValue = node => value('unknown', node);
  const primitiveValue = (node, literal) => value('primitive', node, { literal });
  const unionValue = (node, values) => {
    const flat = values.flatMap(item => item?.kind === 'union' ? item.values : item ? [item] : []);
    return flat.length === 1 ? flat[0] : value('union', node, { values: flat });
  };
  const objectValue = (node, props = new Map(), precise = true) => value('object', node, { props, precise });
  const callableValue = (node, declaration, environment, invoke) => value('callable', node,
    { declaration, environment, props: new Map(), invoke });

  const literal = (expression, environment, stack = new Set()) => {
    if (!expression) return undefined;
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text;
    if (ts.isNumericLiteral(expression)) return Number(expression.text);
    if (expression.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (expression.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (expression.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression)
      || ts.isSatisfiesExpression(expression) || ts.isNonNullExpression(expression)
      || ts.isTypeAssertionExpression(expression)) return literal(expression.expression, environment, stack);
    if (ts.isIdentifier(expression)) {
      if (expression.text === 'undefined') return undefined;
      const symbol = unalias(checker.getSymbolAtLocation(expression));
      if (!symbol || stack.has(symbol)) return undefined;
      stack.add(symbol);
      const bound = environment.get(symbol);
      if (bound?.kind === 'primitive') { stack.delete(symbol); return bound.literal; }
      const declaration = symbol.valueDeclaration ?? symbol.declarations?.find(ts.isVariableDeclaration);
      const result = declaration && 'initializer' in declaration && declaration.initializer
        ? literal(declaration.initializer, environment, stack) : undefined;
      stack.delete(symbol);
      return result;
    }
    if (ts.isTemplateExpression(expression)) {
      let result = expression.head.text;
      for (const span of expression.templateSpans) {
        const part = literal(span.expression, environment, stack);
        if (part === undefined) return undefined;
        result += String(part) + span.literal.text;
      }
      return result;
    }
    if (ts.isConditionalExpression(expression)) {
      const condition = literal(expression.condition, environment, stack);
      return condition === true ? literal(expression.whenTrue, environment, stack)
        : condition === false ? literal(expression.whenFalse, environment, stack) : undefined;
    }
    if (ts.isBinaryExpression(expression)) {
      const left = literal(expression.left, environment, stack);
      const right = literal(expression.right, environment, stack);
      switch (expression.operatorToken.kind) {
        case ts.SyntaxKind.PlusToken: return left !== undefined && right !== undefined ? left + right : undefined;
        case ts.SyntaxKind.EqualsEqualsToken:
        case ts.SyntaxKind.EqualsEqualsEqualsToken: return left !== undefined && right !== undefined ? left === right : undefined;
        case ts.SyntaxKind.ExclamationEqualsToken:
        case ts.SyntaxKind.ExclamationEqualsEqualsToken: return left !== undefined && right !== undefined ? left !== right : undefined;
        case ts.SyntaxKind.LessThanToken: return left !== undefined && right !== undefined ? left < right : undefined;
        case ts.SyntaxKind.GreaterThanToken: return left !== undefined && right !== undefined ? left > right : undefined;
        default: return undefined;
      }
    }
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
      try {
        const constant = checker.getConstantValue(expression);
        if (constant !== undefined) return constant;
      } catch { /* unresolved property is handled by the value graph */ }
      const propertySymbol = unalias(checker.getSymbolAtLocation(ts.isPropertyAccessExpression(expression)
        ? expression.name : expression.argumentExpression));
      const propertyDeclaration = propertySymbol?.valueDeclaration ?? propertySymbol?.declarations?.[0];
      if (propertyDeclaration && ts.isEnumMember(propertyDeclaration) && propertyDeclaration.initializer)
        return literal(propertyDeclaration.initializer, environment, stack);
      const base = evaluate(expression.expression, environment, new Set());
      const name = ts.isPropertyAccessExpression(expression) ? expression.name.text
        : literal(expression.argumentExpression, environment, stack);
      const selected = selectProperty(base, String(name));
      return selected?.kind === 'primitive' ? selected.literal : undefined;
    }
    if (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression)) {
      const receiver = literal(expression.expression.expression, environment, stack);
      const args = expression.arguments.map(argument => literal(argument, environment, stack));
      const method = expression.expression.name.text;
      if (typeof receiver === 'string') {
        if (method === 'slice' && args.every(argument => argument === undefined || typeof argument === 'number'))
          return receiver.slice(...args);
        if (method === 'replace' && args.length >= 2 && args.every(argument => typeof argument === 'string'))
          return receiver.replace(args[0], args[1]);
        if (method === 'split' && (args[0] === undefined || typeof args[0] === 'string'))
          return receiver.split(args[0]);
      }
      if (Array.isArray(receiver) && method === 'join' && (args[0] === undefined || typeof args[0] === 'string'))
        return receiver.join(args[0]);
    }
    if (ts.isArrayLiteralExpression(expression)) {
      const items = expression.elements.map(element => literal(ts.isSpreadElement(element)
        ? element.expression : element, environment, stack));
      return items.every(item => item !== undefined) ? items : undefined;
    }
    return undefined;
  };
  const propertyName = (name, environment) => {
    if (!name) return undefined;
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)
      || ts.isNoSubstitutionTemplateLiteral(name)) return name.text;
    return ts.isComputedPropertyName(name) ? literal(name.expression, environment) : undefined;
  };

  const selectProperty = (base, name) => {
    if (!base) return undefined;
    if (base.kind === 'union') return unionValue(base.node,
      base.values.map(item => selectProperty(item, name)).filter(Boolean));
    if (base.props?.has(name)) return base.props.get(name);
    if (base.kind === 'array' && /^\d+$/.test(name)) return base.items[Number(name)];
    return undefined;
  };
  const assignProperty = (base, name, assigned) => {
    if (!base || name === undefined) return;
    if (base.kind === 'union') { for (const item of base.values) assignProperty(item, name, assigned); return; }
    if (!base.props) base.props = new Map();
    base.props.set(String(name), assigned);
  };
  const deleteProperty = (base, name) => {
    if (!base || name === undefined) return;
    if (base.kind === 'union') { for (const item of base.values) deleteProperty(item, name); return; }
    base.props?.delete(String(name));
  };

  const bindName = (name, bound, environment) => {
    if (ts.isIdentifier(name)) {
      const symbol = unalias(checker.getSymbolAtLocation(name));
      if (symbol) environment.set(symbol, bound ?? unknownValue(name));
      return;
    }
    const entries = name.elements;
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index];
      if (ts.isOmittedExpression(entry)) continue;
      const key = propertyName(entry.propertyName ?? entry.name, environment) ?? String(index);
      bindName(entry.name, selectProperty(bound, key) ?? (entry.initializer
        ? evaluate(entry.initializer, environment, new Set()) : unknownValue(entry)), environment);
    }
  };
  const bindParameters = (parameters, argumentsList, parentEnvironment) => {
    const environment = new Map(parentEnvironment);
    parameters.forEach((parameter, index) => bindName(parameter.name, argumentsList[index]
      ?? (parameter.initializer ? evaluate(parameter.initializer, environment, new Set()) : unknownValue(parameter)), environment));
    return environment;
  };

  const executeStatements = (statements, environment, callStack, context = {}) => {
    const returned = []; const yielded = [];
    const executeOne = statement => {
      if (ts.isFunctionDeclaration(statement) && statement.name) {
        bindName(statement.name, makeFunction(statement, environment), environment); return false;
      }
      if (ts.isClassDeclaration(statement) && statement.name) {
        bindName(statement.name, makeClass(statement, environment), environment); return false;
      }
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          const initialized = declaration.initializer
            ? evaluate(declaration.initializer, environment, callStack) : unknownValue(declaration);
          bindName(declaration.name, initialized, environment);
        }
        return false;
      }
      if (ts.isExpressionStatement(statement)) { evaluate(statement.expression, environment, callStack, context); return false; }
      if (ts.isReturnStatement(statement)) {
        returned.push(statement.expression ? evaluate(statement.expression, environment, callStack, context)
          : primitiveValue(statement, undefined)); return true;
      }
      if (ts.isIfStatement(statement)) {
        const condition = literal(statement.expression, environment);
        if (condition === false) return statement.elseStatement ? executeOne(statement.elseStatement) : false;
        if (condition === true) return executeOne(statement.thenStatement);
        const left = executeOne(statement.thenStatement);
        const right = statement.elseStatement ? executeOne(statement.elseStatement) : false;
        return left && right;
      }
      if (ts.isBlock(statement)) return executeStatements(statement.statements, environment, callStack, context).stopped;
      if (ts.isSwitchStatement(statement)) {
        const selected = literal(statement.expression, environment);
        let active = false;
        for (const clause of statement.caseBlock.clauses) {
          if (ts.isDefaultClause(clause) || selected !== undefined
            && literal(clause.expression, environment) === selected) active = true;
          if (active) for (const nested of clause.statements) {
            if (ts.isBreakStatement(nested)) return false;
            if (executeOne(nested)) return true;
          }
        }
        return false;
      }
      if (ts.isThrowStatement(statement)) return true;
      return false;
    };
    for (const statement of statements) if (executeOne(statement)) break;
    return { returned, yielded, stopped: returned.length > 0 };
  };

  const makeFunction = (declaration, environment) => {
    const invoke = (argumentsList, callStack) => {
      if (callStack.has(declaration)) return unknownValue(declaration);
      const nextStack = new Set(callStack); nextStack.add(declaration);
      const local = bindParameters(declaration.parameters, argumentsList, environment);
      if (!declaration.body) return unknownValue(declaration);
      if (!ts.isBlock(declaration.body)) return evaluate(declaration.body, local, nextStack);
      const result = executeFunctionBody(declaration.body, local, nextStack);
      const combined = unionValue(declaration, result.values);
      return declaration.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword)
        ? value('promise', declaration, { inner: combined })
        : declaration.asteriskToken ? value('array', declaration, { items: result.yields }) : combined;
    };
    return callableValue(declaration, declaration, environment, invoke);
  };
  const executeFunctionBody = (body, environment, callStack) => {
    const values = []; const yields = [];
    const walk = statements => {
      for (const statement of statements) {
        if (ts.isVariableStatement(statement)) {
          for (const declaration of statement.declarationList.declarations) bindName(declaration.name,
            declaration.initializer ? evaluate(declaration.initializer, environment, callStack) : unknownValue(declaration), environment);
        } else if (ts.isFunctionDeclaration(statement) && statement.name) {
          bindName(statement.name, makeFunction(statement, environment), environment);
        } else if (ts.isExpressionStatement(statement)) {
          const expression = statement.expression;
          if (ts.isYieldExpression(expression)) {
            const item = expression.expression ? evaluate(expression.expression, environment, callStack) : primitiveValue(expression, undefined);
            if (expression.asteriskToken && item?.kind === 'array') yields.push(...item.items); else yields.push(item);
          } else evaluate(expression, environment, callStack);
        } else if (ts.isReturnStatement(statement)) {
          values.push(statement.expression ? evaluate(statement.expression, environment, callStack)
            : primitiveValue(statement, undefined)); return true;
        } else if (ts.isIfStatement(statement)) {
          const condition = literal(statement.expression, environment);
          if (condition === false) {
            if (statement.elseStatement && walk(ts.isBlock(statement.elseStatement)
              ? statement.elseStatement.statements : [statement.elseStatement])) return true;
          } else if (condition === true) {
            if (walk(ts.isBlock(statement.thenStatement) ? statement.thenStatement.statements : [statement.thenStatement])) return true;
          } else {
            walk(ts.isBlock(statement.thenStatement) ? statement.thenStatement.statements : [statement.thenStatement]);
            if (statement.elseStatement) walk(ts.isBlock(statement.elseStatement)
              ? statement.elseStatement.statements : [statement.elseStatement]);
          }
        } else if (ts.isSwitchStatement(statement)) {
          const selected = literal(statement.expression, environment); let active = false;
          for (const clause of statement.caseBlock.clauses) {
            if (ts.isDefaultClause(clause) || selected !== undefined
              && literal(clause.expression, environment) === selected) active = true;
            if (active && walk(clause.statements)) return true;
          }
        }
      }
      return false;
    };
    walk(body.statements);
    if (!values.length) values.push(primitiveValue(body, undefined));
    return { values, yields };
  };

  const makeClass = (declaration, environment) => {
    const staticProps = new Map();
    for (const member of declaration.members) {
      if (!member.name || ts.isPrivateIdentifier(member.name)
        || !member.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword)) continue;
      const name = propertyName(member.name, environment);
      if (name === undefined) continue;
      if (ts.isMethodDeclaration(member) || ts.isGetAccessorDeclaration(member))
        staticProps.set(String(name), makeFunction(member, environment));
      else if (ts.isPropertyDeclaration(member) && member.initializer)
        staticProps.set(String(name), evaluate(member.initializer, environment, new Set()));
    }
    const construct = (argumentsList, callStack) => {
      const instance = objectValue(declaration, new Map(), false);
      for (const member of declaration.members) {
        if (!member.name || ts.isPrivateIdentifier(member.name)
          || member.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword)) continue;
        const name = propertyName(member.name, environment);
        if (name === undefined) continue;
        if (ts.isMethodDeclaration(member) || ts.isGetAccessorDeclaration(member))
          instance.props.set(String(name), makeFunction(member, environment));
        else if (ts.isPropertyDeclaration(member) && member.initializer)
          instance.props.set(String(name), evaluate(member.initializer, environment, callStack));
      }
      const constructor = declaration.members.find(ts.isConstructorDeclaration);
      if (constructor?.body) {
        const local = bindParameters(constructor.parameters, argumentsList, environment);
        local.set('__this__', instance);
        executeFunctionBody(constructor.body, local, new Set(callStack).add(constructor));
      }
      return instance;
    };
    return value('class', declaration, { props: staticProps, construct });
  };

  const targetProperty = (target, environment, callStack, context) => {
    if (ts.isPropertyAccessExpression(target)) return {
      base: target.expression.kind === ts.SyntaxKind.ThisKeyword ? environment.get('__this__')
        : evaluate(target.expression, environment, callStack, context),
      name: target.name.text,
    };
    if (ts.isElementAccessExpression(target)) return {
      base: target.expression.kind === ts.SyntaxKind.ThisKeyword ? environment.get('__this__')
        : evaluate(target.expression, environment, callStack, context),
      name: literal(target.argumentExpression, environment),
    };
    return {};
  };

  const descriptorValue = (descriptor, environment, callStack) => {
    const resolved = evaluate(descriptor, environment, callStack);
    if (resolved?.kind !== 'object') return unknownValue(descriptor);
    if (resolved.props.has('value')) return resolved.props.get('value');
    const getter = resolved.props.get('get');
    return getter?.kind === 'callable' ? getter.invoke([], callStack) : unknownValue(descriptor);
  };
  const entriesValue = entries => {
    const result = objectValue(entries?.node ?? entries);
    if (entries?.kind !== 'array') return result;
    for (const tuple of entries.items) if (tuple?.kind === 'array' && tuple.items.length >= 2
      && tuple.items[0]?.kind === 'primitive' && typeof tuple.items[0].literal === 'string')
      result.props.set(tuple.items[0].literal, tuple.items[1]);
    return result;
  };

  const invokeCallable = (target, argumentsList, callStack) => {
    if (!target) return unknownValue(undefined);
    if (target.kind === 'union') return unionValue(target.node,
      target.values.map(item => invokeCallable(item, argumentsList, callStack)));
    return target.kind === 'callable' ? target.invoke(argumentsList, callStack) : unknownValue(target.node);
  };

  const evaluate = (node, environment, callStack = new Set(), context = {}) => {
    if (!node) return unknownValue(node);
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)
      || ts.isNonNullExpression(node) || ts.isTypeAssertionExpression(node)) {
      const inner = evaluate(node.expression, environment, callStack, context);
      return { ...inner, node, type: nodeType(node) };
    }
    if (ts.isIdentifier(node) && node.text === 'undefined') return primitiveValue(node, undefined);
    const knownLiteral = literal(node, environment);
    if (!Array.isArray(knownLiteral) && (knownLiteral !== undefined
      || node.kind === ts.SyntaxKind.NullKeyword)) return primitiveValue(node, knownLiteral);
    if (ts.isIdentifier(node)) {
      const symbol = unalias(checker.getSymbolAtLocation(node));
      if (!symbol) return unknownValue(node);
      if (environment.has(symbol)) return environment.get(symbol);
      return valueForSymbol(symbol, environment);
    }
    if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) return makeFunction(node, environment);
    if (ts.isClassExpression(node)) return makeClass(node, environment);
    if (ts.isObjectLiteralExpression(node)) {
      const result = objectValue(node);
      for (const property of node.properties) {
        if (ts.isSpreadAssignment(property)) {
          const spread = evaluate(property.expression, environment, callStack);
          if (spread?.props) for (const [name, item] of spread.props) result.props.set(name, item);
          continue;
        }
        if (!property.name || ts.isPrivateIdentifier(property.name)) continue;
        const name = propertyName(property.name, environment);
        if (name === undefined) continue;
        if (ts.isPropertyAssignment(property)) result.props.set(String(name), evaluate(property.initializer, environment, callStack));
        else if (ts.isShorthandPropertyAssignment(property)) result.props.set(String(name), evaluate(property.name, environment, callStack));
        else if (ts.isMethodDeclaration(property)) result.props.set(String(name), makeFunction(property, environment));
        else if (ts.isGetAccessorDeclaration(property)) result.props.set(String(name), makeFunction(property, environment).invoke([], callStack));
      }
      return result;
    }
    if (ts.isArrayLiteralExpression(node)) {
      const items = [];
      for (const element of node.elements) {
        if (ts.isOmittedExpression(element)) { items.push(primitiveValue(element, undefined)); continue; }
        const item = evaluate(ts.isSpreadElement(element) ? element.expression : element, environment, callStack);
        if (ts.isSpreadElement(element) && item.kind === 'array') items.push(...item.items); else items.push(item);
      }
      return value('array', node, { items, props: new Map() });
    }
    if (ts.isConditionalExpression(node)) {
      const condition = literal(node.condition, environment);
      return condition === true ? evaluate(node.whenTrue, environment, callStack)
        : condition === false ? evaluate(node.whenFalse, environment, callStack)
          : unionValue(node, [evaluate(node.whenTrue, environment, callStack), evaluate(node.whenFalse, environment, callStack)]);
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const assigned = evaluate(node.right, environment, callStack);
      if (ts.isIdentifier(node.left)) bindName(node.left, assigned, environment);
      else { const target = targetProperty(node.left, environment, callStack, context); assignProperty(target.base, target.name, assigned); }
      return assigned;
    }
    if (ts.isDeleteExpression(node)) {
      const target = targetProperty(node.expression, environment, callStack, context);
      deleteProperty(target.base, target.name); return primitiveValue(node, true);
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const target = targetProperty(node, environment, callStack, context);
      return selectProperty(target.base, String(target.name)) ?? unknownValue(node);
    }
    if (ts.isCallExpression(node)) {
      const canonicalCallName = expression => {
        const text = expression.getText();
        if (text === 'globalThis.Object.fromEntries') return 'Object.fromEntries';
        if (!ts.isIdentifier(expression)) return text;
        const symbol = unalias(checker.getSymbolAtLocation(expression));
        const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.find(ts.isVariableDeclaration);
        return declaration && ts.isVariableDeclaration(declaration) && declaration.initializer
          ? canonicalCallName(declaration.initializer) : text;
      };
      const expressionText = canonicalCallName(node.expression);
      const argumentsList = node.arguments.map(argument => evaluate(argument, environment, callStack));
      const property = ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : undefined;
      const receiverNode = ts.isPropertyAccessExpression(node.expression) ? node.expression.expression : undefined;
      const receiverText = receiverNode?.getText();
      if ((expressionText === 'Object.fromEntries' || expressionText === 'globalThis.Object.fromEntries'))
        return entriesValue(argumentsList[0]);
      if (expressionText === 'Object.create') {
        const created = objectValue(node);
        const descriptors = argumentsList[1];
        if (descriptors?.props) for (const [name, descriptor] of descriptors.props)
          created.props.set(name, descriptorValue(descriptor, environment, callStack));
        return created;
      }
      if (expressionText === 'Object.defineProperty' || expressionText === 'Reflect.defineProperty') {
        const target = argumentsList[0]; const name = argumentsList[1]?.literal;
        if (typeof name === 'string') assignProperty(target, name, descriptorValue(argumentsList[2], environment, callStack));
        return target;
      }
      if (expressionText === 'Object.defineProperties') {
        const target = argumentsList[0]; const descriptors = argumentsList[1];
        if (descriptors?.props) for (const [name, descriptor] of descriptors.props)
          assignProperty(target, name, descriptorValue(descriptor, environment, callStack));
        return target;
      }
      if (expressionText === 'Object.assign') {
        const target = argumentsList[0] ?? objectValue(node);
        for (const source of argumentsList.slice(1)) if (source?.props)
          for (const [name, item] of source.props) assignProperty(target, name, item);
        return target;
      }
      if (expressionText === 'Reflect.set') {
        const name = argumentsList[1]?.literal;
        if (typeof name === 'string') assignProperty(argumentsList[0], name, argumentsList[2]);
        return primitiveValue(node, true);
      }
      if (receiverText === 'Promise' && property === 'resolve') return value('promise', node,
        { inner: argumentsList[0] ?? primitiveValue(node, undefined) });
      if (property === 'then') {
        const receiver = evaluate(receiverNode, environment, callStack);
        const result = invokeCallable(argumentsList[0], [receiver?.inner ?? unknownValue(receiverNode)], callStack);
        return value('promise', node, { inner: result });
      }
      if (property === 'map') {
        const receiver = evaluate(receiverNode, environment, callStack);
        const callback = argumentsList[0];
        return value('array', node, { props: new Map(), items: receiver?.kind === 'array'
          ? receiver.items.map(item => invokeCallable(callback, [item], callStack)) : [] });
      }
      if (property === 'bind') {
        const receiver = evaluate(receiverNode, environment, callStack);
        const bound = argumentsList.slice(1);
        return callableValue(node, receiver?.declaration, environment,
          (later, stack) => invokeCallable(receiver, [...bound, ...later], stack));
      }
      if (property === 'call') {
        const receiver = evaluate(receiverNode, environment, callStack);
        return invokeCallable(receiver, argumentsList.slice(1), callStack);
      }
      if (property === 'apply') {
        const receiver = evaluate(receiverNode, environment, callStack);
        const applied = argumentsList[1]?.kind === 'array' ? argumentsList[1].items : [];
        return invokeCallable(receiver, applied, callStack);
      }
      const target = evaluate(node.expression, environment, callStack);
      return invokeCallable(target, argumentsList, callStack);
    }
    if (ts.isNewExpression(node)) {
      const argumentsList = (node.arguments ?? []).map(argument => evaluate(argument, environment, callStack));
      if (node.expression.getText() === 'Promise') {
        const captured = [];
        const resolveCallback = callableValue(node, undefined, environment, args => {
          captured.push(args[0] ?? primitiveValue(node, undefined)); return primitiveValue(node, undefined);
        });
        invokeCallable(argumentsList[0], [resolveCallback], callStack);
        return value('promise', node, { inner: unionValue(node, captured) });
      }
      if (node.expression.getText() === 'Map') {
        const entries = argumentsList[0];
        return value('array', node, { props: new Map(), items: entries?.kind === 'array'
          ? entries.items.map(tuple => tuple?.kind === 'array' ? tuple.items[1] : unknownValue(tuple?.node)) : [] });
      }
      if (node.expression.getText() === 'Set') return argumentsList[0]?.kind === 'array'
        ? argumentsList[0] : value('array', node, { props: new Map(), items: [] });
      if (node.expression.getText() === 'Proxy') {
        const proxy = argumentsList[0] ?? objectValue(node); const handler = argumentsList[1];
        const getter = selectProperty(handler, 'get');
        if (getter?.kind === 'callable') for (const name of forbiddenPermissionExports) {
          const selected = invokeCallable(getter, [proxy, primitiveValue(node, name)], callStack);
          if (selected?.kind !== 'primitive' || selected.literal !== undefined) assignProperty(proxy, name, selected);
        }
        return proxy;
      }
      const target = evaluate(node.expression, environment, callStack);
      return target?.kind === 'class' ? target.construct(argumentsList, callStack) : unknownValue(node);
    }
    if (ts.isYieldExpression(node)) return node.expression ? evaluate(node.expression, environment, callStack) : primitiveValue(node, undefined);
    return unknownValue(node);
  };

  const valueForSymbol = (symbol, environment) => {
    const target = unalias(symbol);
    if (!target) return unknownValue(undefined);
    if (environment.has(target)) return environment.get(target);
    if (evaluatingSymbols.has(target)) return unknownValue(symbolLocation(target));
    evaluatingSymbols.add(target);
    const declaration = target.valueDeclaration ?? target.declarations?.find(item => isVirtual(item));
    let result;
    if (declaration && ts.isVariableDeclaration(declaration)) result = declaration.initializer
      ? evaluate(declaration.initializer, environment, new Set()) : unknownValue(declaration);
    else if (declaration && (ts.isFunctionDeclaration(declaration) || ts.isMethodDeclaration(declaration)))
      result = makeFunction(declaration, environment);
    else if (declaration && ts.isClassDeclaration(declaration)) result = makeClass(declaration, environment);
    else if (declaration && ts.isExportAssignment(declaration)) result = evaluate(declaration.expression, environment, new Set());
    else result = unknownValue(declaration);
    environment.set(target, result); evaluatingSymbols.delete(target); return result;
  };

  const hasDeclareModifier = declaration => declaration.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.DeclareKeyword);
  const isTypeOnlyAlias = symbol => (symbol.declarations ?? []).every(declaration => ts.isExportSpecifier(declaration)
    && (declaration.isTypeOnly || ts.isExportDeclaration(declaration.parent.parent)
      && declaration.parent.parent.isTypeOnly));
  const hasRuntimeDeclaration = symbol => (symbol.declarations ?? []).some(declaration => {
    if (ts.isInterfaceDeclaration(declaration) || ts.isTypeAliasDeclaration(declaration)) return false;
    if (hasDeclareModifier(declaration)) return false;
    if (ts.isFunctionDeclaration(declaration)) return !!declaration.body;
    return ts.isVariableDeclaration(declaration) || ts.isBindingElement(declaration) || ts.isClassDeclaration(declaration)
      || ts.isEnumDeclaration(declaration) || ts.isModuleDeclaration(declaration)
      || ts.isExportAssignment(declaration) || ts.isSourceFile(declaration);
  });

  const inspectType = (type, path, location) => {
    if (!type) return;
    for (const part of typeParts(type)) {
      if (inspectedTypes.has(part)) continue;
      inspectedTypes.add(part);
      let properties = [];
      try { properties = checker.getPropertiesOfType(part); } catch { /* total result below */ }
      for (const property of properties) {
        const name = property.getName();
        const declaration = symbolLocation(property) ?? location;
        const propertyType = symbolType(property, declaration);
        if (!preciseValuePaths.has(path)) checkForbiddenPosition(name, propertyType, `${path}.${name}`);
        if (property.declarations?.some(isVirtual)) inspectType(propertyType, `${path}.${name}`, declaration);
      }
      let numeric;
      try { numeric = checker.getIndexTypeOfType(part, ts.IndexKind.Number); } catch { numeric = undefined; }
      if (numeric) inspectType(numeric, `${path}[]`, location);
      if (part.flags & ts.TypeFlags.Object && part.objectFlags & ts.ObjectFlags.Reference) {
        try { for (const argument of checker.getTypeArguments(part)) inspectType(argument, `${path}[]`, location); }
        catch { /* unresolved generic arguments are covered by the value graph */ }
      }
      for (const kind of [ts.SignatureKind.Call, ts.SignatureKind.Construct]) {
        let signatures = [];
        try { signatures = checker.getSignaturesOfType(part, kind); } catch { /* total result below */ }
        for (const signature of signatures) if ((!signature.declaration || isVirtual(signature.declaration))
          && !preciseValuePaths.has(`${path}${kind === ts.SignatureKind.Call ? '()' : ' new()'}`)) {
          let returned;
          try { returned = checker.getReturnTypeOfSignature(signature); } catch { returned = undefined; }
          inspectType(returned, `${path}${kind === ts.SignatureKind.Call ? '()' : ' new()'}`,
            signature.declaration ?? location);
        }
      }
    }
  };

  const inspectValue = (runtimeValue, path) => {
    if (!runtimeValue || inspectedValues.has(runtimeValue)) return;
    inspectedValues.add(runtimeValue);
    if (runtimeValue.kind === 'union') {
      for (const item of runtimeValue.values) inspectValue(item, path);
      return;
    }
    if ((runtimeValue.kind === 'object' && runtimeValue.precise !== false)
      || runtimeValue.kind === 'array' || runtimeValue.kind === 'promise')
      preciseValuePaths.add(path);
    if (runtimeValue.props) for (const [name, propertyValue] of runtimeValue.props) {
      checkForbiddenPosition(name, propertyValue?.type, `${path}.${name}`, propertyValue?.kind === 'callable');
      inspectValue(propertyValue, `${path}.${name}`);
    }
    if (runtimeValue.kind === 'array') for (let index = 0; index < runtimeValue.items.length; index++)
      inspectValue(runtimeValue.items[index], `${path}[${index}]`);
    if (runtimeValue.kind === 'promise') inspectValue(runtimeValue.inner, `${path}<resolved>`);
    if (runtimeValue.kind === 'callable') {
      const callPath = `${path}()`; preciseValuePaths.add(callPath);
      inspectValue(runtimeValue.invoke([], new Set()), callPath);
    }
    if (runtimeValue.kind === 'class') inspectValue(runtimeValue.construct([], new Set()), `${path} new()`);
  };

  const sourceFiles = program.getSourceFiles().filter(source => virtual.has(resolve(source.fileName)));
  for (const source of sourceFiles) {
    const environment = new Map(); environments.set(resolve(source.fileName), environment);
    for (const statement of source.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name) bindName(statement.name, makeFunction(statement, environment), environment);
      if (ts.isClassDeclaration(statement) && statement.name) bindName(statement.name, makeClass(statement, environment), environment);
    }
    executeStatements(source.statements, environment, new Set());
  }

  const inspectedExports = new Set();
  const inspectExport = (symbol, path, environment) => {
    if (!symbol || inspectedExports.has(symbol) || isTypeOnlyAlias(symbol)) return;
    inspectedExports.add(symbol);
    const assignment = symbol.declarations?.find(ts.isExportAssignment);
    if (assignment) {
      const type = nodeType(assignment.expression);
      checkForbiddenPosition(symbol.getName(), type, path);
      inspectValue(evaluate(assignment.expression, environment, new Set()), path);
      inspectType(type, path, assignment.expression);
      return;
    }
    const target = unalias(symbol);
    if (!target) {
      addViolation('unanalyzable', symbol.getName(), path, 'export-alias-unresolvable'); return;
    }
    if (forbiddenPermissionExports.has(symbol.getName())
      && symbol.declarations?.some(ts.isNamespaceExport) && !target.declarations?.length) {
      addViolation('unanalyzable', symbol.getName(), path, 'module-exports-unresolvable'); return;
    }
    if (target.flags & ts.SymbolFlags.Module) {
      let nested = [];
      try { nested = checker.getExportsOfModule(target); }
      catch { addViolation('unanalyzable', symbol.getName(), path, 'module-exports-unresolvable'); }
      if (!nested.length && forbiddenPermissionExports.has(symbol.getName()))
        addViolation('unanalyzable', symbol.getName(), path, 'module-exports-unresolvable');
      for (const child of nested) inspectExport(child, `${path}.${child.getName()}`, environment);
      return;
    }
    if (!(target.flags & ts.SymbolFlags.Value) || !hasRuntimeDeclaration(target)) return;
    const type = symbolType(target, symbolLocation(symbol));
    checkForbiddenPosition(symbol.getName(), type, path);
    const source = symbolLocation(target)?.getSourceFile();
    const targetEnvironment = source ? environments.get(resolve(source.fileName)) ?? environment : environment;
    const runtimeValue = valueForSymbol(target, targetEnvironment);
    inspectValue(runtimeValue, path);
    inspectType(type, path, symbolLocation(target));
  };
  for (const source of sourceFiles) {
    const module = checker.getSymbolAtLocation(source);
    if (!module) continue;
    let exports = [];
    try { exports = checker.getExportsOfModule(module); }
    catch { addViolation('unanalyzable', '<module>', `${source.fileName}:<exports>`, 'module-exports-unresolvable'); }
    const environment = environments.get(resolve(source.fileName)) ?? new Map();
    for (const exported of exports) inspectExport(exported,
      `${relative(process.cwd(), source.fileName)}:${exported.getName()}`, environment);
  }
  return violations;
}

export function validateMeasurementPermissionExports(sources) {
  try {
    const violations = inspectMeasurementPermissionExports(sources);
    const refused = violations.filter(row => row.status === 'refused');
    const unanalyzable = violations.filter(row => row.status === 'unanalyzable');
    if (refused.length) return { status: 'refused', accepted: false,
      reason: 'reachable-callable-permission', path: refused[0].path, violations };
    if (unanalyzable.length) return { status: 'unanalyzable', accepted: false,
      reason: unanalyzable[0].reason, path: unanalyzable[0].path, violations };
    return { status: 'accepted', accepted: true, reason: 'no-reachable-callable-permission',
      path: null, violations: [] };
  } catch (error) {
    return { status: 'unanalyzable', accepted: false, reason: 'validator-failure', path: '<program>',
      violations: [{ status: 'unanalyzable', name: '<unknown>', path: '<program>',
        reason: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }] };
  }
}

export function findForbiddenMeasurementPermissionExports(sources) {
  const result = validateMeasurementPermissionExports(sources);
  return [...new Set(result.violations.map(row => row.name))].sort();
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
  const permissionValidation = validateMeasurementPermissionExports(sources);
  if (!permissionValidation.accepted) {
    const names = [...new Set(permissionValidation.violations.map(row => row.name))].join(', ');
    throw new Error(`P16 measurement permission validation ${permissionValidation.status}: ${names}`
      + ` (${permissionValidation.reason} at ${permissionValidation.path})`);
  }
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
