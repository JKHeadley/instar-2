import { expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { COMPOSITE_SCRIPTS, DEVELOPMENT_TOOLS, admitToolProposal } from '../../src/assembly/index.js';
import { factsFixture, refused, value } from '../facts/fixtures.js';

it('Rule 2: every development script and repository check is inventoried as a shipped, scoped tool', () => {
  const scripts = Object.keys((JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }).scripts);
  const covered = new Set([...DEVELOPMENT_TOOLS.flatMap(tool => tool.packageScripts), ...Object.keys(COMPOSITE_SCRIPTS)]);
  expect(scripts.filter(script => !covered.has(script))).toEqual([]);
  for (const ids of Object.values(COMPOSITE_SCRIPTS)) for (const id of ids) expect(DEVELOPMENT_TOOLS.some(tool => tool.id === id)).toBe(true);
  const repositoryCheck = DEVELOPMENT_TOOLS.find(tool => tool.id === 'repository-check')!.params!.pattern;
  expect(readdirSync('scripts').filter(name => /^check-.*\.mjs$/u.test(name)).filter(name => !repositoryCheck.test(`scripts/${name}`))).toEqual([]);
  for (const tool of DEVELOPMENT_TOOLS) if (tool.run.kind === 'process')
    for (const arg of tool.run.argv.filter(item => /\.(?:mjs|ts)$/u.test(item))) expect(existsSync(arg), `${tool.id}: ${arg}`).toBe(true);
  expect(new Set(DEVELOPMENT_TOOLS.map(tool => tool.phase))).toEqual(new Set(['inspect', 'build', 'test', 'review', 'package', 'install', 'migrate', 'repair']));
});

it('admits a registered tool with scoped parameters and refuses anything wider (Rules 2, 115)', () => {
  const f = factsFixture();
  expect(value(admitToolProposal({ operation: 'unit-test', params: ['tests/assembly/tool-inventory.test.ts'] }, [], f.c)).run)
    .toEqual({ kind: 'process', credentials: [], argv: ['npx', 'vitest', 'run', '--maxWorkers', '4', 'tests/assembly/tool-inventory.test.ts'] });
  expect(value(admitToolProposal({ operation: 'repository-check', params: ['scripts/check-architecture.mjs'] }, [], f.c)).tool).toBe('repository-check');
  refused(admitToolProposal({ operation: 'shell', params: ['rm -rf /'] }, [], f.c), 'not registered');
  refused(admitToolProposal({ operation: 'unit-test', params: ['../../etc/passwd.test.ts'] }, [], f.c), 'outside its scope');
  refused(admitToolProposal({ operation: 'unit-test', params: ['--reporter=../x.test.ts'] }, [], f.c), 'outside its scope');
  refused(admitToolProposal({ operation: 'typecheck', params: ['--listFiles'] }, [], f.c), 'no parameters');
  refused(admitToolProposal({ operation: 'journal-migrate', params: [] }, [], f.c), 'requires operator-storage-key');
  refused(admitToolProposal({ operation: 'journal-migrate', params: [] }, ['operator-storage-key'], f.c), 'subcommand not registered');
  // Typed options: scoped paths inside the owner's roots, the credential named by reference only.
  const scopes = { roots: ['/work/preview'] };
  expect(value(admitToolProposal({ operation: 'journal-migrate', params: [], subcommand: 'import',
    options: { 'new-root': '/work/preview/new', 'export-file': '/work/preview/transfer.enc' } }, ['operator-storage-key'], f.c, scopes)).run)
    .toEqual({ kind: 'process', credentials: ['preview-storage-key'], argv: ['node', '--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      'tests/preview/journal-migrate.mjs', 'import', '--new-root', '/work/preview/new', '--export-file', '/work/preview/transfer.enc'] });
  refused(admitToolProposal({ operation: 'journal-audit', params: [], options: { root: '/work/other' } }, ['operator-storage-key'], f.c, scopes), 'outside its scope');
  refused(admitToolProposal({ operation: 'journal-audit', params: [], options: { root: '/work/preview/../x' } }, ['operator-storage-key'], f.c, scopes), 'outside its scope');
  refused(admitToolProposal({ operation: 'journal-audit', params: [], options: {} }, ['operator-storage-key'], f.c, scopes), 'requires --root');
  expect(value(admitToolProposal({ operation: 'install-package', params: [], options: { namespace: 'agent.x', version: '1.0.0' } }, ['local-install'], f.c)).run)
    .toEqual({ kind: 'port', port: 'installLocalCapability', options: { namespace: 'agent.x', version: '1.0.0' } });
  refused(admitToolProposal({ operation: 'stage-package', params: [], options: { namespace: 'agent.x', version: '--force' } }, [], f.c), 'outside its scope');
  refused(admitToolProposal({ operation: 'package-test', params: Array.from({ length: 11 }, (_, i) => `t${i}.test.mjs`) }, [], f.c), 'at most 10');
});
