#!/usr/bin/env node
// Run under the operator/installer identity, never as a grant invented by the agent.
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
register('./slice-ts-loader.mjs', import.meta.url);
const { configureTrust } = await import('../tests/preview/trust-setup.mjs');
const [action, root, requestPath] = process.argv.slice(2);
if (!root || (action !== 'revoke' && !requestPath)) {
  process.stderr.write('Usage: node scripts/setup-standing-trust.mjs setup|tighten ROOT OPERATOR-REQUEST.json\n       node scripts/setup-standing-trust.mjs revoke ROOT\n');
  process.exitCode = 1;
} else {
  const result = configureTrust(root, action, requestPath ? JSON.parse(readFileSync(requestPath, 'utf8')) : undefined);
  process.stdout.write(`${JSON.stringify(result)}\nUse --effect-policy ${result.policyPath} when launching the runner; restart after MCP changes.\n`);
}
