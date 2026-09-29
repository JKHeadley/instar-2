import { boundary, ensure, freeze } from './boundary.js';
import type { BoundaryContext, Result } from '../index.js';

/**
 * Rules 2 and 115 (D14 §9): every tool used to inspect, build, test, review, package, install,
 * migrate and repair Instar, exposed as a scoped tool a harness may propose. A tool is a proposal
 * with a registered operation id and scoped parameters; admission validates it; the harness never
 * runs a shell, chooses an executable or widens its own grants.
 */
export type ToolPhase = 'inspect' | 'build' | 'test' | 'review' | 'package' | 'install' | 'migrate' | 'repair';
/**
 * A typed, scoped option (`--name value`). `root`/`file` values are absolute, normalized paths
 * inside one of the scope roots the harness owner granted this run; `namespace`/`version` name a
 * local package; `count` and `account` are bounded decimal numbers. A harness never supplies raw argv.
 */
export interface ToolOption { readonly name: string; readonly kind: 'root' | 'file' | 'namespace' | 'version' | 'count' | 'account'; readonly required: boolean }
export interface DevelopmentTool {
  readonly id: string;
  readonly phase: ToolPhase;
  /** A fixed argument vector (process tools) or a public port the harness calls (port tools). */
  readonly run: Readonly<{ kind: 'process'; argv: readonly string[] }> | Readonly<{ kind: 'port'; port: string }>;
  /** Scoped positional parameters appended to argv: each must be a repository-relative path of this shape. */
  readonly params: Readonly<{ pattern: RegExp; max: number }> | null;
  /** Typed options, or per-subcommand typed options (the subcommand becomes the first argument). */
  readonly options?: readonly ToolOption[];
  readonly subcommands?: Readonly<Record<string, readonly ToolOption[]>>;
  /** Credential references the owner resolves for this tool; the harness never sees their values. */
  readonly credentials?: readonly string[];
  /** The package.json scripts this tool is (the inventory must cover every script). */
  readonly packageScripts: readonly string[];
  /** Grants the tool needs beyond the harness's working scope; admission refuses without them. */
  readonly grants: readonly string[];
  /** The shipped feature this tool serves. */
  readonly feature: string;
}

