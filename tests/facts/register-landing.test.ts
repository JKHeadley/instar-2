// Plan #91: account-authenticated assent (chat reply / pinned operator review) produces the
// explicit yes, the Part Two landing provider appends the governing records, and the verified
// register spine answers from them — both sides of the one declaration, and across a restart.
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { authorizationRequestDigest, canonical, decode } from '../../src/index.js';
import type { Hash, Json } from '../../src/index.js';
import { accountAuthenticatedAssent } from '../../src/decode/explicit-yes.js';
import { createFactStore, createRegisterLanding, createRegisterSpine, extractGovernedChain, governedExtract, positionVector } from '../../src/facts/index.js';
import type { FactEnvelope, GoverningPayloadCustody, SegmentStoragePort } from '../../src/facts/index.js';
import { produceExplicitYes } from '../../src/operator/index.js';
import type { ExplicitYesInstallation, ExplicitYesObservation, ExplicitYesRequest } from '../../src/operator/index.js';
import { factsFixture, privateKey, refused, value } from './fixtures.js';

// The shipped declaration is on (PR #139); this file exercises both of its sides.
const assent = vi.hoisted(() => ({ enabled: true }));
vi.mock('../../src/decode/explicit-yes.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/decode/explicit-yes.js')>();
  return { ...actual,
    attestedClass: (recordType: string) => actual.attestedClass(recordType, assent),
    isExplicitYes: (p: Parameters<typeof actual.isExplicitYes>[0]) => actual.isExplicitYes(p, assent),
    isRepositoryYes: (p: Parameters<typeof actual.isRepositoryYes>[0]) => actual.isRepositoryYes(p, assent) };
});

const installation: ExplicitYesInstallation = { adapter: 'host', machine: 'machine-a',
  chat: { method: 'telegram-sender', boundChatId: 'chat-operator', operatorAccountId: 'tg:alice', agentHoldsNoAccess: true },
  github: { method: 'github-review', repository: 'org/instar', operatorLogin: 'Alice-Op', agentHoldsNoAccess: true },
  agentSpeaksAsOperatorInChat: false };

function setup() {
  assent.enabled = true;
  const f = factsFixture();
  const root = f.fact();
  const ctx = { ...f.ctx, schemas: [...f.ctx.schemas, f.governingSchema], facts: [root], grants: [{ factId: root.id, grant: f.g }] };
  const rows: string[] = [];
  const storage: SegmentStoragePort = { owner: 'part-ten', read: () => rows.map(r => JSON.parse(r) as unknown),
    append: bytes => { rows.push(bytes); return f.success({ kind: 'local-durable' as const }); } };
  const payloads = new Map<string, string>();
  const custody: GoverningPayloadCustody = {
    put: bytes => { const hash = value(canonical(JSON.parse(bytes))).hash; payloads.set(hash, bytes); return f.success(hash); },
    get: hash => payloads.get(hash) };
  const open = () => createRegisterLanding({ context: ctx, store: createFactStore(ctx, storage), custody,
    author: { machine: 'machine-a', principal: f.alice as unknown as Json, provenance: f.alice.provenance as unknown as Json, privateKey },
    anchor: root.id, stalenessBoundMs: 1000 });
  const landing = { owner: 'part-ten' as const, merges: ['merge-1', 'merge-2', 'merge-3'].map(commit =>
    ({ commit, onMain: true, parentCount: 2, reviewedBase: 'base:1' })) };
  function content(body: string) { const c = { id: 'store', body }; const e = value(canonical(c)); f.capture(e.bytes, e.hash); return { c, hash: e.hash as Hash }; }
  function request(requestId: string, artifact: Hash, overrides: Partial<ExplicitYesRequest> = {}): ExplicitYesRequest {
    const action = { kind: 'merge', scope: f.scope };
    return { requestId, authorizationId: `authorization:${requestId}`, approver: f.alice, requestedBy: f.bob, under: f.g.id,
      action: action.kind, scope: f.scope, artifact, base: 'base:1', kind: { kind: 'approval' }, issuedAt: 50, expiresAt: 500,
      chatMessageId: `msg:${requestId}`, head: `head:${requestId}`,
      requestDigest: authorizationRequestDigest({ approver: f.alice, action, artifact, base: 'base:1' }), ...overrides };
  }
  const chat = (requestId: string, messageId = '901', over: Record<string, unknown> = {}): ExplicitYesObservation =>
    ({ kind: 'chat-reply', chatId: 'chat-operator', messageId, replyToMessageId: `msg:${requestId}`, senderAccountId: 'tg:alice',
      text: 'yes', at: f.now, ...over }) as ExplicitYesObservation;
  const review = (requestId: string, reviewId = 'r-77', over: Record<string, unknown> = {}): ExplicitYesObservation =>
    ({ kind: 'github-review', repository: 'org/instar', pullRequest: 12, pullRequestBody: `Approval request: ${requestId}\n`,
      reviewId, commitId: `head:${requestId}`, state: 'APPROVED', reviewerLogin: 'alice-op', at: f.now, ...over }) as ExplicitYesObservation;
  function authorize(req: ExplicitYesRequest, observation: ExplicitYesObservation, consumed: readonly string[] = [],
    install: ExplicitYesInstallation = installation) {
    const record = value(produceExplicitYes(req, install, observation, consumed, f.c));
    f.capture(record.bytes, record.reference);
    const p = value(decode('Provenance', record.provenance, f.ctx.decode));
    return decode('Authorization', { type: 'Authorization', schemaVersion: 1, ...record.authorization, explicitYes: p }, { ...f.ctx.decode, provenance: p });
  }
  const version = (id: string, body: { c: Json; hash: Hash }, supersedes: readonly string[] = [], landedIn = 'merge-1') =>
    ({ id, subject: 'store', content: body.c, contentHash: body.hash, supersedes, base: 'base:1', landedIn });
  const factsNow = () => [root, ...rows.map(r => JSON.parse(r) as FactEnvelope)];
  return { f, ctx, root, rows, payloads, open, landing, content, request, chat, review, authorize, version, factsNow };
}

