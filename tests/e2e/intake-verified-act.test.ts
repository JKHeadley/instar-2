import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { intakeFixture, refused, value } from '../intake/fixtures.js';

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

it('P4-VA-RESTART a durable admitted act survives a cut and replay remains refused after reconstruction', () => {
  const directory = mkdtempSync(join(tmpdir(), 'p4-verified-act-')); directories.push(directory);
  const first = intakeFixture({ directory }), verified = first.verifiedAct();
  expect(value(first.port().admitVerifiedAct(verified.input)).kind).toBe('approved');
  expect(readFileSync(join(directory, 'segment.jsonl'), 'utf8')).toContain('intake-verified-act');

  // A fresh owner/port/context reconstructs exclusively from the fsync-backed
  // segment and capture files. No in-memory snapshot crosses this cut.
  const restarted = intakeFixture({ directory });
  Object.assign(restarted.context, { schemas: [...restarted.context.schemas, restarted.rootSchema, restarted.requestSchema] });
  refused(restarted.port().admitVerifiedAct(verified.input), 'replayed');
  expect(restarted.facts().filter(row => row.kind === 'intake-verified-act')).toHaveLength(1);
});
