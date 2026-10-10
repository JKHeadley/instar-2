// Operator setup for the existing effect doorway. This records authority; it never infers it.
import { readFileSync, writeFileSync, renameSync, mkdirSync, openSync, closeSync, fsyncSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { decodeEffectPolicy, DEFAULT_EFFECT_POLICY } from './effect-doorway.mjs';
import { readRootMcp } from './tool-turn.mjs';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const text = value => typeof value === 'string' && value.trim().length > 0;
export function setupTrustPolicy(request) {
  if (!request || !text(request.source) || !text(request.custodian) || !text(request.recovery)
    || !Number.isFinite(request.resourceLevelUsd) || request.resourceLevelUsd < 0
    || !Array.isArray(request.effects)) throw Error('trust setup needs the operator source, custodian, recovery, dollar level and scoped effects');
  const registered = [], grants = [];
  for (const effect of request.effects) {
    if (!text(effect.target) || !text(effect.recovery)) throw Error('each effect needs an exact target and recovery obligation');
    if (!['tool:network', 'tool:network-write', 'tool:mcp'].includes(effect.effect)) throw Error('unsupported setup effect');
    if (effect.effect === 'tool:network-write' && !effect.request)
      throw Error('network writes need an exact request method and path, not a whole host');
    const scoped = effect.request ? { request: effect.request } : {};
    if (effect.registration) {
      const r = effect.registration;
      if (!['reversible', 'irreversible'].includes(r.reversibility)) throw Error('declare whether the agent alone can undo this effect');
      // Unknown cost stays unknown; a standing resource grant never removes a spend ceiling.
      registered.push({ ...r, ...scoped, effect: effect.effect, target: effect.target, source: request.source, recovery: effect.recovery, reach: 'world' });
    }
    const id = `operator-trust:${createHash('sha256').update(JSON.stringify([request.source, effect.effect, effect.target, scoped])).digest('hex')}`;
    if (grants.some(grant => grant.id === id)) throw Error('duplicate effect scope');
    grants.push({ ...scoped, id, effect: effect.effect, target: effect.target,
      approves: ['scope', 'resources', 'policySensitive'], resourceLevelUsd: request.resourceLevelUsd,
      source: request.source, custodian: request.custodian, recovery: effect.recovery });
  }
  return decodeEffectPolicy({ ...DEFAULT_EFFECT_POLICY, registered, grants });
}

/** Credentials enter through the vault, never through setup input. Environment values are references only. */
export function setupMcp(config = { mcpServers: {}, reads: [] }) {
  if (!config || typeof config !== 'object' || !config.mcpServers || Array.isArray(config.mcpServers)) throw Error('MCP setup needs mcpServers');
  if (!Object.keys(config.mcpServers).length && (config.reads ?? []).length) throw Error('MCP reads need configured servers');
  for (const server of Object.values(config.mcpServers)) {
    for (const value of Object.values(server.env ?? {})) {
      if (!value || typeof value !== 'object' || typeof value.secretRef !== 'string')
        throw Error('MCP setup env values must use secretRef into the runner vault');
    }
  }
  readRootMcp('', () => JSON.stringify(config));
  return config;
}

function read(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
function durableWrite(path, value) {
  const fd = openSync(path, 'wx', 0o600);
  try { writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`); fsyncSync(fd); } finally { closeSync(fd); }
}
function replace(path, value) {
  const temporary = `${path}.trust-next`;
  durableWrite(temporary, value);
  renameSync(temporary, path);
}
/** Installer/wizard entry point. Setup is idempotent, but never overwrites existing operator choices.
 * Tighten can only remove grants/servers/reads or lower grant dollar ceilings; revoke removes all trust.
 * Existing runners reload the policy at each turn; restart after changing MCP configuration. */
export function configureTrust(root, action, request) {
  const policyPath = join(root, 'effect-policy.json'), mcpPath = join(root, 'mcp.json');
  if (!['setup', 'tighten', 'revoke'].includes(action)) throw Error('choose setup, tighten or revoke');
  const oldPolicy = read(policyPath), oldMcp = read(mcpPath);
  const policy = action === 'revoke' ? { ...DEFAULT_EFFECT_POLICY } : { ...setupTrustPolicy(request) };
  const mcp = action === 'revoke' ? { mcpServers: {}, reads: [] } : { ...setupMcp(request.mcp),
    operatorGrant: { source: request.source, custodian: request.custodian, recovery: request.recovery } };
  if (action === 'setup') {
    if ((oldPolicy && !same(oldPolicy, policy)) || (oldMcp && !same(oldMcp, mcp)))
      throw Error('setup already has different operator choices; use tighten or revoke');
  } else if (action === 'tighten') {
    if (!oldPolicy || !oldMcp) throw Error('tighten requires an existing setup');
    decodeEffectPolicy(oldPolicy);
    if (policy.registered.some(r => !oldPolicy.registered.some(old => same(old, r)))
      || policy.grants.some(g => !oldPolicy.grants.some(old => old.effect === g.effect && old.target === g.target
        && same(old.request, g.request) && old.source === g.source && old.custodian === g.custodian && old.recovery === g.recovery
        && old.expiresAt === undefined && g.resourceLevelUsd <= old.resourceLevelUsd
        && g.approves.every(test => old.approves.includes(test))))
      || Object.entries(mcp.mcpServers).some(([name, server]) => !same(server, oldMcp.mcpServers[name]))
      || (mcp.reads ?? []).some(name => !(oldMcp.reads ?? []).includes(name)))
      throw Error('tighten cannot widen standing trust');
    policy.registered = oldPolicy.registered;
  }
  mkdirSync(root, { recursive: true, mode: 0o700 });
  for (const [path, old, next] of [[policyPath, oldPolicy, policy], [mcpPath, oldMcp, mcp]]) {
    if (same(old, next)) continue;
    if (old === null) durableWrite(path, next);
    else replace(path, next);
  }
  const directory = openSync(root, 'r');
  try { fsyncSync(directory); } finally { closeSync(directory); }
  return { policyPath, mcpPath, action, restartMcp: !same(oldMcp, mcp) };
}
