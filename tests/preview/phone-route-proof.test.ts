import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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
    expect(phoneRouteProof(connected)).toMatchObject({ source: true, actions: true, renewalActions: null });
  }
});

it('requires the installed renewal route below the ceiling, and never turns the ceiling into PASS', () => {
  expect(phoneRouteProof({ ...configured(true), expires: SUBSCRIPTION_PREVIEW_EXPIRY - 1 }).actions).toBe(true);
  expect(phoneRouteProof({ ...configured(false), expires: SUBSCRIPTION_PREVIEW_EXPIRY - 1 }).actions).toBe(false);
  for (const installed of [false, true]) expect(phoneRouteProof(configured(installed)).renewalActions).toBeNull();
  for (const expires of [undefined, null, 0, -1, String(SUBSCRIPTION_PREVIEW_EXPIRY), SUBSCRIPTION_PREVIEW_EXPIRY + 1])
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

it('preserves the October 9 missing-activation failure and separates October 18 coverage from renewal', () => {
  const { records } = JSON.parse(readFileSync(new URL('./fixtures/phone-route-2026-10-18.json', import.meta.url), 'utf8'));
  const [before, ceiling] = records;
  expect(before.update).toBe(715675120);
  expect(prove(before.status, before.reviewedExpiry)).toMatchObject({ source: true, actions: false, renewalActions: false });
  expect(ceiling.update).toBe(6234534);
  expect(prove(ceiling.status, ceiling.reviewedExpiry)).toMatchObject({ source: true, actions: true, renewalActions: null });
  for (const record of records) {
    const missing = { ...record.status, operatorActionSurface: { ...record.status.operatorActionSurface, raiseCaps: 'host command line' } };
    expect(prove(missing, record.reviewedExpiry).actions).toBe(false);
  }
});


it('replays the proposed M/Q check expressions against real delivery and negative controls', () => {
  const { records } = JSON.parse(readFileSync(new URL('./fixtures/phone-route-2026-10-18.json', import.meta.url), 'utf8'));
  const patch = readFileSync(new URL('../../reviews/rule79-q79a-1018-proof.patch', import.meta.url), 'utf8');
  const expressions = patch.split('\n').filter(line => /^\+ +".*json.loads/.test(line))
    .map(line => line.trim().slice(1).trim().slice(1, -1).replace('$PHASE', 'now'));
  expect(expressions).toHaveLength(4);
  const record = records[1];
  const route = prove(record.status, record.reviewedExpiry);
  const evaluate = (expr: string, reply: unknown, proof: unknown = route) => JSON.parse(execFileSync('python3', ['-c', `
import json,sys
x=json.load(sys.stdin)
def g(obj,path,default=None):
 for key in path.split('.'):
  if not isinstance(obj,dict) or key not in obj: return default
  obj=obj[key]
 return obj
def F(name): return json.dumps(x['proof'])
def I(label): return {'reply':x['reply']}
def U(label): return x['update']
print(json.dumps(eval(x['expr'])))
`], { input: JSON.stringify({ expr, reply, proof, update: record.update }), encoding: 'utf8' }));
  for (const index of [0, 2]) {
    expect(evaluate(expressions[index]!, record.reply)).toBe(true);
    for (const reply of [null, { ...record.reply, text: '' }, { ...record.reply, update: record.update - 1 },
      { ...record.reply, outcome: 'unknown' }, { ...record.reply, telegramMessageId: null }])
      expect(evaluate(expressions[index]!, reply)).toBe(false);
    expect(evaluate(expressions[index]!, record.reply, prove(records[0].status, records[0].reviewedExpiry))).toBe(false);
  }
  for (const index of [1, 3]) expect(evaluate(expressions[index]!, record.reply)).toBeNull();
});
