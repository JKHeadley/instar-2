// Public challenge fixture, NOT a second broker or installation authority. The
// exact shipped mediated custody reader serves one fixed, harmless scoped read.
// Installed release layout puts this file beside dist/ and context.json.
import { createServer } from 'node:net';
import { chmodSync, readFileSync, unlinkSync } from 'node:fs';
import { createMediatedStoreReader } from './dist/assembly/custody.js';
import { boundary } from './dist/assembly/boundary.js';
import { consumeResult } from './dist/index.js';

const context = JSON.parse(readFileSync(new URL('./context.json', import.meta.url), 'utf8'));
const payload = 'Instar custody isolation challenge';
const success = value => boundary('IsolationProbe', null, context, () => value);
const reader = createMediatedStoreReader({
  persistence: { owner: 'part-ten', describe: () => ({ encrypted: true }), readExact: () => success([payload]) },
  policy: { id: 'policy:isolation-probe', store: 'store:public-challenge', disclosureScopes: ['probe'],
    grants: ['probe-only'], auditBound: 1, resourceBound: 128, custodians: ['service:custody'] },
  authority: { owner: 'part-one', verify: () => success(undefined) },
  context, generation: () => 'probe:1', clock: () => 0,
});
// The fixture has no real key, store, grant, login or transport. Its authority
// stub is only for this public probe; production standing is never synthesized.
const sockets = new Set(); let requests = 0;
const server = createServer({ allowHalfOpen: true }, peer => {
  if (sockets.size >= 4) { peer.destroy(); return; }
  sockets.add(peer); peer.on('close', () => sockets.delete(peer)); peer.on('error', () => peer.destroy());
  peer.setTimeout(1000, () => peer.destroy()); let bytes = '';
  peer.on('data', chunk => { bytes += chunk; if (Buffer.byteLength(bytes) > 2048) peer.destroy(); });
  peer.on('end', () => {
    let response = { state: 'refused' };
    try {
      const request = JSON.parse(bytes);
      if (++requests > 128) throw Error('request budget');
      if (JSON.stringify(request) === '{"operation":"status"}')
        response = { state: 'running', pid: process.pid, uid: process.getuid() };
      else if (Object.keys(request).sort().join(',') === 'maxBytes,operation,scope' && request.operation === 'read') {
        response = consumeResult(reader.read({ requester: 'public:probe', operation: 'probe:read',
          policy: 'policy:isolation-probe', scope: request.scope, grant: 'probe-only',
          positions: ['public:challenge'], maxBytes: request.maxBytes }), {
          Success: value => ({ state: 'allowed', bytes: value.bytes, observations: value.observations.length }),
          Refused: () => ({ state: 'refused' }),
        });
      }
    } catch { /* Exact malformed input refuses; it never reaches a secret resolver. */ }
    peer.end(JSON.stringify(response));
  });
});
const socket = process.argv[2];
server.listen(socket, () => chmodSync(socket, 0o600));
const stop = () => { for (const peer of sockets) peer.destroy(); server.close(() => { try { unlinkSync(socket); } catch {} }); clearTimeout(lifetime); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
const lifetime = setTimeout(stop, 60000);
