// Build 3b: the independent approval surface (Eleven §§2, 4, 5; P-02, P-04). The fixture authenticator is
// real-shaped WebAuthn: a P-256 key the surface and runner never hold, authenticator data with the site's
// rpId hash and user-presence/verification flags, and an ES256 DER signature over authenticatorData ||
// SHA-256(clientDataJSON), exactly as a phone passkey produces them.
import { afterEach, expect, it } from 'vitest';
import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { Script } from 'node:vm';
import type { AddressInfo, Server } from 'node:net';
import { join } from 'node:path';
import { admittedDependencies, approvalRequestText, createJournalWorker, openPreviewJournal, previewTestContext } from './journal-test-worker.js';
// @ts-expect-error The operator-run surface is JavaScript.
import { createApprovalSurface, handle, serve } from '../../scripts/approval-surface.mjs';
// @ts-expect-error The runner client is JavaScript.
import { createApprovalSurfaceClient } from './approval-surface-client.mjs';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });
const b64u = (bytes: Buffer | Uint8Array) => Buffer.from(bytes).toString('base64url');
const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest();
const ORIGIN = 'https://approve.example.org', RP = 'approve.example.org';

/** A phone passkey stand-in: it holds the private key; everything it emits is the WebAuthn wire shape. */
function authenticator(options: { flags?: number; origin?: string; rpId?: string } = {}) {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const id = randomBytes(16);
  const client = (type: string, challenge: string) => Buffer.from(JSON.stringify({ type, challenge,
    origin: options.origin ?? ORIGIN, crossOrigin: false }));
  const signWith = (key: KeyObject, data: Buffer) => sign('sha256', data, key);
  return { id: b64u(id), privateKey,
    create(challenge: string) {
      const length = Buffer.alloc(2); length.writeUInt16BE(id.length);
      const auth = Buffer.concat([sha(options.rpId ?? RP), Buffer.from([0x45]), Buffer.alloc(4), Buffer.alloc(16), length, id, Buffer.from([0xa0])]);
      return { id: b64u(id), alg: -7, publicKey: b64u(publicKey.export({ format: 'der', type: 'spki' })),
        clientDataJSON: b64u(client('webauthn.create', challenge)), authenticatorData: b64u(auth) };
    },
    get(challenge: string, key: KeyObject = privateKey, override: { flags?: number; origin?: string; rpId?: string } = {}) {
      const data = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge, origin: override.origin ?? options.origin ?? ORIGIN, crossOrigin: false }));
      const auth = Buffer.concat([sha(override.rpId ?? options.rpId ?? RP), Buffer.from([override.flags ?? options.flags ?? 0x05]), Buffer.from([0, 0, 0, 0])]);
      return { credentialId: b64u(id), clientDataJSON: b64u(data), authenticatorData: b64u(auth),
        signature: b64u(signWith(key, Buffer.concat([auth, sha(data)]))) };
    } };
}

const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
  configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 1, maxReplies: 8, maxTurns: 8, maxBytes: 32768, cursor: 0 };
