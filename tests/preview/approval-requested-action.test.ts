// cint-L2: build 3b's approval page composed with the #42 general requested action. A capped operator
// request to act later is saved, not answered, while the chat's limited answer is inhibited; the raise
// waits on the operator's page; the passkey yes applies it, and the saved message then gets its ordinary
// answer in the real model's declared shape (`dated[].remind: true`), which grants the request exactly
// once. The plain-text real-model shape grants nothing (the standing live risk, live-model-shapes.test.ts).
import { afterEach, expect, it } from 'vitest';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { admittedDependencies, createJournalWorker, openPreviewJournal, previewTestContext } from './journal-test-worker.js';
// @ts-expect-error The operator-run surface is JavaScript.
import { createApprovalSurface, handle } from '../../scripts/approval-surface.mjs';
// @ts-expect-error The runner client is JavaScript.
import { createApprovalSurfaceClient } from './approval-surface-client.mjs';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });
const b64u = (bytes: Buffer | Uint8Array) => Buffer.from(bytes).toString('base64url');
const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest();
const ORIGIN = 'https://approve.example.org', RP = 'approve.example.org';
const zone = 'America/Los_Angeles';
const start = Date.UTC(2026, 8, 26, 17); // Saturday 2026-09-26 10:00 in Los Angeles.
const ASK = 'Send me a rundown of today at 6 pm.';
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
  configurationDigest: 'sha256:offline', expires: Date.UTC(2026, 9, 10), maxCalls: 1, maxReplies: 8, maxTurns: 8,
  maxBytes: 32768, cursor: 0 };
const message = (id: number, text: string) => ({ update_id: id, message: { message_id: id,
  chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: Math.floor(start / 1000) + id } });

function phone() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const id = randomBytes(16);
  const client = (type: string, challenge: string) => Buffer.from(JSON.stringify({ type, challenge, origin: ORIGIN, crossOrigin: false }));
  return {
    create(challenge: string) {
      const length = Buffer.alloc(2); length.writeUInt16BE(id.length);
      const auth = Buffer.concat([sha(RP), Buffer.from([0x45]), Buffer.alloc(4), Buffer.alloc(16), length, id, Buffer.from([0xa0])]);
      return { id: b64u(id), alg: -7, publicKey: b64u(publicKey.export({ format: 'der', type: 'spki' })),
        clientDataJSON: b64u(client('webauthn.create', challenge)), authenticatorData: b64u(auth) };
    },
    get(challenge: string) {
      const data = client('webauthn.get', challenge), auth = Buffer.concat([sha(RP), Buffer.from([0x05]), Buffer.from([0, 0, 0, 0])]);
      return { credentialId: b64u(id), clientDataJSON: b64u(data), authenticatorData: b64u(auth),
        signature: b64u(sign('sha256', Buffer.concat([auth, sha(data)]), privateKey)) };
    } };
}

async function run(answer: (question: string) => string) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'approval-requested-')));
  cleanup.push(() => rmSync(root, { recursive: true, force: true }));
  const store = join(root, 'store'), outbox = join(root, 'outbox');
  mkdirSync(store, { mode: 0o755 }); mkdirSync(outbox, { mode: 0o755 }); chmodSync(store, 0o755); chmodSync(outbox, 0o755);
  let clock = start;
  const uid = process.getuid!();
  const surface = createApprovalSurface({ operator: 'telegram:7654321', operatorUid: uid, agentUid: uid + 1,
    ingressGrant: 'desk:ingress-test', publicBase: ORIGIN, store, outbox }, () => clock);
  const client = createApprovalSurfaceClient({ store, outbox, operatorUid: uid, agentUid: uid + 1, now: () => clock });
  const call = (method: string, path: string, body?: unknown) => handle(surface, { method, path: `/${surface.surface.token}${path}`,
    body: body === undefined ? undefined : JSON.stringify(body) }) as { status: number; body: string };
  const device = phone();
  const code = (surface.enrol() as string).split('#')[1]!;
  expect(call('POST', '/enrol/finish', { code, registration: device.create(JSON.parse(call('POST', '/enrol/begin', { code }).body).challenge) }).status).toBe(200);
  const sent: string[] = [], questions: string[] = [];
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(7), genesis);
  cleanup.unshift(() => journal.close());
  const worker = createJournalWorker(journal, { now: () => clock, stopped: () => false, checkOutbound: () => {}, timeZone: zone,
    model: async input => { questions.push(input.question); return answer(input.question); }, approvalSurface: client,
    minimal: { context: previewTestContext, dependencies: () => ({ ...admittedDependencies(), register: false, lease: false,
      fence: false, 'replication-peer': false }) },
    send: async (input: { expectedText: string }) => { sent.push(input.expectedText); return sent.length; } });
  worker.intake([message(1, 'Good morning.')]); await worker.drain();
  worker.intake([message(2, ASK)]); await worker.drain(); await worker.minimal();
  const lead = journal.view.order[1]!;
  // Capped and inhibited: nothing in the chat, no model call, no grant; the raise waits on the page.
  expect(sent).toHaveLength(1);
  expect(questions).toHaveLength(1);
  expect(journal.view.dated.filter(item => item.remind)).toHaveLength(0);
  expect(lead.approvalReason).toBe('calls');
  const challenge = lead.approval!.challenge!;
  const name = createHash('sha256').update(challenge.id).digest('hex');
  clock += 60_000;
  const begin = JSON.parse(call('POST', '/begin', { name, decision: 'approve' }).body);
  expect(call('POST', '/act', { name, decision: 'approve', nonce: begin.nonce, assertion: device.get(begin.challenge) }).status).toBe(200);
  await worker.minimal(); await worker.drain();
  return { sent, questions, grants: journal.view.dated.filter(item => item.remind).length, limits: journal.view.limits };
}

it('a capped request to act later is granted once, after the page raise, in the real model\'s declared shape', async () => {
  const declared = await run(question => question.includes(ASK)
    ? JSON.stringify({ reply: 'Sure — I\'ll send you a rundown of today at 6 pm.', memory: [],
      dated: [{ quote: ASK, when: 'today at 6 pm', remind: true }] })
    : 'Good morning!');
  expect(declared.limits.maxCalls).toBe(2);
  expect(declared.questions).toHaveLength(2);
  expect(declared.grants).toBe(1);
  expect(declared.sent).toHaveLength(2);
  expect(declared.sent[1]).toContain('I will act on this once at 2026-09-26 18:00 (America/Los_Angeles) and send you the result here.');
});

it('live risk: the real model\'s plain-text confirmation after the raise grants nothing', async () => {
  const plain = await run(question => question.includes(ASK) ? 'Sure — I\'ll send you a rundown of today at 6 pm.' : 'Good morning!');
  expect(plain.limits.maxCalls).toBe(2);
  expect(plain.grants).toBe(0);
  expect(plain.sent[1]).toBe('Sure — I\'ll send you a rundown of today at 6 pm.');
});
