import { createHash } from 'node:crypto';
import { chmodSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createClaudeCodeProductionRoute } from '../../src/assembly/production-provider.js';
import { factsFixture, refused, value } from '../facts/fixtures.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture(body: string) {
  const f = factsFixture(), root = realpathSync(mkdtempSync(join(tmpdir(), 'production-provider-')));
  roots.push(root);
  const executable = join(root, 'test-cli.mjs'), bytes = `#!${process.execPath}\n${body}\n`;
  writeFileSync(executable, bytes); chmodSync(executable, 0o700);
  let resolves = 0;
  const input = { provider: 'anthropic', model: 'explicit-model', route: 'registered-route',
    disclosure: 'CLI receives recorded envelope as text; provider internal context unavailable',
    credential: { type: 'SecretRef' as const, schemaVersion: 1 as const, vault: 'vault', name: 'provider-test-only' },
    context: { ...f.ctx.decode, site: f.c.site, preserved: f.c.preserved },
    resolve: () => { resolves++; return 'synthetic-test-credential'; }, executable,
    artifact: `sha256:${createHash('sha256').update(bytes).digest('hex')}`, workingDirectory: root };
  const bounds = { operation: 'operation:test', deadline: 10000, timeout: 2000,
    maxOutputBytes: 4096, maxTokens: 128, maxCharge: 20, automaticRetries: 0 as const };
  return { root, input, bounds, resolves: () => resolves };
}

it('production provider transport: exact stdin, bounded receipt, explicit model, no inherited secret or retry settings', async () => {
  const f = fixture(`import {writeFileSync} from 'node:fs';
    let text=''; for await (const bytes of process.stdin) text+=bytes;
    writeFileSync('observed.json', JSON.stringify({text,args:process.argv.slice(2),
      retries:process.env.CLAUDE_CODE_MAX_RETRIES,token:process.env.ANTHROPIC_API_KEY,
      unexpected:process.env.INSTAR_PROVIDER_TEST_PARENT ?? null}));
    process.stdout.write(JSON.stringify({type:'result',is_error:false,result:'{"decision":"recorded"}',
      session_id:'test-cli-operation',usage:{input_tokens:3,output_tokens:4},total_cost_usd:0.000002}));`);
  process.env.INSTAR_PROVIDER_TEST_PARENT = 'must-not-inherit';
  try {
    const route = value(createClaudeCodeProductionRoute(f.input));
    const submitted = '{"messages":[{"role":"context","content":"exact"}]}';
    expect(await route.invoke(submitted, f.bounds)).toMatchObject({ state: 'complete',
      providerOperation: 'test-cli-operation', usage: { inputTokens: 3, outputTokens: 4, charge: 2 } });
    const observed = JSON.parse(readFileSync(join(f.root, 'observed.json'), 'utf8'));
    expect(observed).toMatchObject({ text: submitted, retries: '0', token: 'synthetic-test-credential', unexpected: null });
    expect(observed.args).toContain('--no-session-persistence');
    expect(observed.args).toContain('--strict-mcp-config');
    expect(observed.args).toContain('{"disableAllHooks":true}');
    expect(f.resolves()).toBe(1); expect(JSON.stringify(route)).not.toContain('synthetic-test-credential');
  } finally { delete process.env.INSTAR_PROVIDER_TEST_PARENT; }
});
it('production provider transport: missing SecretRef resolution refuses before child invocation', () => {
  const f = fixture("throw Error('must never execute')");
  refused(createClaudeCodeProductionRoute({ ...f.input, resolve: () => { throw Error('synthetic-private-diagnostic'); } }),
    'provider-credential: SecretRef unresolvable');
});
it('production provider transport: changed executable refuses before credentials resolve', () => {
  const f = fixture("throw Error('must never execute')");
  refused(createClaudeCodeProductionRoute({ ...f.input, artifact: `sha256:${'0'.repeat(64)}` }), 'artifact changed');
  expect(f.resolves()).toBe(0);
});
it('production provider transport: timeout retains uncertainty without retry', async () => {
  const f = fixture('setInterval(()=>{}, 1000)');
  const route = value(createClaudeCodeProductionRoute(f.input));
  expect(await route.invoke('exact', { ...f.bounds, timeout: 30 })).toMatchObject({ state: 'uncertain',
    bytes: null, providerOperation: null, retryBlocked: false });
});
