import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import * as conversation from '../../src/conversation/index.js';

it('round12 structural re-slice names every moved map row and exports no A2 assessment surface', () => {
  const map = readFileSync('scripts/check-p12-contract-map.mjs', 'utf8');
  const moved = map.match(/const sliceA2Rows = new Set\(\[([^\]]+)\]\);/);
  expect(moved?.[1]?.split(',').map(value => Number(value.trim()))).toEqual([29, 34, 35]);
  for (const row of [29, 34, 35]) {
    expect(map).toMatch(new RegExp(`\\n\\s*${row}: [^\\n]+NON-EXECUTABLE-UNTIL-slice-A2`));
  }
  expect(map).toContain("'EXECUTABLE ARM + NON-EXECUTABLE-UNTIL-slice-A2'");
  expect(map).toContain("'NON-EXECUTABLE-UNTIL-slice-A2'");

  expect(Object.keys(conversation).filter(name => /status|assessment/i.test(name))).toEqual([]);
  const telegram = readFileSync('src/conversation/telegram.ts', 'utf8');
  expect(telegram).not.toContain('renderTelegramDeliveryStatus');
  expect(telegram).not.toContain('deliveryStatusHistories');
  expect(telegram).not.toContain('replyProviderResponses');
  expect(telegram).not.toContain('readEvidence');
});
