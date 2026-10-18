// Host-only PDF decoding at the existing attachment protection boundary (Rules 4/95/100).
// No provider, process, download, durable state or authority is introduced here.
import { PDFDocument, PDFPage, setLog } from 'mupdf';
import { credentialSpans } from '../../src/recall/redact.js';
import { secretForms } from './reply-check.js';

// Decoder diagnostics may quote unprotected source bytes. The attachment boundary
// already reports failures without source content; suppress raw library diagnostics.
setLog({});

export function protectPdf(bytes, protectText, heldSecrets) {
  let document = new PDFDocument(bytes);
  try {
    if (document.needsPassword()) throw Error('PDF protection requires decoded content');
    // A derivative must not carry prior incremental revisions the current xref hides.
    let changed = document.countVersions() > 1;
    for (let index = 0; index < document.countPages(); index++) {
      const page = document.loadPage(index), text = page.toStructuredText('preserve-whitespace');
      try {
        const chars = [];
        text.walk({ onChar: (value, _origin, _font, _size, quad) => chars.push({ value, quad }),
          endLine: () => chars.push({ value: '\n', quad: null }) });
        const original = chars.map(char => char.value).join('');
        if (protectText(original) === original) continue;
        // The same exact credential spans and held encodings as the existing floor.
        // Coordinates come from decoded glyphs, including compressed/hex/TJ text.
        const held = heldSecrets();
        if (held.unavailable !== null) throw Error('media held credentials unavailable');
        const spans = [...credentialSpans(original)];
        for (const form of held.values.flatMap(secretForms)) {
          for (let at = original.indexOf(form); at !== -1; at = original.indexOf(form, at + form.length))
            spans.push({ start: at, end: at + form.length });
        }
        let offset = 0;
        const quads = [];
        for (const char of chars) {
          if (char.quad && spans.some(span => span.start < offset + char.value.length && span.end > offset)) quads.push(char.quad);
          offset += char.value.length;
        }
        if (!quads.length) throw Error('PDF protection could not locate credential');
        const annotation = page.createAnnotation('Redact');
        try {
          annotation.setQuadPoints(quads);
          annotation.applyRedaction(1, PDFPage.REDACT_IMAGE_NONE, PDFPage.REDACT_LINE_ART_NONE);
        } finally { annotation.destroy(); }
        changed = true;
      } finally { text.destroy(); page.destroy(); }
    }
    // Redaction can leave superseded, unreferenced page streams in the working xref.
    // Collect them before inspecting what will actually be handed to the reader.
    if (changed) {
      const rewritten = document.saveToBuffer('garbage=4,compress');
      try {
        const next = new PDFDocument(rewritten.asUint8Array());
        document.destroy(); document = next;
      } finally { rewritten.destroy(); }
    }
    for (let index = 0; index < document.countPages(); index++) {
      const page = document.loadPage(index), text = page.toStructuredText('preserve-whitespace');
      try {
        const original = text.asText();
        if (protectText(original) !== original) throw Error('PDF text protection unresolved');
      } finally { text.destroy(); page.destroy(); }
    }
    // Protect strings outside pages (metadata, annotations, forms), and inspect every
    // decoded stream, including unused objects. Never let compressed leftovers through.
    const strings = (object, depth = 0) => {
      if (depth > 100) throw Error('PDF object nesting exceeds protection bound');
      if (object.isIndirect()) return; // the finite xref walk handles these once
      if (object.isArray() || object.isDictionary()) object.forEach((value, key) => {
        if (value.isString()) {
          const original = value.asString(), protectedText = protectText(original);
          if (original !== protectedText) { object.put(key, document.newString(protectedText)); changed = true; }
        } else strings(value, depth + 1);
      });
    };
    const trailer = document.getTrailer();
    try { strings(trailer); } finally { trailer.destroy(); }
    for (let index = 1; index < document.countObjects(); index++) {
      const ref = document.newIndirect(index), object = ref.resolve();
      try {
        if (object.isString()) {
          const original = object.asString(), protectedText = protectText(original);
          if (original !== protectedText) { ref.writeObject(document.newString(protectedText)); changed = true; }
        } else strings(object);
        if (ref.isStream()) {
          const decoded = ref.readStream();
          try {
            // A residual credential in an opaque stream cannot safely be patched as
            // text. Withhold this derivative; encrypted source and file tools survive.
            const contents = Buffer.from(decoded.asUint8Array());
            const utf8 = contents.toString('utf8');
            const original = Buffer.from(utf8).equals(contents) ? utf8 : contents.toString('latin1');
            if (protectText(original) !== original) throw Error('PDF stream protection unresolved');
          } finally { decoded.destroy(); }
        }
      } finally { object.destroy(); ref.destroy(); }
    }
    if (!changed) return bytes;
    // Full rewrite drops superseded compressed objects; incremental saving could leak them.
    const result = document.saveToBuffer('garbage=4,compress');
    try { return Buffer.from(result.asUint8Array()); } finally { result.destroy(); }
  } finally { document.destroy(); }
}
