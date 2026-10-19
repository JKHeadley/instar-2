import { expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createTelegramMediaCustody, telegramInboundMedia } from './telegram-media.js';
import { createMediaAdmission, DEFAULT_EFFECT_POLICY } from './media-admission.js';
import { createSecretCustody } from './secret-custody.js';
// @ts-expect-error Host-only file bridge.
import { openConversationMedia, protectMediaBytes } from './media-understanding.mjs';

// @ts-expect-error Host-only local audio decoder.
import { createLocalTranscriber, localMediaCommand } from '../../scripts/local-transcriber.mjs';
// @ts-expect-error Host resource owner.
import { createResourceOwner } from '../../scripts/resource-owner.mjs';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/media-understanding/${name}`, import.meta.url));
const cases = [
  ['photo', 'shapes.jpg'], ['document', 'synthetic-brief.pdf'], ['voice', 'meeting.ogg'],
  ['audio', 'meeting.ogg'], ['video', 'clip.mp4'], ['video_note', 'clip.mp4'],
  ['animation', 'clip.gif'], ['sticker', 'sticker.webp'], ['document', 'unknown.custom'],
];

it.each(cases)('files sent in Telegram reach the agent: %s / %s', { timeout: 30000 }, async (kind, name) => {
  const bytes = ['shapes.jpg', 'synthetic-brief.pdf', 'meeting.ogg'].includes(name!) ? fixture(name!) : Buffer.from('synthetic opaque file');
  const root = mkdtempSync(join(tmpdir(), 'telegram-files-'));
  try {
    mkdirSync(join(root, '.tmp')); mkdirSync(join(root, 'state'));
    const file = { file_id: 'synthetic-file', file_name: name, file_size: bytes.length };
    const media = telegramInboundMedia({ [kind!]: kind === 'photo' ? [file] : file });
    expect(media).not.toBeNull();
    const source = 'telegram:synthetic:update:1', key = new Uint8Array(32).fill(11);
    const admission = createMediaAdmission({ root, incarnation: 'test:files', now: () => 1000, monotonic: () => 100,
      stopped: () => false, source: () => ({ grant: 'grant:files', account: '123456789', conversation: 'synthetic:3', intakeDigest: 'sha256:synthetic' }),
      claimed: () => false, retainClaim: () => {}, policy: () => DEFAULT_EFFECT_POLICY });
    const resources = createResourceOwner(); await resources.attach();
    const localTranscribe = createLocalTranscriber({ temporary: root,
      run: (command: string, args: string[], options: object) => localMediaCommand(command, args, { ...options, resources }) });
    const host = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
    const transcribeExpression = host.split('transcribe: async (bytes, source) => {')[1]!.split('} });')[0]!;
    const custody = createSecretCustody(root, key, () => 1000);
    const transcribe = Function('localTranscribe', 'custody', `return async (bytes, source) => {${transcribeExpression}}`)(localTranscribe, custody);
    let requests = 0, transcriptions = 0;
    const original = createTelegramMediaCustody(root, key, { admission, stopped: () => false,
      transcribe: async (input, source) => { transcriptions++; return transcribe(input, source); },
      token: () => '123456789:synthetic', fetch: async input => {
        requests++;
        return String(input).endsWith('/getFile')
          ? new Response(JSON.stringify({ ok: true, result: { file_id: file.file_id, file_path: 'files/file.bin', file_size: bytes.length } }))
          : new Response(new Uint8Array(bytes));
      } });
    const stored = await original.receive(source, media!);
    expect(stored.state).toBe('stored'); expect(requests).toBe(2);
    const expression = host.split('prepareInputFiles: ')[1]!.split(',\n          currentActionFacts:')[0]!;
    const prepare = Function('join', 'openConversationMedia', 'project', 'topic', 'currentMedia', 'protectMediaBytes', 'custody', 'heldSecrets', 'stoppedNow',
      `return (${expression});`)(join, openConversationMedia, root, '3', (id: string) => ({ media, saved: original.open(id, media!, stored) }),
      protectMediaBytes, createSecretCustody(root, key, () => 1000), () => ({ values: [], unavailable: null }), () => false);
    const opened = await prepare([source]);
    try {
      const notice = opened.notices[source];
      expect(notice).toContain('Read this file');
      if (kind === 'voice' || kind === 'audio') {
        expect(notice).toContain('Voice note, transcribed locally');
        expect(notice).toMatch(/Tuesday.*9|Tuesday.*nine/i);
        expect(stored).toMatchObject({ transcript: expect.stringMatching(/Tuesday/i) });
      } else expect(notice).not.toContain('transcribed locally');
      const path = JSON.parse(notice.match(/: ("[^"]+")\./u)[1]);
      expect(readFileSync(path)).toEqual(bytes);
      writeFileSync(join(root, 'state/config.json'), JSON.stringify({ workspace: root, tmp: join(root, '.tmp'), maxCalls: 5, maxWriteBytes: 1048576, operations: [] }));
      const pre = spawnSync(process.execPath, [join(process.cwd(), 'tests/preview/tool-admission-hook.mjs'), 'pre', join(root, 'state')], {
        input: JSON.stringify({ tool_name: 'Read', tool_input: { file_path: path }, tool_use_id: 'read-file' }), encoding: 'utf8' });
      expect(pre.status, pre.stderr).toBe(0);
      expect(original.open(source, media!, stored).bytes).toEqual(bytes);
      opened.close(); expect(existsSync(path)).toBe(false);
    } finally { opened.close(); }
    expect(readdirSync(join(root, '.tmp'))).toEqual([]);
    await original.receive(source, media!); expect(requests).toBe(2);
    expect(transcriptions).toBe(kind === 'voice' || kind === 'audio' ? 1 : 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it.runIf(process.platform === 'darwin')('the actual harness macOS user can open the published file, while private originals stay closed', async () => {
  // Use an isolated directory outside /private/tmp's inherited deny ACL, just as
  // the mounted session volume does. Never touch a serving root or login.
  // @ts-expect-error Host-only ACL and kernel access probe.
  const { grantVolume, probeAccess, HARNESS_USER, runnerUser } = await import('./harness-user.mjs');
  const root = mkdtempSync('/Users/Shared/telegram-files-proof-');
  try {
    const privateFile = join(root, 'private-original');
    writeFileSync(privateFile, 'synthetic private source', { mode: 0o600 });
    const project = join(root, 'work'); mkdirSync(project, { mode: 0o700 });
    // Traversal only to this test's workspace; private files remain runner-only.
    // @ts-expect-error Host-only ACL helper.
    const { grantAcl, harnessAcl } = await import('./harness-user.mjs');
    grantAcl([root], [harnessAcl.search(HARNESS_USER)]);
    grantVolume(project, HARNESS_USER, runnerUser());
    const tmp = join(project, '.tmp'); mkdirSync(tmp, { mode: 0o700 });
    const bytes = fixture('synthetic-brief.pdf');
    const opened = await openConversationMedia({ tmp, scope: 'test', operations: ['file'],
      lookup: () => ({ media: { kind: 'document', name: 'brief.pdf' }, saved: { bytes } }),
      protect: (input: Buffer) => protectMediaBytes(input, 'source', { custody: ({ text }: { text: string }) => ({ text }) },
        () => ({ values: [], unavailable: null })) });
    try {
      const path = JSON.parse(opened.notices.file.match(/: ("[^"]+")\./u)[1]);
      const access = probeAccess([`r:${path}`, `r:${privateFile}`]);
      expect(access).toMatchObject([{ path, ok: true }, { path: privateFile, ok: false, code: 'EACCES' }]);
    } finally { opened.close(); }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