it('a chat yes enters force, a review yes supersedes it, and both survive a restart', () => {
  const s = setup(), first = s.content('one'), second = s.content('two');
  const landing = s.open();
  const yes1 = value(s.authorize(s.request('req-1', first.hash), s.chat('req-1')));
  expect(yes1.explicitYes.class).toBe('account-assented');
  expect(yes1.explicitYes.record.reference).toBe('telegram:chat:chat-operator:message:901');
  const v1 = value(landing.land(yes1, s.version('v1', first), s.f.scope, s.landing, s.f.now as unknown as Json));
  const extraction = value(extractGovernedChain(value(landing.spine()), { ...s.ctx, facts: s.factsNow() }));
  const generation = { type: 'GenerationRecord', schemaVersion: 1, at: s.f.clockRaw(100),
    generation: { type: 'RegisterGeneration', schemaVersion: 1, id: `sha256:${'a'.repeat(64)}`, commit: 'commit:1',
      vector: { owner: 'part-two', name: 'FactPositionVector', id: (extraction.extract as { vector: { id: string } }).vector.id } } } as unknown as Json;
  value(landing.enterForce(generation, s.f.now as unknown as Json));

  const yes2 = value(s.authorize(s.request('req-2', second.hash), s.review('req-2')));
  expect(yes2.explicitYes.authenticated.recordType).toBe('operator-review-approval');
  value(landing.land(yes2, s.version('v2', second, [v1.version.id], 'merge-2'), s.f.scope, s.landing, s.f.now as unknown as Json));

  // Restart: a new store and provider over the same durable rows and custody.
  const restarted = s.open(), spine = value(restarted.spine());
  expect(spine.versions.map(v => v.version.id)).toEqual(['v1', 'v2']);
  expect(spine.approvals).toHaveLength(2); expect(spine.generations).toHaveLength(1);
  const context = { ...s.ctx, facts: s.factsNow() };
  const rows = (value(extractGovernedChain(spine, context)).extract as { rows: { version: string; status: string }[] }).rows;
  expect(rows.map(r => [r.version, r.status])).toEqual([['v1', 'superseded'], ['v2', 'live']]);
  const port = createRegisterSpine(spine, context, record => s.f.success(record));
  expect(value(port.verifyExtract(extraction.extract))).toEqual({ owner: 'part-two', name: 'FactEnvelope', id: v1.factId });
  expect(value(port.enteringForce((generation as { generation: Json }).generation))).toEqual(generation);
  expect(value(port.isCurrent({ owner: 'part-two', name: 'FactPositionVector', id: (extraction.extract as { vector: { id: string } }).vector.id }, s.f.clock(150)))).toBe(true);
});

