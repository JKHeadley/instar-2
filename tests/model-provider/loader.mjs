import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
    let url = new URL(specifier, context.parentURL);
    if (url.pathname.includes('/src/') && url.pathname.endsWith('.js')) {
      url = new URL(url.href.replace('/src/', '/dist/'));
      return { url: url.href, shortCircuit: true };
    }
    if (url.pathname.includes('/tests/') && url.pathname.endsWith('.js') && existsSync(fileURLToPath(url).slice(0, -3) + '.ts'))
      return { url: pathToFileURL(fileURLToPath(url).slice(0, -3) + '.ts').href, shortCircuit: true };
  }
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (url.startsWith('file:') && url.endsWith('.ts')) return { format: 'module', shortCircuit: true,
    source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText };
  return next(url, context);
}
