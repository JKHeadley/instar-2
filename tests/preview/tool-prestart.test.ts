import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { afterEach, expect, it } from 'vitest';
import { openPreviewJournal } from './journal.js';
import { SINGLE_MACHINE_PROFILE } from './activation-authority.js';
import { subscriptionModelCommand, SUBSCRIPTION_TOOLS_FRAMING } from '../../src/assembly/production-provider.js';
// @ts-expect-error Physical runner JavaScript.
import { prepareNextToolTurn, runToolTurn, reconcileToolTurns } from './tool-turn.mjs';
// @ts-expect-error Physical host JavaScript.
import { createResourceOwner, RESOURCE_CEILINGS } from '../../scripts/resource-owner.mjs';
// @ts-expect-error Physical host JavaScript.
import { prestartProvider } from '../../scripts/provider-prestart.mjs';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'tool-prestart-'))), mount = realpathSync(mkdtempSync('/private/tmp/itt-'));
  roots.push(root, mount);
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(7), { kind: 'genesis',
    bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
    expires: 9_999_999_999_999, maxCalls: 1000, maxReplies: 10, maxTurns: 10, maxBytes: 32768, cursor: 0 });
  let closes = 0, unmounts = 0;
  const provider = { close: async () => { closes++; } };
  const options = { root, journal, conversation: 'private-root', session: null, authority: 'tools:current',
    id: 'telegram:12345678:update:5', prepared: 'current packet', promptLimit: 32768,
    deniedRoots: [root], operations: SINGLE_MACHINE_PROFILE.operations,
    harness: { ready: true, user: 'fixture', runner: 'fixture', hookScript: join(root, 'hook.mjs') },
    stateRoot: () => { const dir = join(root, 'harness'); mkdirSync(dir, { recursive: true }); return dir; },
    grant: { volume: () => {}, state: (dir: string) => { mkdirSync(dir); return { open: () => {} }; },
      socket: () => mkdtempSync(join(mount, 's-')) },
    scratch: () => mount, unmount: () => { unmounts++; return true; }, detach: () => true,
    egress: async () => ({ port: 12345, close: async () => {} }), networkTools: () => ({ reads: [] }),
    now: () => 1, redactText: (text: string) => text, stopped: () => false,
    fallback: async () => ({ state: 'rejected' }) };
  return { root, mount, journal, options, provider, closes: () => closes, unmounts: () => unmounts };
}

it('prepares before the next update exists, then uses its fresh state under the actual durable reservation', async () => {
  const f = fixture(); let launches = 0;
  const warm = await prepareNextToolTurn(f.options, () => { launches++; return f.provider; });
  expect(warm).not.toBeNull();
  expect(f.journal.view.calls).toBe(0);
  expect(f.journal.view.toolTurns?.invocations ?? 0).toBe(0);
  try {
    const result = await runToolTurn({ ...f.options, prestart: warm, invoke: async (scope: { stateDirectory: string; prestarted: unknown }) => {
      expect(scope.prestarted).toBe(f.provider);
      expect(f.journal.view.toolTurns?.open).toContain(`${f.options.id}#0`);
      expect(existsSync(join(scope.stateDirectory, 'slots'))).toBe(false);
      expect(JSON.parse(readFileSync(join(f.root, 'tool-turns/next-0/claim.json'), 'utf8'))).toEqual({ id: f.options.id, attempt: 0 });
      return { state: 'complete', value: 'answer' };
    } });
    expect(result.result).toEqual({ state: 'complete', value: 'answer' });
    expect(f.journal.view.toolTurns?.open).toEqual([]);
    expect(launches).toBe(1);
    expect(await warm.take(f.options)).toBeNull();
  } finally { await warm.close(); }
  expect(f.unmounts()).toBe(1);
});

