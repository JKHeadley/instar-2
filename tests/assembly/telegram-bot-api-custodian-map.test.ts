import { describe, expect, test } from 'vitest';
import { telegramBotApiCustodianContractMap } from '../../src/assembly/index.js';
import {
  checkTelegramCustodianMap,
  telegramCustodianExecutableArms,
  telegramCustodianHeldArms,
// @ts-expect-error The owner checker is intentionally a directly executable plain-ESM script.
} from '../../scripts/check-assembly-contracts.mjs';

describe('Part Ten Telegram custodian checker wiring', () => {
  test('accepts the concrete executable and individually named held rosters', () => {
    expect(checkTelegramCustodianMap(telegramBotApiCustodianContractMap)).toBe(true);
  });

  test.each([
    ['executable', telegramCustodianExecutableArms],
    ['held', telegramCustodianHeldArms],
  ] as const)('refuses every omitted %s arm', (roster, required) => {
    for (const omitted of required) {
      const changed = {
        executable: [...telegramBotApiCustodianContractMap.executable],
        held: [...telegramBotApiCustodianContractMap.held],
        [roster]: telegramBotApiCustodianContractMap[roster].filter(arm => arm !== omitted),
      };
      expect(() => checkTelegramCustodianMap(changed), omitted).toThrow(/contract roster differs/);
    }
  });
});
