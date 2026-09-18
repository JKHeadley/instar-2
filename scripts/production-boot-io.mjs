// The fixed Ten physical host. No worker receives these OS ports.
import { spawn } from 'node:child_process';
import { closeSync, constants, existsSync, fsyncSync, lstatSync, mkdirSync, openSync,
  readFileSync, realpathSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

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
