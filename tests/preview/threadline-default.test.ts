import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, realpathSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync, sign } from 'node:crypto';
import { createSecretCustody } from './secret-custody.js';
import { validateSessionWorkRow, openPreviewJournal } from './journal.js';
import type { SessionWorkEffect } from '../../src/assembly/production-session-work.js';
// @ts-expect-error installed host composition
import { createThreadlineRuntime, admitThreadline, THREADLINE_LOSS_MODEL } from '../../scripts/threadline-runtime.mjs';
// @ts-expect-error normal checkpoint
import { createAdmissionGate, createToolEffectOwner } from './admission-gate.mjs';
// @ts-expect-error normal effect policy consumer
import { admitToolCallEffect } from './tool-admission.mjs';
// @ts-expect-error normal connector composition
import { prepareSessionConnectors } from './session-connectors.mjs';
// @ts-expect-error installer
import { runOnboarding } from '../../scripts/onboarding.mjs';
// @ts-expect-error root connector reader
import { readRootMcp, createHeldSecrets, custodyHeldSources, heldVerdict } from './tool-turn.mjs';
// @ts-expect-error installer-side signed enrollment
import { installThreadlineBinding } from '../../scripts/threadline-setup.mjs';
import { spawn } from 'node:child_process';
const cleanup: (() => Promise<void> | void)[] = [];
afterEach(async () => { for (const stop of cleanup.splice(0).reverse()) await stop(); });
async function pair() {
  const owner = generateKeyPairSync('ed25519');
  const installs = [];
  for (let n = 0; n < 2; n++) {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'threadline-default-'))); cleanup.push(() => rmSync(root, { recursive: true, force: true }));
    const answers = ['assist the team', 'trusted', '0', 'none'];
    expect(await runOnboarding(root, { read: async () => answers.shift(), write: () => {} }, 'owner')).toBe(0);
    let stop = false;
    const rows: SessionWorkEffect[] = [];
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), Buffer.alloc(32, n + 1), {
      kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
      expires: 9999999999999, maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 262144, cursor: 0 });
    cleanup.push(() => journal.close());
    const append = (row: SessionWorkEffect) => { validateSessionWorkRow(row); journal.append({ kind: 'session-work', record: row, at: 1000 }); rows.push(row); };
    const custody = createSecretCustody(root, Buffer.alloc(32, n + 1), () => 1000);
    custody.store({ value: 'secret-value-1234567890', kind: 'test-secret', source: 'test installation' });
    const held = heldVerdict(createHeldSecrets(custodyHeldSources(custody, () => ({}))));
    let replicating = true;
    const runtimeOptions = { root, custody, storageKey: Buffer.alloc(32, n + 1), records: () => journal.threadlineRecords(), now: () => 1000, stopped: () => stop,
      held, append, recorded: (id: string) => (journal.view.toolEffects ?? []).includes(id), replicate: async () => replicating };
    const runtime = createThreadlineRuntime(runtimeOptions);
    const effects = createToolEffectOwner({ append, stopped: () => stop, now: () => 1000, prepared: (id: string) => (journal.view.toolEffects ?? []).includes(id),
      decide: (tool: string, input: unknown, parent: unknown) => admitThreadline(runtime, tool, input, parent, { effectPolicy: JSON.parse(readFileSync(join(root, 'effect-policy.json'), 'utf8')), operations: [] }, admitToolCallEffect, 1000) });
    const gate = await createAdmissionGate({ append, effects, threadline: runtime, stopped: () => stop, now: () => 1000,
      held }); cleanup.push(() => gate.stop());
    const edge = { id: `edge-${n}`, parent: 'root', child: `claim-${n}`, topic: 'main', budget: { deadline: 10000 } };
    gate.open(`claim-${n}`, { framework: 'claude-code', allowance: 20, edge });
    const connectors = await prepareSessionConnectors({ mcp: readRootMcp(root), privateDirectory: root, identity: null, check: () => 'clear',
      threadline: (id: string, tool: string, input: unknown) => gate.threadline(`claim-${n}`, id, tool, input) }); cleanup.push(() => connectors.close());
    const launch = connectors.launch().launch.threadline;
    const child = spawn(launch.command, launch.args, { stdio: ['pipe', 'pipe', 'pipe'] });
    cleanup.push(async () => { if (child.exitCode === null) { child.stdin.end(); await new Promise(resolve => child.once('exit', resolve)); } });
    let pending = '', serial = 0;
    const waits = new Map<number, (row: { result: { content: { text: string }[] } }) => void>();
    child.stdout.on('data', data => { pending += data; let end; while ((end = pending.indexOf('\n')) >= 0) {
      const row = JSON.parse(pending.slice(0, end)); pending = pending.slice(end + 1); waits.get(row.id)?.(row);
    } });
    const call = (name: string, args: unknown) => new Promise<unknown>((resolve, reject) => {
      const id = ++serial, timer = setTimeout(() => reject(Error('MCP reply timeout')), 5000);
      waits.set(id, row => { clearTimeout(timer); resolve(JSON.parse(row.result.content[0]!.text)); });
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } })}\n`);
    });
    installs.push({ root, runtime, runtimeOptions, setReplication: (ok: boolean) => { replicating = ok; }, rows, journal, call, gate, edge, effects, setStop: () => { stop = true; } });
  }
  for (const [index, current] of installs.entries()) {
    const other = installs[1 - index]!;
    const record = { version: 1, principal: current.runtime.publicRecord.principal, owner: 'owner', withdrawn: false, expiresAt: 10000,
      durability: { demand: 'local-durable', causalPrefix: 'full', lossModel: THREADLINE_LOSS_MODEL },
      peers: [{ ...other.runtime.publicRecord, owner: 'owner', topic: 'main', conversation: 'private-team-conversation' }] };
    installThreadlineBinding(current.root, { owner: { id: 'owner', publicKey: owner.publicKey.export({ format: 'pem', type: 'spki' }).toString() },
      signed: { record, signature: sign(null, Buffer.from(JSON.stringify(record)), owner.privateKey).toString('base64') } }, 1000);
  }
  return installs;
}
it('two freshly set up installations exchange a message and reply through real MCP and normal checkpoint once', async () => {
  const [a, b] = await pair();
  const first = { peer: b!.runtime.publicRecord.principal, request: 'one', message: 'Hello peer' };
  expect(await a!.call('threadline_send', first)).toMatchObject({ status: 'accepted-by-transport' });
  expect(await b!.call('threadline_receive', { peer: a!.runtime.publicRecord.principal, request: 'read-one' })).toMatchObject({ status: 'received', messages: [{ message: 'Hello peer', authority: 'peer-data-only' }] });
  expect(await b!.call('threadline_send', { peer: a!.runtime.publicRecord.principal, request: 'reply', message: 'Hello back' })).toMatchObject({ status: 'accepted-by-transport' });
  expect(await a!.call('threadline_receive', { peer: b!.runtime.publicRecord.principal, request: 'read-reply' })).toMatchObject({ status: 'received', messages: [{ message: 'Hello back' }] });
  expect(await a!.call('threadline_status', { peer: b!.runtime.publicRecord.principal, request: 'one' })).toMatchObject({ status: 'durably-queued', receipt: { witness: { kind: 'custodian', principal: b!.runtime.publicRecord.principal } } });
  const count = readdirSync(join(b!.root, 'threadline/inbox')).length;
  expect(await a!.call('threadline_send', first)).toMatchObject({ status: 'refused' });
  expect(readdirSync(join(b!.root, 'threadline/inbox')).length).toBe(count);
  for (const install of [a!, b!]) expect(install.rows.filter(row => row.operation === 'threadline:receive')).toHaveLength(1);
}, 20000);
it('unknown peer, private topic, held secret, stop and unsigned team edits refuse before delivery', async () => {
  const [a, b] = await pair();
  const input = { peer: b!.runtime.publicRecord.principal, request: 'test', message: 'hello' };
  expect(await a!.call('threadline_send', { ...input, peer: 'unknown' })).toMatchObject({ status: 'refused' });
  expect(await a!.call('threadline_send', { ...input, message: 'secret-value-1234567890' })).toMatchObject({ status: 'refused' });
  expect(await a!.runtime.exchange('threadline_send', input, { ...a!.edge, topic: '2' })).toMatchObject({ status: 'refused' });
  const path = join(a!.root, 'threadline-team.json'), original = readFileSync(path, 'utf8');
  writeFileSync(path, original.replace('main', '2'));
  expect(await a!.call('threadline_send', input)).toMatchObject({ status: 'refused' });
  writeFileSync(path, original); a!.setStop();
  expect(await a!.call('threadline_send', input)).toMatchObject({ status: 'refused' });
  expect(readdirSync(join(b!.root, 'threadline/inbox'))).toHaveLength(0);
  expect(JSON.stringify(a!.rows)).not.toContain('secret-value-1234567890');
}, 20000);

it('replays recorded model shapes as peer data and refuses the recorded empty candidate without granting authority', async () => {
  const [a, b] = await pair();
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8'));
  for (const [index, shape] of fixture.otherShapes.entries()) {
    const result = await a!.call('threadline_send', { peer: b!.runtime.publicRecord.principal, request: `capture-${index}`, message: shape.raw });
    expect(result).toMatchObject({ status: shape.raw ? 'accepted-by-transport' : 'refused' });
  }
  const answer = await b!.call('threadline_receive', { peer: a!.runtime.publicRecord.principal, request: 'captures' }) as { messages: { message: string; authority: string }[] };
  expect(answer.messages.map(row => row.message).sort()).toEqual(fixture.otherShapes.filter((shape: { raw: string }) => shape.raw).map((shape: { raw: string }) => shape.raw).sort());
  expect(answer.messages.every(row => row.authority === 'peer-data-only')).toBe(true);
  expect(b!.journal.view.capAuthority).toBeNull(); expect(b!.journal.view.operatorRequests).toEqual([]);
}, 30000);
it('keeps identity and never-twice evidence through restart/compaction and refuses replica loss before sending', async () => {
  const [a, b] = await pair();
  const input = { peer: b!.runtime.publicRecord.principal, request: 'retained', message: 'kept across restart' };
  expect(await a!.call('threadline_send', input)).toMatchObject({ status: 'accepted-by-transport' });
  a!.journal.compact();
  const restarted = createThreadlineRuntime(a!.runtimeOptions);
  expect(restarted.publicRecord.principal).toBe(a!.runtime.publicRecord.principal);
  const before = readdirSync(join(b!.root, 'threadline/inbox')).filter(name => JSON.parse(readFileSync(join(b!.root, 'threadline/inbox', name), 'utf8')).kind === 'envelope');
  expect(await restarted.exchange('threadline_send', input, { ...a!.edge, child: 'replacement' })).toMatchObject({ status: 'already-prepared' });
  expect(readdirSync(join(b!.root, 'threadline/inbox')).filter(name => JSON.parse(readFileSync(join(b!.root, 'threadline/inbox', name), 'utf8')).kind === 'envelope')).toEqual(before);
  a!.setReplication(false);
  expect(await a!.call('threadline_send', { ...input, request: 'replica-lost' })).toMatchObject({ status: 'uncertain' });
  expect(readdirSync(join(b!.root, 'threadline/inbox')).filter(name => JSON.parse(readFileSync(join(b!.root, 'threadline/inbox', name), 'utf8')).kind === 'envelope')).toEqual(before);
}, 30000);
