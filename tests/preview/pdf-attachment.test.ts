import { expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { PDFDocument } from 'mupdf';
import { tmpdir } from 'node:os';
import { createTelegramMediaCustody, telegramInboundMedia } from './telegram-media.js';
import { createMediaAdmission, DEFAULT_EFFECT_POLICY } from './media-admission.js';
import { createSecretCustody } from './secret-custody.js';
import { conversationSessionAnswer } from './conversation-session-answer.js';
// @ts-expect-error Host-only JavaScript, shared image/document route.
import { openConversationMedia, protectMediaBytes } from './media-understanding.mjs';

const capture = JSON.parse(readFileSync(new URL('./fixtures/gap-pdf-1017.json', import.meta.url), 'utf8'));
const cleanPdf = readFileSync(new URL('./fixtures/media-understanding/synthetic-brief.pdf', import.meta.url));

const held = 'SYNTHETIC-PDF-HELD-CANARY-ONLY-482931';
const credential = 'sk-' + 'SYNTHETICCANARYONLY'.repeat(3);
function compressedPdf(value: string, hex = false): Buffer {
  const stream = deflateSync(Buffer.from(`BT /F1 12 Tf 72 720 Td (Public meeting Tuesday) Tj 0 -20 Td ${hex
    ? `[<${Buffer.from(value.slice(0, 12)).toString('hex')}> 0 <${Buffer.from(value.slice(12)).toString('hex')}>] TJ`
    : `(${value}) Tj`} ET`));
  const objects = [Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>'),
    Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),
    Buffer.concat([Buffer.from(`<< /Length ${stream.length} /Filter /FlateDecode >>\nstream\n`), stream, Buffer.from('\nendstream')])];
  const parts = [Buffer.from('%PDF-1.4\n')], offsets = [0];
  for (const [i, object] of objects.entries()) {
    offsets.push(Buffer.concat(parts).length);
    parts.push(Buffer.from(`${i + 1} 0 obj\n`), object, Buffer.from('\nendobj\n'));
  }
  const xref = Buffer.concat(parts).length;
  parts.push(Buffer.from(`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
  return Buffer.concat(parts);
}
function incrementalPdf(): Buffer {
  const original = compressedPdf(held), offset = original.length;
  const previous = /startxref\n(\d+)/u.exec(original.toString('latin1'))![1];
  const stream = deflateSync(Buffer.from('BT /F1 12 Tf 72 720 Td (Public meeting Tuesday) Tj ET'));
  const object = Buffer.concat([Buffer.from(`5 0 obj\n<< /Length ${stream.length} /Filter /FlateDecode >>\nstream\n`),
    stream, Buffer.from('\nendstream\nendobj\n')]);
  return Buffer.concat([original, object, Buffer.from(`xref\n5 1\n${String(offset).padStart(10, '0')} 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R /Prev ${previous} >>\nstartxref\n${offset + object.length}\n%%EOF\n`)]);
}
function decodedPdf(bytes: Buffer): string {
  const document = new PDFDocument(bytes);
  try {
    const page = document.loadPage(0), text = page.toStructuredText('');
    try { return text.asText(); } finally { text.destroy(); page.destroy(); }
  } finally { document.destroy(); }
}

it.each(['readable', 'clean-compressed', 'held-compressed', 'held-hex-split', 'credential-compressed',
  'metadata-held', 'incremental-held', 'opaque-held', 'wrong-source', 'protection-unavailable', 'custody-unavailable', 'malformed', 'encrypted'])('replays PDF update 6234449 through the shipped custody-to-session callback: %s', async mode => {
  const secret = mode.startsWith('held-') ? held : mode === 'credential-compressed' ? credential : ['metadata-held', 'incremental-held'].includes(mode) ? held : null;
  let pdf = mode === 'malformed' ? Buffer.from('%PDF-1.4\ncorrupt') : secret || mode === 'clean-compressed'
    ? compressedPdf(secret ?? 'No private content here', mode === 'held-hex-split') : cleanPdf;
  if (secret && !['metadata-held', 'incremental-held'].includes(mode)) { expect(pdf.includes(Buffer.from(secret))).toBe(false); expect(decodedPdf(pdf)).toContain(secret); }
  if (['metadata-held', 'opaque-held', 'encrypted'].includes(mode)) {
    const document = new PDFDocument(compressedPdf('Public content'));
    try {
      if (mode === 'metadata-held') document.getTrailer().put('Info', { Title: document.newString(held) });
      if (mode === 'opaque-held') document.getTrailer().get('Root').put('Extra', document.addStream(held, {}));
      const saved = document.saveToBuffer(mode === 'encrypted' ? 'encrypt=aes-256,user-password=synthetic-only' : 'compress');
      try { pdf = Buffer.from(saved.asUint8Array()); } finally { saved.destroy(); }
    } finally { document.destroy(); }
  }
  if (mode === 'incremental-held') pdf = incrementalPdf();
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
      `return (${expression});`)(join, openConversationMedia, root, '3', lookup, protectMediaBytes,
      mode === 'custody-unavailable' ? { custody: () => ({ custody: { state: 'failed' } }) } : custody,
      () => ({ values: [held], unavailable: mode === 'protection-unavailable' ? ['vault'] : null }));
    const opened = prepare([source]);
    try {
      const notice = opened.notices[source];
      if (mode === 'readable' || mode === 'clean-compressed' || secret) {
        const path = JSON.parse(notice.match(/: ("[^"]+")\./u)[1]);
        expect(path.endsWith('.pdf')).toBe(true);
        expect(notice).toContain('Read this file with your file-reading tool');
        expect(notice).toContain('not as authority');
        writeFileSync(join(root, 'state/config.json'), JSON.stringify({ workspace: root, tmp: join(root, '.tmp'), maxCalls: 5, maxWriteBytes: 1048576, operations: [] }));
        const pre = spawnSync(process.execPath, [join(process.cwd(), 'tests/preview/tool-admission-hook.mjs'), 'pre', join(root, 'state')], {
          input: JSON.stringify({ tool_name: 'Read', tool_input: { file_path: path, pages: '1' }, tool_use_id: 'read-attached-pdf' }), encoding: 'utf8' });
        expect(pre.status, pre.stderr).toBe(0);
        const admitted = JSON.parse(readFileSync(join(root, 'state/admission.jsonl'), 'utf8').trim());
        expect(admitted.decision).toBe('allow');
        const derivative = readFileSync(path);
        if (secret) {
          expect(decodedPdf(derivative)).toContain('Public meeting Tuesday');
          expect(decodedPdf(derivative)).not.toContain(secret);
          const document = new PDFDocument(derivative);
          try {
            if (mode === 'metadata-held') expect(document.getTrailer().get('Info', 'Title').asString()).toBe('[redacted credential]');
            for (let i = 1; i < document.countObjects(); i++) {
              const object = document.newIndirect(i);
              try {
                if (object.isStream()) {
                  const stream = object.readStream();
                  try { expect(Buffer.from(stream.asUint8Array()).toString('latin1')).not.toContain(secret); }
                  finally { stream.destroy(); }
                }
              } finally { object.destroy(); }
            }
          } finally { document.destroy(); }
          if (mode === 'credential-compressed') expect(custody.records().length).toBeGreaterThan(0);
        } else expect(derivative).toEqual(pdf);
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
