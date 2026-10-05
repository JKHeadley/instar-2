import { it, expect } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { intakeFixture, route, message, stop, value, refused, json } from '../intake/fixtures.js';
import { canonical } from '../../src/index.js';
import { createFactStore } from '../../src/facts/index.js';
import type { InboundRoute } from '../../src/intake/index.js';
import { privateKey } from '../facts/fixtures.js';

// Every child below is one fresh-process boot of scripts/test-intake-restart.mjs, which returns
// in well under a second; its three fsyncSync calls — one of them on a directory — are the only
// unbounded waits in it, and on 2026-10-05 one such child sat at 0% CPU for 54 minutes and the
// whole suite waited on it, because no callsite here named a timeout. 20 s is tighter than each
// case's own 30 s budget, so a repeat raises the named explanation from
// tests/setup/bound-children.mjs rather than a bare case timeout.
const harnessBound = { timeout: 20_000, killSignal: 'SIGKILL' } as const;

it('P4-NF-01 P4-NF-03 P4-NF-04 P4-NF-06 P4-NF-11 P4-NF-14 public boot survives process death at each durable intake boundary', () => {
  const f = intakeFixture(); f.bind();
  const base = { frames: f.frames, context: f.context, observer: f.deps.author.principal, privateKey,
    registerContext: f.r.context, registerInput: f.registerInput,
    evidence: value(f.deps.adapter.authenticate(message(), route, f.f.now)), route, at: 100 };
  for (const cut of ['capture', 'intake-receipt', 'intake-resolved', 'intake-admitted', 'intake-stop']) {
    const directory = mkdtempSync(join(tmpdir(), 'instar-intake-'));
    const raw = cut === 'intake-stop' ? stop : message();
    try {
      const killed = spawnSync(process.execPath, ['scripts/test-intake-restart.mjs'], {
        input: JSON.stringify({ ...base, directory, raw, cut }), encoding: 'utf8', ...harnessBound });
      expect(killed.status, killed.stderr).toBe(86);
      const run = (raw: string, eventId = route.eventId) => JSON.parse(execFileSync(process.execPath, ['scripts/test-intake-restart.mjs'], {
        input: JSON.stringify({ ...base, directory, raw, route: { ...route, eventId } }), encoding: 'utf8', ...harnessBound }));
      const resumed = cut === 'intake-receipt' ? JSON.parse(execFileSync(process.execPath, ['scripts/test-intake-restart.mjs'], {
        input: JSON.stringify({ ...base, directory, route: undefined, raw: undefined, recover: true, at: 500 }), encoding: 'utf8', ...harnessBound })) : run(raw);
      expect(resumed.rebuilt).toBe(true); expect(resumed.taint).toEqual([]);
      expect(resumed.registerChecks).toEqual(['extract', 'force', 'current']);
      expect(resumed.contextLivePrincipals).toEqual(['intake-observer']);
      if (cut === 'intake-stop') {
        expect(resumed.outcome).toBe('stopped'); expect(resumed.stops).toHaveLength(1);
        const after = run(message('after stop'), 'next');
        expect(after.outcome).toMatch(/^Refused:.*stopped/); expect(after.admitted).toHaveLength(0);
      } else {
        expect(resumed.outcome).toBe(cut === 'intake-admitted' ? 'duplicate' : 'admitted');
        expect(resumed.admitted).toHaveLength(1);
        expect(resumed.arrivals).toEqual([{ at: 100, channel: route.channel, sender: route.sender, eventId: route.eventId }]);
        expect(run(raw).admitted).toEqual(resumed.admitted);
      }
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }
}, 30000);

it('P4-NF-02 P4-NF-03 P4-NF-10 P4-NF-14 public fresh-process boot keeps requester service and bound stop reachable through hostile receipt history', () => {
  const f=intakeFixture(); f.bind();
  refused(f.port().receive(message('malformed route'),{} as InboundRoute));
  const capture=value(f.deps.capture.preserve(message('foreign preemption'),f.f.now));
  const wire=f.f.wire({ kind: 'intake-receipt',machine: 'machine-b',principal: f.f.bob,provenance: f.f.bob.provenance,
    segment: { machine: 'machine-b',epoch: 0,position: 0 },predecessors: { inSegment: null,frontier: {},required: [] },
    body: { adapter: 'host',capture: json(capture),rawHash: capture.hash,ingress: value(canonical(route)).bytes } });
  value(createFactStore(f.context,f.storage).append(wire,{ peer: 'machine-b' }));
  Object.assign(f.context,{ folded: { 'machine-b': { epoch: 0,position: 0 } } });
  const directory=mkdtempSync(join(tmpdir(),'instar-intake-hostile-'));
  const base={ frames: f.frames,context: f.context,observer: f.deps.author.principal,privateKey,directory,
    registerContext: f.r.context,registerInput: f.registerInput,
    evidence: value(f.deps.adapter.authenticate(message(),route,f.f.now)),at: 100 };
  const run=(raw: string,eventId=route.eventId) => JSON.parse(execFileSync(process.execPath,['scripts/test-intake-restart.mjs'],{
    input: JSON.stringify({ ...base,raw,route: { ...route,eventId } }),encoding: 'utf8', ...harnessBound }));
  try {
    const admitted=run(message('Alice genuine event'));
    expect(admitted.outcome).toBe('admitted'); expect(admitted.taint).toEqual([]);
    expect(admitted.rebuilt).toBe(true); expect(admitted.contextLivePrincipals).toEqual(['intake-observer']);
    expect(run(message('Alice genuine event')).outcome).toBe('duplicate');
    const brake=run(stop,'brake');
    expect(brake.outcome).toBe('stopped'); expect(brake.stops).toHaveLength(1);
    expect(brake.kinds.filter((k: string) => k==='intake-receipt')).toHaveLength(5);
  } finally { rmSync(directory,{ recursive: true,force: true }); }
},30000);

it('P4-NF-06 P4-NF-01 R7 fresh-process pending policy preserves input and drains only through approved runtime governance', () => {
  const f = intakeFixture(); f.bind();
  const directory = mkdtempSync(join(tmpdir(), 'instar-intake-policy-'));
  const base = { frames: f.frames, context: f.context, observer: f.deps.author.principal, privateKey, directory,
    registerContext: f.r.context, registerInput: f.registerInput,
    evidence: value(f.deps.adapter.authenticate(message(), route, f.f.now)), route, raw: message(), at: 100 };
  const run = (seed: object) => JSON.parse(execFileSync(process.execPath, ['scripts/test-intake-restart.mjs'], { input: JSON.stringify(seed), encoding: 'utf8', ...harnessBound }));
  try {
    const pending = run({ ...base, registerInput: { ...base.registerInput, extract: { ...f.r.extract, rows: [] } } });
    expect(pending.registerChecks).toEqual(['extract', 'force', 'current']);
    expect(pending.outcome).toMatch(/^Refused:.*preserved hold/);
    expect(pending.kinds).toEqual(expect.arrayContaining(['intake-receipt', 'intake-held']));
    expect(pending.admitted).toHaveLength(0);
    const drained = run({ ...base, recover: true, raw: undefined, route: undefined, at: 500 });
    expect(drained.registerChecks).toEqual(['extract', 'force', 'current']);
    expect(drained.outcome).toBe('admitted'); expect(drained.admitted).toHaveLength(1);
    expect(drained.arrivals).toEqual([{ at: 100, channel: route.channel, sender: route.sender, eventId: route.eventId }]);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 30000);
