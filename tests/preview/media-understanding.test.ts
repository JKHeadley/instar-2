import { expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createSecretCustody, secretRef } from './secret-custody.js';
import { createHostResourceAllocation } from './six-host-resources.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
// @ts-expect-error Host-only JavaScript.
import { withMediaFile, voiceNotice, protectMediaBytes, invokeMediaTurn, openConversationMedia } from './media-understanding.mjs';
// @ts-expect-error Host-only JavaScript.
import { createLocalTranscriber, localMediaCommand } from '../../scripts/local-transcriber.mjs';
// @ts-expect-error Host resource owner.
import { createResourceOwner, RESOURCE_CEILINGS } from '../../scripts/resource-owner.mjs';
// @ts-expect-error Host credential sources.
import { createHeldSecrets, custodyHeldSources } from './tool-turn.mjs';
const fixture = (name: string) => readFileSync(new URL(`./fixtures/media-understanding/${name}`, import.meta.url));

it.each(['photo', 'document'])('confines the %s to a generated private path and removes it on success or throw', async kind => {
  const tmp = mkdtempSync(join(tmpdir(), 'media-path-'));
  try {
    for (const fail of [false, true]) {
      let path = '';
      const task = withMediaFile({ tmp, media: { kind, name: '../../escape.txt' }, saved: { bytes: fixture('shapes.png') }, protect: (bytes: Buffer) => protectMediaBytes(bytes, 'synthetic-image',
        createSecretCustody(tmp, new Uint8Array(32).fill(7), () => 1000), () => ({ values: [], unavailable: null })) }, async (notice: string) => {
        path = JSON.parse(notice.match(/: ("[^"]+")\./u)![1]!);
        expect(path.startsWith(`${tmp}/inbound-media-`)).toBe(true);
        expect(statSync(path).mode & 0o777).toBe(0o600);
        expect(statSync(join(path, '..')).mode & 0o777).toBe(0o700);
        expect(readFileSync(path)).toEqual(fixture('shapes.png'));
        if (fail) throw Error('model failed');
        return 'answer';
      });
      if (fail) await expect(task).rejects.toThrow('model failed'); else expect(await task).toBe('answer');
      expect(existsSync(path)).toBe(false); expect(readdirSync(tmp)).toEqual([]);
    }
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

it('labels local provenance and an unreadable or interrupted recording honestly', () => {
  expect(voiceNotice({ transcription: { state: 'complete', text: 'Tuesday at nine' } })).toContain('transcribed locally');
  for (const state of ['pending', 'failed']) expect(voiceNotice({ transcription: { state } })).toContain('do not invent words');
});

it('enforces output, timeout and stop through the existing resource owner', async () => {
  const resources = createResourceOwner(); await resources.attach();
  const cwd = mkdtempSync(join(tmpdir(), 'media-limits-'));
  try {
    await expect(localMediaCommand(process.execPath, ['-e', 'process.stdout.write("x".repeat(100))'], { resources, cwd, maxBytes: 20 })).rejects.toThrow('output limit');
    await expect(localMediaCommand(process.execPath, ['-e', 'process.exit(0)'], { resources, cwd, stopped: () => true })).rejects.toThrow('stopped');
    await expect(localMediaCommand(process.execPath, ['-e', 'setTimeout(()=>{},10000)'], { resources, cwd, timeout: 100 })).rejects.toThrow('timeout');
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

it('admits a real local decode with Six allocation and refuses capacity before any decoder can spawn', { timeout: 90000 }, async () => {
  const root = mkdtempSync(join(tmpdir(), 'media-allocation-'));
  try {
    const resources = createResourceOwner();
    const allocation = createHostResourceAllocation({ root, machine: 'machine:media-test', ceilings: RESOURCE_CEILINGS,
      incarnation: `test:${process.pid}`, now: () => Date.now(), monotonic: () => performance.now() });
    await resources.attach({ ledgerPath: join(root, 'launches.json'), allocation });
    const transcribe = createLocalTranscriber({ temporary: root,
      run: (command: string, args: string[], options: object) => localMediaCommand(command, args, { ...options, resources }) });
    expect(await transcribe(fixture('meeting.ogg'))).toMatch(/Tuesday.*9|Tuesday.*nine/i);
    expect(resources.snapshot()).toMatchObject({ counters: { admitted: 2 }, active: [],
      lastLaunch: { admission: { work: 'maintenance' }, cleanup: 'verified', allocation: { state: 'returned' } } });
    const marker = join(root, 'must-not-exist');
    const refused = createResourceOwner();
    await refused.attach({ allocation: { reserve: () => ({ ok: false, reason: 'fixture capacity exhausted' }), open: () => [] } });
    await expect(localMediaCommand(process.execPath, ['-e', `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'spawned')`],
      { resources: refused, cwd: root, timeout: 1 })).rejects.toThrow('capacity');
    expect(existsSync(marker)).toBe(false);
    expect(refused.snapshot().counters.admitted).toBe(0);
    expect(refused.snapshot().allocation.lastRefusal).toBe('fixture capacity exhausted');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it.each([false, true])('protects the actual admitted Read boundary before model consumption (credential document=%s)', async secret => {
  const root = mkdtempSync(join(tmpdir(), 'media-custody-'));
  const canary = 'sk-' + 'SYNTHETICCANARYONLY'.repeat(3), heldValue = 'synthetic-held-value';
  try {
    for (const name of ['tmp', 'ws', 'state', 'vault-root']) mkdirSync(join(root, name));
    const custody = createSecretCustody(join(root, 'vault-root'), new Uint8Array(32).fill(9), () => 1000);
    const held = createHeldSecrets({ ...custodyHeldSources(custody, () => ({})), host: () => [heldValue] });
    writeFileSync(join(root, 'state/config.json'), JSON.stringify({ workspace: join(root, 'ws'), tmp: join(root, 'tmp'),
      maxCalls: 5, maxWriteBytes: 1048576, operations: [] }));
    const original = Buffer.from(secret ? `Café notes\napi_key=${canary}\nExisting login: ${heldValue}` : 'Café notes: meeting Tuesday at nine.');
    const hook = join(process.cwd(), 'tests/preview/tool-admission-hook.mjs');
    const id = 'telegram:synthetic:update:1';
    await invokeMediaTurn(id, { scratch: root }, (source: string) => {
      expect(source).toBe(id); return { media: { kind: 'document', name: 'credentials.txt' }, saved: { bytes: original } };
    }, async (notice: string) => {
      const file = JSON.parse(notice.match(/: ("[^"]+")\./u)![1]!);
      const call = { tool_name: 'Read', tool_input: { file_path: file }, tool_use_id: 'synthetic-read' };
      const pre = spawnSync(process.execPath, [hook, 'pre', join(root, 'state')], { input: JSON.stringify(call), encoding: 'utf8' });
      expect(pre.status, pre.stderr).toBe(0);
      const contents = readFileSync(file, 'utf8');
      expect(contents).toContain('Café notes');
      if (secret) {
        expect(contents).not.toContain(canary); expect(contents).not.toContain(heldValue);
        expect(contents).toContain('SecretRef preview/'); expect(contents).toContain('[redacted credential]');
        const record = custody.records()[0]!;
        expect(custody.resolve(secretRef(record.name))).toBe(canary);
        expect(original.toString()).toContain(canary); // authoritative source remains untouched
      } else expect(contents).toBe(original.toString());
      const post = spawnSync(process.execPath, [hook, 'post', join(root, 'state')], {
        input: JSON.stringify({ ...call, tool_response: { type: 'text', file: { content: contents } } }), encoding: 'utf8' });
      expect(post.status, post.stderr).toBe(0);
      const log = readFileSync(join(root, 'state/admission.jsonl'), 'utf8');
      expect(log).not.toContain(canary); expect(log).not.toContain(heldValue);
    }, (bytes: Buffer, source: string) => protectMediaBytes(bytes, source, custody, held));
    expect(readdirSync(join(root, 'tmp'))).toEqual([]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('withholds only the attachment when custody or the held set cannot be read', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'media-failed-custody-'));
  try {
    for (const failure of ['custody', 'held', 'missing-port']) {
      const protect = failure === 'missing-port' ? undefined : (bytes: Buffer) => protectMediaBytes(bytes, 'source',
        { custody: ({ text }: { text: string }) => ({ text, ...(failure === 'custody' ? { custody: { state: 'failed' } } : {}) }) },
        () => ({ values: [], unavailable: failure === 'held' ? ['vault'] : null }));
      await withMediaFile({ tmp, media: { kind: 'document', name: 'a.txt' }, saved: { bytes: Buffer.from('safe') }, protect }, async (notice: string) => {
        expect(notice).toContain('could not be read'); expect(readdirSync(tmp)).toEqual([]);
      });
    }
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

it('rejects empty/overlong audio and removes decoded plaintext after a transcriber failure', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'media-transcriber-'));
  const model = join(tmp, 'model'); writeFileSync(model, 'fixture');
  try {
    for (const length of [0, 300 * 32000 + 2]) {
      const transcribe = createLocalTranscriber({ model, temporary: tmp, run: async () => Buffer.alloc(length) });
      await expect(transcribe(Buffer.from('OggS'))).rejects.toThrow('duration refused');
    }
    let wav = '';
    const transcribe = createLocalTranscriber({ model, temporary: tmp, run: async (name: string, args: string[]) => {
      if (name === 'ffmpeg') return Buffer.alloc(32000);
      wav = args[args.indexOf('-f') + 1]!;
      expect(statSync(wav).mode & 0o777).toBe(0o600); throw Error('unreadable');
    } });
    await expect(transcribe(Buffer.from('OggS'))).rejects.toThrow('unreadable');
    expect(existsSync(wav)).toBe(false); expect(readdirSync(tmp)).toEqual(['model']);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

it('replays the real confined harness outputs from the synthetic-media proof', async () => {
  const { parseModelJson, conclusionText } = await import('./model-json.js');
  for (const [name, expected] of [['image', /green.*circle/is], ['voice', /Tuesday.*9/is], ['unreadable', /can.t|unreadable|corrupt/i]] as const) {
    const row = JSON.parse(fixture(`recorded/${name}.json`).toString('utf8')) as { answer: string; state: string; provenance: string };
    expect(row.state).toBe('complete'); expect(row.provenance).toContain('real Claude Code');
    expect(conclusionText(parseModelJson(row.answer))).toMatch(expected);
  }
});

it('replays captured summary, uncertain/undecided Jev, review and delivered/empty shapes through the protected attachment boundary', async () => {
  const capture = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as {
    otherShapes: { kind: string; id: string; raw: string }[] };
  const root = mkdtempSync(join(tmpdir(), 'media-recorded-'));
  try {
    mkdirSync(join(root, 'tmp'));
    const custody = createSecretCustody(root, new Uint8Array(32).fill(8), () => 1000);
    const kinds: string[] = [];
    for (const row of capture.otherShapes) {
      await invokeMediaTurn(row.id, { scratch: root }, () => ({ media: { kind: 'document', name: 'recorded.txt' },
        saved: { bytes: Buffer.from(row.raw) } }), async (notice: string) => {
        const path = JSON.parse(notice.match(/: ("[^"]+")\./u)![1]!);
        expect(readFileSync(path, 'utf8'), `${row.kind} ${row.id}`).toBe(row.raw);
        kinds.push(row.kind);
      }, (bytes: Buffer, source: string) => protectMediaBytes(bytes, source, custody, () => ({ values: [], unavailable: null })));
    }
    expect(kinds).toEqual(['summary-writer', 'summary-uncertain', 'jev-undecided', 'jev-unsure', 'reply-review', 'delivered-reply', 'empty-reply-in-recorded-context']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});


it('replays walk update 715676899 with protected readable bytes on the continuing-session bridge', async () => {
  const capture = JSON.parse(readFileSync(new URL('./fixtures/gap-image-1017.json', import.meta.url), 'utf8'));
  const tmp = mkdtempSync(join(tmpdir(), 'conversation-media-replay-'));
  try {
    const custody = createSecretCustody(tmp, new Uint8Array(32).fill(7), () => 1000);
    const second = `${capture.updateId}:format-retry`;
    const opened = await openConversationMedia({ tmp, scope: 'topic-4', operations: [capture.updateId, second, 'summary:unrelated'],
      lookup: (id: string) => id === capture.updateId ? { media: { kind: 'photo', name: 'screenshot.png' }, saved: { bytes: fixture('shapes.png') } } : null,
      protect: (bytes: Buffer, source: string) => protectMediaBytes(bytes, source, custody, () => ({ values: [], unavailable: null })) });
    expect(opened.notices['summary:unrelated']).toBeUndefined();
    const paths = [capture.updateId, second].map(id => JSON.parse(opened.notices[id].match(/: ("[^"]+")\./u)[1]));
    expect(paths[0]).not.toBe(paths[1]);
    for (const path of paths) expect(readFileSync(path)).toEqual(fixture('shapes.png'));
    const { conversationSessionAnswer } = await import('./conversation-session-answer.js');
    const old = conversationSessionAnswer({ state: 'complete', text: capture.native.input.content, detail: 'recorded', edge: 'recorded', child: 'recorded' }, capture.updateId, () => {});
    expect(old).toMatchObject({ state: 'complete' });
    expect(JSON.stringify(old)).toContain('no image-reading capability');
    expect(opened.notices[capture.updateId]).toContain('Read this file');
    opened.close();
    for (const path of paths) expect(existsSync(path)).toBe(false);
    // Real historical refusal is retained as a refusal to claim vision, never rewritten into a successful proof.
    expect(capture.delivered).toContain("contents haven't actually been read");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

it('keeps the conversation alive with an honest notice when attachment custody fails', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'conversation-media-refused-'));
  try {
    for (const lookup of [() => { throw Error('custody unavailable'); }, () => ({ media: { kind: 'photo' }, saved: { bytes: Buffer.from('x') } })]) {
      const opened = await openConversationMedia({ tmp, scope: 'topic-4', operations: ['photo'], lookup, protect: () => { throw Error('held secrets unavailable'); } });
      expect(opened.notices.photo).toContain('could not be read');
      opened.close(); expect(readdirSync(tmp)).toEqual([]);
    }
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

it('sweeps only a finished topic’s crash residue and preserves a concurrent topic’s attachment', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'conversation-media-topics-'));
  const lookup = () => ({ media: { kind: 'photo' }, saved: { bytes: fixture('shapes.png') } });
  const protect = (bytes: Buffer) => bytes;
  const pathOf = (opened: { notices: Record<string, string> }) => JSON.parse(opened.notices.photo!.match(/: ("[^"]+")\./u)![1]!);
  try {
    const a = await openConversationMedia({ tmp, scope: 'a', operations: ['photo'], lookup, protect });
    const b = await openConversationMedia({ tmp, scope: 'b', operations: ['photo'], lookup, protect });
    const replacement = await openConversationMedia({ tmp, scope: 'a', operations: ['photo'], lookup, protect });
    expect(existsSync(pathOf(a))).toBe(false);
    expect(readFileSync(pathOf(b))).toEqual(fixture('shapes.png'));
    expect(readFileSync(pathOf(replacement))).toEqual(fixture('shapes.png'));
    a.close(); b.close(); replacement.close(); expect(readdirSync(tmp)).toEqual([]);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

it('runs the shipped host callback and admits its protected image through the real file hook', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'host-session-media-'));
  try {
    mkdirSync(join(tmp, '.tmp')); mkdirSync(join(tmp, 'state'));
    const host = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
    const expression = host.split('prepareInputFiles: ')[1]!.split(',\n          currentActionFacts:')[0]!;
    const custody = createSecretCustody(tmp, new Uint8Array(32).fill(5), () => 1000);
    const prepare = Function('join', 'openConversationMedia', 'project', 'topic', 'currentMedia', 'protectMediaBytes', 'custody', 'heldSecrets', 'stoppedNow',
      `return (${expression});`)(join, openConversationMedia, tmp, '4', () => ({ media: { kind: 'photo' }, saved: { bytes: fixture('shapes.png') } }),
      protectMediaBytes, custody, () => ({ values: [], unavailable: null }), () => false);
    const opened = await prepare(['telegram:8994258214:update:715676899']);
    const notice = opened.notices['telegram:8994258214:update:715676899'];
    const path = JSON.parse(notice.match(/: ("[^"]+")\./u)[1]);
    writeFileSync(join(tmp, 'state/config.json'), JSON.stringify({ workspace: tmp, tmp: join(tmp, '.tmp'), maxCalls: 5, maxWriteBytes: 1048576, operations: [] }));
    const pre = spawnSync(process.execPath, [join(process.cwd(), 'tests/preview/tool-admission-hook.mjs'), 'pre', join(tmp, 'state')], {
      input: JSON.stringify({ tool_name: 'Read', tool_input: { file_path: path }, tool_use_id: 'read-attached-photo' }), encoding: 'utf8' });
    expect(pre.status, pre.stderr).toBe(0);
    expect(readFileSync(path)).toEqual(fixture('shapes.png'));
    opened.close(); expect(existsSync(path)).toBe(false);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
