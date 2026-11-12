// Credential-free worker client; profile custody and execution remain with the claim's host.
import { connect } from 'node:net';
import { createInterface } from 'node:readline';
const socket = process.argv[2];
const read = (id, input) => new Promise(resolve => {
  let text = '', done = false;
  const link = connect(socket), finish = result => { if (!done) { done = true; link.destroy(); resolve(result); } };
  link.setEncoding('utf8'); link.setTimeout(16000, () => finish({ status: 'refused', reason: 'browser-timeout' }));
  link.on('connect', () => link.end(`browser-read ${JSON.stringify({ id: `mcp:${id}`, input })}\n`));
  link.on('data', chunk => { text += chunk; if (Buffer.byteLength(text) > 65536) finish({ status: 'refused', reason: 'result-bound' }); });
  link.on('error', () => finish({ status: 'refused', reason: 'browser-unavailable' }));
  link.on('end', () => { try { finish(JSON.parse(text)); } catch { finish({ status: 'refused', reason: 'browser-unavailable' }); } });
});
createInterface({ input: process.stdin }).on('line', async line => {
  if (Buffer.byteLength(line) > 8192) return;
  let row; try { row = JSON.parse(line); } catch { return; }
  if (row.id === undefined) return;
  const base = { jsonrpc: '2.0', id: row.id }, send = result => process.stdout.write(`${JSON.stringify({ ...base, result })}\n`);
  if (row.method === 'initialize') return send({ protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'playwright', version: '1' } });
  const result = await read(row.id, row.method === 'tools/list' ? { method: row.method } : row.params);
  send(row.method === 'tools/list' && result.tools ? { tools: result.tools }
    : { content: [{ type: 'text', text: JSON.stringify({ ...result, content: result.content?.filter(part => part.type !== 'image') }) },
      ...(result.status === 'observed' ? result.content?.filter(part => part.type === 'image') ?? [] : [])], isError: result.status !== 'observed' });
});
