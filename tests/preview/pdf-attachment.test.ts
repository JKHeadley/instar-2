// Retains the real regression case after removal of the per-type decoder.
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSecretCustody } from './secret-custody.js';
// @ts-expect-error Host file bridge.
import { openConversationMedia, protectMediaBytes } from './media-understanding.mjs';
const fixture = (name: string) => readFileSync(new URL(`./fixtures/media-understanding/${name}`, import.meta.url));

it('replays the captured PDF refusal while publishing a file on the same source-bound path', async () => {
  const capture = JSON.parse(readFileSync(new URL('./fixtures/gap-pdf-1017.json', import.meta.url), 'utf8'));
  const root = mkdtempSync(join(tmpdir(), 'telegram-files-recorded-'));
  try {
    const source = capture.intake.id;
    const opened = await openConversationMedia({ tmp: root, scope: '3', operations: [source],
      lookup: (id: string) => {
        expect(id).toBe('telegram:8989505249:update:6234449');
        return { media: { kind: 'document', name: 'walk-brief.pdf' }, saved: { bytes: fixture('synthetic-brief.pdf') } };
      }, protect: (bytes: Buffer) => protectMediaBytes(bytes, source,
        createSecretCustody(root, new Uint8Array(32).fill(9), () => 1000), () => ({ values: [], unavailable: null })) });
    const path = JSON.parse(opened.notices[source].match(/: ("[^"]+")\./u)[1]);
    expect(readFileSync(path)).toEqual(fixture('synthetic-brief.pdf'));
    const { conversationSessionAnswer } = await import('./conversation-session-answer.js');
    const recorded = capture.native.content.find((item: { name?: string }) => item.name === 'Write').input.content;
    const old = conversationSessionAnswer({ state: 'complete', text: recorded, detail: 'recorded', edge: 'recorded', child: 'recorded' }, source, () => {});
    expect(JSON.stringify(old)).toContain("I can't read walk-brief.pdf");
    expect(capture.intake.answers[0].message).toBe(8687);
    opened.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
