// @ts-nocheck -- the registered doorway's physical IO is its captured-frame conformance fixture; every other step is the shipped path.
// Rules 2, 70, 115, 116 (assembly §9): the shipped self-host CLI reads its login profile from the file named by
// --login-profile, and the provider credential custodian admits only the host's own frozen descriptor
// ("host-owned frozen subscription descriptor required", src/assembly/provider-credential-custodian.ts). The CLI
// parsed that file with a plain JSON.parse, so the object stayed mutable, the custodian refused it and the route
// was never constructed: every valid login profile was refused with "preview: subscription route refused" and no
// provider call was made. Recorded live:
// pipeline/live-proof/results/J-w4jselfhost-8dd8d479-selfhost/j5-cli.out (that run's meta.txt records j5-driver=desk,
// so it is the recorded CLI output, not an unattended shipped-path completion).
// These tests exercise the CLI's own loading function (`loadLoginProfile`, the shipped loading point) with the
// existing valid-profile fixture, and cover both sides of the custodian's decision: the loaded profile dispatches
// through the registered doorway, and the same file bytes left mutable — exactly what the CLI did before — still refuse.
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { doorwayProvider, loadLoginProfile } from './self-host.mjs';
import { dispatchOwnedProvider } from './self-host-owners.ts';
import { stoppedAt } from './self-host-harness.mjs';
import { DOORWAY_CONFORMANCE } from './doorway-conformance.js';
import { successiveWorld } from './successive-fixture.js';

const NOW = 1790000002000, DOORWAY = 'claude-code-subscription', world = successiveWorld();
const temp = () => realpathSync(mkdtempSync(join(tmpdir(), 'self-host-cli-profile-')));
/** The existing valid-profile fixture, written out exactly as the CLI's --login-profile file. */
const profileFile = root => {
  const path = join(root, 'login-profile.json');
  writeFileSync(path, `${JSON.stringify(DOORWAY_CONFORMANCE[DOORWAY].profile, null, 2)}\n`);
  return path;
};
const plan = { files: [{ path: 'a.mjs', content: 'export const a = 1;\n' }], tools: [],
  package: { namespace: 'agent.a', version: '1.0.0' } };
const recordedAnswer = JSON.stringify({ type: 'Decision', schemaVersion: 1, id: 'cli-profile',
  conclusion: { subject: 'preview-stage2-answer', value: JSON.stringify(plan) } });
/** One provider attempt through the shipped owner path with `profile` as the CLI loaded it. */
const dispatchWith = async (root, profile) => {
  const state = { outcome: 'complete', calls: 0, stdin: [], result: () => recordedAnswer };
  const attempt = (async () => {
    const provider = await doorwayProvider({ doorwayId: DOORWAY, profile, io: DOORWAY_CONFORMANCE[DOORWAY].io(state),
      activation: world.activation(), model: world.model, stopped: stoppedAt(root), now: () => NOW });
    return dispatchOwnedProvider({ root, task: 'cli-profile', question: 'q', conversation: [{ request: { plan: 'p' } }],
      allowance: 3, provider, stopped: stoppedAt(root), now: () => NOW });
  })();
  return attempt.then(call => ({ dispatched: true, calls: state.calls, answer: call.answer }),
    error => ({ dispatched: false, calls: state.calls, message: String(error?.message ?? error) }));
};

it("the CLI's login-profile loading point returns the custodian's host-owned frozen descriptor", () => {
  const root = temp();
  try {
    const profile = loadLoginProfile(profileFile(root));
    expect(Object.isFrozen(profile)).toBe(true);
    expect(profile).toEqual(DOORWAY_CONFORMANCE[DOORWAY].profile);
    // Frozen is the custody requirement, not an accident of the fixture: a write is refused, not applied.
    expect(() => { 'use strict'; profile.expectedAccount = 'other@example.invalid'; }).toThrow();
    expect(profile.expectedAccount).toBe(DOORWAY_CONFORMANCE[DOORWAY].profile.expectedAccount);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('a login profile loaded the way the CLI loads it dispatches through the registered doorway (Rules 2, 115)', async () => {
  const root = temp();
  try {
    const result = await dispatchWith(root, loadLoginProfile(profileFile(root)));
    expect(result).toMatchObject({ dispatched: true, calls: 1 });
    expect(JSON.parse(result.answer)).toEqual(plan);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60_000);

it('the same profile bytes left mutable — the plain parse the CLI used — are still refused before any provider call', async () => {
  const root = temp();
  try {
    const mutable = JSON.parse(readFileSync(profileFile(root), 'utf8'));
    expect(Object.isFrozen(mutable)).toBe(false);
    const result = await dispatchWith(root, mutable);
    expect(result).toMatchObject({ dispatched: false, calls: 0 });
    expect(result.message).toContain('preview: subscription route refused');
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60_000);
