// Composition evidence without loading the macOS execution harness. Rules 26, 49, 69, 115.
import { readFileSync } from 'node:fs';
import { hashBytes } from '../../src/facts/index.js';
import { SELF_HOST_HARNESS } from './stall-coverage.js';
import { compositionClosure, compositionDigest, currentRuntime } from '../../scripts/composition-digest.mjs';
const DECLARATIONS = new URL('../../src/assembly/harness.declarations.json', import.meta.url);
const REPOSITORY = new URL('../../', import.meta.url);

/**
 * Rules 26, 49, 69, 115 (D17 §2): the exact composition the supported self-hosting tuple was certified
 * on. The declaration names the composition's entry points and the resolved runtime; the files are the
 * entries' static import closure, and the digest is recomputed from those files as they are now, on the
 * runtime actually running. `supported` is true only when the declared conformance and runtime match
 * this running composition exactly.
 */
export function selfHostCompositionEvidence(declarations = JSON.parse(readFileSync(DECLARATIONS, 'utf8')),
  read = path => { try { return readFileSync(new URL(path, REPOSITORY), 'utf8'); } catch { return null; } }) {
  const metrics = declarations.flatMap(entry => entry.requiredFacts?.metrics ?? []);
  const prefix = `harness.${SELF_HOST_HARNESS}.`;
  const fact = name => metrics.filter(metric => metric.startsWith(prefix) && metric.includes(`.self-hosting.${name}=`)).map(metric => metric.slice(metric.indexOf('=') + 1));
  const [entries] = fact('entries'), [declared] = fact('conformance'), [runtime] = fact('runtime');
  const closure = compositionClosure((entries ?? '').split(',').filter(Boolean), read, 'src/assembly/harness.declarations.json');
  const running = currentRuntime();
  const digest = closure.complete && closure.files.length ? compositionDigest(running, closure.files, read) : null;
  return { entries: (entries ?? '').split(',').filter(Boolean), files: closure.files, runtime: running, declaredRuntime: runtime ?? null,
    declared: declared ?? null, digest: digest ?? hashBytes('incomplete composition'),
    supported: digest !== null && declared === digest && runtime === running };
}