const message = (id: number, text: string) => ({ update_id: id,
  message: { message_id: id, chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });
// A host whose minimal path is not admitted (a missing register generation, lease/fence, or the
// single-machine P-08 policy not yet accepted): the chat's limited answer stays inhibited. The approval
// page must still carry the request.
const liveDependencies = () => ({ ...admittedDependencies(), register: false, lease: false, fence: false, 'replication-peer': false });

function setup() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'approval-surface-')));
  cleanup.push(() => rmSync(root, { recursive: true, force: true }));
  const store = join(root, 'store'), outbox = join(root, 'outbox');
  mkdirSync(store, { mode: 0o755 }); mkdirSync(outbox, { mode: 0o755 }); chmodSync(store, 0o755); chmodSync(outbox, 0o755);
  let clock = 1_000_000;
  const uid = process.getuid!();
  // In a real installation the surface runs as a separate operator OS user; one test process can only
  // declare the agent's identity as different (as the fixed-installation host tests do).
  const config = { operator: 'telegram:7654321', operatorUid: uid, agentUid: uid + 1, ingressGrant: 'desk:ingress-test',
    publicBase: ORIGIN, store, outbox };
  const surface = createApprovalSurface(config, () => clock);
  const client = createApprovalSurfaceClient({ store, outbox, operatorUid: uid, agentUid: uid + 1, now: () => clock });
  const token = surface.surface.token as string;
  const call = (method: string, path: string, body?: unknown) =>
    handle(surface, { method, path: `/${token}${path}`, body: body === undefined ? undefined : JSON.stringify(body) }) as
      { status: number; headers: Record<string, string>; body: string };
  const phone = authenticator();
  const enrol = (device = phone) => {
    const code = (surface.enrol() as string).split('#')[1]!;
    const start = JSON.parse(call('POST', '/enrol/begin', { code }).body);
    return call('POST', '/enrol/finish', { code, registration: device.create(start.challenge) });
  };
  /** The operator taps a decision on the page and confirms with the passkey. */
  const decide = (name: string, decision: 'approve' | 'decline', device = phone, tamper?: (start: { challenge: string }) => string) => {
    const begin = call('POST', '/begin', { name, decision });
    if (begin.status !== 200) return begin;
    const start = JSON.parse(begin.body);
    return call('POST', '/act', { name, decision, nonce: start.nonce, assertion: device.get(tamper ? tamper(start) : start.challenge) });
  };
  const sent: string[] = [];
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(7), genesis);
  const worker = createJournalWorker(journal, { now: () => clock, stopped: () => false, checkOutbound: () => {},
    model: async () => 'ordinary answer', approvalSurface: client,
    minimal: { context: previewTestContext, dependencies: liveDependencies },
    send: async (input: { expectedText: string }) => { sent.push(input.expectedText); return sent.length; } });
  return { root, store, outbox, surface, client, call, phone, enrol, decide, journal, worker, sent, config,
    tick: (ms: number) => { clock += ms; }, now: () => clock };
}
const nameOf = (id: string) => createHash('sha256').update(id).digest('hex');

