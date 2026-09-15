import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import * as conversation from '../../src/conversation/index.js';

it('P12-NF-29 P12-NF-34 P12-NF-35 round17 structural map requires the landed assessment and retains only exact holds', () => {
  const map = readFileSync('scripts/check-p12-contract-map.mjs', 'utf8');
  expect(map).not.toContain('slice-A2');
  expect(map).toContain("35: 'PARTIAL: the Telegram response uses the landed Part Nine public assessment");
  expect(map).toContain('real settlement remains non-executable-until-seam-response-effects-followup.md');
  expect(map).not.toContain('NON-EXECUTABLE-UNTIL-row-99-ten-conditional-append');
  expect(map).toContain('competing-process one-mode admission through Part Ten appendIfSubjectFrontier');

  expect(Object.keys(conversation).filter(name => /status|assess/i.test(name))).toEqual([
    'assessTelegramReplyResponse', 'renderTelegramDeliveryStatus',
  ]);
  const telegram = readFileSync('src/conversation/telegram.ts', 'utf8');
  expect(telegram).toContain('export function assessTelegramReplyResponse');
  expect(telegram).toContain('export function renderTelegramDeliveryStatus');
  expect(telegram).toContain("input.claim === 'provider-accepted'");
  expect(telegram).toContain("view.finalCharge === null && view.delayedExecutionExcluded === false");
});
