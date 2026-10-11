// Free, offline voice decoding. No shell, network, provider key, or daemon.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
export const localMediaDirectory = () => join(homedir(), '.local', 'share', 'instar', 'media');
export const localMediaModel = () => join(localMediaDirectory(), 'ggml-base.bin');

/** One exact child PID, bounded output and time; stop is observed while it runs.
 * stdout is private memory. Diagnostics can contain content and are discarded. */
export function localMediaCommand(command, args, { stopped = () => false, input, timeout = 90000, maxBytes = 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    if (stopped()) { reject(Error('local media stopped')); return; }
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'ignore'], env: { PATH: process.env.PATH ?? '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin', HOME: homedir() } });
    let failure = null, size = 0; const chunks = [];
    const cancel = reason => { failure ??= Error(reason); if (child.pid) child.kill('SIGKILL'); };
    const timer = setTimeout(() => cancel('local media timeout'), timeout);
    const stop = setInterval(() => { if (stopped()) cancel('local media stopped'); }, 50);
    const clear = () => { clearTimeout(timer); clearInterval(stop); };
    child.on('error', error => { clear(); reject(error); });
    child.stdout.on('data', chunk => { size += chunk.length; if (size > maxBytes) cancel('local media output limit'); else chunks.push(chunk); });
    child.stdin.on('error', () => {});
    child.on('close', code => { clear(); if (failure || code !== 0) reject(failure ?? Error('local media failed')); else resolve(Buffer.concat(chunks)); });
    child.stdin.end(input);
  });
}
export function createLocalTranscriber({ stopped = () => false, model = localMediaModel(), temporary = tmpdir(), run = localMediaCommand } = {}) {
  return async bytes => {
    if (!existsSync(model) || bytes.length > 8 * 1024 * 1024) throw Error('local transcription unavailable');
    // Decode at most 301 seconds, then reject the over-limit neighbour instead of
    // silently transcribing a prefix. Mono 16-bit 16 kHz PCM is 32000 bytes/second.
    const pcm = await run('ffmpeg', ['-nostdin', '-v', 'error', '-threads', '1', '-protocol_whitelist', 'pipe', '-i', 'pipe:0', '-t', '301', '-ac', '1', '-ar', '16000', '-f', 's16le', 'pipe:1'],
      { input: bytes, stopped, timeout: 30000, maxBytes: 301 * 32000 + 4096 });
    if (!pcm.length || pcm.length > 300 * 32000 || stopped()) throw Error('local transcription duration refused');
    mkdirSync(temporary, { recursive: true, mode: 0o700 });
    const area = mkdtempSync(join(temporary, 'instar-voice-'));
    try {
      const wav = Buffer.alloc(44); wav.write('RIFF'); wav.writeUInt32LE(pcm.length + 36, 4); wav.write('WAVEfmt ', 8);
      wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(16000, 24);
      wav.writeUInt32LE(32000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(pcm.length, 40);
      const path = join(area, 'voice.wav'); writeFileSync(path, Buffer.concat([wav, pcm]), { mode: 0o600, flag: 'wx' });
      const output = await run('whisper-cli', ['-m', model, '-f', path, '-l', 'auto', '-t', '1', '-ng', '-nt', '-np'], { stopped, timeout: 90000, maxBytes: 16384 });
      const text = output.toString('utf8').trim();
      if (!text || stopped()) throw Error('local transcription empty');
      return text;
    } finally { rmSync(area, { recursive: true, force: true }); }
  };
}
