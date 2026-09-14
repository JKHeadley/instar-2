import { writeFileSync } from 'node:fs';
import { m, F, got, event, plan, win, ok, no } from './helpers.js';

const rows: any[] = [];
for (const large of [false, true]) for (const reverse of [false, true]) {
  const f = F();
  const amount = large ? Number.MAX_SAFE_INTEGER : 101;
  const values = reverse ? [amount, amount - 1, amount] : [amount - 1, amount, amount];
  const observations = values.map((value, index) =>
    event(f, `median:${index}`, `median:${index}`, value, index * 200 + 50));
  observations.forEach(f.persistObservation);
  const plans = observations.map((observation, index) =>
    plan(f, `median:${index}`, index * 200, [observation], ['feature-a'], observation.amount));
  const raw = { ...f.burnPolicyInput, id: 'burn:median-check', entryExcess: 1,
    recoveryExcess: 0 };
  const context = f.withRegistered(raw, f.c);
  f.c = context;
  const policy = got(m.decodeBurnPolicy(raw, context));
  const history = f.snapshot();
  const windows = plans.map(planned => win(f, planned, history));
  const actual = m.evaluateCurrentBurn(policy, { state: 'closed', recoveryCount: 0,
    notified: false, investigation: null }, windows[2], [windows[0], windows[1]], context);
  rows.push({ name: `median:large-${large}:reverse-${reverse}`,
    pass: no(actual) || ok(actual) && !got(actual).notify,
    exactExpectedMedian: `${amount - 1}.5`, exactExpectedExcess: '0.5',
    entryExcess: 1, actual });
}

writeFileSync(process.argv[2]!, JSON.stringify(rows, null, 2));
console.log(JSON.stringify({ cases: rows.length, failed: rows.filter(row => !row.pass) }, null, 2));