const path = (shape: string) => new RegExp(`^(?!-)(?!.*(?:^|/)\\.\\.(?:/|$))${shape}$`, 'u');
const option = (name: string, kind: ToolOption['kind'], required = true): ToolOption => ({ name, kind, required });
const packageOptions = [option('namespace', 'namespace'), option('version', 'version')];
const loaded = (entry: string) => ['node', '--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', entry];
export const DEVELOPMENT_TOOLS: readonly DevelopmentTool[] = freeze([
  { id: 'git-status', phase: 'inspect', run: { kind: 'process', argv: ['git', 'status', '--short'] }, params: null,
    packageScripts: [], grants: [], feature: 'self-hosting' },
  { id: 'git-diff', phase: 'inspect', run: { kind: 'process', argv: ['git', 'diff', '--stat'] }, params: null,
    packageScripts: [], grants: [], feature: 'self-hosting' },
  { id: 'typecheck', phase: 'build', run: { kind: 'process', argv: ['npx', 'tsc', '--noEmit'] }, params: null,
    packageScripts: ['typecheck'], grants: [], feature: 'self-hosting' },
  { id: 'build', phase: 'build', run: { kind: 'process', argv: ['npx', 'tsc', '-p', 'tsconfig.build.json'] }, params: null,
    packageScripts: ['build', 'pretest'], grants: [], feature: 'self-hosting' },
  { id: 'unit-test', phase: 'test', run: { kind: 'process', argv: ['npx', 'vitest', 'run', '--maxWorkers', '4'] },
    params: { pattern: path('tests/[A-Za-z0-9_./-]+\\.test\\.ts'), max: 20 }, packageScripts: ['test'], grants: [], feature: 'self-hosting' },
  { id: 'package-test', phase: 'test', run: { kind: 'process', argv: ['node', '--test'] },
    params: { pattern: path('[A-Za-z0-9_./-]+\\.test\\.mjs'), max: 10 }, packageScripts: [], grants: [], feature: 'local-capability-packages' },
  { id: 'affected-tests', phase: 'test', run: { kind: 'process', argv: ['node', 'scripts/affected-tests.mjs'] }, params: null,
    packageScripts: ['test:affected'], grants: [], feature: 'self-hosting' },
  { id: 'kill-schedule', phase: 'test', run: { kind: 'process', argv: ['node', 'scripts/run-kill-schedule.mjs'] }, params: null,
    packageScripts: [], grants: [], feature: 'self-hosting' },
  { id: 'ci-local', phase: 'test', run: { kind: 'process', argv: ['node', 'scripts/ci-local.mjs'] }, params: null,
    packageScripts: ['ci:local'], grants: [], feature: 'self-hosting' },
  { id: 'architecture-check', phase: 'review', run: { kind: 'process', argv: ['node', 'scripts/check-architecture.mjs'] }, params: null,
    packageScripts: [], grants: [], feature: 'self-hosting' },
  { id: 'repository-check', phase: 'review', run: { kind: 'process', argv: ['node'] },
    params: { pattern: path('scripts/check-[a-z0-9-]+\\.mjs'), max: 1 }, packageScripts: [], grants: [], feature: 'self-hosting' },
  { id: 'register-check', phase: 'review', run: { kind: 'process', argv: ['node', 'scripts/build-register.mjs', '--check'] }, params: null,
    packageScripts: ['register:check'], grants: [], feature: 'self-hosting' },
  { id: 'register-generate', phase: 'package', run: { kind: 'process', argv: ['node', 'scripts/build-register.mjs'] }, params: null,
    packageScripts: ['register:generate'], grants: ['governed-register-change'], feature: 'self-hosting' },
  { id: 'stage-package', phase: 'package', run: { kind: 'port', port: 'stageLocalCapability' }, params: null, options: packageOptions,
    packageScripts: [], grants: [], feature: 'local-capability-packages' },
  { id: 'install-package', phase: 'install', run: { kind: 'port', port: 'installLocalCapability' }, params: null, options: packageOptions,
    packageScripts: [], grants: ['local-install'], feature: 'local-capability-packages' },
  { id: 'journal-migrate', phase: 'migrate', run: { kind: 'process', argv: loaded('tests/preview/journal-migrate.mjs') }, params: null,
    subcommands: {
      export: [option('old-root', 'root'), option('export-file', 'file'), option('bot-id', 'account'), option('chat-id', 'account'),
        option('operator-sender-id', 'account'), option('max-calls', 'count', false), option('max-replies', 'count', false),
        option('max-context-bytes', 'count', false)],
      import: [option('new-root', 'root'), option('export-file', 'file')],
    }, credentials: ['preview-storage-key'], packageScripts: [], grants: ['operator-storage-key'], feature: 'preview-journal' },
  { id: 'journal-audit', phase: 'repair', run: { kind: 'process', argv: [...loaded('tests/preview/journal-agent.mjs'), 'audit'] }, params: null,
    options: [option('root', 'root')], credentials: ['preview-storage-key'], packageScripts: [], grants: ['operator-storage-key'], feature: 'preview-journal' },
] satisfies DevelopmentTool[]);
/** package.json scripts that only chain inventoried tools. */
export const COMPOSITE_SCRIPTS: Readonly<Record<string, readonly string[]>> = freeze({
  lint: ['architecture-check', 'repository-check'],
  'test:all': ['typecheck', 'build', 'kill-schedule', 'unit-test', 'architecture-check', 'repository-check', 'register-check'],
});

export interface ToolProposal {
  readonly operation: string; readonly params: readonly string[];
  readonly subcommand?: string; readonly options?: Readonly<Record<string, string>>;
}
/** What the harness owner granted this run: the absolute roots a `root`/`file` option may name. */
export interface ToolScopes { readonly roots: readonly string[] }
export interface AdmittedTool {
  readonly tool: string; readonly phase: ToolPhase;
  /** `paths`: the admitted root/file option values, for the executor to resolve physically before it runs anything. */
  readonly run: Readonly<{ kind: 'process'; argv: readonly string[]; credentials: readonly string[]; paths: readonly string[] }>
    | Readonly<{ kind: 'port'; port: string; options: Readonly<Record<string, string>> }>;
}

