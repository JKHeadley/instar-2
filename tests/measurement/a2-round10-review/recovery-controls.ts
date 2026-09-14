import { writeFileSync } from 'node:fs';
import { m, F, got, event, plan, win, open, ok, no } from './helpers.js';

const rows: any[] = [];
function check(name: string, run: () => any, predicate: (result: any) => boolean) {
  try { const actual = run(); rows.push({ name, pass: predicate(actual), actual }); }
  catch (error) { rows.push({ name, pass: false, exception: String(error) }); }
}

for (const expiredIndex of [-1, 1, 2]) {
  const f = F();
  const observations = [0, 1, 2, 3].map(index => [
    event(f, `control:${index}:t`, `control:${index}:t`, index === 0 ? 10 : 0,
      index * 200 + 50, index === expiredIndex ? 650 - (index * 200 + 50) : 10_000),
    event(f, `control:${index}:o`, `control:${index}:o`, index === 0 ? 90 : 20,
      index * 200 + 50),
  ]);
  observations.flat().forEach(f.persistObservation);
  const plans = observations.map((set, index) => plan(f, `control:${index}`, index * 200,
    set, ['feature-a', 'comparison'], index === 0 ? 100 : 20));
  const raw = { ...f.burnPolicyInput, id: 'burn:three-control', recoveryWindows: 3 };
  f.c = f.withRegistered(raw, f.c);
  const policy = got(m.decodeBurnPolicy(raw, f.c));
  const history = f.snapshot();
  const windows = plans.map(planned => win(f, planned, history));
  let state: any = open;
  for (let index = 1; index <= 3; index++) {
    const result = m.evaluateCurrentBurn(policy, state, windows[index], [windows[0]], f.c);
    if (index === 3) check(`three-vote:expired-index-${expiredIndex}`, () => result,
      candidate => ok(candidate) && (expiredIndex === -1
        ? got(candidate).episode.state === 'closed' : got(candidate).episode.state === 'open'));
    state = got(result).episode;
  }
  if (expiredIndex >= 1) check(`three-vote:expired-index-${expiredIndex}:direct-support-unavailable`,
    () => m.resolveCurrentQuantity({
      witnesses: windows[expiredIndex].samples[0].quantities[0].witnesses,
      sourceHistory: history, evaluationClock: f.clock(800),
    }, f.c), result => ok(result) && got(result).state === 'unavailable'
      && got(result).amount === null);
}

{
  const f = F();
  const observations = [0, 1, 2].map(index => [
    event(f, `same:${index}:t`, `same:${index}:t`, index === 0 ? 10 : 0,
      index * 200 + 50),
    event(f, `same:${index}:o`, `same:${index}:o`, index === 0 ? 90 : 20,
      index * 200 + 50),
  ]);
  observations.flat().forEach(f.persistObservation);
  const plans = observations.map((set, index) => plan(f, `same:${index}`, index * 200,
    set, ['feature-a', 'comparison'], index === 0 ? 100 : 20));
  const alias = f.admitEvidence(f.evidenceInput({ id: 'same:alias', observedAt: f.clock(400),
    freshFor: 10_000, claim: { ...plans[1].evidence.claim, subject: 'same:other-id' } }));
  f.append('measurement-evidence', { evidence: alias }, f.clock(400));
  const history = f.snapshot();
  const windows = plans.map(planned => win(f, planned, history));
  const policy = f.burnPolicy();
  const first = got(m.evaluateCurrentBurn(policy, open, windows[1], [windows[0]], f.c));
  const other = got(m.createCurrentBurnWindow({ sourceHistory: history,
    window: { ...plans[1].build(history), id: 'same:other-id', populationEvidence: alias } }, f.c));
  check('F6:distinct-witness-same-interval-retains-one', () =>
    m.evaluateCurrentBurn(policy, first.episode, other, [windows[0]], f.c), result =>
    ok(result) && got(result).episode.state === 'open'
      && got(result).episode.recoveryCount === 1);
  check('F6:next-interval-closes', () =>
    m.evaluateCurrentBurn(policy, first.episode, windows[2], [windows[0]], f.c), result =>
    ok(result) && got(result).episode.state === 'closed');
}

for (const expired of [false, true]) {
  const f = F();
  const observation = event(f, 'pop:e', 'pop:event', 17, 100);
  f.persistObservation(observation);
  const planned = plan(f, 'pop', 0, [observation], ['feature-a'], 17);
  const history = f.snapshot();
  const window = win(f, planned, history);
  check(`population:evidence-withdrawn-${expired}`, () =>
    m.evaluateCurrentBurn(f.burnPolicy(), open, window, [], expired
      ? { ...f.c, types: { ...f.types,
        evidence: f.evidence.filter((evidence: any) => evidence.id !== window.populationEvidence.id) } }
      : f.c), expired ? no : ok);
}

writeFileSync(process.argv[2]!, JSON.stringify(rows, null, 2));
console.log(JSON.stringify({ cases: rows.length, failed: rows.filter(row => !row.pass) }, null, 2));
