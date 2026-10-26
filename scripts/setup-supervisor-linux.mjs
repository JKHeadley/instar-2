// OS implementation beneath the OS-neutral setup supervisor/Seven interface.
// Signed qualification is absent by default: no real install can dispatch yet.
import { execFileSync } from 'node:child_process';
import { createPublicKey, verify } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boundedLinuxRun } from './setup-qualification-linux.mjs';
import { MODEL_3B, PROFILE_3B_3GIB, TEMPLATE, digest, fileDigest, tokenUsage, extractReply } from './setup-qualification.mjs';
import { DECISION_SCHEMA, PROMPT } from './setup-supervisor-protocol.mjs';
import { publishSetupRecord } from './onboarding-state.mjs';
const PINS = ['adapter', 'projection', 'prompt', 'template', 'schema', 'decoder', 'runner', 'runnerPython', 'supervisor', 'owners', 'platform'];
const codeFiles = { supervisor: './setup-supervisor.mjs', owners: './setup-supervisor-owners.mjs', platform: './setup-supervisor-linux.mjs', adapter: './setup-supervisor-seven.mjs', projection: './setup-supervisor-protocol.mjs',
  decoder: './setup-supervisor-protocol.mjs', runner: './setup-qualification-linux.mjs', runnerPython: './setup-qualification-linux.py' };
function contained(root, relative) {
  if (typeof relative !== 'string' || !relative.split('/').every(s => /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(s))) throw Error('unsafe release path');
  const path = resolve(root, relative);
  if (!path.startsWith(`${root}${sep}`)) throw Error('unsafe release path');
  let current = path;
  while (true) {
    const stat = lstatSync(current);
    if (stat.isSymbolicLink() || (!stat.isDirectory() && (!stat.isFile() || stat.nlink !== 1))) throw Error('unsafe release path');
    if (dirname(current) === current) break;
    current = dirname(current);
  }
  return path;
}
/** Material is the independently signed release manifest, not a model result.
 * trustAnchor is supplied by independent installer custody, never from material.
 * No shipped manifest currently qualifies this new prompt/decoder/owner contract.
 */
