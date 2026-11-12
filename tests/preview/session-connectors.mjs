// Continuing sessions reuse the per-call connector custody and launch preparation.
// Machine-local, bounded by the session lifetime; root configuration is the recorded account scope.
import { classifyEffect, decodeEffectPolicy } from './effect-doorway.mjs';
import { createProfileBrowser, profileConsequential, profileRead } from './browser-profile.mjs';
import { mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareMcpLaunch, serveTurnSocket, readRootMcp } from './tool-turn.mjs';
import { grantAcl, harnessAcl, harnessSocketDirectory, harnessHookPath } from './harness-user.mjs';

export async function prepareSessionConnectors({ mcp, privateDirectory, identity, workspace, resolveSecret,
  check, ownerRead = null, browserCall, holdBrowser, deadline, stopped, socketDirectory = () => identity ? harnessSocketDirectory(identity.user) : realpathSync(mkdtempSync(join(tmpdir(), 'ism-'))) }) {
  if (!mcp && !ownerRead) return { launch: () => undefined, close: async () => {} };
  const values = {};
  for (const [server, refs] of Object.entries(mcp?.secrets ?? {})) {
    if ((ownerRead && server === 'owner_github') || !Object.keys(refs).length) continue;
    values[server] = Object.fromEntries(Object.entries(refs).map(([key, ref]) => {
      const value = resolveSecret(ref);
      if (typeof value !== 'string' || !value) throw Error('session connector credential unavailable');
      return [key, value];
    }));
  }
  const profile = mcp?.browserProfile;
  const browser = profile ? createProfileBrowser({ binding: () => readRootMcp(profile.installation)?.browserProfile,
    hold: holdBrowser, check, call: browserCall, deadline, stopped }) : null;
  const socket = join(socketDirectory(), 's');
  const close = await serveTurnSocket(socket, { shared: Boolean(identity), check, ownerRead, browserRead: browser?.request });
  return { close: async () => { await browser?.close(); await close(); }, launch() {
    const client = identity ? join(dirname(harnessHookPath()), 'owner-browser-client.mjs')
      : fileURLToPath(new URL('./owner-browser-client.mjs', import.meta.url));
    let configured = ownerRead ? { ...mcp, secrets: { ...mcp?.secrets, owner_github: {} }, servers: { ...mcp?.servers,
      owner_github: { command: process.execPath, args: [client, socket] } } } : mcp;
    if (browser) {
      const client = identity ? join(dirname(harnessHookPath()), 'browser-profile-client.mjs') : fileURLToPath(new URL('./browser-profile-client.mjs', import.meta.url));
      configured = { ...configured, secrets: { ...configured.secrets, playwright: {} }, servers: { ...configured.servers,
        playwright: { command: process.execPath, args: [client, socket] } } };
    }
    const prepared = prepareMcpLaunch({ mcp: configured, privateDirectory, socket, workspace,
      harness: identity ? { hookScript: harnessHookPath() } : null });
    if (identity && prepared) grantAcl([prepared.config], [harnessAcl.readOnly(identity.user)]);
    close.rearm(prepared?.nonces ?? {}, values);
    return prepared;
  } };
}

/** ONE rollout switch: --conversation-account-actions on. Default off until PR 164 merges.
 * The current role, policy, resource ceiling and exact local cause still govern each call. */
