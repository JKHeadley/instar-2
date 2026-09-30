// The register regeneration's resolver for the preview's record references (Rules 9, 62). Run the build with
// `--provider tests/preview/register-proof-provider.mjs` and INSTAR_PREVIEW_PROOF_LOG naming the runner's
// proofs.jsonl. A `live-proof:<capability>` reference resolves only to a live proof `record-live-proof` wrote for
// that capability; a duty's `proofs.jsonl#<plan>` only to a passed attempt of that plan. Anything else stays
// unresolved and the register refuses the declaration — a live user-facing feature is not registered as proven
// before a real run proved it. Probe and fixture references resolve through the part-nine owner manifest instead.
import { readFileSync } from 'node:fs';

const rows = () => {
  const path = process.env.INSTAR_PREVIEW_PROOF_LOG;
  if (!path) return [];
  return readFileSync(path, 'utf8').split('\n').flatMap(line => { try { return line ? [JSON.parse(line)] : []; } catch { return []; } })
    .filter(row => row && typeof row === 'object' && row.v === 1);
};
const result = resolved => resolved ? { type: 'Result', schemaVersion: 1, kind: 'Success', value: true, capacity: { kind: 'none' } }
  : { type: 'Result', schemaVersion: 1, kind: 'Refused', reason: 'decode', detail: 'unresolved preview proof record', site: 'register.decode',
    failDirection: 'closed', preserved: 'preview:proofs' };

export const provider = {
  resolveReference(reference) {
    if (reference.provider !== 'record') return result(false);
    const log = rows();
    if (reference.kind === 'e2e-run') return result(log.some(row => row.liveProof === reference.id && typeof row.version === 'string'));
    const plan = reference.kind === 'observation-proof' && /^proofs\.jsonl#([a-z-]+)$/u.exec(reference.id)?.[1];
    return result(Boolean(plan) && log.some(row => row.plan === plan && row.disposition === 'passed'));
  },
};
