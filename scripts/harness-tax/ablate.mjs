/** Source-copy-only text switches. Does not edit a launcher, register, floor or running installation. */
import { readFileSync, writeFileSync, realpathSync, lstatSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { digest, durable } from './runner.mjs';

const switches = {
  'copy-coaching': { file: 'tests/preview/briefing.ts',
    pattern: /export const LITERAL_COPY_INSTRUCTIONS = [\s\S]*?;\n/u, replacement: "export const LITERAL_COPY_INSTRUCTIONS = '';\n" },
  'claim-coaching': { file: 'tests/preview/answer-provenance.ts',
    pattern: /export const CLAIM_EVIDENCE_GUIDANCE = [\s\S]*?;\n/u, replacement: "export const CLAIM_EVIDENCE_GUIDANCE = '';\n" },
  'self-description-coaching': { file: 'tests/preview/briefing.ts',
    pattern: /\$\{MIND_INSTRUCTIONS\}\\n\$\{SELF_DESCRIPTION\}\\n\$\{ANSWER_PROTOCOL\}/u,
    replacement: '${MIND_INSTRUCTIONS}\\n${ANSWER_PROTOCOL}' },
};
export function ablate(copy, part, receipt) {
  const spec = switches[part];
  const root = realpathSync(copy);
  if (!spec || root !== resolve(copy) || receipt?.root !== root || receipt?.disposable !== true || !receipt?.sourceDigest)
    throw Error('ablation needs an explicitly provisioned disposable source copy');
  const marker = JSON.parse(readFileSync(join(root, 'harness-tax-copy.json'), 'utf8'));
  if (digest(marker) !== digest(receipt)) throw Error('copy receipt mismatch');
  const path = join(root, spec.file), actual = realpathSync(path);
  if (lstatSync(path).isSymbolicLink() || relative(root, actual).startsWith('..')) throw Error('source escapes copy');
  const before = readFileSync(path, 'utf8');
  if (!spec.pattern.test(before)) throw Error('source changed: switch must be re-reviewed');
  const after = before.replace(spec.pattern, spec.replacement);
  if (after === before) throw Error('correction already off');
  // Record before mutation, so interruption is repairable without guessing.
  durable(join(root, `${part}.ablation.json`), { part, file: spec.file, before, beforeDigest: digest(before), afterDigest: digest(after), receipt });
  writeFileSync(path, after);
  return { part, beforeDigest: digest(before), afterDigest: digest(after) };
}
