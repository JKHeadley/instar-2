import { expect, it } from 'vitest';
import { value } from '../intake/fixtures.js';
import { telegramUpdate, wireTelegram } from './round3-fixture.js';
import { captureReadOverlap } from './round15-fixture.js';

it('P12-NF-16 P12-NF-18 P12-NF-46 round15 fresh-capture-overlap-confirmation leaves only the winning public ingress operational', () => {
  for (const outerMode of ['long-poll', 'webhook'] as const) {
    const result = captureReadOverlap(outerMode);
    expect(result.admitted, outerMode).toBeDefined();
    const admitted = result.admitted!;
    const admittedApi = result.outer.kind === 'Success' ? result.api : result.fixture.api;
    const wired = wireTelegram({ ...result.fixture, admitted }, admittedApi);
    if (admitted.mode === 'long-poll') {
      result.fixture.queue(telegramUpdate(100));
      expect(value(wired.ingress.pollOnce()).captured).toHaveLength(1);
    } else {
      expect(value(wired.ingress.receiveWebhook(telegramUpdate(101))).captured.updateId).toBe(101);
    }
    const admissions = value(wired.facts.read()).filter(row => row.kind === 'intake-admitted');
    expect(admissions, outerMode).toHaveLength(1);
    expect(result.outer.kind === 'Success' || result.nested?.kind === 'Success', outerMode).toBe(true);
    expect(result.outer.kind === 'Success' && result.nested?.kind === 'Success', outerMode).toBe(false);
  }
}, 60_000);
