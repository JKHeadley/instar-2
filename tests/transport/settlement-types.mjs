import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
import { effectCommit } from './effect-pin.mjs';

// Compile the real pinned eight sources against the local six declaration. No
// surrogate EffectSettlement interface can accidentally make this seam typecheck.
const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', effectCommit, 'src/effects'], { encoding: 'utf8' }).trim().split('\n').filter(p => p.endsWith('.ts'));
const files = new Map(paths.map(path => [resolve(path), execFileSync('git', ['show', `${effectCommit}:${path}`], { encoding: 'utf8' })]));
const seam = resolve('src/settlement-owner-typecheck.ts');
files.set(seam, `
import { createTransportAuthority, registerTransportBodies } from './transport/index.js';
import type { TransportHost, TransportSpine, FenceToken } from './transport/index.js';
import type { BoundaryContext } from './index.js';
import { consumeEffectSettlement } from './effects/index.js';
import type { EffectSettlement, EffectComposition } from './effects/index.js';
declare const host: TransportHost, spine: TransportSpine, c: BoundaryContext, fence: FenceToken, settlement: EffectSettlement;
const api = createTransportAuthority(host, spine, c, consumeEffectSettlement);
registerTransportBodies(host, c, consumeEffectSettlement);
api.settle(fence, settlement);
const closed = api.close('close', fence, 'operation:1');
const composed: EffectComposition['transport'] = api;
// @ts-expect-error Request-written input is not an eight-owned issuance.
api.settle(fence, {});
// @ts-expect-error A conditional close names an operation, never a settlement.
api.close('close', fence, settlement);
// @ts-expect-error Missing owner consumer leaves the seam statically dark.
createTransportAuthority(host, spine, c).settle(fence, settlement);
`);
const config = ts.readConfigFile('tsconfig.build.json', ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
const host = ts.createCompilerHost(parsed.options);
const read = host.readFile.bind(host), exists = host.fileExists.bind(host), directoryExists = host.directoryExists.bind(host);
host.readFile = path => files.get(resolve(path)) ?? read(path);
host.fileExists = path => files.has(resolve(path)) || exists(path);
host.directoryExists = path => [...files.keys()].some(file => dirname(file) === resolve(path)) || directoryExists(path);
host.getSourceFile = (path, languageVersion) => {
  const source = host.readFile(path); return source === undefined ? undefined : ts.createSourceFile(path, source, languageVersion, true);
};
const program = ts.createProgram([...parsed.fileNames, ...files.keys()], { ...parsed.options, noEmit: true }, host);
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length) throw Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCanonicalFileName: path => path, getCurrentDirectory: () => process.cwd(), getNewLine: () => '\n',
}));
console.log('Actual eight/six types compose; unknown and unconfigured inputs refuse.');