for (const change of [
  { conversation: 'different-topic' }, { authority: 'withdrawn-and-replaced' },
  { deniedRoots: ['/different-root'] }, { effectPolicy: { changed: true } }, { mcp: { servers: { changed: {} } } },
]) it(`discards a prediction whose binding changed: ${Object.keys(change)[0]}`, async () => {
  const f = fixture(), warm = await prepareNextToolTurn(f.options, () => f.provider);
  try { expect(await warm.take({ ...f.options, ...change })).toBeNull(); }
  finally { await warm.close(); }
  expect(f.closes()).toBe(1);
  expect(f.journal.view.calls).toBe(0);
  expect(f.unmounts()).toBe(1);
});

it('does not speculate MCP startup, a withdrawn identity, or a stopped turn', async () => {
  const f = fixture(); let launches = 0;
  for (const change of [{ mcp: { servers: { tool: {} } } }, { stopped: () => true }, { harness: { ready: false } },
    { admission: { harness: 'checkpointed' } }])
    expect(await prepareNextToolTurn({ ...f.options, ...change }, () => { launches++; return f.provider; })).toBeNull();
  expect(launches).toBe(0);
});

it('uses different admission state and a fresh provider on successive turns of the same root', async () => {
  const f = fixture(), states: string[] = [], providers: object[] = [];
  for (const update of [5, 6]) {
    const options = { ...f.options, id: `telegram:12345678:update:${update}` };
    const warm = await prepareNextToolTurn(options, () => {
      const provider = { close: async () => {} }; providers.push(provider); return provider;
    });
    try {
      await runToolTurn({ ...options, prestart: warm, invoke: async (scope: { stateDirectory: string; prestarted: object }) => {
        states.push(scope.stateDirectory);
        expect(scope.prestarted).toBe(providers.at(-1));
        return { state: 'complete', value: 'answer' };
      } });
    } finally { await warm.close(); }
  }
  expect(new Set(states).size).toBe(2);
  expect(new Set(providers).size).toBe(2);
  expect(f.journal.view.toolTurns?.invocations).toBe(2);
});

it('retains failed cleanup and its confinement instead of admitting a replacement', async () => {
  const f = fixture();
  const warm = await prepareNextToolTurn(f.options, () => ({ close: async () => { throw Error('cleanup unresolved'); } }));
  const resources = await warm.take(f.options);
  try {
    await expect(warm.close()).rejects.toThrow('cleanup unresolved');
    await expect(warm.take(f.options)).rejects.toThrow('cleanup unresolved');
    expect(f.unmounts()).toBe(0);
    expect(f.journal.view.calls).toBe(0);
  } finally {
    // Only the simulated provider is unresolved. Dispose this fixture's real sockets.
    await resources.checkpoint.close(); await resources.closeSecrets();
  }
});

