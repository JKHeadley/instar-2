// The fixed Ten physical host. No worker receives these OS ports.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, constants, existsSync, fsyncSync, lstatSync, mkdirSync, openSync,
  readFileSync, realpathSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const productionStorageIO = Object.freeze({ pid: process.pid,
  probePid: pid => { process.kill(pid, 0); }, join, resolve, closeSync, constants, existsSync,
  fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, rmdirSync,
  unlinkSync, writeFileSync });

export const productionProviderIO = Object.freeze({
  realpath: realpathSync,
  executableBytes: path => { if (!lstatSync(path).isFile()) throw Error('provider executable missing'); return readFileSync(path); },
  execute: input => new Promise(resolve => {
    const child = spawn(input.executable, input.args, { cwd: input.cwd, env: input.env,
      shell: false, stdio: ['pipe', 'pipe', 'ignore'] });
    let chunks = [], size = 0, limited = false;
    const fail = () => { limited = true; chunks = []; child.kill('SIGKILL'); };
    const timer = setTimeout(fail, input.timeout);
    child.on('error', () => { clearTimeout(timer); resolve({ code: null, limited: true, stdout: '' }); });
    child.stdin.on('error', fail);
    child.stdout.on('data', chunk => {
      size += chunk.length;
      if (size > input.maxBytes) fail(); else if (!limited) chunks.push(chunk);
    });
    child.on('close', code => { clearTimeout(timer); resolve({ code, limited, stdout: Buffer.concat(chunks).toString('utf8') }); });
    child.stdin.end(input.stdin, 'utf8');
  }),
});

/** Unit 3 owns scanning and sealed identity capture. Transfer its private exact
 * original into encrypted root custody before removing the temporary original. */
export function createProductionTelegramIO(root, captures) {
  const directory = join(root, '.telegram-sealed');
  mkdirSync(directory, { mode: 0o700, recursive: true });
  if (realpathSync(directory) !== directory) throw Error('telegram: sealed capture path substituted');
  return Object.freeze({ invoke(input, credential) {
    const request = Buffer.from(JSON.stringify({ method: input.method, body: input.body, timeoutMs: input.timeoutMs,
      captureDirectory: directory, identityBinding: input.identityBinding })).toString('base64url');
    const child = spawnSync(process.execPath,
      [fileURLToPath(new URL('../src/assembly/telegram-bot-api-bridge.mjs', import.meta.url)), request],
      { input: credential, encoding: 'utf8', timeout: input.timeoutMs + 2000, maxBuffer: 2 * 1024 * 1024,
        env: { PATH: '/usr/bin:/bin' }, stdio: ['pipe', 'pipe', 'ignore'] });
    if (child.status !== 0) return { kind: 'uncertain', limitation: 'transport', stage: 'child-exit' };
    try {
      const reply = JSON.parse(child.stdout);
      if (reply.kind === 'identity') {
        const match = /^capture:telegram:sealed-getMe:([a-f0-9]{64})$/.exec(reply.capture?.reference);
        if (!match) throw Error('sealed identity reference invalid');
        const file = join(directory, `${match[1]}.capture`), bytes = readFileSync(file, 'utf8');
        if (`sha256:${createHash('sha256').update(bytes).digest('hex')}` !== reply.capture.hash
          || !captures.preserve(reply.capture.reference, bytes)
          || captures.read(reply.capture.reference) !== bytes) throw Error('identity custody transfer failed');
        unlinkSync(file); const fd = openSync(directory, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
      }
      return reply;
    } catch { return { kind: 'uncertain', limitation: 'transport', stage: 'sealed-capture' }; }
  } });
}

/** The worker's physical boundary is the running installed process. Encrypted
 * custody is flushed before the worker independently reads and parses delivery. */
export function createProductionNativeContextIO(captures) {
  const identity = `pid:${process.pid}:start:${Math.floor(performance.timeOrigin)}`;
  const artifact = `sha256:${createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex')}`;
  const current = () => {
    process.kill(process.pid, 0);
    return { identity, artifact };
  };
  return Object.freeze({ current, consume(reference, bytes) {
    current();
    if (captures.read(reference) !== null) throw Error('native context operation already delivered');
    if (!captures.preserve(reference, bytes)) throw Error('native context custody unavailable');
    const actual = captures.read(reference);
    if (actual !== bytes) throw Error('native context readback differs');
    const delivered = JSON.parse(actual);
    if (delivered.processIdentity !== identity || !Array.isArray(delivered.contents)
      || delivered.contents.some(row => typeof row.bytes !== 'string')) throw Error('native context delivery malformed');
    // Parsing every delivered body is the actual worker input boundary. No
    // provider call or ungoverned output is possible through this physical port.
    for (const row of delivered.contents) JSON.parse(row.bytes);
    return { identity, digest: `sha256:${createHash('sha256').update(actual).digest('hex')}` };
  } });
}
