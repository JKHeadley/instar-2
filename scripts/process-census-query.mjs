// Read the whole UID population without materializing unbounded argv tails.
// Ten already retains only the first4096 normalized command characters per row.
import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
export const PROCESS_CENSUS_COLUMNS = 'pid=,ppid=,pgid=,uid=,rss=,time=,stat=,lstart=,command=';
export function readProcessCensus(file, args, { timeoutMs = 2000, maxBytes = 1024 * 1024, onFailure = () => {}, spawnProcess = spawn } = {}) {
  return new Promise(resolve => {
    const started = performance.now(), decoder = new StringDecoder('utf8');
    const rows = []; let child, timer, settled = false, retainedBytes = 0, readBytes = 0;
    let line = '', fields = 0, pendingSpace = false, commandChars = 0;
    const fail = code => {
      if (settled) return; settled = true; clearTimeout(timer);
      try { child?.kill('SIGKILL'); } catch { /* only this query child */ }
      onFailure({ query: 'process-census', code, elapsedMs: Math.round(performance.now() - started), readBytes, retainedBytes });
      resolve(null);
    };
    const flush = () => {
      const bytes = Buffer.byteLength(line + '\n');
      if (retainedBytes + bytes > maxBytes) return fail('normalized-output-overflow');
      rows.push(line); retainedBytes += bytes;
      line = ''; fields = 0; pendingSpace = false; commandChars = 0;
    };
    const consume = text => {
      for (const c of text) {
        if (settled) return;
        if (c === '\n') { flush(); continue; }
        if (/\s/u.test(c)) { if (line) pendingSpace = true; continue; }
        if (pendingSpace) {
          fields++; pendingSpace = false;
          if (fields <= 12) line += ' ';
          else if (commandChars < 4096) { line += ' '; commandChars++; }
        }
        if (fields < 12) line += c;
        else if (commandChars < 4096) { const keep = c.slice(0, 4096 - commandChars); line += keep; commandChars += keep.length; }
        // Invalid metadata cannot grow a single retained row beyond the old query bound.
        if (line.length > maxBytes) return fail('normalized-output-overflow');
      }
    };
    try {
      child = spawnProcess(file, args, { env: { PATH: '/usr/bin:/bin' }, stdio: ['ignore', 'pipe', 'ignore'] });
      timer = setTimeout(() => fail('timeout'), timeoutMs);
      child.stdout.on('data', bytes => { readBytes += bytes.length; consume(decoder.write(bytes)); });
      child.stdout.on('error', () => fail('stdout-unavailable'));
      child.once('error', error => fail(typeof error.code === 'string' ? error.code : 'spawn-failed'));
      child.once('close', code => {
        if (settled) return;
        consume(decoder.end()); if (line && !settled) flush(); if (settled) return;
        if (code !== 0) return fail('exit-' + String(code));
        if (rows.every(row => !row)) return fail('empty-census');
        settled = true; clearTimeout(timer); resolve(rows.join('\n') + '\n');
      });
    } catch (error) { fail(typeof error.code === 'string' ? error.code : 'spawn-failed'); }
  });
}
