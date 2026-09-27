// @ts-nocheck -- the canary exercises the shipped JavaScript CLI and encrypted preview journal.
import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, activationMatchesJournal } from './journal.js';
import { HOLDING_REPLY, JEV_MODEL, REPLY_RULES, parseReplyReviewVerdict } from './reply-check.js';
import { interpretSummaryReview } from './summary-check.js';
import { parseModelJson } from './model-json.js';
import { renewActivation } from './renew-activation.mjs';
import { encoded } from './stage2-provider.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { SUBSCRIPTION_CONVERSATION_FRAMING, SUBSCRIPTION_PREVIEW_EXPIRY,
  subscriptionConversationPolicy, validateSubscriptionActivation } from '../../src/assembly/production-provider.js';

const key = new Uint8Array(32).fill(43);
const at = 1790512800000; // Fixed 2026-09-27 clock; no wall-clock activation assumptions.
const model = 'claude-sonnet-5';
const genesis = (caps = {}) => ({ kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'preview-trial:offline-canary', configurationDigest: 'sha256:offline-canary',
  expires: SUBSCRIPTION_PREVIEW_EXPIRY, maxCalls: 12, maxReplies: 8, maxTurns: 8,
  maxBytes: 32768, cursor: 0, ...caps });
const update = (id, text) => ({ update_id: id, message: { chat: { id: 7654321, type: 'private' },
  from: { id: 7654321 }, text } });
const scores = (rawPath = 0) => ({ model: JEV_MODEL,
  answers: Object.fromEntries(Object.keys(REPLY_RULES).map(id => [id,
    { type: 'noul', noul: id === 'raw_path' ? rawPath : 0 }])) });
const summarySignal = score => ({ model: JEV_MODEL,
  answers: { summary_integrity: { type: 'noul', noul: score } } });
const rootOf = () => realpathSync(mkdtempSync(join(tmpdir(), 'preview-offline-canary-')));
const status = root => {
  const result = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
    'tests/preview/journal-agent.mjs', 'status', '--root', root], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 10000,
    env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout);
};

