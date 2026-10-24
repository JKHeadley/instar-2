// Rules 44/100/116: reuse the 1.x Playwright default, runtime validator and custody.
import { mkdirSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { jwtExpiry } from '../tests/preview/secret-custody.js';
import { readRootMcp } from '../tests/preview/tool-turn.mjs';
import { setupMcp } from '../tests/preview/trust-setup.mjs';
import { durablePreviewWrite } from '../tests/preview/durable-write.js';
import { readSetupRecord } from './onboarding-state.mjs';
import { assertAgentPaths } from './agent-paths.mjs';

export const DEFAULT_MCP = { mcpServers: { playwright: { command: 'npx', args: ['-y', '@playwright/mcp@latest'] } },
  reads: ['mcp__playwright__browser_snapshot'] };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** Installer-only. A per-root lock prevents concurrent merges losing operator entries.
 * A crash leaves a visible lock; the installer must establish writer death before removing it.
 * Existing default names win; explicitly adding a conflicting account refuses. */
export function installMcp(root, config = DEFAULT_MCP, secretEnv = {}, custody) {
  assertAgentPaths({ root });
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const lock = join(root, '.mcp-setup-lock'); mkdirSync(lock, { mode: 0o700 });
  try {
    const path = join(root, 'mcp.json'), old = readSetupRecord(path);
    readRootMcp(root);
    setupMcp(config);
    const next = structuredClone(config);
    if (!secretEnv || typeof secretEnv !== 'object' || Array.isArray(secretEnv)) throw Error('MCP secret env must be an object');
    const pending = [];
    for (const [name, values] of Object.entries(secretEnv)) {
      if (!Object.hasOwn(next.mcpServers, name) || !values || typeof values !== 'object' || Array.isArray(values) || !custody)
        throw Error('MCP secrets need a configured server and custody');
      for (const [key, value] of Object.entries(values)) {
        if (typeof value !== 'string' || !value || !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(key)) throw Error('MCP secret env malformed');
        next.mcpServers[name].env = { ...next.mcpServers[name].env, [key]: { secretRef: 'pending' } }; pending.push({ name, key, value });
      }
    }
    if (!Object.keys(next.mcpServers ?? {}).length && (next.reads ?? []).length) throw Error('MCP reads need servers');
    readRootMcp(root, () => JSON.stringify(next));
    for (const { name, key, value } of pending) {
      const prior = old?.mcpServers?.[name]?.env?.[key]?.secretRef;
      const kept = prior && custody.resolve({ type: 'SecretRef', schemaVersion: 1, vault: 'preview', name: prior }) === value;
      next.mcpServers[name].env[key] = { secretRef: kept ? prior : custody.store({ value, kind: jwtExpiry(value) === null ? 'mcp' : 'jwt', source: 'MCP installer' }).name };
    }
    const servers = Object.assign(Object.create(null), old?.mcpServers), reads = [...old?.reads ?? []];
    for (const [name, server] of Object.entries(next.mcpServers)) {
      if (Object.hasOwn(servers, name)) {
        if (config !== DEFAULT_MCP && !same(servers[name], server)) throw Error('MCP server already has different operator choices');
        continue;
      }
      servers[name] = server;
      for (const tool of next.reads ?? []) if (tool.startsWith(`mcp__${name}__`) && !reads.includes(tool)) reads.push(tool);
    }
    const merged = { ...old, mcpServers: servers, reads };
    readRootMcp(root, () => JSON.stringify(merged));
    if (same(old, merged)) return false;
    durablePreviewWrite(path, merged);
    return true;
  } finally { rmdirSync(lock); }
}
