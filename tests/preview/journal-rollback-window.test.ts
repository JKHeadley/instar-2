// Rollback is the safety net, and until this unit it cost the operator's conversation: an older build
// REFUSED to start on a root a newer build had used. Rehearsed 2026-10-04 00:03 (cint-L45 writer, cint-L44
// reader) and reproduced here on the real byte shape — the real recorded refusal was
// `preview journal: orphan effect`, raised because `project` read "a frame kind I never heard of" as "an
// effect whose turn is gone". tests/preview/journal-rollback-real-switch.test.ts runs the two real builds
// and records that message; this file proves the window the fix installs, on the same byte shape.
import { expect, it } from 'vitest';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { appendFileSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { durableProjection, JOURNAL_GENERATION, KNOWN_FRAME_KINDS, openPreviewJournal, type JournalRecord } from './journal.js';

const key = new Uint8Array(32).fill(47);
const at = 1790520000000;
const id = (n: number) => `telegram:12345678:update:${n}`;
const genesis = { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'rollback-window', configurationDigest: 'sha256:offline', expires: 1790628000000,
  maxCalls: 16, maxReplies: 16, maxTurns: 20, maxBytes: 32768, cursor: 0 } as const;
const update = (n: number, text: string) => ({ update_id: n, message: { chat: { id: 7654321, type: 'private' },
  from: { id: 7654321 }, text, date: Math.floor(at / 1000) + n } });

/** The real SessionWorkEdge record cint-L45 added and cint-L44 had no branch for — the payload whose kind
 * made the whole root unreadable. Carried here under a kind THIS build has no branch for, which is the
 * same byte shape one generation further on. */
const realSessionWorkEdge = { type: 'SessionWorkEdge', schemaVersion: 1, id: 'edge-1', parent: 'parent-run',
  child: 'child-run', scope: 'one bounded step', owner: 'preview', authority: 'parent grant',
  exitTest: 'child answered', placement: 'local', transport: 'in-process', resultDestination: 'parent',
  budget: { steps: 1, deadline: at + 60_000, tokens: null, calls: 1, maxResultBytes: 4096 }, openedAt: at + 6 };

/** A newer build's own writer: this build cannot `append` a kind it does not project, so the frame is sealed
 * exactly as `frame()` seals one — AES-256-GCM over the JSON, the offset as additional authenticated data. */
function sealFrameAt(path: string, row: unknown): void {
  const offset = statSync(path).size;
  const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(`preview-journal:${offset}`));
  const body = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(row))), cipher.final()]);
  const bytes = Buffer.concat([nonce, cipher.getAuthTag(), body]);
  const prefix = Buffer.alloc(4); prefix.writeUInt32BE(bytes.length);
  appendFileSync(path, Buffer.concat([prefix, bytes]));
}

/** A root this build wrote and answered in, with one later frame a newer build added. */
function seedRoot(directory: string, forward: unknown, compactBytes?: number): string {
  const path = join(directory, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, genesis, undefined, false, compactBytes);
  try {
    const first = update(1, 'Sam keeps the cedar map in the green drawer.');
    journal.append({ kind: 'intake', id: id(1), update: 1, text: first.message.text, raw: JSON.stringify(first),
      accepted: true, cursor: 2, at: at + 1 });
    journal.append({ kind: 'reserve', id: id(1), prompt: 'rollback answer request', at: at + 2 });
    journal.append({ kind: 'answer', id: id(1), text: 'Sam keeps the cedar map in the green drawer.',
      state: 'complete', at: at + 3 });
    journal.append({ kind: 'intent', id: id(1), text: 'PREVIEW — Sam keeps the cedar map in the green drawer.',
      chat: genesis.chat, update: 1, grant: genesis.grant, at: at + 4 });
    journal.append({ kind: 'sent', id: id(1), message: 101, at: at + 5 });
  } finally { journal.close(); }
  if (forward !== undefined) sealFrameAt(path, forward);
  return path;
}
const digestOf = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const temp = () => realpathSync(mkdtempSync(join(tmpdir(), 'rollback-window-')));
/** The frame kind cint-L50 is the newest to carry; one generation on it is a kind this build cannot project. */
const nextKind = 'session-work-v2';

