import { it, expect } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { intakeFixture, route, message, stop, value } from '../intake/fixtures.js';
import { privateKey } from '../facts/fixtures.js';

it('P4-NF-01 P4-NF-03 P4-NF-04 P4-NF-11 P4-NF-14 public boot survives process death at each durable intake boundary', () => {
  const f = intakeFixture(); f.bind();
  const base = { frames: f.frames, context: f.context, observer: f.deps.author.principal, privateKey,
    registerContext: f.r.context, registerInput: f.registerInput,
    evidence: value(f.deps.adapter.authenticate(message(), route, f.f.now)), route, at: 100 };
  for (const cut of ['capture', 'intake-receipt', 'intake-resolved', 'intake-admitted', 'intake-stop']) {
    const directory = mkdtempSync(join(tmpdir(), 'instar-intake-'));
    const raw = cut === 'intake-stop' ? stop : message();
    try {
      const killed = spawnSync(process.execPath, ['scripts/test-intake-restart.mjs'], {
        input: JSON.stringify({ ...base, directory, raw, cut }), encoding: 'utf8' });
      expect(killed.status, killed.stderr).toBe(86);
      const run = (raw: string, eventId = route.eventId) => JSON.parse(execFileSync(process.execPath, ['scripts/test-intake-restart.mjs'], {
        input: JSON.stringify({ ...base, directory, raw, route: { ...route, eventId } }), encoding: 'utf8' }));
      const resumed = run(raw);
      expect(resumed.rebuilt).toBe(true); expect(resumed.taint).toEqual([]);
      expect(resumed.contextLivePrincipals).toEqual(['intake-observer']);
      if (cut === 'intake-stop') {
        expect(resumed.outcome).toBe('stopped'); expect(resumed.stops).toHaveLength(1);
        const after = run(message('after stop'), 'next');
        expect(after.outcome).toMatch(/^Refused:.*stopped/); expect(after.admitted).toHaveLength(0);
      } else {
        expect(resumed.outcome).toBe(cut === 'intake-admitted' ? 'duplicate' : 'admitted');
        expect(resumed.admitted).toHaveLength(1);
        expect(run(raw).admitted).toEqual(resumed.admitted);
      }
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }
}, 30000);