it.runIf(existsSync('/Users/Shared/instar-harness/bin/claude-2.1.280'))('measures cold and pre-started answer stages on isolated copies through the pinned CLI', async () => {
  const captured = JSON.parse(readFileSync(join(__dirname, 'fixtures/tool-turn/live-2026-10-03/task.json'), 'utf8'));
  const content = JSON.parse(captured.raw).result;
  let requests = 0;
  const server = createServer(async (request, response) => {
    let body = ''; for await (const part of request) body += part;
    if (!request.url?.startsWith('/v1/messages')) { response.end('{}'); return; }
    requests++;
    const query = JSON.parse(body);
    const message = { id: `msg_${requests}`, type: 'message', role: 'assistant', model: query.model,
      content: [{ type: 'text', text: content }], stop_reason: 'end_turn', stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 } };
    if (!query.stream) { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify(message)); return; }
    response.setHeader('content-type', 'text/event-stream');
    const event = (type: string, data: object) => response.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
    event('message_start', { message: { ...message, content: [], stop_reason: null, usage: { input_tokens: 10, output_tokens: 0 } } });
    event('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
    event('content_block_delta', { index: 0, delta: { type: 'text_delta', text: content } });
    event('content_block_stop', { index: 0 });
    event('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 10 } });
    event('message_stop', {}); response.end();
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw Error('loopback address absent');
  const measurements: { warm: boolean; answerStageSeconds: number; requests: number }[] = [];
  try {
    for (const warm of [false, true, false, true]) {
      const f = fixture(), home = join(f.root, 'home'), configDirectory = join(f.root, 'config');
      mkdirSync(home); mkdirSync(configDirectory);
      const owner = createResourceOwner({ ...RESOURCE_CEILINGS,
        launch: { ...RESOURCE_CEILINGS.launch, processCount: 256 } });
      await owner.attach({});
      const command = (scope: Parameters<typeof subscriptionModelCommand>[3]) => {
        const input = subscriptionModelCommand({ executable: '/Users/Shared/instar-harness/bin/claude-2.1.280', home,
          configDirectory, workingDirectory: f.root }, 'claude-sonnet-5', SUBSCRIPTION_TOOLS_FRAMING, scope);
        return { ...input, env: { ...input.env, ANTHROPIC_API_KEY: 'not-a-live-credential',
          ANTHROPIC_BASE_URL: `http://127.0.0.1:${address.port}` }, timeout: 20000, stdin: 'Replay the recorded local answer.' };
      };
      const initial = requests;
      const parked = warm ? await prepareNextToolTurn(f.options,
        (scope: Parameters<typeof command>[0]) => prestartProvider(command(scope), { owner })) : null;
      try {
        if (warm) {
          expect(parked).not.toBeNull();
          // An injected idle interval, never host load. All worker lifetimes are foreground-owned.
          await new Promise(resolve => setTimeout(resolve, 1000));
          expect(requests).toBe(initial);
        }
        const started = performance.now();
        const result = await runToolTurn({ ...f.options, prestart: parked,
          invoke: async (scope: Parameters<typeof command>[0] & { prestarted?: { consume(input: unknown): Promise<unknown> | null } }) => {
            const input = command(scope);
            const ready = scope?.prestarted?.consume(input);
            if (warm) expect(ready).not.toBeNull();
            const raw = await (ready ?? owner.execute(input, 'answer'));
            expect(raw).toMatchObject({ code: 0, limited: false });
            const frame = JSON.parse((raw as { stdout: string }).stdout);
            expect(frame.result).toBe(content);
            return { state: 'complete', value: frame.result };
          } });
        expect(result.result.state).toBe('complete');
        measurements.push({ warm, answerStageSeconds: (performance.now() - started) / 1000, requests: requests - initial });
        expect(requests - initial).toBe(1);
      } finally { await parked?.close(); }
    }
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  console.info(JSON.stringify({ subject: 'runToolTurn answer stage, copied fixture roots, real pinned CLI and resource owner; recorded loopback answer; excludes subscription preflights', measurements }));
}, 60000);

it('recovers only a claimed speculative directory, preserving the actual operation identity', async () => {
  const f = fixture(), warm = await prepareNextToolTurn(f.options, () => f.provider);
  try {
    const taken = await warm.take(f.options);
    f.journal.append({ kind: 'tool-turn', phase: 'reserved', id: f.options.id, attempt: 0, calls: 1, at: 1 });
    const recover = () => reconcileToolTurns({ root: f.root, journal: f.journal, redactText: (text: string) => text, now: () => 2 });
    expect(recover()).toEqual([]); // no operation may inherit unclaimed speculative evidence
    writeFileSync(join(taken.turn.directory, 'claim.json'), 'null');
    expect(recover()).toEqual([]);
    taken.admit();
    writeFileSync(join(taken.turn.stateDirectory, 'admission.jsonl'), '');
    expect(recover()).toEqual([`${f.options.id}#0`]);
    // This test interrupted before runToolTurn could take cleanup ownership.
    await taken.checkpoint.close(); await taken.closeSecrets();
  } finally { await warm.close(); }
});
