import { describe, expect, it } from 'vitest';
import { decodeExtract } from '../../src/register/index.js';
import { detail, setup, value } from './fixtures.js';

describe('round-four extract total decoding', () => {
  it('P3-NF-03 admits only the closed string status enum', () => {
    const s = setup();
    const base = { id: 'store', version: 'store:v1', status: 'live', since: 'machine-a:0:0', supersedes: [],
      approvedIn: { owner: 'part-two', name: 'FactEnvelope', id: 'approval:1' }, landedIn: 'merge:1',
      base: 'base:1', contentHash: `sha256:${'1'.repeat(64)}` };
    expect(value(decodeExtract({ ...s.extract, rows: [base] }, s.context)).rows[0]!.status).toBe('live');
    for (const status of [['live'], ['retired'], ['superseded']]) {
      expect(detail(decodeExtract({ ...s.extract, rows: [{ ...base, status }] }, s.context))).toContain('version status');
    }
  });
});
