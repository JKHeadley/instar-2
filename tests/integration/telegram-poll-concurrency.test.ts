// Live 2026-09-29 (cint-L4 canary): the Telegram long poll ran as a synchronous child, so for its
// whole wait the runner's event loop was frozen. A provider launch already in flight (its version
// preflight, its start-evidence query and gate) could not observe its own finished child, and its
// timer fired first: the answer was held as "lost". This composes the same two physical parts offline:
// the host resource owner's launch and the transport's long poll against a held local endpoint.
import { createServer, type Server } from 'node:http';
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error The physical host remains JavaScript.
import { createResourceOwner } from '../../scripts/resource-owner.mjs';
// @ts-expect-error The physical host remains JavaScript.
import { createProductionTelegramIO } from '../../scripts/production-boot-io.mjs';

const TEST_TOKEN = '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const HOLD_MS = 3000, LAUNCH_TIMEOUT_MS = 1500;
const roots: string[] = [], servers: Server[] = [];
afterEach(() => {
  servers.splice(0).forEach(server => server.close());
  roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true }));
});

async function compose(mode: 'poll' | 'invoke') {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'telegram-poll-')));
  roots.push(root);
  // A long poll that holds its answer, as getUpdates does when no message is waiting.
  const server = createServer((request, response) => {
    request.resume();
    request.on('end', () => setTimeout(() => {
      response.writeHead(200, { 'content-type': 'application/json' }); response.end('{"ok":true,"result":[]}');
    }, HOLD_MS));
  });
  servers.push(server);
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('test endpoint unbound');
  const captures = new Map<string, string>();
  const telegram = createProductionTelegramIO(join(root, '.writer'), {
    preserve: (ref: string, bytes: string) => { captures.set(ref, bytes); return true; },
    read: (ref: string) => captures.get(ref) ?? null }, `http://127.0.0.1:${address.port}`);
  const owner = createResourceOwner();
  await owner.attach({ statePath: join(root, 'resources.json') });
  const started = performance.now();
  let launchSettledAt = 0;
  // The child marks that it is running (its gate opened, its timer armed) before its ~0.5 s of work.
  const marker = join(root, 'launched');
  const launch = owner.execute({ executable: '/bin/sh', args: ['-c', `echo > '${marker}'; sleep 0.5; echo ok`], cwd: root, env: { PATH: '/usr/bin:/bin' },
    stdin: '', timeout: LAUNCH_TIMEOUT_MS, maxBytes: 1024 }, 'answer')
    .then((result: unknown) => { launchSettledAt = performance.now() - started; return result; });
  // The launch is in flight (like a ~0.3 s version preflight) when the runner's poll cycle starts its long poll.
  // Wait for the child itself rather than a fixed delay: under load the owner's admission and process-limit
  // queries can outlast any fixed delay, and a launch not yet spawned is never frozen mid-flight.
  for (const deadline = performance.now() + 10000; !existsSync(marker);) {
    if (performance.now() > deadline) throw Error('launch never started');
    await new Promise(done => setTimeout(done, 5));
  }
  const request = { method: 'getUpdates', body: { offset: 0, limit: 10, timeout: 3 }, timeoutMs: HOLD_MS + 2000 };
  const polled = mode === 'poll' ? await telegram.poll(request, TEST_TOKEN) : telegram.invoke(request, TEST_TOKEN);
  const polledAt = performance.now() - started;
  return { launch: await launch, polled, polledAt, launchSettledAt };
}

it('the long poll waits without freezing a concurrent launch: the finished child is observed, not timed out',
  { timeout: 30000 }, async () => {
    const { launch, polled, polledAt, launchSettledAt } = await compose('poll');
    expect(launch).toMatchObject({ code: 0, limited: false, localLimit: null, stdout: 'ok\n' });
    expect(launchSettledAt).toBeLessThan(polledAt);
    expect(polled).toMatchObject({ kind: 'response', status: 200 });
    expect(JSON.parse((polled as { bytes: string }).bytes)).toEqual({ ok: true, result: [] });
  });

it('the same composition over the synchronous transport freezes the launch past its timeout (the live failure)',
  { timeout: 30000 }, async () => {
    const { launch } = await compose('invoke');
    expect(launch).toMatchObject({ limited: true, localLimit: 'timeout', stdout: '' });
  });
