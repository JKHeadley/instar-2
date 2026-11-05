// @ts-nocheck -- fixture installs explicit test-only governance; production Four and custody run unchanged.
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { expect, it } from 'vitest';
import { createIntakePort } from '../../src/intake/index.js';
import { sealEnvelope } from '../../src/rungraph/index.js';
import { createThreadlineKeyCustody, threadlineIdentityFromSeeds, sealThreadlineFrame,
  createThreadlineIntakeAdapter, threadlineIntakeRoute, threadlineParserDeclarationId,
  threadlineAuthenticationMethod } from '../../src/transport/index.js';
import { intakeFixture, value, refused } from '../intake/fixtures.js';

function fixture() {
  const f = intakeFixture();
  const identities = new Map(['sender', 'receiver', 'forger'].map((name, i) => [name,
    threadlineIdentityFromSeeds(new Uint8Array(32).fill(i * 2 + 1), new Uint8Array(32).fill(i * 2 + 2))]));
  let epoch = 'enrollment:1', known = true;
  const custody = (principal, identity = principal) => createThreadlineKeyCustody({ principal,
    identity: identities.get(identity), peer: id => known ? identities.get(id)?.public : undefined, random: randomBytes });
  const parser = f.r.declaration(threadlineParserDeclarationId, 'parsers', { fixture: 'check',
    authenticationClass: [{ stimulusType: 'message', class: 'channel-attested' }],
    eventIdAuthority: { mintedBy: 'Threadline authenticated protocol envelope key and attempt',
      uniquenessScope: 'channel, sender, key epoch, key, attempt', replayWindow: 0,
      fallbackFingerprint: { policy: 'none', basis: 'signed protocol identities required' } }, ackPolicy: 'bound-only' },
  { profile: f.r.profile });
  const declarations = JSON.parse(readFileSync('src/intake/port.declarations.json', 'utf8'));
  const governance = f.govern([...declarations, parser]).governance;
  Object.assign(f.context.decode.register, { entries: [...f.context.decode.register.entries, threadlineParserDeclarationId],
    methods: [...f.context.decode.register.methods, threadlineAuthenticationMethod] });
  const adapter = createThreadlineIntakeAdapter({ keys: custody('receiver'), capture: f.deps.capture,
    machine: f.deps.author.machine, context: f.f.c, epoch: () => known ? epoch : null });
  const port = value(createIntakePort({ ...f.deps, adapter, governance }));
  const envelope = sealEnvelope({ kind: 'progress', key: 'sender|edge|progress|1', sender: 'sender', recipient: 'receiver',
    edge: 'edge', parentRun: 'parent', childRun: 'child', conversation: 'thread', contractDigest: 'sha256:contract',
    scope: ['project'], grants: [], resultDestination: { run: 'parent', edge: null }, answers: null,
    contract: null, result: null, reason: 'progress', at: 100 });
  const frame = (identity = 'sender') => sealThreadlineFrame(custody('sender', identity), {
    kind: 'envelope', recipient: 'receiver', conversation: 'thread', key: envelope.key,
    digest: envelope.digest, attempt: 'delivery:1' }, { envelope, receipt: null });
  const receive = (input, route = threadlineIntakeRoute(input, epoch)) => port.receive(JSON.stringify(input), route);
  return { f, port, adapter, frame, receive, envelope, setEpoch: value => { epoch = value; }, unknown: () => { known = false; } };
}

it('preserves a sealed arrival before authenticating it and admits only requester intent; exact replay deduplicates', () => {
  const f = fixture(), frame = f.frame();
  expect(value(f.receive(frame))).toMatchObject({ kind: 'admitted', standing: 'requester', boundOperator: false,
    intent: { via: threadlineParserDeclarationId, principal: { id: 'sender', kind: 'agent' } } });
  expect(value(f.receive(frame))).toMatchObject({ kind: 'duplicate' });
  expect(f.f.facts().filter(row => row.kind === 'intake-admitted')).toHaveLength(1);
  expect(f.f.facts().some(row => row.kind === 'intake-receipt')).toBe(true);
});

it.each(['forged', 'unknown', 'stale', 'topic', 'ciphertext'])('retains and refuses %s custody without a Run or grant', variant => {
  const f = fixture(), frame = f.frame(variant === 'forged' ? 'forger' : 'sender');
  let route = threadlineIntakeRoute(frame, 'enrollment:1');
  if (variant === 'unknown') f.unknown();
  if (variant === 'stale') f.setEpoch('enrollment:2');
  if (variant === 'topic') route = { ...route, channel: 'threadline:another' };
  const input = variant === 'ciphertext' ? { ...frame, sealed: frame.sealed.slice(0, -4) + 'AAAA' } : frame;
  refused(f.receive(input, route));
  expect(f.f.facts().some(row => row.kind === 'intake-receipt')).toBe(true);
  expect(f.f.facts().some(row => ['intake-admitted', 'run-opening', 'genesis-grant'].includes(row.kind))).toBe(false);
});

it('never parses unauthenticated bytes', () => {
  const f = fixture();
  expect(() => f.adapter.parse(JSON.stringify(f.envelope))).toThrow(/not authenticated/);
});