const OPTION_VALUE: Readonly<Record<Exclude<ToolOption['kind'], 'root' | 'file'>, RegExp>> = freeze({
  namespace: /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u, version: /^[0-9]{1,6}\.[0-9]{1,6}\.[0-9]{1,6}$/u,
  count: /^[1-9][0-9]{0,5}$/u, account: /^-?[1-9][0-9]{0,19}$/u,
});
const scopedPath = (value: string, scopes: ToolScopes) => value.startsWith('/') && value.length <= 1024
  && !/(?:^|\/)\.{1,2}(?:\/|$)|\/\/|\/$|[\0\n]/u.test(value)
  && scopes.roots.some(root => root.startsWith('/') && (value === root || value.startsWith(`${root}/`)));

/** Validates a proposal against the inventory, the harness's grants and the owner's scopes; never widens any. */
export function admitToolProposal(proposal: unknown, grants: readonly string[], context: BoundaryContext,
  scopes: ToolScopes = { roots: [] }): Result<AdmittedTool> {
  return boundary('DevelopmentToolAdmission', proposal, context, () => {
    const candidate = proposal as Partial<ToolProposal> | null;
    ensure(candidate && typeof candidate.operation === 'string' && Array.isArray(candidate.params), 'tool proposal malformed');
    const tool = DEVELOPMENT_TOOLS.find(item => item.id === candidate.operation);
    ensure(tool, `tool ${candidate.operation} is not registered`);
    const missing = tool.grants.filter(grant => !grants.includes(grant));
    ensure(missing.length === 0, `tool ${tool.id} requires ${missing.join(', ')}`);
    const params = candidate.params as readonly unknown[];
    if (tool.params === null) ensure(params.length === 0, `tool ${tool.id} takes no parameters`);
    else {
      const shape = tool.params;
      ensure(params.length <= shape.max, `tool ${tool.id} accepts at most ${shape.max} parameters`);
      ensure(params.every(value => typeof value === 'string' && shape.pattern.test(value)), `tool ${tool.id} parameter outside its scope`);
    }
    let declared: readonly ToolOption[] = tool.options ?? [];
    const prefix: string[] = [];
    if (tool.subcommands) {
      const subcommand = candidate.subcommand;
      ensure(typeof subcommand === 'string' && Object.hasOwn(tool.subcommands, subcommand), `tool ${tool.id} subcommand not registered`);
      declared = tool.subcommands[subcommand]!; prefix.push(subcommand);
    } else ensure(candidate.subcommand === undefined, `tool ${tool.id} takes no subcommand`);
    const given = candidate.options ?? {};
    ensure(typeof given === 'object' && given !== null && !Array.isArray(given), `tool ${tool.id} options malformed`);
    for (const name of Object.keys(given)) ensure(declared.some(item => item.name === name), `tool ${tool.id} option ${name} is not registered`);
    const options: Record<string, string> = {};
    for (const item of declared) {
      const value = (given as Record<string, unknown>)[item.name];
      if (value === undefined) { ensure(!item.required, `tool ${tool.id} requires --${item.name}`); continue; }
      ensure(typeof value === 'string' && (item.kind === 'root' || item.kind === 'file' ? scopedPath(value, scopes) : OPTION_VALUE[item.kind].test(value)),
        `tool ${tool.id} option ${item.name} outside its scope`);
      options[item.name] = value;
    }
    if (tool.run.kind === 'port') return freeze({ tool: tool.id, phase: tool.phase, run: { kind: 'port' as const, port: tool.run.port, options } });
    return freeze({ tool: tool.id, phase: tool.phase, run: { kind: 'process' as const,
      argv: [...tool.run.argv, ...prefix, ...Object.entries(options).flatMap(([name, value]) => [`--${name}`, value]), ...params as string[]],
      credentials: [...tool.credentials ?? []],
      paths: declared.filter(item => item.kind === 'root' || item.kind === 'file').flatMap(item => options[item.name] === undefined ? [] : [options[item.name]!]) } });
  });
}
