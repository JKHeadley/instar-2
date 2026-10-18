import { afterEach, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { PDFDocument, PDFName } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { tmpdir } from 'node:os';
import { createTelegramMediaCustody, telegramInboundMedia } from './telegram-media.js';
import { createMediaAdmission, DEFAULT_EFFECT_POLICY } from './media-admission.js';
import { createSecretCustody } from './secret-custody.js';
import { conversationSessionAnswer } from './conversation-session-answer.js';
// @ts-expect-error Host-only JavaScript, shared image/document route.
import { openConversationMedia, protectMediaBytes } from './media-understanding.mjs';

// The production runner uses hostResources. This portable host-port fixture runs
// the actual decoder bytes; Darwin resource enforcement has its own contract suite.
vi.mock('../../scripts/resource-owner.mjs', () => ({ hostResources: { execute: vi.fn(async (input: {
  executable: string; args: string[]; stdin: Buffer; timeout: number; maxBytes: number; cwd: string;
}) => {
  const result = spawnSync(input.executable, input.args, { input: input.stdin, cwd: input.cwd,
    timeout: input.timeout, maxBuffer: input.maxBytes, killSignal: 'SIGKILL', env: {} });
  return { code: result.status, limited: !!result.error, stdoutBytes: result.stdout };
}) } }));
// @ts-expect-error Host resource port.
import { hostResources } from '../../scripts/resource-owner.mjs';
afterEach(() => vi.clearAllMocks());

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
async function decodedPdf(bytes: Buffer): Promise<string> {
  const task = getDocument({ data: Uint8Array.from(bytes), verbosity: 0,
    standardFontDataUrl: join(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts/') });
  const document = await task.promise;
  try { return (await (await document.getPage(1)).getTextContent()).items.map(item => 'str' in item ? item.str : '').join(''); }
  finally { await task.destroy(); }
}

it.each(['readable', 'clean-compressed', 'held-compressed', 'held-hex-split', 'credential-compressed', 'credential-hex-split', 'clean-hex-split',
  'metadata-held', 'incremental-held', 'opaque-held', 'opaque-clean', 'opaque-unsupported', 'comment-held', 'wrong-source', 'protection-unavailable', 'custody-unavailable', 'malformed', 'encrypted'])('replays PDF update 6234449 through the shipped custody-to-session callback: %s', async mode => {
  const secret = mode.startsWith('held-') ? held : mode.startsWith('credential-') ? credential : ['metadata-held', 'incremental-held'].includes(mode) ? held : null;
  let pdf = mode === 'malformed' ? Buffer.from('%PDF-1.4\ncorrupt') : secret || ['clean-compressed', 'clean-hex-split'].includes(mode)
    ? compressedPdf(secret ?? 'No private content here', mode.endsWith('hex-split')) : cleanPdf;
  if (secret && !['metadata-held', 'incremental-held'].includes(mode)) { expect(pdf.includes(Buffer.from(secret))).toBe(false); expect(await decodedPdf(pdf)).toContain(secret); }
  if (['metadata-held', 'opaque-held', 'opaque-clean', 'opaque-unsupported', 'encrypted'].includes(mode)) {
    const document = await PDFDocument.load(compressedPdf('Public content'));
    if (mode === 'metadata-held') document.setTitle(held);
    if (mode.startsWith('opaque-')) document.catalog.set(PDFName.of('Extra'), document.context.register(
      mode === 'opaque-unsupported' ? document.context.stream('opaque data', { Filter: 'UnsupportedFilter' })
        : document.context.flateStream(mode === 'opaque-held' ? held : 'Public extra content')));
    if (mode === 'encrypted') document.context.trailerInfo.Encrypt = document.context.register(document.context.obj({ Filter: 'Standard', V: 4, R: 4 }));
    pdf = Buffer.from(await document.save({ useObjectStreams: false }));
  }
  if (mode === 'incremental-held') pdf = incrementalPdf();
  if (mode === 'comment-held') pdf = Buffer.concat([cleanPdf, Buffer.from(`\n% ${held}\n`)]);
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
    const prepare = Function('join', 'openConversationMedia', 'project', 'topic', 'currentMedia', 'protectMediaBytes', 'custody', 'heldSecrets', 'stoppedNow',
      `return (${expression});`)(join, openConversationMedia, root, '3', lookup, protectMediaBytes,
      mode === 'custody-unavailable' ? { custody: () => ({ custody: { state: 'failed' } }) } : custody,
      () => ({ values: [held], unavailable: mode === 'protection-unavailable' ? ['vault'] : null }), () => false);
    const diagnostics = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    let opened;
    try {
      opened = await prepare([source]);
      expect(diagnostics.mock.calls).toEqual([]); // parser failures cannot log raw source
    } finally { diagnostics.mockRestore(); }
    try {
      const notice = opened.notices[source];
      if (['readable', 'clean-compressed', 'clean-hex-split', 'opaque-clean'].includes(mode)) {
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
        expect(derivative).toEqual(pdf);
        expect(await decodedPdf(derivative)).toContain(mode === 'readable' ? 'Synthetic PDF fixture' : 'Public meeting Tuesday');
        opened.close(); expect(existsSync(path)).toBe(false);
      } else {
        expect(notice).toContain('could not be read');
        if (mode.startsWith('credential-')) expect(custody.records().length).toBeGreaterThan(0);
      }
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

it('withholds bounded-decoder overflow without exposing parser diagnostics or source text', async () => {
  const root = mkdtempSync(join(tmpdir(), 'pdf-bound-'));
  const diagnostics = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  try {
    const custody = createSecretCustody(root, new Uint8Array(32).fill(9), () => 1000);
    for (const bytes of [Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(20 * 1024 * 1024)]),
      compressedPdf('x'.repeat(9 * 1024 * 1024))]) {
      await expect(protectMediaBytes(bytes, 'synthetic-bounded-pdf', custody,
        () => ({ values: [held], unavailable: null }))).rejects.toThrow(/PDF/);
    }
    expect(diagnostics.mock.calls).toEqual([]);
  } finally { diagnostics.mockRestore(); rmSync(root, { recursive: true, force: true }); }
});

it.each(['capacity', 'stopped', 'timeout'])('withholds the derivative when the existing resource owner refuses: %s', async reason => {
  const root = mkdtempSync(join(tmpdir(), 'pdf-resource-'));
  try {
    vi.mocked(hostResources.execute).mockResolvedValueOnce({ code: null, limited: true, localLimit: reason,
      stdoutBytes: new Uint8Array() });
    await expect(protectMediaBytes(cleanPdf, 'synthetic-refused', createSecretCustody(root, new Uint8Array(32).fill(9), () => 1000),
      () => ({ values: [], unavailable: null }), { cwd: root })).rejects.toThrow('PDF protection');
    expect(hostResources.execute).toHaveBeenCalledTimes(1);
    expect(vi.mocked(hostResources.execute).mock.calls[0]![1]).toBe('maintenance');
    const area = vi.mocked(hostResources.execute).mock.calls[0]![0].cwd;
    expect(area.startsWith(join(root, 'pdf-decode-'))).toBe(true);
    expect(existsSync(area)).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('checks stop before asking the resource owner to launch a PDF decoder', async () => {
  const root = mkdtempSync(join(tmpdir(), 'pdf-stop-'));
  try {
    await expect(protectMediaBytes(cleanPdf, 'synthetic-stopped', createSecretCustody(root, new Uint8Array(32).fill(9), () => 1000),
      () => ({ values: [], unavailable: null }), { cwd: root, stopped: () => true })).rejects.toThrow('PDF protection');
    expect(hostResources.execute).not.toHaveBeenCalled();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