it('opens a root one generation ahead, keeps its conversation, and names the frame it skipped', () => {
  const directory = temp();
  try {
    const path = seedRoot(directory, { kind: nextKind, forward: { generation: JOURNAL_GENERATION + 1, additive: true },
      record: realSessionWorkEdge, at: at + 6 });
    const journal = openPreviewJournal(path, key);
    try {
      // Readable: every turn of the conversation replays, with its answer and its send intact.
      expect(journal.view.order).toHaveLength(1);
      expect(journal.view.order[0]?.answer).toBe('Sam keeps the cedar map in the green drawer.');
      expect(journal.view.order[0]?.sent).toBe(101);
      expect(journal.view.cursor).toBe(2);
      // Rule 2: the skipped frame is named, not dropped in silence.
      expect(journal.view.forwardFrames).toEqual([{ kind: nextKind, generation: JOURNAL_GENERATION + 1, at: at + 6 }]);
      // Runnable, not merely readable: the next turn appends after the frame it could not project.
      const second = update(2, 'And the brass key?');
      journal.append({ kind: 'intake', id: id(2), update: 2, text: second.message.text,
        raw: JSON.stringify(second), accepted: true, cursor: 3, at: at + 7 });
    } finally { journal.close(); }
    const replayed = openPreviewJournal(path, key, undefined, undefined, true);
    try {
      expect(replayed.view.order.map(turn => turn.update)).toEqual([1, 2]);
      expect(replayed.view.forwardFrames.map(frame => frame.kind)).toEqual([nextKind]);
    } finally { replayed.close(); }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

it('refuses a root two generations ahead, and leaves it byte-for-byte as it was', () => {
  const directory = temp();
  try {
    const path = seedRoot(directory, { kind: nextKind, forward: { generation: JOURNAL_GENERATION + 2, additive: true },
      record: realSessionWorkEdge, at: at + 6 });
    const before = digestOf(path);
    expect(() => openPreviewJournal(path, key)).toThrow(
      `preview journal: root generation ${JOURNAL_GENERATION + 2} is more than one build ahead of ${JOURNAL_GENERATION}`);
    expect(digestOf(path)).toBe(before);
    // A writer open must refuse before it can truncate or append to this root either.
    expect(() => openPreviewJournal(path, key, undefined, undefined, false)).toThrow('more than one build ahead');
    expect(digestOf(path)).toBe(before);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

it('refuses an unknown kind that declares nothing — the shape cint-L45 actually wrote', () => {
  const directory = temp();
  try {
    // Byte-for-byte the frame cint-L45 appended: a complete typed record under a kind the reader lacks, with
    // no declaration that skipping it is safe. cint-L44 reported this as `orphan effect`; it is still a
    // refusal, because the frame may be load-bearing, but the reason now names what is actually wrong.
    const path = seedRoot(directory, { kind: nextKind, record: realSessionWorkEdge, at: at + 6 });
    const before = digestOf(path);
    expect(() => openPreviewJournal(path, key)).toThrow(`preview journal: unknown frame kind "${nextKind}"`);
    expect(digestOf(path)).toBe(before);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

it('refuses a declaration that does not assert the frame is additive', () => {
  const directory = temp();
  try {
    const path = seedRoot(directory, { kind: nextKind, forward: { generation: JOURNAL_GENERATION + 1, additive: false },
      record: realSessionWorkEdge, at: at + 6 });
    expect(() => openPreviewJournal(path, key)).toThrow(`preview journal: unknown frame kind "${nextKind}"`);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

it('refuses a generation this build has already reached, because the declaration contradicts itself', () => {
  const directory = temp();
  try {
    const path = seedRoot(directory, { kind: nextKind, forward: { generation: JOURNAL_GENERATION, additive: true },
      record: realSessionWorkEdge, at: at + 6 });
    expect(() => openPreviewJournal(path, key)).toThrow(
      `preview journal: frame kind "${nextKind}" claims generation ${JOURNAL_GENERATION}, which this build is already at`);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

it('will not compact away a forward frame, and still compacts a root without one', () => {
  const directory = temp(), control = temp();
  try {
    // Both roots are written at the ordinary threshold, then reopened under one small enough that the open
    // would compact. Only one carries a frame this build cannot project.
    const path = seedRoot(directory, { kind: nextKind, forward: { generation: JOURNAL_GENERATION + 1, additive: true },
      record: realSessionWorkEdge, at: at + 6 });
    const before = digestOf(path), bytesBefore = statSync(path).size;
    expect(bytesBefore).toBeGreaterThan(512);
    const journal = openPreviewJournal(path, key, undefined, undefined, false, 512);
    try {
      expect(journal.view.forwardFrames).toHaveLength(1);
      expect(digestOf(path)).toBe(before); // the open did not rewrite it
      // An explicit call is refused too: `compact` is handed to every holder, not only the automatic path.
      expect(() => journal.compact()).toThrow('preview journal: compaction refused while a forward frame is present');
      expect(digestOf(path)).toBe(before);
      journal.append({ kind: 'hold', id: id(1), reason: 'reply check unavailable', at: at + 8 });
      expect(statSync(path).size).toBeGreaterThan(bytesBefore); // it kept appending instead
    } finally { journal.close(); }
    // The frame is still there afterwards: nothing silently lost.
    const after = openPreviewJournal(path, key, undefined, undefined, true);
    try { expect(after.view.forwardFrames.map(frame => frame.kind)).toEqual([nextKind]); } finally { after.close(); }

    const controlPath = seedRoot(control, undefined);
    const controlBefore = digestOf(controlPath);
    expect(statSync(controlPath).size).toBeGreaterThan(512);
    const other = openPreviewJournal(controlPath, key, undefined, undefined, false, 512);
    try {
      expect(other.view.forwardFrames).toHaveLength(0);
      expect(digestOf(controlPath)).not.toBe(controlBefore); // the same threshold did compact this one
      expect(other.view.order[0]?.answer).toBe('Sam keeps the cedar map in the green drawer.');
      const compactedOnce = digestOf(controlPath);
      other.compact(); // and an explicit call still compacts a root without one
      expect(digestOf(controlPath)).not.toBe(compactedOnce);
      expect(other.view.order[0]?.answer).toBe('Sam keeps the cedar map in the green drawer.');
    } finally { other.close(); }
  } finally { rmSync(directory, { recursive: true, force: true }); rmSync(control, { recursive: true, force: true }); }
});

it('names every frame kind the union carries, so a new kind cannot slip in unnamed', () => {
  const source = readFileSync(join(process.cwd(), 'tests/preview/journal.ts'), 'utf8');
  const start = source.indexOf('\nexport type JournalRecord =');
  const end = source.indexOf('\n  | SentinelRecord;', start);
  expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
  const union = source.slice(start, end);
  const declared = new Set([...union.matchAll(/kind: '([a-z0-9-]+)'/gu)].map(match => match[1]!));
  // The two union members named by type rather than written inline.
  for (const path of ['tests/preview/model-call-boundary.ts', 'tests/preview/sentinel-record.ts']) {
    const member = readFileSync(join(process.cwd(), path), 'utf8');
    for (const match of member.matchAll(/^export (?:interface|type) \w+\s*(?:=\s*)?\{\s*kind: '([a-z0-9-]+)'/gmu)) declared.add(match[1]!);
  }
  expect([...declared].filter(kind => !KNOWN_FRAME_KINDS.has(kind))).toEqual([]);
  expect([...KNOWN_FRAME_KINDS].filter(kind => !declared.has(kind))).toEqual([]);
});

it('keeps the orphan-effect refusal for a kind it does know whose turn is missing', () => {
  const directory = temp();
  try {
    const path = seedRoot(directory, undefined);
    // `sent` is a kind this build projects; its turn does not exist. That is a genuinely orphan effect and
    // must stay refused under its own name — the window widens nothing for a frame the reader understands.
    sealFrameAt(path, { kind: 'sent', id: id(9), message: 999, at: at + 6 } satisfies JournalRecord);
    expect(() => openPreviewJournal(path, key)).toThrow('preview journal: orphan effect');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

/** A root a newer build COMPACTED before the rollback: genesis, then one snapshot whose retained evidence
 * carries the frame that build added. The saved projection is this build's own, so only the retained row
 * differs between the neighbours — exactly the representation a newer writer's compaction leaves. */
function snapshotRoot(directory: string, forwardRow: unknown): string {
  const seeded = seedRoot(directory, undefined);
  const journal = openPreviewJournal(seeded, key, undefined, undefined, true);
  const saved = { view: durableProjection(journal.view), retained: forwardRow === undefined ? [] : [forwardRow] };
  const stored = journal.view.genesis;
  journal.close(); rmSync(seeded);
  const path = join(directory, 'snapshot.encrypted');
  writeFileSync(path, '');
  const data = Buffer.from(JSON.stringify(saved));
  sealFrameAt(path, stored);
  sealFrameAt(path, { kind: 'snapshot-start', version: 1, chunks: 1, bytes: data.length,
    digest: createHash('sha256').update(data).digest('hex') });
  sealFrameAt(path, { kind: 'snapshot-chunk', data: data.toString('base64') });
  return path;
}

it('admits a snapshot\'s retained frames on the same test a raw frame meets', () => {
  const directory = temp();
  try {
    // Ordinary control: a snapshot with nothing unknown restores whole and reports no forward frame.
    const control = snapshotRoot(directory, undefined);
    const plain = openPreviewJournal(control, key);
    try {
      expect(plain.compacted).toBe(true);
      expect(plain.view.forwardFrames).toEqual([]);
      expect(plain.view.order[0]?.answer).toBe('Sam keeps the cedar map in the green drawer.');
    } finally { plain.close(); }
    rmSync(control);

    // One generation ahead and additive: read, named, and never compacted away.
    const ahead = snapshotRoot(directory, { kind: nextKind, forward: { generation: JOURNAL_GENERATION + 1, additive: true },
      record: realSessionWorkEdge, at: at + 6 });
    const before = digestOf(ahead);
    const journal = openPreviewJournal(ahead, key, undefined, undefined, false, 64);
    try {
      expect(journal.view.forwardFrames).toEqual([{ kind: nextKind, generation: JOURNAL_GENERATION + 1, at: at + 6 }]);
      expect(journal.view.order[0]?.sent).toBe(101);
      expect(digestOf(ahead)).toBe(before);
      expect(() => journal.compact()).toThrow('compaction refused while a forward frame is present');
      expect(digestOf(ahead)).toBe(before);
    } finally { journal.close(); }
    rmSync(ahead);

    // Two generations ahead: refused before any mutation, as a raw frame is.
    const tooNew = snapshotRoot(directory, { kind: nextKind, forward: { generation: JOURNAL_GENERATION + 2, additive: true },
      record: realSessionWorkEdge, at: at + 6 });
    const tooNewBefore = digestOf(tooNew);
    expect(() => openPreviewJournal(tooNew, key)).toThrow('more than one build ahead');
    expect(digestOf(tooNew)).toBe(tooNewBefore);
    rmSync(tooNew);

    // Undeclared: it may be load-bearing, so the snapshot is refused whole.
    const undeclared = snapshotRoot(directory, { kind: nextKind, record: realSessionWorkEdge, at: at + 6 });
    const undeclaredBefore = digestOf(undeclared);
    expect(() => openPreviewJournal(undeclared, key)).toThrow(`preview journal: unknown frame kind "${nextKind}"`);
    expect(digestOf(undeclared)).toBe(undeclaredBefore);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
