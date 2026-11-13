// P-08 v2 eligibility is host-only. The existing effect owner persists this whole cause before dispatch.
import { authorityDigest, resolveInstallationPolicy, ROLE_SINGLE_MACHINE_PROFILE } from './activation-authority.js';
export function roleProfileDecision({ profile, singleMachine, trial, operator, now, authority, parent, active, config, tool, input, decide }) {
  const legacy = decide(tool, input, config, now);
  if (profile !== ROLE_SINGLE_MACHINE_PROFILE.id || !legacy.tests?.irreversible || config.operations.includes(legacy.effect)) return legacy;
  const refuse = reason => ({ ...legacy, admitted: false, disposition: 'refused', refusedFor: ['durability'], reason });
  if (singleMachine !== true) return refuse('enrolled-peer durability cannot fall back to a local single-machine profile');
  const policy = resolveInstallationPolicy(trial, authority.record, operator, now, authority.records, authority.sealKey, profile);
  if (policy.kind !== 'resolved') return refuse(policy.reason);
  // The exact durable parent (and its delegated reservation ancestors), not a caller's assertion of a receipt.
  const prefix = [], seen = new Set();
  let edge = parent;
  while (edge) {
    if (seen.has(edge.id) || !active[edge.id] || authorityDigest(active[edge.id]) !== authorityDigest(edge))
      return refuse('the complete local causal prefix is not durable');
    seen.add(edge.id); prefix.push(edge);
    if (!edge.drawsOn) break;
    edge = active[edge.drawsOn];
    if (!edge) return refuse('the complete local causal prefix is not durable');
  }
  if (!prefix.length) return refuse('the complete local causal prefix is not durable');
  const verdict = decide(tool, input, { ...config, rolePolicy: policy }, now);
  const acceptance = authority.record.installationPolicies.find(entry => entry.id === policy.id);
  const names = row => row.topicId === acceptance.source.topicId && row.messageId === acceptance.source.messageId;
  return { ...verdict, localCause: JSON.stringify({ tool, input, prefix, configuration: config, policy,
    authority: authority.record, source: { messages: authority.records.messages.filter(names),
      provenance: authority.records.provenance.filter(names), bindings: { [acceptance.source.topicId]: authority.records.bindings[acceptance.source.topicId] } }, decision: verdict }) };
}
