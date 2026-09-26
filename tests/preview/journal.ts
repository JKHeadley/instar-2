/** The machine-local preview's only conversation and effect ledger. Records are
 * individually authenticated so replay reads the file once at boot; hot turns
 * append one frame and update only the in-memory projection. */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { closeSync, constants, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, writeSync, ftruncateSync, statSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { previewTurnId } from './state.js';
import { redact } from '../../src/recall/redact.js';

export type JournalRecord =
  | { kind: 'genesis'; bot: string; chat: string; operator: string; grant: string; configurationDigest: string; expires: number; maxCalls: number; maxReplies: number; maxTurns: number; maxBytes: number; cursor: number }
  | { kind: 'intake'; id: string; update: number; text: string; raw: string; accepted: boolean; cursor: number; at: number }
  | { kind: 'reserve'; id: string; at: number }
  | { kind: 'answer'; id: string; text: string; at: number }
  | { kind: 'intent'; id: string; text: string; chat: string; update: number; grant: string; at: number }
  | { kind: 'sent'; id: string; message: number; at: number }
  | { kind: 'hold'; id: string; reason: string; at: number }
  | { kind: 'stop'; reason: string; at: number }
  | { kind: 'legacy-call'; at: number }
  | { kind: 'legacy-reply'; at: number }
  | { kind: 'import'; source: string; remainingCalls: number; remainingReplies: number; oldStop: string; at: number }
  | { kind: 'summary-reserve'; through: number; at: number }
  | { kind: 'summary'; through: number; text: string; at: number };

export interface Turn { id: string; update: number; text: string; raw: string; accepted: boolean; answer?: string;
  reserved: boolean; intent?: string; sent?: number; held?: string }
export interface JournalView { genesis: Extract<JournalRecord, {kind:'genesis'}>; cursor: number;
  turns: Map<string, Turn>; order: Turn[]; calls: number; replies: number; stop: string | null;
  summaries: Extract<JournalRecord, {kind:'summary'}>[]; summaryReservations: Set<number>; sourceStop: string | null }

const frameLimit = 2 * 1024 * 1024;
function project(view: JournalView, row: JournalRecord): void {
  if (row.kind === 'genesis') throw Error('preview journal: duplicate genesis');
  if (row.kind === 'intake') {
    const prior = view.turns.get(row.id);
    if (prior) { if (prior.update !== row.update || prior.raw !== row.raw) throw Error('preview journal: update collision'); return; }
    if (view.order.length >= view.genesis.maxTurns) throw Error('preview journal: turn capacity');
    const turn: Turn = { id: row.id, update: row.update, text: row.text, raw: row.raw, accepted: row.accepted, reserved: false };
    view.turns.set(row.id, turn); view.order.push(turn); view.cursor = Math.max(view.cursor, row.cursor); return;
  }
  if (row.kind === 'stop') { view.stop ??= row.reason; return; }
  if (row.kind === 'legacy-call') { view.calls++; return; }
  if (row.kind === 'legacy-reply') { view.replies++; return; }
  if (row.kind === 'import') {
    if (view.calls + row.remainingCalls !== view.genesis.maxCalls
      || view.replies + row.remainingReplies !== view.genesis.maxReplies) throw Error('preview journal: imported counters differ');
    view.sourceStop = row.oldStop; return;
  }
  if (row.kind === 'summary-reserve') {
    if (view.summaryReservations.has(row.through)) throw Error('preview journal: repeated summary reservation');
    view.summaryReservations.add(row.through); view.calls++; return;
  }
  if (row.kind === 'summary') {
    if (!view.summaryReservations.has(row.through) || view.summaries.some(item => item.through === row.through))
      throw Error('preview journal: summary without reservation');
    view.summaries.push(row); return;
  }
  const turn = view.turns.get(row.id);
  if (!turn) throw Error('preview journal: orphan effect');
  if (row.kind === 'reserve') { if (turn.reserved) throw Error('preview journal: repeated reservation'); turn.reserved = true; view.calls++; }
  if (row.kind === 'answer') { if (!turn.reserved || turn.answer !== undefined) throw Error('preview journal: answer order'); turn.answer = row.text; }
  if (row.kind === 'intent') { if (turn.answer === undefined || turn.intent !== undefined || row.chat !== view.genesis.chat || row.update !== turn.update || row.grant !== view.genesis.grant) throw Error('preview journal: intent order'); turn.intent = row.text; view.replies++; }
  if (row.kind === 'sent') { if (turn.intent === undefined || turn.sent !== undefined) throw Error('preview journal: receipt order'); turn.sent = row.message; }
  if (row.kind === 'hold') turn.held = row.reason;
}

export function openPreviewJournal(path: string, key: Uint8Array, initial?: Extract<JournalRecord,{kind:'genesis'}>,
  boundary?: (stage: string) => void) {
  if (resolve(path) !== path || key.byteLength !== 32) throw Error('preview journal: path or key refused');
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  if (realpathSync(dirname(path)) !== dirname(path) || lstatSync(dirname(path)).isSymbolicLink())
    throw Error('preview journal: substituted directory');
  const fresh = !existsSync(path);
  if (fresh && !initial) throw Error('preview journal: identity absent');
  if (!fresh && lstatSync(path).isSymbolicLink()) throw Error('preview journal: substituted file');
  const flags = fresh ? constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | constants.O_NOFOLLOW
    : constants.O_RDWR | constants.O_NOFOLLOW;
  const fd = openSync(path, flags, 0o600);
  if (fresh) { const directory = openSync(dirname(path), 'r'); try { fsyncSync(directory); } finally { closeSync(directory); } }
  let size = statSync(path).size;
  let view: JournalView | undefined;
  const sealed = readFileSync(fd);
  let offset = 0;
  try {
    while (offset < sealed.length) {
      if (sealed.length - offset < 4) break;
      const length = sealed.readUInt32BE(offset);
      if (length < 28 || length > frameLimit) throw Error('preview journal: corrupt frame length');
      if (sealed.length - offset - 4 < length) break;
      const bytes = sealed.subarray(offset + 4, offset + 4 + length);
      const nonce = bytes.subarray(0, 12), tag = bytes.subarray(12, 28), ciphertext = bytes.subarray(28);
      const cipher = createDecipheriv('aes-256-gcm', key, nonce);
      cipher.setAAD(Buffer.from(`preview-journal:${offset}`)); cipher.setAuthTag(tag);
      const row = JSON.parse(Buffer.concat([cipher.update(ciphertext), cipher.final()]).toString('utf8')) as JournalRecord;
      if (!view) {
        if (row.kind !== 'genesis') throw Error('preview journal: genesis missing');
        view = { genesis: row, cursor: row.cursor, turns: new Map(), order: [], calls: 0, replies: 0, stop: null, summaries: [], summaryReservations: new Set(), sourceStop: null };
      } else project(view, row);
      offset += 4 + length;
    }
    if (offset < sealed.length) {
      // Retain the incomplete suffix for diagnosis before removing it from the
      // active append point. It never becomes accepted intake or an effect.
      const tail = `${path}.torn-${String(size)}`;
      const torn = openSync(tail, 'wx', 0o600);
      try { writeSync(torn, sealed.subarray(offset)); fsyncSync(torn); } finally { closeSync(torn); }
      const dir = openSync(dirname(path), 'r'); try { fsyncSync(dir); } finally { closeSync(dir); }
      ftruncateSync(fd, offset); fsyncSync(fd); size = offset;
    }
    // A complete frame left by a process death before its original fsync is
    // made durable before recovery is allowed to consume its causal state.
    fsyncSync(fd);
    const append = (row: JournalRecord) => {
      boundary?.(`before:${row.kind}`);
      const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, nonce);
      cipher.setAAD(Buffer.from(`preview-journal:${size}`));
      const body = Buffer.concat([cipher.update(JSON.stringify(row), 'utf8'), cipher.final()]);
      const bytes = Buffer.concat([nonce, cipher.getAuthTag(), body]);
      if (bytes.length > frameLimit) throw Error('preview journal: record too large');
      const prefix = Buffer.alloc(4); prefix.writeUInt32BE(bytes.length);
      const packet = Buffer.concat([prefix, bytes]);
      let written = 0; while (written < packet.length) written += writeSync(fd, packet, written, packet.length - written, size + written);
      fsyncSync(fd); size += packet.length;
      if (row.kind === 'genesis') {
        if (view) throw Error('preview journal: duplicate genesis');
        view = { genesis: row, cursor: row.cursor, turns: new Map(), order: [], calls: 0, replies: 0, stop: null, summaries: [], summaryReservations: new Set(), sourceStop: null };
      } else project(view!, row);
      boundary?.(`after:${row.kind}`);
    };
    if (!view) {
      if (!initial) throw Error('preview journal: identity absent');
      if (!initial.bot || !initial.chat || !initial.operator || !initial.grant || !initial.configurationDigest
        || !Number.isSafeInteger(initial.expires) || initial.expires <= 0
        || ![initial.maxCalls, initial.maxReplies, initial.maxTurns, initial.maxBytes].every(n => Number.isSafeInteger(n) && n > 0)
        || initial.cursor < 0 || !Number.isSafeInteger(initial.cursor)) throw Error('preview journal: invalid genesis');
      append(initial);
    }
    return { get view() { return view!; }, append, close: () => closeSync(fd) };
  } catch (error) { closeSync(fd); throw error; }
}

