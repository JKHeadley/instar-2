import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSecretCustody, secretRef } from './secret-custody.js';
import { conversationSessionAnswer } from './conversation-session-answer.js';
// @ts-expect-error Host-only file bridge.
import { openConversationMedia, protectMediaBytes } from './media-understanding.mjs';

const capture = JSON.parse(readFileSync(new URL('./fixtures/gap-pdf-1017.json', import.meta.url), 'utf8'));
const pdf = readFileSync(new URL('./fixtures/media-understanding/synthetic-brief.pdf', import.meta.url));

it('files sent in Telegram reach the agent: recorded update 6234449 now has an accessible original', async () => {
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), 'files-recorded-')));
  try {
    const source = capture.intake.id;
    const custody = createSecretCustody(tmp, new Uint8Array(32).fill(11), () => 1000);
    const opened = await openConversationMedia({ tmp, scope: '3', operations: [source],
      lookup: () => ({ media: { kind: 'document', name: 'brief.pdf' }, saved: { bytes: pdf } }),
      protect: (bytes: Buffer, id: string) => protectMediaBytes(bytes, id, custody, () => ({ values: [], unavailable: null })) });
    try {
      const path = JSON.parse(opened.notices[source].match(/: ("[^"]+")\./u)[1]);
      expect(readFileSync(path)).toEqual(pdf);
      const old = conversationSessionAnswer({ state: 'complete', text: capture.native.content[0].input.content,
        detail: 'recorded', edge: 'recorded', child: 'recorded' }, source, () => {});
      expect(JSON.stringify(old)).toContain('none exists');
      expect(capture.intake.answers[0].text).toContain('encrypted custody');
    } finally { opened.close(); }
    expect(readdirSync(tmp)).toEqual([]);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

it.each(['clean', 'held', 'credential', 'custody-unavailable', 'held-unavailable'])('keeps the existing raw-byte checkpoint for every file: %s', mode => {
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), 'files-raw-')));
  try {
    const custody = createSecretCustody(tmp, new Uint8Array(32).fill(11), () => 1000);
    const held = 'SYNTHETIC-HELD-CANARY-ONLY', credential = 'sk-' + 'SYNTHETICCANARYONLY'.repeat(3);
    const bytes = Buffer.concat([pdf, Buffer.from(mode === 'held' ? held : mode === 'credential' ? `api_key=${credential}` : '')]);
    const protect = () => protectMediaBytes(bytes, 'source', mode === 'custody-unavailable'
      ? { custody: () => ({ custody: { state: 'failed' } }) } : custody,
    () => ({ values: [held], unavailable: mode === 'held-unavailable' ? ['vault'] : null }));
    if (mode.endsWith('unavailable')) expect(protect).toThrow('unavailable');
    else {
      const output = protect();
      expect(output.includes(Buffer.from(held))).toBe(false);
      expect(output.includes(Buffer.from(credential))).toBe(false);
      if (mode === 'clean') expect(output).toEqual(bytes);
      if (mode === 'credential') expect(custody.resolve(secretRef(custody.records()[0]!.name))).toBe(credential);
    }
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

it('passes opaque file bytes unchanged without a type-specific decoder', () => {
  const bytes = Buffer.from('%PDF-1.4\nopaque container bytes');
  expect(protectMediaBytes(bytes, 'source', { custody: ({ text }: { text: string }) => ({ text }) },
    () => ({ values: [], unavailable: null }))).toEqual(bytes);
});
