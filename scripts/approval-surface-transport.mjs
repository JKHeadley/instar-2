// Read-only transport over the existing authenticated Instar private file service.
// Transport authentication conveys bytes, never operator standing. Tracking acts
// still require the enrolled passkey signature and exact owner-issued challenge.
import { check, SURFACE_LIMITS } from './approval-surface-core.mjs';

export function createApprovalFileTransport(config, { credential, fetch: request = globalThis.fetch } = {}) {
  const endpoint = new URL(config.endpoint);
  check(endpoint.protocol === 'https:' && endpoint.pathname === '/' && !endpoint.search && !endpoint.hash
    && !endpoint.username && !endpoint.password, 'approval transport requires an exact HTTPS service origin');
  check(typeof config.agentId === 'string' && /^[A-Za-z0-9_-]{1,64}$/u.test(config.agentId), 'existing service role required');
  check(typeof config.directory === 'string' && config.directory.length <= 1024 && config.directory.length > 0
    && !config.directory.startsWith('/') && config.directory.split('/').every(part => part && part !== '.' && part !== '..'),
  'approval transport requires a fixed service-relative directory');
  check(typeof config.standing === 'string' && config.standing.trim().length > 0,
    'existing read-only service standing reference required');
  check(typeof credential === 'function', 'existing service credential resolver required');
  const read = async (path, signal, missing = false) => {
    const url = new URL('/api/files/read', endpoint);
    url.searchParams.set('path', path);
    const token = credential();
    check(typeof token === 'string' && token.length > 0 && token.length <= 8192, 'service credential unavailable');
    const response = await request(url, { method: 'GET', redirect: 'error', signal,
      headers: { Authorization: `Bearer ${token}`, 'X-Instar-AgentId': config.agentId } });
    if (missing && response.status === 404) return null;
    check(response.ok, 'private file service refused or unavailable');
    // Bound bytes while reading, not after an unbounded response.text allocation.
    const reader = response.body?.getReader(); check(reader, 'private file response missing');
    const chunks = []; let size = 0;
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.byteLength;
        check(size <= 2 * SURFACE_LIMITS.maxBody, 'private file response exceeds bound');
        chunks.push(part.value);
      }
    } finally { await reader.cancel(); }
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    check(value.path === path && value.binary !== true, 'private file response path differs');
    return value;
  };
  let cursor = 0;
  return Object.freeze({
    async batch(kind, issued) {
      check(kind === 'request' || kind === 'act', 'closed approval file class required');
      // Owner-issued index avoids the service's 500-entry directory truncation;
      // consumed evidence remains retained without starving new requests.
      const signal = AbortSignal.timeout(4000);
      const names = kind === 'request'
        ? JSON.parse((await read(`${config.directory}/tracking-index.json`, signal)).content).requests : issued;
      const pattern = kind === 'request' ? /^[a-f0-9]{64}\.request\.json$/u : /^[a-f0-9]{64}\.json$/u;
      check(Array.isArray(names) && names.length <= 4 * SURFACE_LIMITS.maxRequests
        && names.every(name => typeof name === 'string' && pattern.test(name)), 'issued approval file index invalid');
      const files = [...new Set(names)].sort();
      const start = files.length ? cursor % files.length : 0;
      const selected = [...files.slice(start), ...files.slice(0, start)].slice(0, 64);
      cursor = start + selected.length;
      const result = [];
      for (const name of selected) {
        const row = await read(`${config.directory}/${name}`, signal, kind === 'act');
        if (row === null) continue;
        check(typeof row.content === 'string' && Buffer.byteLength(row.content) <= SURFACE_LIMITS.maxBody,
          'approval service file oversized');
        result.push({ name, content: row.content });
      }
      return result;
    },
  });
}
