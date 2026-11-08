// Port of TemplatesDriftVerifier (1.x 1cb59f787, lines 220–401): enumerate host
// deployments, compare current/prior SHA history, retain unknown customizations,
// and deduplicate (real path, SHA). Uses the existing update transaction holder.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { homedir } from 'node:os';
import { readUpdateRuntime, writeUpdateRuntime } from './update.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const templates = JSON.parse(readFileSync(new URL('./update-templates.json', import.meta.url), 'utf8'));
function defaultAgentRoots(home) {
  const parent = join(home, '.instar', 'agents'), out = [join(home, '.instar2')];
  if (!existsSync(parent)) return out;
  for (const name of readdirSync(parent)) {
    if (name.startsWith('.')) continue;
    const full = join(parent, name);
    try { if (statSync(full).isDirectory()) out.push(full); } catch { /* vanished entry */ }
  }
  return out;
}
function deploymentDirsForAgent(root) {
  const dirs = [];
  const candidates = [root, join(root, '.claude', 'scripts'), join(root, '.instar', 'scripts')];
  if (basename(root) === '.instar') candidates.push(join(root, 'scripts'));
  for (const candidate of candidates) {
    try { if (statSync(candidate).isDirectory()) dirs.push(realpathSync(candidate)); } catch { /* absent layout */ }
  }
  return dirs;
}
export function runTemplatesDriftVerifier(root, opts = {}) {
  const result = { scanned: 0, drifted: 0, prior: 0, suppressed: 0, errors: [] };
  if (opts.enabled === false) return { ...result, disabled: true };
  const home = opts.homeDir ?? homedir();
  const agentRoots = opts.agentRoots ?? [...defaultAgentRoots(home), root];
  const seen = readUpdateRuntime(root).templateFindings ?? {};
  if (!seen || typeof seen !== 'object' || Array.isArray(seen)) throw Error('Malformed durable drift findings');
  const visited = new Set();
  for (const agentRoot of agentRoots) {
    for (const dir of deploymentDirsForAgent(agentRoot)) {
      for (const spec of opts.templates ?? templates) {
        const path = join(dir, spec.basename);
        if (visited.has(path)) continue;
        visited.add(path);
        let foundSha;
        try {
          if (!existsSync(path) || !statSync(path).isFile()) continue;
          if (statSync(path).size > 1024 * 1024) { result.errors.push({ path, reason: 'template exceeds read bound' }); continue; }
          foundSha = sha(readFileSync(path));
        } catch { result.errors.push({ path, reason: 'template unreadable' }); continue; }
        result.scanned++;
        if (foundSha === spec.currentSha) continue;
        if (spec.priorShas.includes(foundSha)) { result.prior++; continue; }
        result.drifted++;
        const id = sha(`${path}::${foundSha}`);
        if (seen[id]) { result.suppressed++; continue; }
        // Persist the finding itself before exposing it, rather than report then append
        // a separate seen marker: a crash cannot duplicate or lose the signal.
        seen[id] = { path, sha: foundSha, observedAt: new Date().toISOString(),
          expectedShas: [spec.currentSha, ...spec.priorShas], disposition: 'custom-preserved' };
      }
    }
  }
  writeUpdateRuntime(root, 'templateFindings', seen);
  writeUpdateRuntime(root, 'templateScan', result);
  return result;
}
