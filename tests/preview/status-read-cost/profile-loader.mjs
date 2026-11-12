// Measurement-only loader: instruments emitted source in memory; never changes product files.
import * as base from '../../../scripts/slice-ts-loader.mjs';
export const resolve = base.resolve;
export async function load(url, context, next) {
  const result = await base.load(url,context,next);
  if (url.endsWith('/tests/preview/journal.ts')) {
    let source = result.source;
    const replace = (before, after) => {
      if (!source.includes(before)) throw Error(`profile instrumentation missing: ${before}`);
      source = source.replaceAll(before, after);
    };
    replace('const sealed = readFileSync(fd);', 'const sealed = __phase("read", () => readFileSync(fd));');
    replace('const decoded = decodeRow(sealed, offset, key);', 'const decoded = __phase("decode", () => decodeRow(sealed, offset, key));');
    replace('parseJournalJson(pendingSnapshot.chunks)', '__phase("snapshotParse", () => parseJournalJson(pendingSnapshot.chunks))');
    replace('restoreSnapshot(snapshot, view.genesis)', '__phase("restore", () => restoreSnapshot(snapshot, view.genesis))');
    replace("project(view, row, systemCheck, 'replay')", "__phase('replay', () => project(view, row, systemCheck, 'replay'))");
    replace("const plain = Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]);", "const plain = __phase('decrypt', () => Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]));");
    replace("brotliDecompressSync(plain.subarray(1), { maxOutputLength: frameLimit })", "__phase('decompress', () => brotliDecompressSync(plain.subarray(1), { maxOutputLength: frameLimit }))");
    replace("JSON.parse(json.toString('utf8'))", "__phase('frameJSON', () => JSON.parse(json.toString('utf8')))");
    source += '\nfunction __phase(name, fn) { const start = process.cpuUsage(); try { return fn(); } finally { const used = process.cpuUsage(start); globalThis.__phases ??= {}; globalThis.__phases[name] = (globalThis.__phases[name] ?? 0) + used.user + used.system; } }\n';
    return {...result, source};
  }
  if (url.endsWith('/tests/preview/journal-agent.mjs')) {
    let source = String(result.source);
    source = source.replace("if (command === 'status') {", "if (command === 'status') { globalThis.__startupCPU = process.cpuUsage();");
    source += '\nprocess.on("exit", () => console.error(JSON.stringify({startupCPU:globalThis.__startupCPU, phases:globalThis.__phases, totalCPU:process.cpuUsage()})));\n';
    return {...result,source};
  }
  return result;
}
