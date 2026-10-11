import { expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
// @ts-expect-error Host-only JavaScript.
import { withMediaFile, voiceNotice } from './media-understanding.mjs';
// @ts-expect-error Host-only JavaScript.
import { createLocalTranscriber, localMediaCommand } from '../../scripts/local-transcriber.mjs';
const fixture = (name: string) => readFileSync(new URL(`./fixtures/media-understanding/${name}`, import.meta.url));

it.each(['photo', 'document'])('confines the %s to a generated private path and removes it on success or throw', async kind => {
  const tmp = mkdtempSync(join(tmpdir(), 'media-path-'));
  try {
    for (const fail of [false, true]) {
      let path = '';
      const task = withMediaFile({ tmp, media: { kind, name: '../../escape.txt' }, saved: { bytes: fixture('shapes.png') } }, async (notice: string) => {
        path = JSON.parse(notice.match(/: ("[^"]+")\./u)![1]!);
        expect(path.startsWith(`${tmp}/inbound-media-`)).toBe(true);
        expect(statSync(path).mode & 0o777).toBe(0o600);
        expect(statSync(join(path, '..')).mode & 0o777).toBe(0o700);
        expect(readFileSync(path)).toEqual(fixture('shapes.png'));
        if (fail) throw Error('model failed');
        return 'answer';
      });
      if (fail) await expect(task).rejects.toThrow('model failed'); else expect(await task).toBe('answer');
      expect(existsSync(path)).toBe(false); expect(readdirSync(tmp)).toEqual([]);
    }
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

it('labels local provenance and an unreadable or interrupted recording honestly', () => {
  expect(voiceNotice({ transcription: { state: 'complete', text: 'Tuesday at nine' } })).toContain('transcribed locally');
  for (const state of ['pending', 'failed']) expect(voiceNotice({ transcription: { state } })).toContain('do not invent words');
});

it('enforces output and stop limits on the exact local child', async () => {
  await expect(localMediaCommand(process.execPath, ['-e', 'process.stdout.write("x".repeat(100))'], { maxBytes: 20 })).rejects.toThrow('output limit');
  await expect(localMediaCommand(process.execPath, ['-e', 'process.exit(0)'], { stopped: () => true })).rejects.toThrow('stopped');
  await expect(localMediaCommand(process.execPath, ['-e', 'setTimeout(()=>{},10000)'], { timeout: 20 })).rejects.toThrow('timeout');
});

it('rejects empty/overlong audio and removes decoded plaintext after a transcriber failure', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'media-transcriber-'));
  const model = join(tmp, 'model'); writeFileSync(model, 'fixture');
  try {
    for (const length of [0, 300 * 32000 + 2]) {
      const transcribe = createLocalTranscriber({ model, temporary: tmp, run: async () => Buffer.alloc(length) });
      await expect(transcribe(Buffer.from('OggS'))).rejects.toThrow('duration refused');
    }
    let wav = '';
    const transcribe = createLocalTranscriber({ model, temporary: tmp, run: async (name: string, args: string[]) => {
      if (name === 'ffmpeg') return Buffer.alloc(32000);
      wav = args[args.indexOf('-f') + 1]!;
      expect(statSync(wav).mode & 0o777).toBe(0o600); throw Error('unreadable');
    } });
    await expect(transcribe(Buffer.from('OggS'))).rejects.toThrow('unreadable');
    expect(existsSync(wav)).toBe(false); expect(readdirSync(tmp)).toEqual(['model']);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

it('replays the real confined harness outputs from the synthetic-media proof', async () => {
  const { parseModelJson, conclusionText } = await import('./model-json.js');
  for (const [name, expected] of [['image', /green.*circle/is], ['voice', /Tuesday.*9/is], ['unreadable', /can.t|unreadable|corrupt/i]] as const) {
    const row = JSON.parse(fixture(`recorded/${name}.json`).toString('utf8')) as { answer: string; state: string; provenance: string };
    expect(row.state).toBe('complete'); expect(row.provenance).toContain('real Claude Code');
    expect(conclusionText(parseModelJson(row.answer))).toMatch(expected);
  }
});
