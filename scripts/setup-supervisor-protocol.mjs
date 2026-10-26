// Rules 4/26/38/57/108: owner facts justify; model prose never authorizes.
export const SCHEMA = 'setup-owner-results-v1';
export const CHECKS = Object.freeze({
  key: ['isolated_custodian', 'protected_paths', 'same_installation', 'same_key_set', 'challenge_verified', 'agent_export_denied', 'harness_export_denied', 'replacement_denied'],
  backup: ['independent_recovery', 'authenticated_decryption', 'same_installation', 'same_key_set', 'current_version', 'restored_challenge'],
  signing: ['canonical_subject', 'expected_signer', 'same_installation', 'same_session', 'correct_purpose', 'signature_verified', 'genesis_authority'],
  append: ['approved_bundle', 'authority_chain', 'required_durability', 'same_digest', 'same_sequence', 'unique_operation'],
});
export const PRECHECKS = Object.freeze({
  key: ['preparation_scope', 'same_installation', 'same_subject', 'current_frontier', 'isolated_custodian', 'protected_paths', 'key_creation_or_resume'],
  backup: ['preparation_scope', 'same_installation', 'same_subject', 'current_frontier', 'same_key_set', 'independent_recovery'],
  signing: ['preparation_scope', 'same_installation', 'same_subject', 'current_frontier', 'expected_signer', 'correct_purpose', 'genesis_authority'],
  append: ['preparation_scope', 'same_installation', 'same_subject', 'current_frontier', 'approved_bundle', 'authority_chain', 'unique_operation'],
});
export const DECISION_SCHEMA = Object.freeze({ type: 'object', additionalProperties: false,
  required: ['disposition'], properties: { disposition: { type: 'string', enum: ['accept', 'hold'] } } });
export const PROMPT = `Validate whether all the required owner checks establish the setup phase described by this closed record.
Each check names its owner and a receipt handle, and states whether it was observed and passed.
Choose accept only if every required check is observed and passed. Otherwise choose hold.
You cannot create authority, invent observations or overrule an owner refusal.
Return exactly one JSON object with the sole field disposition, whose value is accept or hold.`;
const keys = (value, names) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',') === [...names].sort().join(',');
export const boundedId = value => typeof value === 'string' && /^[a-zA-Z0-9:._-]{1,160}$/.test(value);
export function projectSetupChecks(record, expected) {
  const names = expected.phase === 'pre' ? PRECHECKS[expected.step] : expected.phase === 'post' ? CHECKS[expected.step] : null;
  const bindingKeys = ['installation', 'session', 'subject', 'authority', 'step', 'phase', 'operation', 'schema'];
  if (!names || !keys(record, ['checkpoint', 'checks'])
    || !keys(record.checkpoint, [...bindingKeys, 'frontier'])
    || bindingKeys.some(key => !boundedId(expected[key]) || record.checkpoint[key] !== expected[key])
    || expected.schema !== SCHEMA || !boundedId(record.checkpoint.frontier)
    || !Array.isArray(record.checks) || record.checks.length !== names.length) throw Error('owner record binding or required set');
  const owner = expected.step === 'append' ? 'one-two' : 'custodian';
  const checks = names.map(name => {
    const rows = record.checks.filter(row => row?.name === name), row = rows[0];
    if (rows.length !== 1 || !keys(row, ['name', 'owner', 'observed', 'passed', 'receipt'])
      || row.owner !== owner || typeof row.observed !== 'boolean' || typeof row.passed !== 'boolean'
      || (row.passed && !row.observed) || !/^r[1-9][0-9]{0,2}$/.test(row.receipt)) throw Error('owner check shape');
    return { name, owner, observed: row.observed, passed: row.passed, receipt: row.receipt };
  });
  if (new Set(checks.map(row => row.receipt)).size !== checks.length) throw Error('duplicate receipt mapping');
  // Long bindings stay in the authenticated checkpoint, never as model instructions.
  return { schema: SCHEMA, step: expected.step, phase: expected.phase, checks };
}
export function decodeSetupDecision(bytes) {
  if (typeof bytes !== 'string' || bytes.length > 65536) return 'hold';
  try {
    // A closed one-field JSON grammar rejects duplicate disposition keys too.
    if (!/^\s*\{\s*"disposition"\s*:\s*"(accept|hold)"\s*\}\s*$/.test(bytes)) return 'hold';
    const value = JSON.parse(bytes);
    return keys(value, ['disposition']) && value.disposition === 'accept' ? 'accept' : 'hold';
  } catch { return 'hold'; }
}
export function checkText(projection) {
  return projection.checks.map(row => `${row.name}: ${!row.observed ? 'not observed' : row.passed ? 'passed' : 'failed'}.`).join(' ');
}
