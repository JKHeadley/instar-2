import { expect, it } from 'vitest';
import { createApprovalFileTransport } from '../../scripts/approval-surface-transport.mjs';
import { SURFACE_LIMITS } from '../../scripts/approval-surface-core.mjs';

const config = { endpoint: 'https://private-service.invalid', agentId: 'fixture-role',
  directory: 'private/requests', standing: 'isolated-existing-role' };
const name = `${'a'.repeat(64)}.request.json`;

it('uses only the fixed authenticated read endpoint and refuses substituted paths, forged indices, oversized responses and denied reads', async () => {
  let mode = 'valid', reads = 0;
  const transport = createApprovalFileTransport(config, { credential: () => 'fixture-only',
    fetch: async (url: URL, options: RequestInit) => {
      reads++;
      expect(url.origin).toBe(config.endpoint); expect(url.pathname).toBe('/api/files/read');
      expect(options).toMatchObject({ method: 'GET', redirect: 'error',
        headers: { Authorization: 'Bearer fixture-only', 'X-Instar-AgentId': config.agentId } });
      const path = url.searchParams.get('path');
      if (mode === 'denied') return new Response('', { status: 403 });
      if (mode === 'oversize') return new Response('x'.repeat(2 * SURFACE_LIMITS.maxBody + 1));
      return Response.json({ path: mode === 'substitute' ? 'somewhere-else' : path,
        content: path?.endsWith('tracking-index.json') ? JSON.stringify({ requests: [mode === 'forged' ? '../keys.json' : name] }) : '{}' });
    } });
  expect(await transport.batch('request')).toEqual([{ name, content: '{}' }]);
  for (const failure of ['substitute', 'forged', 'oversize', 'denied']) {
    mode = failure;
    const before = reads;
    await expect(transport.batch('request')).rejects.toThrow();
    expect(reads).toBe(before + 1); // an invalid index never becomes a path traversal or another read
  }
});

it('never broadens a service refusal, permits only explicitly issued act filenames, and retains a batch-wide timeout', async () => {
  const signals: AbortSignal[] = [];
  const transport = createApprovalFileTransport(config, { credential: () => 'fixture-only',
    fetch: async (_url: URL, options: RequestInit) => { signals.push(options.signal!); return new Response('', { status: 404 }); } });
  await expect(transport.batch('act', ['../operator-keys.json'])).rejects.toThrow(/index/);
  expect(signals).toHaveLength(0);
  expect(await transport.batch('act', [`${'a'.repeat(64)}.json`, `${'b'.repeat(64)}.json`])).toEqual([]);
  expect(signals[0]).toBe(signals[1]);
  await expect(transport.batch('request')).rejects.toThrow(/refused/);
  for (const changes of [{ endpoint: 'http://private-service.invalid' }, { endpoint: 'https://other.invalid/path' },
    { directory: '../private' }, { directory: '/private' }, { agentId: '' }, { standing: '' }])
    expect(() => createApprovalFileTransport({ ...config, ...changes }, { credential: () => 'fixture-only' })).toThrow();
});
