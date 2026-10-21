// Rules 72/73: the build check's graduation-deadline lines name the feature, its deadline and the owner of the next step.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { deadlineLines } from '../../scripts/build-register.mjs';

const record = readFileSync('tests/preview/promotion-record.ts', 'utf8');
const input = { files: ['tests/preview/promotion-record.ts'], show: (path: string) => { expect(path).toBe('tests/preview/promotion-record.ts'); return record; } };
const row = (id: string, deadline: number, path = 'tests/preview/capabilities.declarations.json') => ({ id, deadline, status: 'dark', path });

describe('graduation deadline lines', () => {
  it('names the feature, the deadline and the latest recorded owner; nothing when nothing is due', async () => {
    expect(await deadlineLines({ dueSoon: [], overdue: [] }, input)).toEqual([]);
    const [warning, overdue] = await deadlineLines({ dueSoon: [row('preview.step-check', 1792800000000)], overdue: [row('preview.step-check', 1792800000000)] }, input);
    expect(warning).toMatch(/^REGISTER-DEADLINE WARNING: feature preview\.step-check graduation deadline 2026-10-24T00:00:00\.000Z is within 24 h;/u);
    expect(overdue).toMatch(/^REGISTER-DEADLINE OVERDUE: feature preview\.step-check graduation deadline 2026-10-24T00:00:00\.000Z passed; Rule 72 obligation open: it must stay dark/u);
    // The owner is the promotion record's latest new-deadline entry, not an earlier one.
    for (const line of [warning, overdue]) expect(line).toContain('owner: the desk with Justin: run tests/preview/jev-step-supervisor-live-test.md');
  });
  it('says so plainly when no promotion record sits beside the declaration', async () => {
    const [line] = await deadlineLines({ dueSoon: [row('rungraph-core', 1792886400000, 'src/rungraph/rungraph.ts')], overdue: [] }, { files: [], show: () => { throw new Error('not read'); } });
    expect(line).toContain('owner: no promotion record beside the declaration');
  });
});