export function admittedUpdate(genesis: JournalView['genesis'], update: { update_id: number; message?: { chat?: { id: number; type?: string }; from?: { id: number }; text?: string } }) {
  if (!Number.isSafeInteger(update.update_id) || update.update_id < 0) throw Error('preview journal: malformed update');
  const message = update.message;
  const accepted = message?.chat?.type === 'private' && String(message.chat.id) === genesis.chat
    && String(message.from?.id) === genesis.operator && typeof message.text === 'string';
  return { id: previewTurnId(genesis.bot, update.update_id), accepted, text: accepted ? message!.text! : '' };
}

export interface PreviewPorts {
  now(): number; stopped(): boolean;
  model(input: { question: string; context: string; id: string }): Promise<string>;
  send(input: { text: string; chat: string; update: number }): Promise<number | null>;
  checkOutbound(text: string): void;
  boundary?(stage: string): void;
}

/** Exactly one worker calls drain. A reserved call or prepared send with no
 * durable result is UNKNOWN on restart and never replayed. */
export function createJournalWorker(journal: ReturnType<typeof openPreviewJournal>, ports: PreviewPorts) {
  let working = false;
  const gate = () => { if (journal.view.stop || ports.stopped() || ports.now() >= journal.view.genesis.expires) throw Error('preview stopped'); };
  const intake = (updates: readonly { update_id: number; message?: { chat?: { id: number; type?: string }; from?: { id: number }; text?: string } }[]) => {
    gate();
    for (const update of updates) {
      const parsed = admittedUpdate(journal.view.genesis, update), prior = journal.view.turns.get(parsed.id);
      if (prior) continue;
      const cursor = update.update_id + 1;
      journal.append({ kind: 'intake', id: parsed.id, update: update.update_id, text: parsed.text,
        raw: JSON.stringify(update), accepted: parsed.accepted, cursor, at: ports.now() });
    }
    return journal.view.cursor;
  };
  const packetFor = (through: number, compact: boolean) => {
    const summary = compact ? journal.view.summaries.filter(item => item.through <= through).at(-1) : undefined;
    const earlier = journal.view.order.filter(item => item.update <= through && (!summary || item.update > summary.through));
    const history = earlier.map(item => ({ user: redact(item.text).text,
      answer: item.answer === undefined ? null : redact(item.answer).text,
      outcome: item.sent ? 'Telegram API accepted' : item.intent ? 'delivery UNKNOWN'
        : item.reserved && item.answer === undefined ? 'model UNKNOWN' : item.held ?? 'pending' }));
    const packet = JSON.stringify({ now: ports.now(), purpose: 'Make coherence something an AI cannot lose.',
      capability: 'Private, capped preview; answer only, no tools or other actions.',
      ...(summary ? { summary: { through: summary.through, text: redact(summary.text).text } } : {}), history });
    return packet;
  };
  const contextFor = (turn: Turn) => {
    const full = packetFor(turn.update - 1, false);
    if (Buffer.byteLength(full) <= journal.view.genesis.maxBytes) return full;
    return packetFor(turn.update - 1, true);
  };
  const drain = async () => {
    if (working) throw Error('preview journal: second worker refused');
    working = true;
    try {
      for (const turn of journal.view.order) {
        if (!turn.accepted || turn.held || turn.sent || turn.intent) continue;
        gate();
        if (turn.answer === undefined) {
          if (turn.reserved) continue;
          if (journal.view.calls >= journal.view.genesis.maxCalls) { journal.append({kind:'hold',id:turn.id,reason:'call cap',at:ports.now()}); continue; }
          const context = contextFor(turn), question = redact(turn.text).text;
          if (Buffer.byteLength(context) > journal.view.genesis.maxBytes) { journal.append({kind:'hold',id:turn.id,reason:'context overflow',at:ports.now()}); continue; }
          journal.append({ kind: 'reserve', id: turn.id, at: ports.now() }); gate();
          let answer: string;
          try { answer = await ports.model({ question, context, id: turn.id }); }
          catch { continue; } // reservation remains UNKNOWN
          journal.append({ kind: 'answer', id: turn.id, text: answer, at: ports.now() });
        }
        gate();
        if (journal.view.replies >= journal.view.genesis.maxReplies) { journal.append({kind:'hold',id:turn.id,reason:'reply cap',at:ports.now()}); continue; }
        const reply = `PREVIEW — ${turn.answer!}`;
        if (Buffer.byteLength(reply) > 4096 || Array.from(reply).length > 4096) { journal.append({kind:'hold',id:turn.id,reason:'reply size',at:ports.now()}); continue; }
        try { ports.checkOutbound(reply); }
        catch { journal.append({ kind: 'hold', id: turn.id, reason: 'outbound secret refused', at: ports.now() }); continue; }
        journal.append({ kind: 'intent', id: turn.id, text: reply, chat: journal.view.genesis.chat,
          update: turn.update, grant: journal.view.genesis.grant, at: ports.now() });
        gate();
        try { const message = await ports.send({ text: reply, chat: journal.view.genesis.chat, update: turn.update });
          if (message !== null && Number.isSafeInteger(message) && message > 0)
            journal.append({ kind: 'sent', id: turn.id, message, at: ports.now() });
        } catch { /* exact intent stays UNKNOWN */ }
      }
    } finally { working = false; }
  };
  /** Derived work runs separately after replies. Reservation shares the same
   * attempt cap. If a summary call is uncertain, originals remain and future
   * overflow is a visible hold, never a silent slice. */
  const summarizeIfNeeded = async () => {
    const last = journal.view.order.filter(turn => turn.sent).at(-1);
    if (!last || journal.view.calls >= journal.view.genesis.maxCalls || journal.view.summaryReservations.has(last.update)) return;
    const packet = packetFor(last.update, true);
    const bytes = Buffer.byteLength(packet);
    if (bytes < Math.floor(journal.view.genesis.maxBytes * .7) || bytes > journal.view.genesis.maxBytes) return;
    gate();
    journal.append({kind:'summary-reserve',through:last.update,at:ports.now()});
    let summary: string;
    try { summary = await ports.model({ question: 'Summarize this preview conversation faithfully, preserving earlier facts, commitments and uncertain outcomes.',
      context: packet, id: `summary:${last.update}` }); }
    catch { return; }
    if (Buffer.byteLength(summary) > Math.min(8192, Math.floor(journal.view.genesis.maxBytes / 4))) return;
    journal.append({kind:'summary',through:last.update,text:redact(summary).text,at:ports.now()});
  };
  return { intake, drain, summarizeIfNeeded, gate, stop: (reason: string) => journal.append({kind:'stop', reason, at:ports.now()}) };
}
