// Async process boundary for structured session workers. No protocol-specific interpretation.
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, renameSync, openSync, closeSync, fsyncSync, appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const stamp = pid => {
  try {
    const value = execFileSync('/bin/ps', ['-p', String(pid), '-o', 'lstart='], { encoding: 'utf8', timeout: 2000 }).trim();
    if (value) return value;
  } catch { /* A failed observer is not evidence that the process is gone. */ }
  try { process.kill(pid, 0); } catch (error) { if (error.code === 'ESRCH') return null; }
  throw Error('protocol process identity unavailable');
};
const sync = path => { const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } };
export function createSessionProtocolIO(directory, stopped = () => false) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, 'processes.json');
  const load = () => existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : [];
  const save = rows => { const tmp = `${path}.${randomUUID()}.tmp`; writeFileSync(tmp, JSON.stringify(rows), { mode: 0o600 });
    sync(tmp); renameSync(tmp, path); sync(directory); };
  const live = row => stamp(row.pid) === row.stamp;
  const connections = new Map();
  async function close(claim, incarnation, identity) {
    for (const row of load().filter(row => row.claim === claim && row.incarnation === incarnation && (!identity || row.identity === identity))) {
      const connection = connections.get(row.identity);
      if (live(row)) {
        connection?.end();
        try { process.kill(row.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
      }
      for (let n = 0; n < 20 && live(row); n++) await pause(25);
      if (live(row)) { process.kill(row.pid, 'SIGKILL'); for (let n = 0; n < 20 && live(row); n++) await pause(25); }
      if (live(row)) throw Error('exact protocol worker stop unconfirmed');
      connections.delete(row.identity);
    }
  }
  return Object.freeze({ close,
    async open(input) {
      if (stopped() || !input.executable.startsWith('/') || !input.cwd.startsWith('/') || input.deadline <= Date.now()
        || !Number.isInteger(input.requestTimeoutMs) || input.requestTimeoutMs < 1 || input.requestTimeoutMs > 60000
        || !Number.isInteger(input.maxProcesses) || input.maxProcesses < 1 || input.maxProcesses > 16)
        throw Error('invalid or stopped protocol launch');
      if (load().filter(live).length >= input.maxProcesses) throw Error('protocol worker capacity exhausted');
      const child = spawn(input.executable, input.args, { cwd: input.cwd, env: input.env, stdio: ['pipe', 'pipe', 'pipe'] });
      await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
      let started;
      try { started = stamp(child.pid); if (!started) throw Error('protocol process identity unavailable'); }
      catch (error) { child.kill('SIGTERM'); throw error; }
      const identity = `protocol:${child.pid}:${randomUUID()}`;
      const row = { claim: input.claim, incarnation: input.incarnation, identity, pid: child.pid, stamp: started };
      try { save([...load(), row]); } catch (error) { child.kill('SIGTERM'); throw error; }
      const capture = join(directory, `${createHash('sha256').update(identity).digest('hex')}.jsonl`);
      const pending = new Map(); let sequence = 0, bytes = 0, held = '', dead = false, frames = [], failure = null;
      let watch, killTimer;
      const fail = error => {
        const first = !dead; failure ??= error; dead = true;
        clearInterval(watch);
        if (first) killTimer = setTimeout(() => {
          try { if (live(row)) child.kill('SIGKILL'); } catch { /* Retain uncertain identity for explicit close. */ }
        }, 500);
        for (const value of pending.values()) { clearTimeout(value.timer); value.reject(error); } pending.clear();
        child.stdin.destroy(); if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
      };
      const captureFrame = frame => {
        const text = `${JSON.stringify(frame)}\n`; bytes += Buffer.byteLength(text);
        if (bytes > 16 * 1024 * 1024) throw Error('protocol capture bound exceeded');
        appendFileSync(capture, text, { mode: 0o600 }); sync(capture);
      };
      const write = value => {
        if (dead || stopped()) throw failure ?? Error('protocol worker unavailable');
        const text = `${JSON.stringify(value)}\n`;
        if (Buffer.byteLength(text) > 2 * 1024 * 1024) throw Error('protocol request bound exceeded');
        captureFrame({ direction: 'request', frame: value }); child.stdin.write(text);
      };
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', chunk => {
        try {
          held += chunk;
          if (Buffer.byteLength(held) > 2 * 1024 * 1024) throw Error('protocol frame bound exceeded');
          let at;
          while ((at = held.indexOf('\n')) >= 0) {
            const line = held.slice(0, at); held = held.slice(at + 1); if (!line.trim()) continue;
            const frame = JSON.parse(line); captureFrame({ direction: 'response', frame });
            if (frame.id !== undefined && !frame.method) {
              const waiting = pending.get(frame.id);
              if (!waiting) throw Error('unexpected protocol response identity');
              pending.delete(frame.id); clearTimeout(waiting.timer);
              if (frame.error) waiting.reject(Error('protocol request refused')); else waiting.resolve(frame.result);
            } else if (frame.id !== undefined) {
              // No server request can widen admission. A host approval is never synthesized.
              write({ id: frame.id, error: { code: -32601, message: 'host does not grant authority through protocol requests' } });
            } else {
              if (frames.length >= 4096) throw Error('protocol observation backlog exceeded');
              frames.push(frame);
            }
          }
        } catch (error) { fail(error); }
      });
      child.stdin.on('error', fail); child.stdout.on('error', fail); child.on('error', fail);
      child.stderr.on('data', chunk => { try { captureFrame({ direction: 'stderr', text: chunk.toString() }); } catch (error) { fail(error); } });
      child.once('exit', () => fail(Error('protocol transport ended')));
      watch = setInterval(() => { if (stopped() || Date.now() >= input.deadline) fail(Error('protocol stop or deadline')); }, 50);
      child.once('close', () => { clearInterval(watch); clearTimeout(killTimer); });
      connections.set(identity, { end: () => fail(Error('protocol closed')) });
      return Object.freeze({ identity,
        request(method, params) {
          return new Promise((resolve, reject) => {
            if (dead || stopped()) { reject(failure ?? Error('protocol worker unavailable')); return; }
            const id = ++sequence;
            const timer = setTimeout(() => fail(Error('protocol request deadline exceeded')), input.requestTimeoutMs);
            pending.set(id, { resolve, reject, timer });
            try { write({ id, method, params }); } catch (error) { fail(error); }
          });
        },
        notify: (method, params) => write({ method, params }),
        drain: () => { const result = frames; frames = []; return result; },
        alive: () => !dead,
        close: () => close(input.claim, input.incarnation, identity),
      });
    },
  });
}