it('offers the raise on the approval page while the chat answer is inhibited, and honours only a passkey-signed yes', async () => {
  const t = setup();
  expect(t.client.status()).toMatchObject({ installed: true, ready: false, passkeys: 0 });
  expect(t.enrol().status).toBe(200);
  expect(t.client.status()).toMatchObject({ ready: true, passkeys: 1 });
  t.worker.intake([message(1, 'one')]); await t.worker.drain();
  t.worker.intake([message(2, 'two')]); await t.worker.drain(); await t.worker.minimal();
  // Nothing goes to the chat for the capped message: the minimal path is not admitted (live posture).
  expect(t.sent).toEqual(['PREVIEW — ordinary answer']);
  const lead = t.journal.view.order[1]!;
  expect(lead.minimalOutage?.missing).toEqual(expect.arrayContaining(['register', 'lease']));
  const challenge = lead.approval!.challenge!;
  expect(lead.approvalReason).toBe('calls');
  // The page lists the standing stop first, then the raise, in the surface's own fixed wording.
  const index = t.call('GET', '/');
  expect(index.status).toBe(200);
  expect(index.body.indexOf('Stop this preview agent permanently?')).toBeLessThan(index.body.indexOf('allowance from 1 to 2'));
  expect(index.headers['content-security-policy']).toContain("default-src 'none'");
  const page = t.call('GET', `/c/${nameOf(challenge.id)}`).body;
  expect(page).toContain(approvalRequestText(t.journal.view, 'calls'));
  expect(page.indexOf('data-decision="approve"')).toBeLessThan(page.indexOf('data-decision="decline"'));
  expect(page).not.toMatch(/<input|<textarea|contenteditable/u); // the operator approves, never authors
  expect(t.client.link(challenge)).toBe(`${ORIGIN}/${t.surface.surface.token}/c/${nameOf(challenge.id)}`);
  // Silence and page views are never consent (Rule 98).
  t.tick(120_000); await t.worker.minimal();
  expect(t.journal.view.limits.maxCalls).toBe(1);
  // A decision signed for different bytes (the decline challenge used for approve) is refused.
  const swapped = t.decide(nameOf(challenge.id), 'approve', t.phone, () => b64u(randomBytes(32)));
  expect(swapped.status).toBe(400);
  expect(JSON.parse(swapped.body).error).toContain('client data differs');
  // The operator's genuine passkey yes: recorded on the surface, applied by the runner at its next step.
  const yes = t.decide(nameOf(challenge.id), 'approve');
  expect(yes.status, yes.body).toBe(200);
  await t.worker.minimal();
  expect(t.journal.view.limits.maxCalls).toBe(2);
  expect(t.journal.view.capAuthority).toBe(`verified-approval:${lead.approval!.id}:${challenge.id}`);
  expect(t.journal.view.order[1]!.approval?.verified?.receipt).toMatch(/^sha256:[a-f0-9]{64}$/u);
  await t.worker.drain();
  expect(t.sent).toEqual(['PREVIEW — ordinary answer', 'PREVIEW — ordinary answer']);
  // One use on both sides: the page refuses a second decision, the runner a second consumption.
  expect(JSON.parse(t.decide(nameOf(challenge.id), 'approve').body).error).toMatch(/unknown request|already decided/u);
  const recorded = readFileSync(join(t.store, 'acts', `${nameOf(challenge.id)}.json`), 'utf8');
  expect(t.client.verifier.verify(challenge, recorded, 'approve')).toMatchObject({ kind: 'Refused' });
  await t.worker.minimal();
  expect(t.journal.view.limits.maxCalls).toBe(2);
  t.journal.close();
  expect(openPreviewJournal(join(t.root, 'journal.encrypted'), new Uint8Array(32).fill(7)).view.limits.maxCalls).toBe(2);
});

it('stops from the page with the passkey; a decline or unenrolled key decides nothing', async () => {
  const t = setup();
  t.enrol();
  await t.worker.minimal();
  const stop = t.journal.view.stopChallenges.at(-1)!;
  expect(stop.audience).toBe('independent-emergency-stop');
  const name = nameOf(stop.id);
  // No decline exists for the brake, and a passkey the operator never enrolled is refused.
  expect(JSON.parse(t.decide(name, 'decline').body).error).toBe('decision invalid');
  expect(JSON.parse(t.decide(name, 'approve', authenticator()).body).error).toBe('passkey not enrolled');
  await t.worker.minimal();
  expect(t.journal.view.stop).toBeNull();
  expect(t.decide(name, 'approve').status).toBe(200);
  await t.worker.minimal();
  expect(t.journal.view.stop).toBe('operator');
  expect(() => t.worker.gate()).toThrow('preview stopped');
});

it('refuses a raise the operator declined, and does not re-offer it at the same base', async () => {
  const t = setup();
  t.enrol();
  t.worker.intake([message(1, 'one'), message(2, 'two')]); await t.worker.drain(); await t.worker.minimal();
  const challenge = t.journal.view.order[1]!.approval!.challenge!;
  expect(t.decide(nameOf(challenge.id), 'decline').status).toBe(200);
  await t.worker.minimal();
  expect(t.journal.view.order[1]!.approval?.decision).toBe('declined');
  expect(t.journal.view.limits.maxCalls).toBe(1);
  t.worker.intake([message(3, 'three')]); await t.worker.drain(); await t.worker.minimal();
  expect(t.journal.view.order.filter(turn => turn.approval?.action === 'raise-caps')).toHaveLength(1);
  expect(t.call('GET', '/').body).not.toContain('allowance');
});

