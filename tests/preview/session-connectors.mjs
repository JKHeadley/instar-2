// Continuing sessions reuse the per-call connector custody and launch preparation.
// Machine-local, bounded by the session lifetime; root configuration is the recorded account scope.
import { mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareMcpLaunch, serveTurnSocket } from './tool-turn.mjs';
import { grantAcl, harnessAcl, harnessSocketDirectory, harnessHookPath } from './harness-user.mjs';

export async function prepareSessionConnectors({ mcp, privateDirectory, identity, workspace, resolveSecret,
  check, ownerRead = null, socketDirectory = () => identity ? harnessSocketDirectory(identity.user) : realpathSync(mkdtempSync(join(tmpdir(), 'ism-'))) }) {
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
  const socket = join(socketDirectory(), 's');
  const close = await serveTurnSocket(socket, { shared: Boolean(identity), check, ownerRead });
  return { close, launch() {
    const client = identity ? join(dirname(harnessHookPath()), 'owner-browser-client.mjs')
      : fileURLToPath(new URL('./owner-browser-client.mjs', import.meta.url));
    const configured = ownerRead ? { ...mcp, secrets: { ...mcp?.secrets, owner_github: {} }, servers: { ...mcp?.servers,
      owner_github: { command: process.execPath, args: [client, socket] } } } : mcp;
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
  const current = { ...config, ...(enabled || config.rolePolicy === undefined ? {} : { rolePolicy: undefined }), mcpReads: mcp?.reads ?? [], operations: enabled ? [...config.operations, 'tool:mcp'] : config.operations.filter(operation => operation !== 'tool:mcp') };
  const verdict = decide(tool, input, current, now);
  // The full input, policy and decision accompany the already durable parent authority and bounds.
  // The checkpoint checks held secrets before this record can be written.
  return { ...verdict, localCause: JSON.stringify({ tool, input, configuration: current,
    connectorDigest: mcp?.digest ?? null, decision: verdict, accountActions: enabled }) };
}
