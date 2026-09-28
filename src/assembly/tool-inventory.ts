import { boundary, ensure, freeze } from './boundary.js';
import type { BoundaryContext, Result } from '../index.js';

/**
 * Rules 2 and 115 (D14 §9): every tool used to inspect, build, test, review, package, install,
 * migrate and repair Instar, exposed as a scoped tool a harness may propose. A tool is a proposal
 * with a registered operation id and scoped parameters; admission validates it; the harness never
 * runs a shell, chooses an executable or widens its own grants.
 */
export type ToolPhase = 'inspect' | 'build' | 'test' | 'review' | 'package' | 'install' | 'migrate' | 'repair';
export interface DevelopmentTool {
  readonly id: string;
  readonly phase: ToolPhase;
  /** A fixed argument vector (process tools) or a public port the harness calls (port tools). */
  readonly run: Readonly<{ kind: 'process'; argv: readonly string[] }> | Readonly<{ kind: 'port'; port: string }>;
  /** Scoped parameters appended to argv: each must be a repository-relative path of this shape. */
  readonly params: Readonly<{ pattern: RegExp; max: number }> | null;
  /** The package.json scripts this tool is (the inventory must cover every script). */
  readonly packageScripts: readonly string[];
  /** Grants the tool needs beyond the harness's working scope; admission refuses without them. */
  readonly grants: readonly string[];
  /** The shipped feature this tool serves. */
  readonly feature: string;
}

const path = (shape: string) => new RegExp(`^(?!-)(?!.*(?:^|/)\\.\\.(?:/|$))${shape}$`, 'u');
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
  { id: 'stage-package', phase: 'package', run: { kind: 'port', port: 'stageLocalCapability' }, params: null,
    packageScripts: [], grants: [], feature: 'local-capability-packages' },
  { id: 'install-package', phase: 'install', run: { kind: 'port', port: 'installLocalCapability' }, params: null,
    packageScripts: [], grants: ['local-install'], feature: 'local-capability-packages' },
  { id: 'journal-migrate', phase: 'migrate', run: { kind: 'process', argv: ['node', '--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
    'tests/preview/journal-migrate.mjs'] }, params: null, packageScripts: [], grants: ['operator-storage-key'], feature: 'preview-journal' },
  { id: 'journal-audit', phase: 'repair', run: { kind: 'process', argv: ['node', '--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
    'tests/preview/journal-agent.mjs', 'audit'] }, params: null, packageScripts: [], grants: ['operator-storage-key'], feature: 'preview-journal' },
] satisfies DevelopmentTool[]);
/** package.json scripts that only chain inventoried tools. */
export const COMPOSITE_SCRIPTS: Readonly<Record<string, readonly string[]>> = freeze({
  lint: ['architecture-check', 'repository-check'],
  'test:all': ['typecheck', 'build', 'kill-schedule', 'unit-test', 'architecture-check', 'repository-check', 'register-check'],
});

export interface ToolProposal { readonly operation: string; readonly params: readonly string[] }
export interface AdmittedTool {
  readonly tool: string; readonly phase: ToolPhase;
  readonly run: Readonly<{ kind: 'process'; argv: readonly string[] }> | Readonly<{ kind: 'port'; port: string }>;
}

/** Validates a proposal against the inventory and the harness's grants; never widens either. */
export function admitToolProposal(proposal: unknown, grants: readonly string[], context: BoundaryContext): Result<AdmittedTool> {
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
    return freeze(tool.run.kind === 'process'
      ? { tool: tool.id, phase: tool.phase, run: { kind: 'process' as const, argv: [...tool.run.argv, ...params as string[]] } }
      : { tool: tool.id, phase: tool.phase, run: { kind: 'port' as const, port: tool.run.port } });
  });
}
