// @ts-nocheck -- the registered doorway's physical IO is its captured-frame conformance fixture; every other step is the shipped CLI path.
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
// Two branches found this defect independently (sb-w4-updaterecord and sb-w4-t2boundary) and each wrote this file;
// the merge keeps both sides' coverage. The first three cases are the updaterecord side, driving the loading point
// with a minimal recorded plan; the fourth is the t2boundary side, driving the CLI's own whole dispatch composition
// (its real question and prompt) and asserting both neighbours inside one case.
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SELF_HOST_QUESTION, doorwayProvider, loadLoginProfile, selfHostPrompt } from './self-host.mjs';
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

const CLI_ANSWER = JSON.stringify({ files: [{ path: 'word-count.mjs', content: 'export const wordCount = () => 0;\n' }],
  tools: [{ operation: 'package-test', params: ['word-count.test.mjs'] }],
  package: { namespace: 'agent.word-count', version: '1.0.0', entrypoints: [{ id: 'word-count', path: 'word-count.mjs' }],
    probe: { entrypoint: 'word-count', export: 'wordCount', input: 'x', expect: 0 } } });

/**
 * The CLI's own dispatch composition: the profile it loaded from its `--login-profile` file, through
 * the registered doorway's captured-frame fixture, into the shipped provider attempt the run makes.
 */
const dispatchCliTurn = async (root, profile) => {
  const state = { outcome: 'complete', calls: 0, stdin: [], answer: () => CLI_ANSWER };
  const provider = await doorwayProvider({ doorwayId: DOORWAY, io: DOORWAY_CONFORMANCE[DOORWAY].io(state), profile,
    activation: world.activation(), model: world.model, stopped: stoppedAt(root), now: () => NOW });
  const call = await dispatchOwnedProvider({ root, task: 'cli-profile', question: SELF_HOST_QUESTION,
    conversation: [{ request: JSON.parse(selfHostPrompt('Build a word-count capability.', null)) }],
    allowance: 3, provider, stopped: stoppedAt(root), now: () => NOW })
    .then(result => ({ answer: result.answer })).catch(error => ({ refused: String(error?.message ?? error) }));
  return { state, call };
};

it('the CLI login-profile loading point yields the frozen descriptor the credential custodian requires (Rules 2, 115, 116)', async () => {
  const directory = temp();
  try {
    const file = join(directory, 'profile.json');
    writeFileSync(file, JSON.stringify(DOORWAY_CONFORMANCE[DOORWAY].profile), { mode: 0o600 });
    const loaded = loadLoginProfile(file);
    expect(Object.isFrozen(loaded)).toBe(true);
    expect({ ...loaded }).toEqual({ ...DOORWAY_CONFORMANCE[DOORWAY].profile });

    // The positive neighbor: the loaded profile reaches the doorway, which is dispatched once and read.
    const good = temp();
    try {
      const { state, call } = await dispatchCliTurn(good, loaded);
      expect(call.refused).toBe(undefined);
      expect(JSON.parse(call.answer.trim()).package.namespace).toBe('agent.word-count');
      expect(state.calls).toBe(1);
    } finally { rmSync(good, { recursive: true, force: true }); }

    // The negative neighbor: the same bytes parsed without the loading point's freeze are refused by
    // the credential custodian before any provider call.
    const mutable = temp();
    try {
      const { state, call } = await dispatchCliTurn(mutable, JSON.parse(JSON.stringify(DOORWAY_CONFORMANCE[DOORWAY].profile)));
      expect(call.refused).toMatch(/subscription route refused/u);
      expect(state.calls).toBe(0);
    } finally { rmSync(mutable, { recursive: true, force: true }); }
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 120_000);
