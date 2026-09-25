#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { importLegacyScheduledJob } from '../dist/scheduled/index.js';
import { consumeResult } from '../dist/index.js';

const root = process.argv[2] ?? '.instar/jobs';
const context = { preserved: 'import:legacy-jobs:dry-run', site: 'types.decode',
  register: { generation: { owner: 'part-three', id: 'import-preview' },
    sites: { 'types.decode': 'closed' }, entries: [] } };
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : entry.isFile() && entry.name.endsWith('.json') ? [path] : [];
  });
}
let refused = 0;
for (const path of files(root).sort()) {
  const bytes = readFileSync(path, 'utf8');
  const row = consumeResult(importLegacyScheduledJob(bytes, context), {
    Success: plan => ({ path, slug: plan.slug, activation: plan.activation, residue: plan.residue }),
    Refused: failure => { refused += 1; return { path, activation: 'refused', residue: [failure.detail] }; },
  });
  process.stdout.write(`${JSON.stringify(row)}\n`);
}
if (refused) process.exitCode = 1;