export function conversationAccountActions(options) {
  const mode = options['conversation-account-actions'] ?? 'off';
  if (!['on', 'off'].includes(mode)) throw Error('conversation-account-actions must be on or off');
  if (mode === 'on' && options['conversation-session'] !== 'on') throw Error('account actions require a continuing session');
  return mode === 'on';
}
export function admitSessionConnector({ tool, input, config, mcp, enabled, now, decide }) {
  if (!tool.startsWith('mcp__')) return decide(tool, input, config, now);
  if (tool !== 'mcp__owner_github__observe' && (!mcp || !Object.keys(mcp.servers).some(name => tool.startsWith(`mcp__${name}__`))))
    return { admitted: false, reason: 'connector is outside the currently granted account set' };
  const envelope = mcp?.browserProfile && tool.startsWith('mcp__playwright__') && input?.browserEffect;
  // A socket for an ordinary navigation still records its preparation, under the profile's recorded origin grant.
  const ordinaryConnection = envelope?.method === 'CONNECT' && (tool === 'mcp__playwright__browser_navigate'
    || (tool === 'mcp__playwright__browser_tabs' && input.action === 'new'))
    && mcp.browserProfile.origins?.includes(envelope.url.replace(/^ws/u, 'http'));
  const networkEffect = envelope && !ordinaryConnection ? envelope : null;
  const consequential = mcp?.browserProfile && tool.startsWith('mcp__playwright__') && profileConsequential(tool.slice(17), input);
  const reads = mcp?.browserProfile ? mcp.reads.filter(read => (!(networkEffect || consequential) || read !== tool) && (!read.startsWith('mcp__playwright__') || profileRead(read.slice(17)))) : mcp?.reads ?? [];
  const current = { ...config, mcpReads: reads, operations: enabled ? [...config.operations, 'tool:mcp'] : config.operations.filter(operation => operation !== 'tool:mcp') };
  const writing = mcp?.browserProfile && tool.startsWith('mcp__playwright__') && !reads.includes(tool);
  if (writing) {
    let grants = [];
    try { grants = classifyEffect({ effect: 'tool:mcp', target: tool }, decodeEffectPolicy(config.effectPolicy), { now }).grants; } catch { /* unavailable grants refuse */ }
    if (!grants.some(grant => grant.target === tool && grant.browserProfile === mcp.browserProfile.id && grant.approves.includes('scope')))
      return { admitted: false, reason: `signed-in effects require a current tool:mcp scope grant naming target=${tool} and browserProfile=${mcp.browserProfile.id} (Rules 18/57)` };
  }
  if (networkEffect) {
    let destination;
    try { const url = new URL(networkEffect.url); if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) || url.username || url.password) throw Error(); destination = url.origin; } catch { return { admitted: false, reason: 'invalid browser destination' }; }
    const grants = classifyEffect({ effect: 'tool:mcp', target: tool }, decodeEffectPolicy(config.effectPolicy), { now }).grants;
    if (!grants.some(grant => grant.target === tool && grant.browserProfile === mcp.browserProfile.id && grant.browserOrigin === destination && grant.approves.includes('scope')))
      return { admitted: false, reason: `browser request needs a scope grant for browserOrigin=${destination} (Rules 18/57)` };
  }
  // Only the host browser emits this envelope, at the actual HTTP write boundary.
  // UI reversibility cannot make an external request reversible. Retain all other
  // cost, scope and sensitive-matter tests and the same exact tool/profile grant.
  if (networkEffect || consequential) {
    const policy = decodeEffectPolicy(config.effectPolicy);
    const classification = classifyEffect({ effect: 'tool:mcp', target: tool }, policy, { now });
    const registered = policy.registered.find(row => row.effect === 'tool:mcp' && (!row.target || row.target === tool));
    current.effectPolicy = { ...policy, registered: [{ ...classification.profile, costUsd: classification.costUsd,
      source: 'host:browser-request', ...registered, effect: 'tool:mcp', target: tool, reversibility: 'irreversible' },
    ...policy.registered.filter(row => row !== registered)] };
  }
  // Profile scope is additional authority, not a replacement for the doorway's
  // registered reversibility. Ordinary UI calls keep their distinct call identity;
  // consequential effects retain the owner's stable never-twice identity.
  const verdict = decide(tool, input, current, now);
  // The full input, policy and decision accompany the already durable parent authority and bounds.
  // The checkpoint checks held secrets before this record can be written.
  return { ...verdict, localCause: JSON.stringify({ tool, input, configuration: current,
    connectorDigest: mcp?.digest ?? null, decision: verdict, accountActions: enabled }) };
}
