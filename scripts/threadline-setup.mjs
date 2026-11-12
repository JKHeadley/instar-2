// Installer-side enrollment, never a worker tool. The owner signs the complete private share.
import { createPublicKey, verify } from 'node:crypto';
import { join } from 'node:path';
import { readSetupRecord, publishSetupRecord } from './onboarding-state.mjs';
import { durablePreviewWrite } from '../tests/preview/durable-write.js';
import { decodeEffectPolicy } from '../tests/preview/effect-doorway.mjs';
import { THREADLINE_TOOLS, THREADLINE_LOSS_MODEL } from './threadline-runtime.mjs';
/** Pin once under installer custody. Changing a pinned owner key is a separate owner recovery. */
export function installThreadlineBinding(root, input, now) {
  const identity = readSetupRecord(join(root, 'threadline/public.json'));
  const setup = readSetupRecord(join(root, '.onboarding/identity.json'));
  const { owner, signed } = input;
  if (!identity || !setup || owner?.id !== setup.custodian || !signed?.record
    || !verify(null, Buffer.from(JSON.stringify(signed.record)), createPublicKey(owner.publicKey), Buffer.from(signed.signature, 'base64')))
    throw Error('Threadline needs the installation owner’s signed private share');
  const r = signed.record;
  if (r.version !== 1 || r.principal !== identity.principal || r.owner !== owner.id || typeof r.withdrawn !== 'boolean'
    || !Number.isSafeInteger(r.expiresAt) || r.expiresAt <= now || !Array.isArray(r.peers) || r.peers.length > 32
    || r.durability?.demand !== 'local-durable' || r.durability?.causalPrefix !== 'full' || r.durability?.lossModel !== THREADLINE_LOSS_MODEL)
    throw Error('Threadline share must bind this identity, its private peers and complete durable cause');
  if (r.peers.some(peer => !/^(?:main|[1-9][0-9]{0,15})$/u.test(peer.topic)
    || typeof peer.principal !== 'string' || typeof peer.conversation !== 'string' || typeof peer.inbox !== 'string'))
    throw Error('Threadline private topic or peer route is malformed');
  const ownerPath = join(root, 'threadline-owner.json'), oldOwner = readSetupRecord(ownerPath);
  if (oldOwner && JSON.stringify(oldOwner) !== JSON.stringify(owner)) throw Error('Threadline owner pin differs; retain the existing pin');
  const policyPath = join(root, 'effect-policy.json'), policy = decodeEffectPolicy(readSetupRecord(policyPath));
  const targets = THREADLINE_TOOLS.map(tool => `mcp__threadline__${tool}`);
  const registered = policy.registered.filter(row => !targets.includes(row.target));
  const grants = policy.grants.filter(row => !targets.includes(row.target));
  if (!r.withdrawn) for (const tool of THREADLINE_TOOLS) {
    const target = `mcp__threadline__${tool}`;
    registered.push({ effect: 'tool:mcp', target, consequence: 'data', reversibility: tool.endsWith('_send') ? 'irreversible' : 'reversible',
      reach: 'world', costUsd: 0, source: `owner-signed-threadline:${identity.principal}` });
    grants.push({ id: `threadline:${tool}`, effect: 'tool:mcp', target, approves: ['scope'], source: `owner-signed-threadline:${identity.principal}`,
      custodian: owner.id, recovery: 'withdraw the signed peer share', expiresAt: r.expiresAt });
  }
  const next = decodeEffectPolicy({ ...policy, registered, grants });
  // Signed scope is checked at every dispatch. A crash between writes grants no peer beyond that scope.
  publishSetupRecord(ownerPath, owner);
  durablePreviewWrite(join(root, 'threadline-team.json'), signed);
  durablePreviewWrite(policyPath, next);
}
