// One native tool call, executed out of the loop's process (Rule 115, Part Thirteen §9 in docs/17-harness-adapters). The loop
// launches this source through the host resource owner (memory, process, CPU and handle ceilings; its stop and deadline end the
// launch) inside the native sandbox, so every open, link and path resolution below is checked by the kernel at the moment it
// happens: a path the hook admitted that later turns into a link out of the scratch volume is refused (EPERM), and a blocking
// open (a FIFO without a writer) blocks only this worker, never the loop. It reads one request ({tool, input, workspace}) on
// stdin and writes one JSON result on stdout. Its descendants are the host resource owner's to account for and end (it joins
// them by this launch's sandbox identity, from outside); nothing here takes part in cleanup. Errors are results, not throws.
// Uses builtins only: the sandbox reads no repository.
import { spawn } from 'node:child_process';
import { globSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, matchesGlob, relative, resolve, sep } from 'node:path';

const within = (path, root) => path === root || path.startsWith(root + sep);
const clip = (text, chars) => text.length > chars ? `${text.slice(0, chars)}…[truncated ${String(text.length - chars)} chars]` : text;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

/** Bounded walk of regular files under `base` that never follows a link. */
function walkFiles(base, limit = 5000) {
  const files = [];
  const walk = dir => {
    for (const name of readdirSync(dir).sort()) {
      if (files.length >= limit) return;
      const path = join(dir, name), stat = lstatSync(path);
      if (stat.isDirectory()) walk(path); else if (stat.isFile()) files.push(path);
    }
  };
  walk(base);
  return files;
}

/** A shell command from the workspace; settles on its exit (a backgrounded descendant that keeps the output open does not hold the
 * call: the host resource owner ends every member of the launch's sandbox once the worker exits). */
function shell(command, workspace) {
  return new Promise(done => {
    const child = spawn('/bin/sh', ['-c', command], { cwd: workspace, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', settled = false;
    const cap = 1024 * 1024;
    child.stdout.on('data', chunk => { if (stdout.length < cap) stdout += chunk; });
    child.stderr.on('data', chunk => { if (stderr.length < cap) stderr += chunk; });
    const finish = code => { if (settled) return; settled = true; done({ stdout, stderr, exitCode: code }); };
    child.on('error', error => { stderr += String(error.message); finish(null); });
    child.on('close', code => finish(code));
    child.on('exit', code => setTimeout(() => finish(code), 200));
  });
}

async function run({ tool, input, workspace }) {
  const at = path => resolve(workspace, String(path));
  const stays = path => { try { return within(realpathSync(path), workspace); } catch { return false; } };
  const sized = path => { if (statSync(path).size > MAX_FILE_BYTES) throw Error(`file larger than ${String(MAX_FILE_BYTES)} bytes`); return path; };
  if (tool === 'Read') {
    const lines = readFileSync(sized(at(input.file_path)), 'utf8').split('\n');
    const offset = Number.isSafeInteger(input.offset) && input.offset > 0 ? input.offset - 1 : 0;
    const limit = Number.isSafeInteger(input.limit) && input.limit > 0 ? input.limit : 2000;
    return { content: clip(lines.slice(offset, offset + limit).join('\n'), 65536) };
  }
  if (tool === 'Write') {
    const path = at(input.file_path);
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    writeFileSync(path, String(input.content ?? ''), { mode: 0o600 });
    return { type: 'written', filePath: relative(workspace, path), bytes: Buffer.byteLength(String(input.content ?? '')) };
  }
  if (tool === 'Edit') {
    const path = at(input.file_path), text = readFileSync(sized(path), 'utf8');
    const from = String(input.old_string ?? ''), to = String(input.new_string ?? '');
    const count = from ? text.split(from).length - 1 : 0;
    if (count === 0) return { error: 'old_string not found' };
    if (count > 1 && input.replace_all !== true) return { error: `old_string occurs ${String(count)} times; set replace_all or give more context` };
    writeFileSync(path, input.replace_all === true ? text.split(from).join(to) : text.replace(from, () => to));
    return { type: 'edited', filePath: relative(workspace, path), replacements: input.replace_all === true ? count : 1 };
  }
  if (tool === 'Glob') {
    const base = at(input.path ?? '.');
    const found = globSync(String(input.pattern ?? ''), { cwd: base }).map(name => join(base, name))
      .filter(stays).slice(0, 1000).map(path => relative(workspace, path));
    return { files: found };
  }
  if (tool === 'Grep') {
    let pattern; try { pattern = new RegExp(String(input.pattern ?? '')); } catch (error) { return { error: `invalid pattern: ${error.message}` }; }
    const base = at(input.path ?? '.'), mode = input.output_mode ?? 'files_with_matches';
    const candidates = lstatSync(base).isFile() ? [base] : walkFiles(base);
    const out = [];
    for (const path of candidates) {
      const name = relative(workspace, path);
      if (typeof input.glob === 'string' && !matchesGlob(relative(base, path) || name, input.glob)) continue;
      if (lstatSync(path).size > 1024 * 1024) continue;
      const lines = readFileSync(path, 'utf8').split('\n'), hits = lines.flatMap((line, i) => pattern.test(line) ? [`${name}:${String(i + 1)}:${line}`] : []);
      if (!hits.length) continue;
      if (mode === 'content') out.push(...hits); else if (mode === 'count') out.push(`${name}:${String(hits.length)}`); else out.push(name);
    }
    return { matches: clip(out.join('\n'), 65536) };
  }
  if (tool === 'Bash') return shell(String(input.command), workspace);
  return { error: `no native executor for ${String(tool)}` };
}

let request = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { request += chunk; });
process.stdin.on('end', async () => {
  let output;
  try {
    const parsed = JSON.parse(request);
    output = await run(parsed);
  } catch (error) { output = { error: clip(String(error?.message ?? error), 512) }; }
  process.stdout.write(JSON.stringify(output), () => process.exit(0));
});