it('the declaration off refuses both paths at Part One and the recorded spine at Part Two', () => {
  const s = setup(), first = s.content('one');
  const landing = s.open();
  const yes = value(s.authorize(s.request('req-1', first.hash), s.chat('req-1')));
  value(landing.land(yes, s.version('v1', first), s.f.scope, s.landing, s.f.now as unknown as Json));
  assent.enabled = false;
  refused(s.authorize(s.request('req-9', first.hash), s.chat('req-9', '902')), 'verified required');
  refused(s.authorize(s.request('req-8', first.hash), s.review('req-8', 'r-78')), 'verified required');
  refused(extractGovernedChain(value(s.open().spine()), { ...s.ctx, facts: s.factsNow() }), 'verified explicit yes');
  refused(s.open().land(yes, s.version('v9', first, [], 'merge-3'), s.f.scope, s.landing, s.f.now as unknown as Json), 'explicit yes');
});

it('a yes is used once: the same chat message cannot land a second version', () => {
  const s = setup(), first = s.content('one'), second = s.content('two');
  const landing = s.open();
  const yes = value(s.authorize(s.request('req-1', first.hash), s.chat('req-1')));
  const v1 = value(landing.land(yes, s.version('v1', first), s.f.scope, s.landing, s.f.now as unknown as Json));
  refused(landing.land(yes, s.version('v2', second, [v1.version.id], 'merge-2'), s.f.scope, s.landing, s.f.now as unknown as Json), 'already used');
  // The producer refuses the consumed reference before any Authorization exists.
  refused(produceExplicitYes(s.request('req-1', first.hash), installation, s.chat('req-1'),
    [yes.explicitYes.record.reference], s.f.c), 'already used');
});

it('the producer admits only the named request, from the pinned account, inside its lifetime', () => {
  const s = setup(), first = s.content('one'), req = s.request('req-1', first.hash);
  const produce = (o: ExplicitYesObservation, install = installation, r = req) => produceExplicitYes(r, install, o, [], s.f.c);
  value(produce(s.chat('req-1')));
  value(produce(s.chat('req-1', '903', { text: '  Approve req-1 ' })));
  refused(produce(s.chat('req-1', '904', { chatId: 'chat-other' })), 'bound chat');
  refused(produce(s.chat('req-1', '905', { senderAccountId: 'tg:mallory' })), 'verified operator account');
  refused(produce(s.chat('req-1', '907', { replyToMessageId: 'msg:req-2' })), 'own message');
  refused(produce(s.chat('req-1', '908', { replyToMessageId: null })), 'own message');
  refused(produce(s.chat('req-1'), installation, { ...req, chatMessageId: null }), 'own message');
  refused(produce(s.chat('req-1'), { ...installation, chat: { ...installation.chat, agentHoldsNoAccess: false } }), 'P-02');
  for (const text of ['yes req-2', 'no', 'no req-1', 'yes req-1 please', 'sure', 'yes!']) refused(produce(s.chat('req-1', '906', { text })), 'exactly');
  refused(produce(s.chat('req-1'), installation, { ...req, expiresAt: 99 }), 'lifetime');
  refused(produce(s.chat('req-1'), installation, { ...req, issuedAt: 101 }), 'lifetime');
  // Where the agent may speak through the operator's chat account, only the review path counts.
  refused(produce(s.chat('req-1'), { ...installation, agentSpeaksAsOperatorInChat: true }), 'P-05');
  value(produce(s.review('req-1'), { ...installation, agentSpeaksAsOperatorInChat: true }));
  refused(produce(s.review('req-1', 'r-1', { state: 'COMMENTED' })), 'not an approval');
  refused(produce(s.review('req-1', 'r-2', { reviewerLogin: 'EchoOfDawn' })), 'pinned operator GitHub');
  refused(produce(s.review('req-1', 'r-3', { pullRequestBody: 'Approval request: req-10' })), 'does not name');
  refused(produce(s.review('req-1', 'r-4', { repository: 'org/fork' })), 'pinned repository');
  refused(produce(s.review('req-1', 'r-5', { commitId: 'head:moved' })), 'exact head');
  refused(produce(s.review('req-1'), { ...installation, github: { ...installation.github!, agentHoldsNoAccess: false } }), 'P-02');
  refused(produce(s.review('req-1'), { ...installation, github: null }), 'no pinned operator GitHub');
  refused(produce(s.chat('req-1'), installation, { ...req, requestedBy: s.f.alice }), 'own request');
});

