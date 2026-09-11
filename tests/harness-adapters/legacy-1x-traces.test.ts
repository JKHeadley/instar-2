import { describe, expect, it } from 'vitest';
import {
  legacyHasSession,
  legacyNewestRolloutRecovery,
  legacyPendingInjectList,
  legacyRefreshWorkGate,
} from './legacy-1x-traces.js';

describe('R4-F9 exact runnable legacy boundaries from design section 10', () => {
  it.each(['EACCES', 'EIO'])('P13-NF-46 legacy PendingInjectStore %s enumeration failure silently collapses to empty', code => {
    const result = legacyPendingInjectList(() => { throw Object.assign(new Error(code), { code }); });
    expect(result).toEqual({ records: [], warnings: [], losses: [] });
  });

  it('P13-NF-46 legacy newest-rollout oracle falsely credits unrelated worker B to stalled A', () => {
    expect(legacyNewestRolloutRecovery(100, { worker: 'worker:B', size: 200 })).toBe(true);
  });

  it('P13-NF-46 legacy synchronous has-session timeout reports dead while its conditional async neighbor is indeterminate', () => {
    const timeout = () => { throw Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' }); };
    expect(legacyHasSession(false, timeout)).toBe(false);
    expect(legacyHasSession(true, timeout)).toBe('indeterminate');
  });

  it.each(['absent', 'disabled', 'unreadable'] as const)('P13-NF-46 legacy %s work gate permits busy refresh', mode => {
    expect(legacyRefreshWorkGate(mode, true)).toEqual({ action: 'proceed', loggedWouldRefuse: false });
  });

  it('P13-NF-46 legacy dry-run work gate logs a would-refusal but still proceeds', () => {
    expect(legacyRefreshWorkGate('dry-run', true)).toEqual({ action: 'proceed', loggedWouldRefuse: true });
    expect(legacyRefreshWorkGate('enforcing', true)).toEqual({ action: 'refuse', loggedWouldRefuse: false });
  });
});
