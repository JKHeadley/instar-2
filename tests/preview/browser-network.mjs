// Rules 1/4/18: browser HTTP hooks cannot observe UDP/DNS or every CDP transport.
// The browser process may reach only this custodian proxy; destination admission precedes DNS/dial.
import http from 'node:http';
import net from 'node:net';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EGRESS_LIMITS } from './egress-proxy.mjs';
export async function browserNetwork(network) {
  const sockets = new Set(); let requests = 0, bytes = 0, closed = false;
  const track = socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); socket.on('error', () => socket.destroy()); socket.on('data', chunk => { bytes += chunk.length; if (bytes > EGRESS_LIMITS.maxBytes) { closed = true; for (const live of sockets) live.destroy(); } }); socket.setTimeout(EGRESS_LIMITS.idleMs, () => socket.destroy()); };
  const bounded = (source, target) => { source.pipe(target); source.on('close', () => { if (!source.readableEnded) target.destroy(); }); };
  const admit = async (url, send) => {
    const serial = ++requests;
    if (closed || serial > EGRESS_LIMITS.maxRequests) throw Error('browser network bound');
    return network({ method: 'CONNECT', url: url.origin, headers: {}, postData: `connection:${serial}` }, send);
  };
  const proxy = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url);
      if (url.protocol !== 'http:' || url.username || url.password) throw Error('proxy destination');
      await admit(url, () => new Promise((resolve, reject) => {
        const out = http.request(url, { method: req.method, headers: { ...req.headers, host: url.host }, agent: false }, response => {
          res.writeHead(response.statusCode, response.headers); response.pipe(res); response.on('end', resolve); response.on('error', reject);
        });
        out.on('socket', track); out.on('error', reject); req.pipe(out);
      }));
    } catch { if (!res.headersSent) res.writeHead(403); res.end(); }
  });
  proxy.on('connection', socket => { if (closed || sockets.size >= EGRESS_LIMITS.maxConnections) return socket.destroy(); track(socket); });
  proxy.on('connect', async (req, socket, head) => {
    try {
      const url = new URL(`https://${req.url}`);
      if (url.username || url.password || url.pathname !== '/') throw Error('proxy destination');
      await admit(url, () => new Promise((resolve, reject) => {
        const upstream = net.connect(Number(url.port || 443), url.hostname);
        track(upstream); upstream.once('error', reject);
        upstream.once('connect', () => {
          socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
          if (head.length) upstream.write(head);
          bounded(socket, upstream); bounded(upstream, socket); resolve();
        });
      }));
    } catch { socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n'); }
  });
  // Browser WebSockets still use their existing per-message checkpoint; preserve the proxy upgrade transport.
  proxy.on('upgrade', async (req, socket, head) => {
    try {
      const url = new URL(req.url);
      if (!['http:', 'ws:'].includes(url.protocol) || url.username || url.password) throw Error('proxy destination');
      await admit(url, () => new Promise((resolve, reject) => {
        const upstream = net.connect(Number(url.port || 80), url.hostname); track(upstream); upstream.once('error', reject);
        upstream.once('connect', () => {
          upstream.write(`${req.method} ${url.pathname}${url.search} HTTP/1.1\r\n${Object.entries({...req.headers, host:url.host}).map(([name,value])=>`${name}: ${value}`).join('\r\n')}\r\n\r\n`);
          if (head.length) upstream.write(head); bounded(socket, upstream); bounded(upstream, socket); resolve();
        });
      }));
    } catch { socket.destroy(); }
  });
  await new Promise((resolve, reject) => { proxy.once('error', reject); proxy.listen(0, '127.0.0.1', resolve); });
  return { port: proxy.address().port, close: async () => { closed = true; for (const socket of sockets) socket.destroy(); await new Promise(resolve => proxy.close(resolve)); } };
}
export function confinedBrowser(executable, port) {
  if (process.platform !== 'darwin') throw Error('browser network confinement unavailable');
  const root = mkdtempSync(join(tmpdir(), 'instar-browser-network-')), wrapper = join(root, 'chromium');
  const quote = text => `'${text.replaceAll("'", "'\\''")}'`;
  // Chromium needs local singleton IPC; this permits no IP listener or outbound Unix connection.
  const policy = `(version 1)(allow default)(deny network*)(allow network-bind network-inbound (local unix-socket))(allow network-outbound (remote tcp "localhost:${port}"))`;
  writeFileSync(wrapper, `#!/bin/sh\nexec /usr/bin/sandbox-exec -p ${quote(policy)} ${quote(executable)} "$@"\n`, {mode:0o700});
  return { executablePath: wrapper, close: () => rmSync(root, {recursive:true,force:true}) };
}
