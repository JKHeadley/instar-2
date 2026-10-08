import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { SUBSCRIPTION_PREVIEW_EXPIRY } from '../../src/assembly/subscription-window.js';
import { parseExplicitYesInstallation } from './explicit-yes-installation.js';
import { explicitYesStatus, operatorActionSurface } from './operator-yes.js';
import { phoneRouteProof as prove } from '../../scripts/phone-route-proof.mjs';
const phoneRouteProof = (status: unknown) => prove(status, SUBSCRIPTION_PREVIEW_EXPIRY);

const fixture = JSON.parse(readFileSync(new URL('./fixtures/phone-route-2026-10-08.json', import.meta.url), 'utf8'));
const installation = parseExplicitYesInstallation(JSON.stringify(fixture.installation));
const bound = { chat: installation.chat.boundChatId, operator: installation.chat.operatorAccountId, trial: installation.installation! };
const configured = (renewalInstalled = false) => {
  const explicitYes = explicitYesStatus(installation, bound, { connected: true });
  return { explicitYes, expires: SUBSCRIPTION_PREVIEW_EXPIRY,
    operatorActionSurface: operatorActionSurface(explicitYes, renewalInstalled) };
};

it('replays both real failed room statuses, then connects the existing accepted source without claiming a renewal proof', () => {
  expect(fixture.records.map((row: { update: number }) => row.update)).toEqual([715674868, 6232820]);
  for (const row of fixture.records) {
    expect(phoneRouteProof(row.status)).toMatchObject({ source: false, actions: false });
    const connected = { ...row.status, ...configured() };
    expect(connected.explicitYes.chat.admissible).toBe(false); // P-05 remains enforced.
    expect(connected.explicitYes.review.acceptance).toMatchObject({ current: true, account: 'JKHeadley', disclosure: expect.any(String) });
    expect(phoneRouteProof(connected)).toMatchObject({ source: true, actions: null });
  }
});

it('requires the installed renewal route below the ceiling, and never turns the ceiling into PASS', () => {
  expect(phoneRouteProof({ ...configured(true), expires: SUBSCRIPTION_PREVIEW_EXPIRY - 1 }).actions).toBe(true);
  expect(phoneRouteProof({ ...configured(false), expires: SUBSCRIPTION_PREVIEW_EXPIRY - 1 }).actions).toBe(false);
  for (const installed of [false, true]) expect(phoneRouteProof(configured(installed)).actions).toBeNull();
  for (const expires of [undefined, null, 0, -1, '1791837600000', SUBSCRIPTION_PREVIEW_EXPIRY + 1])
    expect(phoneRouteProof({ ...configured(true), expires }).actions).toBe(false);
  for (const ceiling of [0, -1, Number.NaN]) expect(prove(configured(true), ceiling).actions).toBe(false);
});

it('refuses disconnected, withdrawn, wrong-installation and incomplete disclosure evidence on either side of the ceiling', () => {
  const valid = configured(true);
  const acceptance = valid.explicitYes.review.acceptance!;
  for (const expires of [SUBSCRIPTION_PREVIEW_EXPIRY - 1, SUBSCRIPTION_PREVIEW_EXPIRY]) {
    const variants = [
      undefined,
      { ...valid.explicitYes, connected: false },
      explicitYesStatus(installation, bound, { connected: false }),
      explicitYesStatus(installation, { ...bound, trial: 'another-installation' }, { connected: true }),
      ...[{ ...acceptance, current: false }, { ...acceptance, account: '' }, { ...acceptance, disclosure: '' }]
        .map(value => ({ ...valid.explicitYes, review: { ...valid.explicitYes.review, acceptance: value } })),
    ];
    for (const explicitYes of variants)
      expect(phoneRouteProof({ ...valid, expires, explicitYes })).toMatchObject({ source: false, actions: false });
  }
});

it('accepts admissible chat and no-access review routes, but refuses missing and extra host-only actions', () => {
  const valid = configured(true);
  for (const explicitYes of [
    { connected: true, chat: { admissible: true }, review: { admissible: false } },
    { connected: true, chat: { admissible: false }, review: { admissible: true } },
  ]) expect(phoneRouteProof({ ...valid, expires: SUBSCRIPTION_PREVIEW_EXPIRY - 1, explicitYes }).actions).toBe(true);
  for (const operatorActionSurface of [undefined, {}, { raiseCaps: valid.operatorActionSurface.raiseCaps },
    { ...valid.operatorActionSurface, raiseCaps: 'host command line' },
    { ...valid.operatorActionSurface, another: 'host command line' }])
    expect(phoneRouteProof({ ...valid, operatorActionSurface }).actions).toBe(false);
  expect(phoneRouteProof(null)).toMatchObject({ source: false, actions: false });
});
