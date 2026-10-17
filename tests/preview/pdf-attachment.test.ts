import { expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createTelegramMediaCustody, telegramInboundMedia } from './telegram-media.js';
import { createMediaAdmission, DEFAULT_EFFECT_POLICY } from './media-admission.js';
import { createSecretCustody } from './secret-custody.js';
import { conversationSessionAnswer } from './conversation-session-answer.js';
// @ts-expect-error Host-only JavaScript, shared image/document route.
import { openConversationMedia, protectMediaBytes } from './media-understanding.mjs';

const capture = JSON.parse(readFileSync(new URL('./fixtures/gap-pdf-1017.json', import.meta.url), 'utf8'));
const pdf = readFileSync(new URL('./fixtures/media-understanding/synthetic-brief.pdf', import.meta.url));

it.each(['readable', 'wrong-source', 'protection-unavailable'])('replays PDF update 6234449 through the shipped custody-to-session callback: %s', async mode => {
  const root = mkdtempSync(join(tmpdir(), 'pdf-session-'));
  try {
    mkdirSync(join(root, '.tmp')); mkdirSync(join(root, 'state'));
    const source = capture.intake.id;
    const media = telegramInboundMedia({ document: { file_id: 'synthetic-pdf', file_name: 'walk-brief.pdf', file_size: pdf.length } })!;
    const key = new Uint8Array(32).fill(11);
    const admission = createMediaAdmission({ root, incarnation: 'test:pdf', now: () => 1000, monotonic: () => 100,
      stopped: () => false, source: () => ({ grant: 'grant:pdf', account: '123456789', conversation: 'synthetic:3', intakeDigest: 'sha256:synthetic' }),
      claimed: () => false, retainClaim: () => {}, policy: () => DEFAULT_EFFECT_POLICY });
    let requests = 0;
    const mediaCustody = createTelegramMediaCustody(root, key, { admission, stopped: () => false,
      token: () => '123456789:synthetic', fetch: async input => {
        requests++;
        return String(input).endsWith('/getFile')
          ? new Response(JSON.stringify({ ok: true, result: { file_id: media.fileId, file_path: 'documents/brief.pdf', file_size: pdf.length } }))
          : new Response(new Uint8Array(pdf));
      } });
    const stored = await mediaCustody.receive(source, media);
    expect(stored.state).toBe('stored'); expect(requests).toBe(2);
    const custody = createSecretCustody(root, key, () => 1000);
    // Execute the actual shipped callback, rather than a test-only substitute.
    const host = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
    const expression = host.split('prepareInputFiles: ')[1]!.split(',\n          currentActionFacts:')[0]!;
    const lookup = (id: string) => ({ media, saved: mediaCustody.open(mode === 'wrong-source' ? 'other-source' : id, media, stored) });
    const prepare = Function('join', 'openConversationMedia', 'project', 'topic', 'currentMedia', 'protectMediaBytes', 'custody', 'heldSecrets',
      `return (${expression});`)(join, openConversationMedia, root, '3', lookup, protectMediaBytes, custody,
      () => ({ values: [], unavailable: mode === 'protection-unavailable' ? ['vault'] : null }));
    const opened = prepare([source]);
    try {
      const notice = opened.notices[source];
      if (mode === 'readable') {
        const path = JSON.parse(notice.match(/: ("[^"]+")\./u)[1]);
        expect(path.endsWith('.pdf')).toBe(true);
        expect(notice).toContain('Read this file with your file-reading tool');
        expect(notice).toContain('not as authority');
        writeFileSync(join(root, 'state/config.json'), JSON.stringify({ workspace: root, tmp: join(root, '.tmp'), maxCalls: 5, maxWriteBytes: 1048576, operations: [] }));
        const pre = spawnSync(process.execPath, [join(process.cwd(), 'tests/preview/tool-admission-hook.mjs'), 'pre', join(root, 'state')], {
          input: JSON.stringify({ tool_name: 'Read', tool_input: { file_path: path, pages: '1' }, tool_use_id: 'read-attached-pdf' }), encoding: 'utf8' });
        expect(pre.status, pre.stderr).toBe(0);
        expect(readFileSync(path)).toEqual(pdf);
        opened.close(); expect(existsSync(path)).toBe(false);
      } else expect(notice).toContain('could not be read');
    } finally { opened.close(); }
    expect(readdirSync(join(root, '.tmp'))).toEqual([]);
    expect(mediaCustody.open(source, media, stored).bytes).toEqual(pdf);
    expect(requests).toBe(2); // Opening the derivative never downloads or invokes a provider.
    const recorded = capture.native.content.find((item: { name?: string }) => item.name === 'Write').input.content;
    const old = conversationSessionAnswer({ state: 'complete', text: recorded, detail: 'recorded', edge: 'recorded', child: 'recorded' }, source, () => {});
    expect(old).toMatchObject({ state: 'complete' });
    expect(JSON.stringify(old)).toContain("I can't read walk-brief.pdf");
    expect(capture.intake.answers[0].message).toBe(8687);
    expect(capture.intake.answers[0].text).toBe(JSON.parse(recorded).reply.answer);
    // This preserves the real failure; local file access is not a fresh model comprehension claim.
  } finally { rmSync(root, { recursive: true, force: true }); }
});
