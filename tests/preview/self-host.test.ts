// @ts-nocheck -- the harness's model doorway is a scripted proposer; every other step is the shipped path.
import { expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { completeInstall, recoverInstalls, selfHost } from './self-host.mjs';

const context = { site: 'preview.journal', preserved: 'preview:test', register: {
  generation: { owner: 'part-three', name: 'RegisterGeneration', id: 'preview:register' },
  entries: ['preview.journal', 'preview', 'host'], producers: ['host'], methods: [], actions: {}, subjects: {},
  sites: { 'preview.journal': 'closed', 'types.decode': 'closed' }, keys: {}, allowRedelegation: false,
  conflictStanding: { ordinary: 'delegate', authority: 'operator' } }, captures: {} };
const module = body => `export function wordCount(text) { ${body} }\n`;
const test = "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { wordCount } from './word-count.mjs';\n"
  + "test('counts words', () => { assert.equal(wordCount('one two  three'), 3); assert.equal(wordCount('   '), 0); });\n";
const plan = body => JSON.stringify({ files: [{ path: 'word-count.mjs', content: module(body) }, { path: 'word-count.test.mjs', content: test }],
  tools: [{ operation: 'package-test', params: ['word-count.test.mjs'] }, { operation: 'shell', params: ['rm -rf /'] }],
  package: { namespace: 'agent.word-count', version: '1.0.0', entrypoints: [{ id: 'word-count', path: 'word-count.mjs' }],
    probe: { entrypoint: 'word-count', export: 'wordCount', input: 'the native harness built this', expect: 5 } } });

it('develops, tests, repairs, packages, installs and exercises a real local capability unattended (Rules 2, 115)', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'self-host-')));
  try {
    const prompts = [];
    // Round 1 ships a bug its own test catches; round 2 repairs it from the recorded test output.
    const replies = [plan("return text.split(' ').length;"), plan('return text.split(/\\s+/u).filter(Boolean).length;')];
    const report = await selfHost({ task: 'Build a word-count capability.', propose: async prompt => { prompts.push(JSON.parse(prompt)); return replies.shift(); },
      repo: process.cwd(), scope: join(root, 'scope'), installRoot: join(root, 'install'), grants: ['local-install'], context });
    expect(report).toMatchObject({ namespace: 'agent.word-count', passed: true, rounds: 2 });
    expect(prompts[1].feedback.failed.some(item => item.tool === 'package-test' && item.code !== 0)).toBe(true);
    expect(report.tools.find(item => item.tool === 'shell').refused).toContain('not registered');
    const active = JSON.parse(readFileSync(join(root, 'install/active/agent.word-count.json'), 'utf8'));
    expect(active).toMatchObject({ version: '1.0.0', contentDigest: report.contentDigest });
    const phases = readFileSync(join(root, 'install/self-host.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line).phase);
    expect(phases).toEqual(['written', 'tools', 'written', 'tools', 'staged', 'installed', 'exercised']);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120000);

it('refuses a file outside the package scope and an install without its grant', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'self-host-')));
  try {
    const escape = JSON.stringify({ files: [{ path: '../outside.mjs', content: 'x' }], tools: [] });
    await expect(selfHost({ task: 't', propose: async () => escape, repo: process.cwd(), scope: join(root, 'scope'),
      installRoot: join(root, 'install'), grants: ['local-install'], context })).rejects.toThrow('outside the package scope');
    await expect(selfHost({ task: 't', propose: async () => plan('return text.split(/\\s+/u).filter(Boolean).length;'), repo: process.cwd(),
      scope: join(root, 'scope2'), installRoot: join(root, 'install'), grants: [], context })).rejects.toThrow('local-install grant absent');
    expect(existsSync(join(root, 'outside.mjs'))).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120000);

it('a crash after the durable install intent is completed by the next run, once', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'self-host-')));
  try {
    const good = plan('return text.split(/\\s+/u).filter(Boolean).length;');
    await expect(selfHost({ task: 't', propose: async () => good, repo: process.cwd(), scope: join(root, 'scope'),
      installRoot: join(root, 'install'), grants: ['local-install'], context, crashAfterIntent: true })).rejects.toThrow('simulated crash');
    expect(existsSync(join(root, 'install/.intent-agent.word-count.json'))).toBe(true);
    expect(existsSync(join(root, 'install/active/agent.word-count.json'))).toBe(false);
    expect(recoverInstalls(join(root, 'install'), 1)).toEqual([join(root, 'install/packages/agent.word-count@1.0.0')]);
    expect(existsSync(join(root, 'install/active/agent.word-count.json'))).toBe(true);
    expect(completeInstall(join(root, 'install'), 'agent.word-count', 2)).toBeNull();
    const { wordCount } = await import(join(root, 'install/packages/agent.word-count@1.0.0/word-count.mjs'));
    expect(wordCount('a b c')).toBe(3);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120000);
