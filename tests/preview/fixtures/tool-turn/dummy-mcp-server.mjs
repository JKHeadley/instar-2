#!/usr/bin/env node
// A minimal stdio MCP server for the full-tool live test: one read tool and one write tool. It holds a dummy
// credential in its environment (never a real secret) so the test can show the sandboxed shell cannot see it.
import { appendFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const log = process.env.MCP_DUMMY_LOG;
const send = message => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
const tools = [
  { name: 'lookup', description: 'Returns the stored value for a key (read only).', inputSchema: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] },
    annotations: { readOnlyHint: true } },
  { name: 'post_note', description: 'Posts a note to the shared board (a write to a third-party account).', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
];
createInterface({ input: process.stdin }).on('line', line => {
  let request; try { request = JSON.parse(line); } catch { return; }
  if (request.id === undefined) return;
  if (request.method === 'initialize') return send({ id: request.id, result: { protocolVersion: request.params?.protocolVersion ?? '2025-06-18',
    capabilities: { tools: {} }, serverInfo: { name: 'dummy', version: '1.0.0' } } });
  if (request.method === 'tools/list') return send({ id: request.id, result: { tools } });
  if (request.method === 'tools/call') {
    if (log) appendFileSync(log, `${JSON.stringify({ tool: request.params?.name, arguments: request.params?.arguments })}\n`);
    const text = request.params?.name === 'lookup' ? `value-of-${String(request.params?.arguments?.key)}: 7319`
      : request.params?.name === 'post_note' ? 'posted' : 'unknown tool';
    return send({ id: request.id, result: { content: [{ type: 'text', text }] } });
  }
  send({ id: request.id, error: { code: -32601, message: 'method not found' } });
});
