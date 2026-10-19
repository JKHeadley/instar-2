import { expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createTelegramMediaCustody, telegramInboundMedia, MEDIA_MAX_BYTES } from './telegram-media.js';
import { createMediaAdmission, DEFAULT_EFFECT_POLICY } from './media-admission.js';
import { createSecretCustody } from './secret-custody.js';
// @ts-expect-error Host file bridge.
import { openConversationMedia, protectMediaBytes } from './media-understanding.mjs';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/media-understanding/${name}`, import.meta.url));
const cases = [
  ['photo', 'photo.jpg', fixture('shapes.png')],
  ['document', 'brief.pdf', fixture('synthetic-brief.pdf')],
  ['voice', 'voice.ogg', fixture('meeting.ogg')],
  ['audio', 'audio.ogg', fixture('meeting.ogg')],
  ['video', 'video.mp4', Buffer.from('synthetic video bytes')],
  ['video_note', 'note.mp4', Buffer.from('synthetic video note bytes')],
  ['animation', 'animation.gif', Buffer.from('GIF89a')],
  ['sticker', 'sticker.webp', Buffer.from('synthetic sticker bytes')],
] as const;

it.each(cases)('files sent in Telegram reach the agent: %s uses the shipped custody-to-path callback', async (kind, name, bytes) => {
  const root = mkdtempSync(join(tmpdir(), 'telegram-files-'));
  try {
    mkdirSync(join(root, '.tmp'));
    const source = `telegram:123456789:update:${kind}`;
    const file = { file_id: `file-${kind}`, file_name: name, file_size: bytes.length };
    const media = telegramInboundMedia({ [kind]: kind === 'photo' ? [file] : file });
    expect(media).not.toBeNull();
    const key = new Uint8Array(32).fill(11);
    const admission = createMediaAdmission({ root, incarnation: 'test:files', now: () => 1000, monotonic: () => 100,
      stopped: () => false, source: () => ({ grant: 'grant:files', account: '123456789', conversation: 'synthetic:3', intakeDigest: 'sha256:synthetic' }),
      claimed: () => false, retainClaim: () => {}, policy: () => DEFAULT_EFFECT_POLICY });
    let requests = 0;
    const mediaCustody = createTelegramMediaCustody(root, key, { admission, stopped: () => false,
      token: () => '123456789:synthetic', fetch: async input => {
        requests++;
        return String(input).endsWith('/getFile')
          ? new Response(JSON.stringify({ ok: true, result: { file_id: media!.fileId, file_path: 'files/attachment.bin', file_size: bytes.length } }))
          : new Response(new Uint8Array(bytes));
      } });
    const stored = await mediaCustody.receive(source, media!);
    expect(stored.state).toBe('stored');
    const custody = createSecretCustody(root, key, () => 1000);
    const host = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
    const expression = host.split('prepareInputFiles: ')[1]!.split(',\n          currentActionFacts:')[0]!;
    const prepare = Function('join', 'openConversationMedia', 'project', 'topic', 'currentMedia', 'protectMediaBytes', 'custody', 'heldSecrets', 'stoppedNow',
      `return (${expression});`)(join, openConversationMedia, root, '3',
      (id: string) => ({ media, saved: mediaCustody.open(id, media!, stored) }), protectMediaBytes, custody,
      () => ({ values: [], unavailable: null }), () => false);
    const opened = await prepare([source]);
    try {
      expect(opened.notices[source]).toContain('Read this file');
      const path = JSON.parse(opened.notices[source].match(/: ("[^"]+")\./u)[1]);
      expect(path.startsWith(join(root, '.tmp') + '/')).toBe(true);
      expect(readFileSync(path)).toEqual(bytes);
      opened.close(); expect(existsSync(path)).toBe(false);
    } finally { opened.close(); }
    expect(mediaCustody.open(source, media!, stored).bytes).toEqual(bytes);
    expect(requests).toBe(2);
    expect(readdirSync(join(root, '.tmp'))).toEqual([]);
    const oversized = await mediaCustody.receive('oversized', { ...media!, size: MEDIA_MAX_BYTES + 1 });
    expect(oversized.state).toBe('file-limit'); expect(requests).toBe(2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it.each(['custody', 'held-source', 'wrong-source', 'size-limit'])('preserves an honest file-delivery refusal: %s', async failure => {
  const root = mkdtempSync(join(tmpdir(), 'telegram-files-refused-'));
  try {
    const opened = await openConversationMedia({ tmp: root, scope: '3', operations: ['source'],
      lookup: () => {
        if (failure === 'wrong-source' || failure === 'size-limit') throw Error('media: unavailable');
        return { media: { kind: 'document', name: 'brief.pdf' }, saved: { bytes: fixture('synthetic-brief.pdf') } };
      }, protect: (bytes: Buffer) => protectMediaBytes(bytes, 'source',
        failure === 'custody' ? { custody: () => ({ custody: { state: 'failed' } }) }
          : createSecretCustody(root, new Uint8Array(32).fill(9), () => 1000),
        () => ({ values: [], unavailable: failure === 'held-source' ? ['vault'] : null })) });
    expect(opened.notices.source).toContain('could not be read');
    expect(opened.notices.source).toContain('do not invent');
    opened.close();
    expect(readdirSync(root).filter(name => name.startsWith('conversation-media-'))).toEqual([]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it.each(cases)('keeps the raw-byte held-secret checkpoint for %s', async (kind, name, bytes) => {
  const root = mkdtempSync(join(tmpdir(), 'telegram-files-held-'));
  try {
    const held = 'SYNTHETIC-HELD-CREDENTIAL-ONLY';
    const original = Buffer.concat([bytes, Buffer.from(`\n${held}`)]);
    const opened = await openConversationMedia({ tmp: root, scope: '3', operations: ['source'],
      lookup: () => ({ media: { kind, name }, saved: { bytes: original } }),
      protect: (input: Buffer) => protectMediaBytes(input, 'source',
        createSecretCustody(root, new Uint8Array(32).fill(9), () => 1000), () => ({ values: [held], unavailable: null })) });
    const path = JSON.parse(opened.notices.source.match(/: ("[^"]+")\./u)[1]);
    expect(readFileSync(path).includes(Buffer.from(held))).toBe(false);
    expect(original.includes(Buffer.from(held))).toBe(true);
    opened.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
