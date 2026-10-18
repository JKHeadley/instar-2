#!/usr/bin/env node
// Explicit installation/update step: free local executables plus a hash-pinned,
// multilingual base model. Never downloads models during a conversation.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localMediaDirectory, localMediaModel } from './local-transcriber.mjs';
const MODEL_SHA = '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe';
export async function installLocalMedia({ run = execFileSync, directory = localMediaDirectory() } = {}) {
  const command = (name, args) => run(name, args, { stdio: 'inherit', timeout: 600000, env: { ...process.env, HOMEBREW_NO_AUTO_UPDATE: '1', CMAKE_BUILD_PARALLEL_LEVEL: '1' } });
  const available = name => { try { run(name, ['-h'], { stdio: 'ignore', timeout: 10000 }); return true; } catch { return false; } };
  if (!available('ffmpeg') || !available('whisper-cli')) {
    // Homebrew supports both macOS and Linux; use its normal install/update path.
    command('brew', ['install', 'whisper-cpp', 'ffmpeg']);
  }
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const model = join(directory, 'ggml-base.bin');
  const valid = path => existsSync(path) && statSync(path).size === 147951465 && createHash('sha256').update(readFileSync(path)).digest('hex') === MODEL_SHA;
  if (!valid(model)) {
    const pending = `${model}.${process.pid}.pending`;
    try {
      command('curl', ['-fL', '--max-time', '300', '--max-filesize', '147951465', '-o', pending,
        'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin']);
      if (!valid(pending)) throw Error('local media model checksum differs');
      renameSync(pending, model);
    } finally { rmSync(pending, { force: true }); }
  }
  return model;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await installLocalMedia();
  process.stdout.write(`Local voice transcription installed: ${localMediaModel()}\n`);
}
