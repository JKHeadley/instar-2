// @ts-nocheck -- the old preview root is the offline successive fixture; every tool runs through the shipped interface.
import { expect, it } from 'vitest';
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OFFLINE_STORAGE_KEY, successiveWorld } from './successive-fixture.js';
import { openPreviewJournal } from './journal.js';
import { SELF_HOST_CONTEXT as context } from './self-host.mjs';
import { createSelfHostHarness, dispatchTool, openRecordLog, readDurable } from './self-host-harness.mjs';
import { createPackageLifecycle } from './self-host-packages.mjs';
import { hashBytes } from '../../src/facts/index.js';

const key = { env: 'INSTAR_SECRET_PREVIEW_STORAGE_KEY', value: Buffer.from(OFFLINE_STORAGE_KEY).toString('hex') };

it('dispatches every advertised tool through the same interface, including package ports and the migration and audit commands', async () => {
  const world = successiveWorld(), root = realpathSync(mkdtempSync(join(tmpdir(), 'self-host-tools-')));
  try {
    world.say('Remember the old first turn.'); world.answer('I remember the old first turn.');
    const composition = world.compose();
    try { await composition.run({ maxCycles: 3, baseBackoffMs: 1, maxBackoffMs: 2, sleep: world.sleep }); } finally { composition.close(); }
    world.state().latchStop('operator');
    const old = world.root, output = join(world.directory, 'transfer.enc'), target = join(world.directory, 'journal-new');
    const log = openRecordLog(root, context), stopped = () => false, resolved = [];
    const harness = createSelfHostHarness({ root, context, stopped, now: () => Date.now(), log,
      resolveCredential: reference => { resolved.push(reference); return reference === 'preview-storage-key' ? key : null; } });
    const lifecycle = createPackageLifecycle({ context, log, harness, stopped, work: 'work:tools' });
    const bytes = 'export const wordCount = text => text.split(/\\s+/u).filter(Boolean).length;\n';
    const declaration = { namespace: 'agent.word-count', version: '1.0.0', entrypoints: [{ id: 'word-count', path: 'word-count.mjs' }],
      probe: { entrypoint: 'word-count', export: 'wordCount', input: 'a b c', expect: 3 } };
    const testBytes = "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { wordCount } from './word-count.mjs';\ntest('counts', () => assert.equal(wordCount('a b'), 2));\n";
    const staged = () => lifecycle.stage(declaration, [{ path: 'word-count.mjs', bytes, digest: hashBytes(bytes), kind: 'file' }],
      [{ path: 'word-count.test.mjs', bytes: testBytes, digest: hashBytes(testBytes) }]);
    const ports = { 'stage-package': () => ({ contentDigest: staged().package.contentDigest }),
      'install-package': () => { const outcome = lifecycle.install(staged()); return { code: outcome.passed ? 0 : 1, passed: outcome.passed, contentDigest: outcome.active }; } };
    const scopes = { roots: [world.directory, root] }, grants = ['local-install', 'operator-storage-key'];
    const tool = proposal => dispatchTool({ proposal: { params: [], ...proposal }, grants, context, scopes, harness, repo: process.cwd(), scope: root, ports, work: 'work:tools' });

    // Package ports reach their public handlers (the core stager and the recorded lifecycle).
    const pkg = { namespace: 'agent.word-count', version: '1.0.0' };
    expect(tool({ operation: 'stage-package', options: pkg })).toMatchObject({ code: 0, contentDigest: expect.stringMatching(/^sha256:/u) });
    const installed = tool({ operation: 'install-package', options: pkg });
    expect(installed, JSON.stringify(installed)).toMatchObject({ code: 0, passed: true });
    expect(lifecycle.active('agent.word-count').contentDigest).toBe(installed.contentDigest);

    // The migration and audit commands run with typed, scoped inputs and only the owner-resolved credential.
    const exported = tool({ operation: 'journal-migrate', subcommand: 'export', options: { 'old-root': old, 'export-file': output,
      'bot-id': world.configuration.botId, 'chat-id': world.configuration.chatId, 'operator-sender-id': world.configuration.operatorSenderId } });
    expect(exported).toMatchObject({ tool: 'journal-migrate', code: 0 });
    expect(existsSync(output)).toBe(true);
    expect(tool({ operation: 'journal-migrate', subcommand: 'import', options: { 'new-root': target, 'export-file': output } })).toMatchObject({ code: 0 });
    const journal = openPreviewJournal(join(target, 'journal.encrypted'), OFFLINE_STORAGE_KEY);
    try { expect(journal.view.order[0]?.text).toBe('Remember the old first turn.'); } finally { journal.close(); }
    const audited = tool({ operation: 'journal-audit', options: { root: target } });
    // The audit ran over the imported journal and returned its report (it exits 1 exactly when it has findings).
    const report = JSON.parse(audited.stdout.trim().split('\n').at(-1));
    expect(Array.isArray(report.findings), audited.output).toBe(true);
    expect(audited.code).toBe(report.findings.length ? 1 : 0);
    expect(resolved).toEqual(['preview-storage-key', 'preview-storage-key', 'preview-storage-key']);
    // Each host tool is a native-adapter launch with its own exit observation.
    const exits = readDurable(join(root, 'assembly.jsonl')).map(row => row.record).filter(row => row.type === 'HarnessObservation' && row.phase === 'exit-observed');
    expect(exits.map(row => row.id)).toEqual(expect.arrayContaining([exported.observation, audited.observation]));

    // Invalid-scope neighbours are refused by admission before anything runs.
    const outside = join(tmpdir(), 'elsewhere');
    expect(tool({ operation: 'journal-audit', options: { root: outside } }).refused).toContain('option root outside its scope');
    expect(tool({ operation: 'journal-audit', options: { root: `${target}/../../..` } }).refused).toContain('outside its scope');
    expect(tool({ operation: 'journal-migrate', subcommand: 'export', options: { 'old-root': old } }).refused).toContain('requires --export-file');
    expect(tool({ operation: 'journal-migrate', subcommand: 'shell', options: {} }).refused).toContain('subcommand not registered');
    expect(tool({ operation: 'journal-audit', options: { root: target, extra: 'x' } }).refused).toContain('option extra is not registered');
    expect(tool({ operation: 'install-package', options: { namespace: 'agent.word-count', version: '1.0.0; rm -rf /' } }).refused).toContain('outside its scope');
    expect(dispatchTool({ proposal: { operation: 'journal-audit', params: [], options: { root: target } }, grants: ['local-install'], context, scopes,
      harness, repo: process.cwd(), scope: root, ports, work: 'w' }).refused).toContain('requires operator-storage-key');
    // A credential the owner cannot resolve refuses the run rather than launching without it.
    const unresolved = createSelfHostHarness({ root, context, stopped, now: () => Date.now(), log });
    expect(dispatchTool({ proposal: { operation: 'journal-audit', params: [], options: { root: target } }, grants, context, scopes,
      harness: unresolved, repo: process.cwd(), scope: root, ports, work: 'w' }).refused).toContain('credential preview-storage-key is not resolvable');
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 180000);