it('renders only the fixed raise template, and refuses a request whose wording or subject was altered', async () => {
  const t = setup();
  t.enrol();
  t.worker.intake([message(1, 'one'), message(2, 'two')]); await t.worker.drain(); await t.worker.minimal();
  const challenge = t.journal.view.order[1]!.approval!.challenge!, file = join(t.outbox, `${nameOf(challenge.id)}.request.json`);
  const record = JSON.parse(readFileSync(file, 'utf8'));
  for (const text of ['Approve raising the model call allowance from 1 to 99? That adds 98 model calls I may spend in this trial.',
    '<script>alert(1)</script>']) {
    writeFileSync(file, JSON.stringify({ ...record, text }));
    const page = t.call('GET', `/c/${nameOf(challenge.id)}`);
    expect(page.status).toBe(400);
    expect(page.body).not.toContain('<script>alert');
  }
  writeFileSync(file, JSON.stringify({ ...record, challenge: { ...record.challenge, operator: 'telegram:1' } }));
  expect(JSON.parse(t.call('GET', `/c/${nameOf(challenge.id)}`).body).error).toContain('operator differs');
  expect(t.call('GET', '/').body).not.toContain('allowance');
});

it('refuses weak or foreign passkey evidence: no user verification, another site, another origin', async () => {
  const t = setup();
  for (const device of [authenticator({ rpId: 'evil.example' }), authenticator({ origin: 'https://evil.example' })])
    expect(JSON.parse(t.enrol(device).body).error).toMatch(/names another site|differs from the exact challenge or origin/u);
  t.enrol();
  await t.worker.minimal();
  const name = nameOf(t.journal.view.stopChallenges.at(-1)!.id);
  for (const [override, error] of [[{ flags: 0x01 }, 'user presence and verification required'], [{ rpId: 'evil.example' }, 'names another site'],
    [{ origin: 'https://evil.example' }, 'differs from the exact challenge or origin']] as const) {
    const start = JSON.parse(t.call('POST', '/begin', { name, decision: 'approve' }).body);
    const refused = t.call('POST', '/act', { name, decision: 'approve', nonce: start.nonce,
      assertion: t.phone.get(start.challenge, t.phone.privateKey, override) });
    expect(JSON.parse(refused.body).error).toContain(error);
  }
  await t.worker.minimal();
  expect(t.journal.view.stop).toBeNull();
  // The genuine phone still decides afterwards: refused attempts spent nothing.
  expect(t.decide(name, 'approve').status).toBe(200);
  await t.worker.minimal();
  expect(t.journal.view.stop).toBe('operator');
});

it('the runner never trusts storage it could have written: same identity, a foreign owner, a writable store', async () => {
  const t = setup();
  t.enrol();
  const uid = process.getuid!();
  expect(() => createApprovalSurfaceClient({ store: t.store, outbox: t.outbox, operatorUid: uid, agentUid: uid, now: t.now }))
    .toThrow('another OS identity');
  const foreign = createApprovalSurfaceClient({ store: t.store, outbox: t.outbox, operatorUid: uid + 7, agentUid: uid + 1, now: t.now });
  expect(foreign.status()).toMatchObject({ ready: false, reason: 'surface storage ownership or mode invalid' });
  chmodSync(join(t.store, 'keys.json'), 0o666);
  expect(t.client.status()).toMatchObject({ ready: false, reason: 'surface storage ownership or mode invalid' });
  // A forged act placed where the runner looks is read only through the same ownership check.
  chmodSync(join(t.store, 'keys.json'), 0o644);
  await t.worker.minimal();
  const stop = t.journal.view.stopChallenges.at(-1)!;
  chmodSync(join(t.store, 'acts'), 0o777);
  const forger = authenticator();
  const forged = { type: 'PreviewApprovalActRecord', schemaVersion: 1, challenge: stop, decision: 'approve', nonce: 'x',
    assertion: forger.get(b64u(randomBytes(32))), at: t.now() };
  writeFileSync(join(t.store, 'acts', `${nameOf(stop.id)}.json`), JSON.stringify(forged));
  expect(t.client.acts()).toEqual([]);
  chmodSync(join(t.store, 'acts'), 0o755);
  expect(t.client.acts()).toHaveLength(1);
  await t.worker.minimal();
  expect(t.journal.view.stop).toBeNull(); // the signature is not the operator's enrolled passkey
  expect(readdirSync(t.outbox).some(file => file.endsWith('.consumed'))).toBe(false);
});

