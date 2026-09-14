import { writeFileSync } from 'node:fs';
import { m, F, got, event, plan, win, request, open, ok, no } from './helpers.js';

const rows: any[] = [];
function check(name: string, run: () => any, predicate: (result: any) => boolean) {
  try { const actual = run(); rows.push({ name, pass: predicate(actual), actual }); }
  catch (error) { rows.push({ name, pass: false, exception: String(error) }); }
}

for (const expireFirst of [false, true]) {
  const f = F();
  const inputs = [0, 1, 2, 3].map(index => [
    event(f, `three:${index}:t`, `three:${index}:t`, index === 0 ? 10 : 0,
      index * 200 + 50, index === 1 && expireFirst ? 400 : 10_000),
    event(f, `three:${index}:o`, `three:${index}:o`, index === 0 ? 90 : 20,
      index * 200 + 50),
  ]);
  inputs.flat().forEach(f.persistObservation);
  const plans = inputs.map((observations, index) => plan(f, `three:${index}`, index * 200,
    observations, ['feature-a', 'comparison'], index === 0 ? 100 : 20));
  const raw = { ...f.burnPolicyInput, id: 'burn:three-votes', recoveryWindows: 3 };
  f.c = f.withRegistered(raw, f.c);
  const policy = got(m.decodeBurnPolicy(raw, f.c));
  const history = f.snapshot();
  const windows = plans.map(planned => win(f, planned, history));
  let state: any = open;
  for (let index = 1; index <= 3; index++) {
    const result = m.evaluateCurrentBurn(policy, state, windows[index], [windows[0]], f.c);
    check(`recovery-three:${expireFirst}:vote-${index}`, () => result, candidate =>
      ok(candidate) && (index < 3 ? got(candidate).episode.recoveryCount === index
        : expireFirst ? got(candidate).episode.state === 'open'
          : got(candidate).episode.state === 'closed'));
    if (ok(result)) state = got(result).episode;
  }
}

{
  const f = F();
  const observations = [event(f, 'replay:base', 'replay:base', 10, 50),
    event(f, 'replay:high', 'replay:high', 100, 250)];
  observations.forEach(f.persistObservation);
  const plans = [plan(f, 'replay:base', 0, [observations[0]], ['feature-a'], 10),
    plan(f, 'replay:high', 200, [observations[1]], ['feature-a'], 100)];
  const history = f.snapshot();
  const [base, high] = plans.map(planned => win(f, planned, history));
  const first = got(m.evaluateCurrentBurn(f.burnPolicy(), { state: 'closed', recoveryCount: 0,
    notified: false, investigation: null }, high, [base], f.c));
  check('burn:same-input-notification-idempotent', () =>
    m.evaluateCurrentBurn(f.burnPolicy(), first.episode, high, [base], f.c), result =>
    ok(result) && !got(result).notify && !got(result).openInvestigation);
}

for (const expired of [false, true]) {
  const f = F();
  const first = event(f, 'aa:expired', 'fresh:event', 17, 100, expired ? 50 : 10_000);
  const second = event(f, 'zz:fresh', 'fresh:event', 17, 100);
  [first, second].forEach(f.persistObservation);
  const history = f.snapshot();
  check(`read:mixed-identical:${expired}`, () =>
    m.renderCurrentMeasurementRead(request(f, history), f.c), result => ok(result)
      && got(result).rows.length === 1 && got(result).rows[0].amount === 17
      && got(result).rows[0].evidenceManifest.length === 2);
}

for (const different of [false, true]) {
  const f = F();
  const first = event(f, 'clock:a', 'clock:event', 7, 100);
  const second = event(f, 'clock:b', 'clock:event', 7, different ? 300 : 100);
  [first, second].forEach(f.persistObservation);
  const history = f.snapshot();
  check(`event-clock:${different}:resolve`, () => m.resolveCurrentQuantity({
    witnesses: [f.witness(first, history), f.witness(second, history)],
    sourceHistory: history, evaluationClock: f.clock(500),
  }, f.c), result => different ? no(result) || ok(result) && got(result).state !== 'resolved'
    : ok(result) && got(result).amount === 7);
  check(`event-clock:${different}:read-first-window`, () =>
    m.renderCurrentMeasurementRead(request(f, history, [f.eventProducer], {
      end: f.clock(200),
    }), f.c), result => different ? no(result) || ok(result) && got(result).partial
      : ok(result) && got(result).totalCount === 1);
}

writeFileSync(process.argv[2]!, JSON.stringify(rows, null, 2));
console.log(JSON.stringify({ cases: rows.length, failed: rows.filter(row => !row.pass) }, null, 2));
