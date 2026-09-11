// @ts-nocheck -- the production slice is an executable JavaScript boundary.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { value } from '../fixtures.js';
import { bootProductionSliceAssembly, sliceConfig } from '../../scripts/slice-assembly.mjs';

const outcome = result => consumeResult(result, { Success: resolved => ({ accepted: true, value: resolved }),
  Refused: refusal => ({ accepted: false, detail: refusal.detail }) });

it('V58 P11-NF-05 P11-NF-22 P11-NF-34 P11-NF-39 a fresh verified restart-surface stop is durable and inhibits later work', () => {
  const config = sliceConfig({ profile: 'reply' });
  const boot = bootProductionSliceAssembly({ home: mkdtempSync(join(tmpdir(), 'p11-round12-stop-')),
    config, restartRecovery: true });
  const surface = boot.coordinator.handles.surface;
  const challenge = value(surface.stopChallenge({ operator: boot.alice.id, scope: boot.scope }));
  const stopped = value(surface.stop({ challenge, proof: 'verified-restart-operator-proof', scope: boot.scope }));
  expect(boot.facts().find(fact => fact.id === stopped.id)?.kind).toBe('intake-stop');

  const later = outcome(boot.intake.receive(JSON.stringify({ schemaVersion: 1, kind: 'message', text: 'later work' }), {
    channel: config.channel, sender: config.sender, identityEpoch: config.identityEpoch, eventId: 'round12-after-stop',
  }));
  expect(later).toMatchObject({ accepted: false });
  if (!later.accepted) expect(later.detail).toContain('stopped');
}, 300_000);
