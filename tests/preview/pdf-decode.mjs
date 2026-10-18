// Private bounded decoder child for pdf-protection.mjs. Never print diagnostics:
// parser warnings can contain source credentials. stdout is a private parent pipe.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PDFDocument, PDFArray, PDFDict, PDFRawStream, PDFString, PDFHexString, PDFName,
  decodePDFRawStream } from 'pdf-lib';

console.log = console.warn = console.error = () => {};
try {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const bytes = readFileSync(0);
  if (bytes.length > 20 * 1024 * 1024) throw Error();
  // Older incremental revisions can hold secrets absent from the current xref.
  // This deliberately conservative marker guard never parses compressed syntax.
  if ((bytes.toString('latin1').match(/startxref/g) ?? []).length !== 1) throw Error();
  const document = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: true });
  const texts = [''];
  let size = 0;
  const append = text => {
    size += Buffer.byteLength(text);
    if (size > 8 * 1024 * 1024) throw Error();
    texts.push(text);
  };
  const inspect = (object, depth = 0) => {
    if (depth > 100) throw Error();
    if (object instanceof PDFString || object instanceof PDFHexString || object instanceof PDFName) append(object.decodeText());
    else if (object instanceof PDFArray) for (const item of object.asArray()) inspect(item, depth + 1);
    else if (object instanceof PDFDict) for (const [key, value] of object.entries()) {
      append(key.decodeText()); inspect(value, depth + 1);
    }
    else if (object instanceof PDFRawStream) {
      inspect(object.dict, depth + 1);
      // Inspect even unused streams. Unsupported filters throw; a page renderer's
      // ability to ignore an opaque object is never evidence that it is safe.
      const decoded = Buffer.from(decodePDFRawStream(object).decode());
      const utf8 = decoded.toString('utf8');
      append(Buffer.from(utf8).equals(decoded) ? utf8 : decoded.toString('latin1'));
    }
  };
  for (const value of Object.values(document.context.trailerInfo)) inspect(value);
  for (const [, object] of document.context.enumerateIndirectObjects()) inspect(object);
  const task = getDocument({ data: Uint8Array.from(bytes), stopAtErrors: true,
    isEvalSupported: false, useSystemFonts: false, disableFontFace: true,
    standardFontDataUrl: fileURLToPath(new URL('../../node_modules/pdfjs-dist/standard_fonts/', import.meta.url)),
    verbosity: 0 });
  const rendered = await task.promise;
  try {
    if (rendered.numPages !== document.getPageCount() || rendered.numPages > 1000) throw Error();
    for (let index = 1; index <= rendered.numPages; index++) {
      const page = await rendered.getPage(index);
      const text = await page.getTextContent({ disableNormalization: true });
      // Check both rendered lines and adjacent runs: TJ/positioning must not hide a
      // held value by inserting layout whitespace between its encoded fragments.
      append(text.items.map(item => item.str ?? '').join(''));
      append(text.items.map(item => (item.str ?? '') + (item.hasEOL ? '\n' : '')).join(''));
      page.cleanup();
    }
  } finally { await task.destroy(); }
  process.stdout.write(JSON.stringify(texts));
} catch { process.exitCode = 1; }
