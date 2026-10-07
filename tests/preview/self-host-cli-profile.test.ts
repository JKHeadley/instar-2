// @ts-nocheck -- the registered doorway's physical IO is its captured-frame conformance fixture; every other step is the shipped CLI path.
import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SELF_HOST_QUESTION, doorwayProvider, loadLoginProfile, selfHostPrompt } from './self-host.mjs';
import { dispatchOwnedProvider } from './self-host-owners.ts';
import { stoppedAt } from './self-host-harness.mjs';
import { DOORWAY_CONFORMANCE } from './doorway-conformance.js';
import { successiveWorld } from './successive-fixture.js';

const DOORWAY = 'claude-code-subscription', NOW = 1790000002000, world = successiveWorld();
const temp = () => realpathSync(mkdtempSync(join(tmpdir(), 'self-host-cli-profile-')));
const ANSWER = JSON.stringify({ files: [{ path: 'word-count.mjs', content: 'export const wordCount = () => 0;\n' }],
  tools: [{ operation: 'package-test', params: ['word-count.test.mjs'] }],
  package: { namespace: 'agent.word-count', version: '1.0.0', entrypoints: [{ id: 'word-count', path: 'word-count.mjs' }],
    probe: { entrypoint: 'word-count', export: 'wordCount', input: 'x', expect: 0 } } });

/**
 * The CLI's own dispatch composition: the profile it loaded from its `--login-profile` file, through
 * the registered doorway's captured-frame fixture, into the shipped provider attempt the run makes.
 */
const dispatchWith = async (root, profile) => {
  const state = { outcome: 'complete', calls: 0, stdin: [], answer: () => ANSWER };
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
      const { state, call } = await dispatchWith(good, loaded);
      expect(call.refused).toBe(undefined);
      expect(JSON.parse(call.answer.trim()).package.namespace).toBe('agent.word-count');
      expect(state.calls).toBe(1);
    } finally { rmSync(good, { recursive: true, force: true }); }

    // The negative neighbor: the same bytes parsed without the loading point's freeze are refused by
    // the credential custodian before any provider call.
    const mutable = temp();
    try {
      const { state, call } = await dispatchWith(mutable, JSON.parse(JSON.stringify(DOORWAY_CONFORMANCE[DOORWAY].profile)));
      expect(call.refused).toMatch(/subscription route refused/u);
      expect(state.calls).toBe(0);
    } finally { rmSync(mutable, { recursive: true, force: true }); }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