it('answers, reviews a clean reply, and holds a contradictory one-line review without sending its candidate', async () => {
  const root = rootOf(), path = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, genesis());
  const sent = [], reviewPackets = [];
  const worker = createJournalWorker(journal, { now: () => at, stopped: () => false,
    prepareModel: input => prepareJournalEnvelope(input, model, genesis().grant, at),
    model: async input => input.id.endsWith(':1') ? 'The answer is violet.'
      : input.id.endsWith(':2') ? 'The answer is amber.' : 'The answer is scarlet.',
    send: async item => { sent.push(item); return sent.length; }, checkOutbound: () => {},
    replyCheck: { elapsedMs: () => at, jev: async text => ({ value: scores(text.includes('violet') ? 0 : 0.9), latencyMs: 1 }),
      escalate: async (_text, _id, originalPrompt, rules) => {
        reviewPackets.push({ originalPrompt, rules });
        // The real one-line parser refuses a PASS followed by a conflicting verdict.
        const line = _text.includes('amber') ? 'PASS | The reply is safe here.'
          : 'PASS | Looks safe.\nVIOLATION:raw_path | Contradiction.';
        return { ...parseReplyReviewVerdict(line), confidence: null, latencyMs: 1 };
      } } });
  try {
    worker.intake([update(1, 'What color is it?')]); await worker.drain();
    worker.intake([update(2, 'And the other color?')]); await worker.drain();
    worker.intake([update(3, 'And one more color?')]); await worker.drain();
    expect(sent.map(item => item.expectedText)).toEqual(['PREVIEW — The answer is violet.', 'PREVIEW — The answer is amber.']);
    expect(reviewPackets).toHaveLength(2);
    expect(reviewPackets[0].originalPrompt).toContain('And the other color?');
    expect(reviewPackets[0].rules).toContain('raw_path');
    expect(journal.view.order[2].answer).toBe('The answer is scarlet.');
    expect(journal.view.order[2].intent).toBeUndefined();
    expect(journal.view.order[2].held).toBe('reply check unavailable');
    expect(status(root)).toMatchObject({ turns: 3, calls: 5, replies: 2,
      limits: { maxCalls: 12, maxReplies: 8, maxTurns: 8, maxBytes: 32768 },
      replyChecks: { pass: 2, unavailable: 1 }, unknownSends: 0, stop: null });
    journal.close(); journal = openPreviewJournal(path, key);
    await createJournalWorker(journal, { now: () => at, stopped: () => false,
      model: async () => { throw Error('answer repeated'); }, send: async () => { throw Error('send repeated'); },
      checkOutbound: () => {} }).drain();
    expect(journal.view.order[2].held).toBe('reply check unavailable');
    expect(journal.view.cursor).toBe(4);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it.each([['pass', true], ['violation', false]])('runs a rolling summary and its full-context review: %s', async (verdict, accepted) => {
  const root = rootOf(), path = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, genesis());
  let reviews = 0;
  const worker = createJournalWorker(journal, { now: () => at, stopped: () => false,
    summaryCheck: async () => ({ model: JEV_MODEL, answers: { lost_memory: { type: 'noul', noul: 0.01 } } }),
    model: async input => input.id.startsWith('summary:')
      ? JSON.stringify({ summary: 'On 26 September, Justin asked us to remember the launch.', people: [], commitments: [], memory: [] })
      : 'I will remember the launch.',
    send: async () => 1, checkOutbound: () => {},
    replyCheck: { elapsedMs: () => at, jev: async (_state, questions) => ({
      value: questions ? summarySignal(0.9) : scores(), latencyMs: 1 }),
      escalate: async () => { throw Error('unexpected reply review'); },
      summaryReview: async state => {
        reviews++;
        expect(state).toContain('remember the launch');
        return interpretSummaryReview({ state: 'complete',
          value: JSON.stringify({ verdict, reason: verdict === 'pass' ? 'The covered fact remains.' : 'The fact is contradicted.' }),
          usage: { inputTokens: 8, outputTokens: 4 } }, 1);
      } } });
  try {
    worker.intake([update(1, 'On 26 September, remember the launch.')]); await worker.drain();
    await worker.summarizeIfNeeded(true);
    expect(reviews).toBe(1);
    expect(journal.view.summaries.length).toBe(accepted ? 1 : 0);
    expect(journal.view.summaryCandidates.get(1)).toContain('remember the launch');
    expect(status(root)).toMatchObject({ calls: 3, summaryThrough: accepted ? 1 : null,
      summaryChecks: { [verdict]: accepted ? 1 : 2 }, summaryPending: 0,
      lastSummaryCheck: { verdict, path: 'subscription' } });
    journal.close(); journal = openPreviewJournal(path, key);
    expect(journal.view.summaries.length).toBe(accepted ? 1 : 0);
    expect(journal.view.summaryCheckCounts[verdict]).toBe(accepted ? 1 : 2);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('accepts one whole Decision JSON object or fence and refuses conflicting wrappers', () => {
  const decision = { type: 'Decision', schemaVersion: 1, answer: 'violet' };
  const json = JSON.stringify(decision);
  expect(parseModelJson(json)).toEqual({ ok: true, value: decision, shape: 'bare' });
  expect(parseModelJson('```json\n' + json + '\n```')).toEqual({ ok: true, value: decision, shape: 'fenced' });
  expect(parseModelJson(`PASS | safe\n${json}`)).toEqual({ ok: false, shape: 'prose-wrapped' });
  expect(parseModelJson(`${json}\n${json}`)).toEqual({ ok: false, shape: 'multiple-objects' });
  expect(interpretSummaryReview({ state: 'complete',
    value: `\`\`\`json\n{"verdict":"pass","reason":"covered"}\n\`\`\``,
    usage: { inputTokens: 1, outputTokens: 1 } }, 1).verdict).toBe('pass');
  expect(interpretSummaryReview({ state: 'complete',
    value: 'PASS | safe\n{"verdict":"violation","reason":"contradiction"}',
    usage: { inputTokens: 1, outputTokens: 1 } }, 1).verdict).toBe('unavailable');
});

it('validates renewal and policy-successor records against the pinned policy, with rejected neighbours', () => {
  const profile = { type: 'ProviderSubscriptionProfile', schemaVersion: 1, reference: 'offline-profile',
    home: '/offline/home', configDirectory: '/offline/config', workingDirectory: '/offline/work',
    expectedAccount: 'offline@example.invalid', organization: 'offline', plan: 'max',
    loginProfileIdentity: 'offline-identity', executable: '/offline/cli', artifact: 'sha256:offline',
    version: '2.1.280', activationReference: 'offline-activation', managedConfigurationDigest: 'sha256:offline' };
  const digest = encoded(subscriptionConversationPolicy(model)).hash;
  expect(digest).toBe('sha256:efe698761d91114749594313b2bde1e2c21a855901f539c5a3afc4a16998cea7');
  const base = { type: 'SubscriptionActivationRecord', schemaVersion: 1, reference: profile.activationReference,
    waiver: 'waiver', p11: 'p11', reviewedHead: 'frozen predecessor', trial: genesis().grant,
    baseConfigurationDigest: genesis().configurationDigest, profileDigest: encoded(profile).hash,
    executable: profile.executable, artifact: profile.artifact, version: profile.version, model,
    invocationPolicyDigest: digest, expectedAccount: profile.expectedAccount, observedAccount: profile.expectedAccount,
    authSource: 'claude.ai', operatorAssertion: 'offline assertion', assertedAt: at - 200000,
    observer: 'offline observer', observedAt: at - 100000, method: 'auth status', safeCaptureReference: 'offline capture',
    extraUsage: 'observed-disabled', extraUsageReason: 'disabled', subscriptionLimit: 'available',
    subscriptionLimitReason: 'offline reading', acceptedResiduals: ['offline fixture'], expiresAt: at + 10000 };
  const observation = { reference: base.reference, reviewedHead: 'canary candidate', assertedAt: at - 2000,
    observedAt: at - 1000, method: 'offline observation', observer: 'offline canary',
    safeCaptureReference: 'offline capture', observedAccount: profile.expectedAccount,
    subscriptionLimit: 'available', subscriptionLimitReason: 'offline fixture' };
  const currentBytes = JSON.stringify(base);
  const renewed = renewActivation({ current: base, currentBytes, profile, observation, now: at }).record;
  expect(() => validateSubscriptionActivation(renewed, profile, model, at, SUBSCRIPTION_CONVERSATION_FRAMING)).not.toThrow();
  expect(renewed.invocationPolicyDigest).toBe(digest);
  expect(renewed.predecessor.digest).toBe(`sha256:${createHash('sha256').update(currentBytes).digest('hex')}`);
  expect(() => validateSubscriptionActivation({ ...renewed, invocationPolicyDigest: 'sha256:wrong' },
    profile, model, at, SUBSCRIPTION_CONVERSATION_FRAMING)).toThrow();
  expect(() => renewActivation({ current: base, currentBytes, profile,
    observation: { ...observation, observedAccount: 'other@example.invalid' }, now: at })).toThrow();
  const priorPolicy = { ...renewed, invocationPolicyDigest: 'sha256:557a62fa7c65c0a8a5982f34f8d96236231d21082bef4b441ea7847be58cb833' };
  const successor = renewActivation({ current: priorPolicy, currentBytes: JSON.stringify(priorPolicy), profile,
    observation, now: at, policySuccessor: true }).record;
  expect(successor.previousInvocationPolicyDigest).toBe(priorPolicy.invocationPolicyDigest);
  expect(successor.invocationPolicyDigest).toBe(digest);
  expect(() => validateSubscriptionActivation(successor, profile, model, at, SUBSCRIPTION_CONVERSATION_FRAMING)).not.toThrow();
  expect(() => renewActivation({ current: renewed, currentBytes: JSON.stringify(renewed), profile,
    observation, now: at, policySuccessor: true })).toThrow('digest unchanged');
  const root = rootOf(), journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
  try {
    expect(activationMatchesJournal(journal.view, renewed)).toBe(true);
    expect(activationMatchesJournal(journal.view, { ...renewed, trial: 'other' })).toBe(false);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('upgrades the frozen live-format journal in place and preserves an UNKNOWN send fence', async () => {
  const root = rootOf(), path = join(root, 'journal.encrypted');
  // Generated with journal.ts whose bytes match frozen15 at 3695117d, then copied to a new root.
  copyFileSync(new URL('./fixtures/offline-canary-frozen15.encrypted', import.meta.url), path);
  let journal = openPreviewJournal(path, key);
  let sends = 1; // the fixture has one physical send attempt with UNKNOWN result
  try {
    expect(journal.view.order[0].intent).toBe('PREVIEW — violet');
    journal.close(); journal = openPreviewJournal(path, key);
    const resumed = createJournalWorker(journal, { now: () => at, stopped: () => false,
      model: async () => 'amber', checkOutbound: () => {},
      send: async () => { sends++; return sends; } });
    resumed.intake([update(1, 'What color?'), update(2, 'Another color?')]); await resumed.drain();
    expect(sends).toBe(2);
    expect(journal.view.order.map(turn => [turn.update, turn.intent, turn.sent])).toEqual([
      [1, 'PREVIEW — violet', undefined], [2, 'PREVIEW — amber', 2] ]);
    expect(status(root)).toMatchObject({ cursor: 3, turns: 2, replies: 2, unknownSends: 1,
      unknownCallBreakdown: { total: 0 }, stop: null });
    expect(readFileSync(path, 'utf8')).not.toContain('What color?');
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
