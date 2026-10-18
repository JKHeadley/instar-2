// Host-only PDF decoding at the existing attachment protection boundary (Rules 4/95/100).
import { localMediaCommand } from '../../scripts/local-transcriber.mjs';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export async function protectPdf(bytes, protectText, options = {}) {
  // Reuse the existing host resource owner for admission, Six allocation, stop,
  // process-tree cleanup and physical limits. Plaintext travels only over pipes.
  if (bytes.length > 20 * 1024 * 1024) throw Error('PDF protection input bound');
  let texts;
  // A private empty working area gives the existing census an exact scope; never
  // join unrelated processes merely because they share the project directory.
  const area = mkdtempSync(join(options.cwd ?? tmpdir(), 'pdf-decode-'));
  try {
    const output = await localMediaCommand(process.execPath, ['--max-old-space-size=256',
      fileURLToPath(new URL('./pdf-decode.mjs', import.meta.url))], {
      ...options, cwd: area, input: bytes, timeout: 10000, maxBytes: 16 * 1024 * 1024,
    });
    texts = JSON.parse(output.toString('utf8'));
  } catch { throw Error('PDF protection requires decoded content'); }
  finally { rmSync(area, { recursive: true, force: true }); }
  if (!Array.isArray(texts) || !texts.length || texts.some(text => typeof text !== 'string'))
    throw Error('PDF protection decoding failed');
  const utf8 = bytes.toString('utf8');
  texts.push(Buffer.from(utf8).equals(bytes) ? utf8 : bytes.toString('latin1'));
  // Preserve clean bytes exactly. Withhold rather than approximate glyph redaction;
  // the caller retains the authenticated encrypted source and unreadable notice.
  for (const text of texts) if (protectText(text) !== text) throw Error('PDF protection unresolved');
  return bytes;
}