export function linuxSetupModel({ root: rootInput, material, trustAnchor }) {
  const root = resolve(rootInput);
  const admit = async () => {
    if (process.platform !== 'linux' || !material || !trustAnchor) return null;
    try {
      const bytes = Buffer.from(material.manifest), key = createPublicKey(trustAnchor);
      if (bytes.length > 65536 || key.asymmetricKeyType !== 'ed25519' || !verify(null, bytes, key, material.signature)) return null;
      const m = JSON.parse(bytes);
      if (m.version !== 1 || m.platform !== `linux-${process.arch}` || m.qualification?.state !== 'qualified'
        || !/^[a-f0-9]{64}$/.test(m.qualification.taskSetDigest) || !/^[a-f0-9]{64}$/.test(m.qualification.reviewDigest)
        || JSON.stringify(m.profile) !== JSON.stringify(PROFILE_3B_3GIB)
        || !PINS.every(pin => /^[a-f0-9]{64}$/.test(m.pins?.[pin]))) return null;
      if (m.pins.prompt !== digest(PROMPT) || m.pins.template !== digest(TEMPLATE)
        || m.pins.schema !== digest(JSON.stringify(DECISION_SCHEMA))) return null;
      for (const [name, file] of Object.entries(codeFiles))
        if (await fileDigest(fileURLToPath(new URL(file, import.meta.url))) !== m.pins[name]) return null;
      if (m.model?.sha256 !== MODEL_3B.sha256 || m.model?.source !== MODEL_3B.source
        || m.model?.size !== MODEL_3B.size || m.runtime?.source !== MODEL_3B.runtimeSource
        || !Array.isArray(m.libraries) || !m.libraries.length || m.libraries.length > 64) return null;
      for (const row of [m.model, m.runtime]) {
        if (!/^[a-f0-9]{64}$/.test(row.sha256)) return null;
        const file = contained(root, row.path);
        if (!lstatSync(file).isFile() || (row === m.model && lstatSync(file).size !== MODEL_3B.size)
          || await fileDigest(file) !== row.sha256) return null;
      }
      // Pin actual loader resolution, not merely copies of libraries in a folder.
      // The independently signed runtime is trusted; ldd runs with a clean env.
      const linked = execFileSync('/usr/bin/ldd', [contained(root, m.runtime.path)],
        { encoding: 'utf8', timeout: 5000, maxBuffer: 65536, env: { PATH: '/usr/bin:/bin', LC_ALL: 'C' } });
      const paths = [];
      for (const line of linked.trim().split('\n')) {
        if (/^\s*linux-vdso[^ ]* \(0x[a-f0-9]+\)\s*$/.test(line)) continue;
        const match = line.match(/^\s*(?:[^ ]+ => )?(\/[^ ]+) \(0x[a-f0-9]+\)\s*$/);
        if (!match) return null;
        paths.push(realpathSync(match[1]));
      }
      const declared = [];
      for (const row of m.libraries) {
        if (typeof row.path !== 'string' || !row.path.startsWith('/') || !/^[a-f0-9]{64}$/.test(row.sha256)) return null;
        const path = realpathSync(row.path);
        if (!lstatSync(path).isFile() || await fileDigest(path) !== row.sha256) return null;
        declared.push(path);
      }
      if (new Set(declared).size !== declared.length || JSON.stringify([...new Set(paths)].sort()) !== JSON.stringify(declared.sort())) return null;
      return { qualified: true, digest: digest(bytes) };
    } catch { return null; }
  };
  return Object.freeze({ admit,
    async execute({ record, prompt, root: workInput, stopFile, stopped, deadlineMs }) {
      const usage = { inputTokens: null, outputTokens: null, charge: 0, source: 'local setup; no paid provider' };
      const held = () => ({ state: 'uncertain', bytes: '', cleanup: 'unknown', usage, accounting: null });
      const started = performance.now();
      if (!Number.isFinite(deadlineMs) || deadlineMs <= 0 || deadlineMs > PROFILE_3B_3GIB.deadlineMs) return held();
      if (!await admit() || stopped()) return held();
      const m = JSON.parse(material.manifest);
      let work;
      try {
        work = contained(root, resolve(workInput).slice(root.length + 1));
        if (work !== resolve(workInput) || stopFile !== join(work, 'stop.json')) return held();
        contained(root, stopFile.slice(root.length + 1));
      } catch { return held(); }
      if (Buffer.byteLength(prompt) > PROFILE_3B_3GIB.context - PROFILE_3B_3GIB.outputTokens - 8) return held();
      const stopRequestFile = join(work, 'stop-request.json');
      const stopTimer = setInterval(() => { if (stopped()) publishSetupRecord(stopRequestFile, { stopped: true }); }, 25);
      try {
        const remaining = deadlineMs - (performance.now() - started);
        if (remaining <= 0) return held();
        const logFile = join(work, `${record.checkpoint.step}-${record.checkpoint.phase}.log`);
        try { if (lstatSync(logFile)) return held(); } catch (error) { if (error.code !== 'ENOENT') return held(); }
        const run = await boundedLinuxRun({ root: work, stopFile, stopRequestFile,
          executable: contained(root, m.runtime.path), stdin: prompt,
          profile: { ...PROFILE_3B_3GIB, deadlineMs: remaining }, args: [
            '-m', contained(root, m.model.path), '-f', '/dev/stdin', '-t', '2', '-tb', '2', '-c', '4096', '-n', '512',
            '--temp', '0', '--seed', '1', '-ngl', '0', '--no-display-prompt', '--simple-io', '--no-warmup',
            '--log-file', logFile, '--json-schema', JSON.stringify(DECISION_SCHEMA)] });
        let diagnostics = '';
        try { const s = lstatSync(logFile); if (s.isFile() && !s.isSymbolicLink() && s.size <= 131072) diagnostics = readFileSync(logFile, 'utf8'); } catch { /* Unknown usage remains null. */ }
        return { state: run.disposition === 'observed' ? 'complete' : 'uncertain', bytes: extractReply(run.raw.stdout),
          usage: tokenUsage(diagnostics), cleanup: run.raw.resources?.cleanup ?? 'unknown',
          accounting: { elapsedMs: performance.now() - started, raw: run.raw, diagnostics } };
      } finally { clearInterval(stopTimer); }
    },
  });
}