it('the surface refuses to run as the agent, without a recorded ingress grant, or on a non-https or local base', () => {
  const t = setup();
  const uid = process.getuid!();
  for (const [change, error] of [[{ agentUid: uid }, 'outside the agent OS identity'], [{ ingressGrant: '  ' }, 'ingress grant'],
    [{ publicBase: 'http://approve.example.org' }, 'public https origin'], [{ publicBase: 'https://localhost' }, 'public https origin'],
    [{ publicBase: 'https://approve.example.org/sub' }, 'public https origin']] as const)
    expect(() => createApprovalSurface({ ...t.config, ...change })).toThrow(error);
  expect(t.call('GET', '/').status).toBe(200);
  expect(handle(t.surface, { method: 'GET', path: '/wrong-token/', body: undefined }).status).toBe(404);
});

it('the live runner installs the surface only with all three arguments, and reports a same-identity store as not ready', () => {
  const t = setup();
  t.enrol();
  const run = (extra: string[]) => spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
    'tests/preview/journal-agent.mjs', 'status', '--root', t.root, ...extra],
  { cwd: process.cwd(), encoding: 'utf8', timeout: 20000, env: { ...process.env,
    INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(new Uint8Array(32).fill(7)).toString('hex') } });
  const partial = run(['--approval-store', t.store]);
  expect(partial.status, partial.stderr).toBe(0);
  expect(JSON.parse(partial.stdout).approvalSurface).toMatchObject({ installed: false, reason: expect.stringContaining('go together') });
  const same = run(['--approval-store', t.store, '--approval-outbox', t.outbox, '--approval-operator-uid', String(process.getuid!())]);
  expect(same.status, same.stderr).toBe(0);
  // The runner's own OS identity can never be the approval surface's administrator.
  expect(JSON.parse(same.stdout).approvalSurface).toMatchObject({ installed: false, reason: 'approval surface must run under another OS identity' });
  const other = run(['--approval-store', t.store, '--approval-outbox', t.outbox, '--approval-operator-uid', String(process.getuid!() + 1)]);
  expect(JSON.parse(other.stdout).approvalSurface).toMatchObject({ installed: true, ready: false, reason: 'surface storage ownership or mode invalid' });
}, 60000);

it('serves the page over its own loopback transport; the page script compiles and the enrolment page needs its token', async () => {
  const t = setup();
  const server = serve(t.surface, 0) as Server;
  cleanup.push(() => server.close());
  await new Promise(done => server.once('listening', done));
  const { address, port } = server.address() as AddressInfo;
  expect(address).toBe('127.0.0.1');
  const token = t.surface.surface.token as string;
  const index = await fetch(`http://127.0.0.1:${port}/${token}/`);
  expect(index.status).toBe(200);
  expect(index.headers.get('cache-control')).toBe('no-store');
  const script = await (await fetch(`http://127.0.0.1:${port}/${token}/app.js`)).text();
  expect(() => new Script(script)).not.toThrow();
  expect((await fetch(`http://127.0.0.1:${port}/`)).status).toBe(404);
  const act = await fetch(`http://127.0.0.1:${port}/${token}/act`, { method: 'POST', body: '{}' });
  expect(act.status).toBe(400);
});
