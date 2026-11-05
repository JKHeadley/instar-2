import { expect, it } from 'vitest';
import { submitAuthenticPendingInput } from '../../src/effects/index.js';
import type { AuthenticPendingInput, PendingInputSubmission, PendingInputSubmissionPorts } from '../../src/effects/index.js';
import { assemblyRuntimeFixture } from './runtime-fixture.js';
import { refused, value } from '../facts/fixtures.js';

function admission() {
  const { c } = assemblyRuntimeFixture();
  const current = { operation: 'delivery', identity: 'pane:pid:created', incarnation: 'inc', claim: 'claim',
    intake: 'intake', digest: 'sha256:input', payloadDigest: 'sha256:terminal', turnStartedAt: 1000, deadline: 10_000 };
  const request: AuthenticPendingInput = { ...current, kind: 'worker-input', action: 'submit-authentic-pending-input',
    ordinal: 0, consumption: 'owner-turn-observation' };
  let history: PendingInputSubmission[] = []; const keys: string[] = [];
  const ports: PendingInputSubmissionPorts = { current: () => current, history: () => history, observe: () => 'sha256:styled-frame',
    save: entry => { history = [...history.filter(row => row.request.ordinal !== entry.request.ordinal), entry]; },
    submit: key => { expect(history.at(-1)?.state).toBe('dispatching'); keys.push(key); }, now: () => 1500 };
  return { request, ports, keys, history: () => history, submit: (input = request) => submitAuthenticPendingInput(input, ports, c) };
}

it('records typed admission before dispatch, and joins repeated requests to the same delivery', () => {
  const f = admission(); expect(value(f.submit())).toEqual({ state: 'accepted', duplicate: false });
  expect(value(f.submit())).toEqual({ state: 'accepted', duplicate: true }); expect(f.keys).toEqual(['Enter']);
  expect(f.history()[0]).toMatchObject({ observation: 'sha256:styled-frame', state: 'accepted', request: f.request });
});
it.each(['operation', 'identity', 'incarnation', 'claim', 'intake', 'digest', 'payloadDigest', 'turnStartedAt', 'deadline', 'kind', 'action', 'consumption'] as const)(
  'refuses a changed %s without dispatch', field => {
    const f = admission(); refused(f.submit({ ...f.request, [field]: 'changed' } as AuthenticPendingInput));
    expect(f.keys).toEqual([]); expect(f.history()).toEqual([]);
  });
it('refuses undeclared payload fields and skipped or out-of-budget ordinals', () => {
  const f = admission(); refused(f.submit({ ...f.request, text: 'arbitrary input' } as AuthenticPendingInput));
  for (const ordinal of [-1, 0.5, 1, 5]) refused(f.submit({ ...f.request, ordinal }));
  expect(f.keys).toEqual([]);
});
it('does not dispatch without fresh composer evidence or after the deadline', () => {
  const f = admission(); f.ports.observe = () => null; refused(f.submit()); expect(f.history()).toEqual([]);
  f.ports.observe = () => 'frame'; f.ports.now = () => 10_000; refused(f.submit()); expect(f.keys).toEqual([]);
});
it('preserves unknown occurrence after dispatch throws and refuses to issue a fresh ordinal', () => {
  const f = admission(); f.ports.submit = () => { throw Error('lost key receipt'); };
  expect(value(f.submit()).state).toBe('uncertain');
  expect(value(f.submit({ ...f.request, ordinal: 1 }))).toEqual({ state: 'uncertain', duplicate: true });
  expect(f.history()).toHaveLength(1);
});
it('does not dispatch when durable intent cannot be recorded', () => {
  const f = admission(); f.ports.save = () => { throw Error('disk unavailable'); };
  refused(f.submit()); expect(f.keys).toEqual([]);
});
it('keeps a lost post-key journal write uncertain under its original identity', () => {
  const f = admission(), save = f.ports.save;
  f.ports.save = entry => { if (entry.state === 'accepted') throw Error('receipt write lost'); save(entry); };
  refused(f.submit()); expect(f.keys).toEqual(['Enter']); expect(f.history()[0]?.state).toBe('dispatching');
  expect(value(f.submit({ ...f.request, ordinal: 1 })).state).toBe('uncertain'); expect(f.keys).toEqual(['Enter']);
});

it('refuses a slow observation that crosses the original deadline', () => {
  const f = admission();
  f.ports.observe = () => { f.ports.now = () => 10_000; return 'fresh-frame'; };
  refused(f.submit(), 'deadline exhausted during observation'); expect(f.keys).toEqual([]); expect(f.history()).toEqual([]);
});
