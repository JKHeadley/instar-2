import { expect, it } from 'vitest';
import http from 'node:http';
import net from 'node:net';
import dgram from 'node:dgram';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
// @ts-expect-error browser host transport
import { browserNetwork, confinedBrowser } from './browser-network.mjs';

it('the browser proxy requires destination admission before HTTP or CONNECT reaches a local receiver', async () => {
  let hits = 0, granted = false;
  const site = http.createServer((_req,res) => { hits++; res.end('ordinary'); });
  await new Promise<void>(resolve => site.listen(0,'127.0.0.1',resolve));
  const port = (site.address() as net.AddressInfo).port;
  const proxy = await browserNetwork(async (_request: unknown, dispatch:()=>Promise<unknown>) => { if (!granted) throw Error('ungranted'); return dispatch(); });
  const get = () => new Promise<number|undefined>((resolve,reject) => {
    const request = http.get({hostname:'127.0.0.1',port:proxy.port,path:`http://127.0.0.1:${port}/`},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));}); request.on('error',reject);
  });
  const connect = () => new Promise<string>((resolve,reject) => {
    const socket = net.connect(proxy.port,'127.0.0.1',()=>socket.write(`CONNECT 127.0.0.1:${port} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\n\r\n`));
    let text=''; socket.on('data',bytes=>{text+=bytes.toString(); if (text.includes('403') || text.includes('ordinary')) {socket.destroy();resolve(text);} else if (text.includes('200 Connection Established')) socket.write('GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n');});socket.once('error',reject);
  });
  try {
    expect(await get()).toBe(403); expect(await connect()).toContain('403'); expect(hits).toBe(0);
    granted = true; expect(await get()).toBe(200); expect(hits).toBe(1); expect(await connect()).toContain('ordinary'); expect(hits).toBe(2);
  } finally { await proxy.close(); await new Promise<void>(resolve=>site.close(()=>resolve())); }
});

it.runIf(process.platform === 'darwin')('the browser process cannot send unmediated WebRTC datagrams', async () => {
  const root=mkdtempSync(join(tmpdir(),'browser-network-proof-')); const sink=dgram.createSocket('udp4'); let datagrams=0;
  sink.on('message',()=>datagrams++);await new Promise<void>(resolve=>sink.bind(0,'127.0.0.1',resolve));
  const proxy=await browserNetwork(async()=>{throw Error('no destination grant');});
  const launcher=confinedBrowser(chromium.executablePath(),proxy.port);
  const context=await chromium.launchPersistentContext(root,{headless:true,executablePath:launcher.executablePath,serviceWorkers:'block',proxy:{server:`http://127.0.0.1:${proxy.port}`,bypass:'<-loopback>'}});
  try {
    await context.pages()[0]!.evaluate(async port=>{
      const peer=new RTCPeerConnection({iceServers:[{urls:`stun:127.0.0.1:${port}`}]});peer.createDataChannel('local-proof');
      await peer.setLocalDescription(await peer.createOffer());await new Promise(resolve=>setTimeout(resolve,1200));peer.close();
    },sink.address().port);
    expect(datagrams).toBe(0);
  } finally {await context.close();await proxy.close();launcher.close();sink.close();rmSync(root,{recursive:true,force:true});}
},30000);