it('an account-assented yes never produces a principal; off, the same record is plain channel-attested', () => {
  const s = setup();
  const reply = { principal: { id: 'mallory', kind: 'person' }, recordType: 'operator-chat-yes', payload: { id: 'mallory', kind: 'person' } };
  const bytes = value(canonical(reply)); s.f.capture(bytes.bytes, 'telegram:chat:chat-operator:message:999');
  const input = { type: 'Provenance', schemaVersion: 1, adapter: 'host', method: 'telegram-sender',
    record: { reference: 'telegram:chat:chat-operator:message:999', hash: bytes.hash }, verifiedAt: s.f.now, machine: 'machine-a',
    evidence: { kind: 'channel', authenticated: true } };
  const principal = (p: unknown) => decode('VerifiedPrincipal', { type: 'VerifiedPrincipal', schemaVersion: 1, id: 'mallory', kind: 'person' },
    { ...s.f.ctx.decode, provenance: p as never });
  const assented = value(decode('Provenance', input, s.f.ctx.decode));
  expect(assented.class).toBe('account-assented');
  refused(principal(assented), 'never produces a principal');
  assent.enabled = false;
  const attested = value(decode('Provenance', input, s.f.ctx.decode));
  expect(attested.class).toBe('channel-attested');
  value(principal(attested));
});

it('a lost governing payload is refused loudly on restart, never skipped', () => {
  const s = setup(), first = s.content('one');
  const yes = value(s.authorize(s.request('req-1', first.hash), s.chat('req-1')));
  value(s.open().land(yes, s.version('v1', first), s.f.scope, s.landing, s.f.now as unknown as Json));
  s.payloads.clear();
  refused(s.open().spine(), 'lost from custody');
});

it('option (C): a bootstrap row stays shape-only until the first governed version of its id supersedes it', () => {
  const s = setup(), first = s.content('one');
  const landing = s.open();
  const boot = [{ id: 'store', contentHash: first.hash }, { id: 'other', contentHash: `sha256:${'b'.repeat(64)}` }];
  type Rows = { vector: { id: string }; rows: { version: string; status: string; supersedes: string[]; approvedIn: { id: string } }[] };
  const before = value(governedExtract(value(landing.spine()), { ...s.ctx, facts: s.factsNow() }, boot)) as unknown as Rows;
  expect(before.vector.id).toBe(positionVector([]));
  expect(before.rows.map(r => [r.version, r.status, r.approvedIn.id]))
    .toEqual([['bootstrap:other', 'live', 'bootstrap:shape-only'], ['bootstrap:store', 'live', 'bootstrap:shape-only']]);

  const yes = value(s.authorize(s.request('req-1', first.hash), s.chat('req-1')));
  value(landing.land(yes, s.version('v1', first), s.f.scope, s.landing, s.f.now as unknown as Json));
  const spine = value(landing.spine()), context = { ...s.ctx, facts: s.factsNow() };
  const after = value(extractGovernedChain(spine, context, undefined, boot)).extract as unknown as Rows;
  expect(after.rows.map(r => [r.version, r.status, r.supersedes]))
    .toEqual([['bootstrap:other', 'live', []], ['bootstrap:store', 'superseded', []], ['v1', 'live', ['bootstrap:store']]]);
  const port = createRegisterSpine(spine, context, record => s.f.success(record), boot);
  value(port.verifyExtract(after));
  // The other side: a replaced bootstrap row kept live, or bootstrap rows the spine was not given, refuse.
  const forged = { ...after, rows: after.rows.map(r => r.version === 'bootstrap:store' ? { ...r, status: 'live' } : r) };
  refused(port.verifyExtract(forged), 'differs from the verified chain');
  refused(createRegisterSpine(spine, context, record => s.f.success(record)).verifyExtract(after), 'differs from the verified chain');
});

it('the shipped declaration is on while Part Eleven accepts an account-assented chat reply as a yes', () => {
  const partEleven = readFileSync('docs/15-the-operator-surfaces.md', 'utf8').replace(/\s+/g, ' ');
  const acceptsAssent = partEleven.includes("a chat reply outside part one's `account-assented` conditions are never yes");
  const refusesChat = partEleven.includes('a successful chat reply are never yes');
  // Disabling the declaration while the amendment stands (or reverting the amendment without disabling) fails here.
  expect(acceptsAssent && !refusesChat).toBe(true);
  expect(accountAuthenticatedAssent.enabled).toBe(acceptsAssent);
  expect(accountAuthenticatedAssent.name).toBe('account-authenticated-assent');
});
