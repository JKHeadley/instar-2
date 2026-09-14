import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { intakeFixture, refused, value } from '../intake/fixtures.js';
import { round20RevocationAdmission, useDifferentLiveRegisterGeneration } from '../intake/round20-fixtures.js';

const directories: string[] = [];
const directory = (name: string) => { const path = mkdtempSync(join(tmpdir(), `p11-r20-${name}-`)); directories.push(path); return path; };
afterEach(() => { for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true }); });

it('round20 V16/V61/V62 lifecycle: live generation drift refuses without a durable disposition append', () => {
  const accepted = intakeFixture({ directory: directory('generation-accept') });
  Object.assign(accepted.context, { decode: { ...accepted.context.decode, register: { ...accepted.context.decode.register,
    generation: accepted.generation } } });
  expect(value(accepted.port().admitVerifiedAct(accepted.verifiedAct().input)).kind).toBe('approved');

  const rejectedDirectory = directory('generation-refuse'), rejected = intakeFixture({ directory: rejectedDirectory });
  Object.assign(rejected.context, { decode: { ...rejected.context.decode, register: { ...rejected.context.decode.register,
    generation: rejected.generation } } });
  const verified = rejected.verifiedAct(), port = rejected.port();
  useDifferentLiveRegisterGeneration(rejected);
  refused(port.admitVerifiedAct(verified.input), 'generations differ');
  expect(readFileSync(join(rejectedDirectory, 'segment.jsonl'), 'utf8')).not.toContain('intake-verified-act');
});

it('round20 V67/V68 lifecycle: fsync-backed history admits the exact revocation target and preserves other-target refusal', () => {
  const acceptedDirectory = directory('target-accept'), intended = round20RevocationAdmission('intended', acceptedDirectory);
  expect(value(intended.fixture.port().admitVerifiedAct(intended.input)).kind).toBe('approved');
  expect(readFileSync(join(acceptedDirectory, 'segment.jsonl'), 'utf8')).toContain('intake-verified-act');

  const refusedDirectory = directory('target-refuse'), other = round20RevocationAdmission('other', refusedDirectory);
  refused(other.fixture.port().admitVerifiedAct(other.input), 'exact target');
  expect(readFileSync(join(refusedDirectory, 'segment.jsonl'), 'utf8')).not.toContain('intake-verified-act');
});
