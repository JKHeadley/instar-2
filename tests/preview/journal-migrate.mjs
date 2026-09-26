#!/usr/bin/env node
/** One-use, read-only old-root export and conservative new-root import. The
 * export is encrypted under the preview storage key; the source is never
 * opened as a writer or changed. Desk runs this only after stopping the old
 * poller. Unknown old effects become permanent journal fences. */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { openPreviewJournal, PREVIEW_LIVE_LIMITS } from './journal.js';
import { durablePreviewWrite } from './state.js';
import { openProductionStorage } from '../../src/assembly/production-storage.js';
import { productionStorageIO } from '../../scripts/production-boot-io.mjs';

const args = values => { const [command, ...rest] = values, options = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (!rest[i]?.startsWith('--') || rest[i + 1] === undefined) throw Error('migration arguments malformed');
    options[rest[i].slice(2)] = rest[i + 1];
  } return { command, options }; };
const need = (o, n) => { if (!o[n]) throw Error(`migration missing --${n}`); return o[n]; };
const key = () => { const value = process.env.INSTAR_SECRET_PREVIEW_STORAGE_KEY;
  if (!value) throw Error('migration storage key absent');
  const bytes = Buffer.from(value, /^[a-f0-9]{64}$/iu.test(value) ? 'hex' : 'base64');
  if (bytes.length !== 32) throw Error('migration storage key invalid'); return bytes; };
const hash = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const context = { site: 'preview.journal', preserved: 'preview:migrate', register: {
  generation: { owner: 'part-three', name: 'RegisterGeneration', id: 'preview:register' },
  entries: ['preview.journal'], producers: ['host'], methods: [], actions: {}, subjects: {},
  sites: { 'preview.journal': 'closed' }, keys: {}, allowRedelegation: false,
  conflictStanding: { ordinary: 'delegate', authority: 'operator' } }, captures: {} };

function unseal(path, keyBytes, name) {
  if (lstatSync(path).isSymbolicLink()) throw Error('migration source symlink refused');
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const cipher = createDecipheriv('aes-256-gcm', keyBytes, Buffer.from(raw.nonce, 'hex'));
  cipher.setAAD(Buffer.from(`machine-a:store:fact:${name}`)); cipher.setAuthTag(Buffer.from(raw.tag, 'hex'));
  return JSON.parse(Buffer.concat([cipher.update(Buffer.from(raw.ciphertext, 'base64')), cipher.final()]).toString('utf8'));
}
function capture(rows, ref) {
  const bytes = rows[ref?.reference];
  if (typeof bytes !== 'string' || hash(bytes) !== ref.hash) throw Error('migration cited capture missing or changed');
  return bytes;
}
function readOnlyRoot(path) {
  const root = resolve(path);
  if (root !== path || realpathSync(root) !== root || lstatSync(root).isSymbolicLink()) throw Error('migration root not canonical');
  if (!existsSync(join(root, 'preview-stop.json'))) throw Error('migration old trial is not stopped');
  const lease = join(root, '.successive', '.boot-lease', 'owner.json');
  if (existsSync(lease)) {
    const owner = JSON.parse(readFileSync(lease, 'utf8'));
    if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0) throw Error('migration old lease malformed');
    try { process.kill(owner.pid, 0); throw Error('migration old poller is live'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  return root;
}
function exportOld(root, input) {
  const old = readOnlyRoot(root), state = JSON.parse(readFileSync(join(old, 'preview-state.json'), 'utf8'));
  const sidecar = JSON.parse(readFileSync(join(old, 'successive-state.json'), 'utf8'));
  if (state.stop === null && !existsSync(join(old, 'preview-stop.json'))) throw Error('migration stop absent');
  const source = join(old, '.successive');
  const facts = unseal(join(source, 'facts.encrypted'), input.key, 'facts').map(bytes => JSON.parse(bytes));
  const captures = unseal(join(source, 'captures.encrypted'), input.key, 'captures');
  const body = fact => fact?.body?.record ?? fact?.body;
  const targetBindings = facts.filter(fact => fact.kind === 'conversation-binding'
    && body(fact).grantId === 'successive-target-grant').map(body);
  if (targetBindings.length !== 1
    || targetBindings[0].channel !== `telegram:v1:bot:${input.bot}:chat:${input.chat}:direct`
    || targetBindings[0].sender !== `telegram:v1:user:${input.operator}`
    || targetBindings[0].principalId !== `telegram:v1:user:${input.operator}`
    || state.trial.hostNotice?.botId !== input.bot || state.trial.hostNotice?.chatId !== input.chat
    || input.chat !== input.operator) throw Error('migration bound audience differs');
  const accepted = facts.filter(fact => fact.kind === 'intake-admitted')
    .map(fact => ({ fact, record: body(fact) }))
    .filter(row => row.record.binding !== 'none' && row.record.channel?.endsWith(':direct'));
  const receipts = facts.filter(fact => fact.kind === 'intake-receipt');
  const admittedByReceipt = new Map(accepted.map(row => [row.record.receipt, row.fact.id]));
  const turns = receipts.map(receipt => {
    const raw = capture(captures, body(receipt).capture), update = JSON.parse(raw);
    if (!Number.isSafeInteger(update.update_id) || update.update_id < 0) throw Error('migration update id malformed');
    const admitted = admittedByReceipt.get(receipt.id) ?? null;
    return { update: update.update_id, raw, admitted, text: update.message?.text ?? '', accepted: admitted !== null,
      answer: null, intent: null, sent: null, reserved: false };
  }).sort((a,b) => a.update - b.update);
  const byFact = new Map(turns.filter(turn => turn.admitted).map(turn => [turn.admitted, turn]));
  const attempts = new Set();
  for (const fact of facts.filter(fact => fact.kind === 'judgment-provider-ProviderJudgmentAttemptRecord'
    || fact.kind === 'effect-provider-ProviderEffectRequest')) {
    const record = body(fact);
    if (fact.kind === 'judgment-provider-ProviderJudgmentAttemptRecord' && record.phase !== 'prepared') continue;
    if (typeof record.attempt !== 'string' || !record.attempt.startsWith('attempt:boot-question:')) continue;
    attempts.add(record.attempt);
    const turn = byFact.get(String(record.attempt).replace(/^attempt:boot-question:/, '').replace(/:\d+$/, ''));
    if (turn) turn.reserved = true;
  }
  for (const fact of facts.filter(fact => fact.kind === 'judgment-provider-ProviderAnswerAcceptance')) {
    const record = body(fact), turn = byFact.get(String(record.request).replace(/^boot-question:/, ''));
    if (!turn) throw Error('migration accepted answer lacks intake');
    const decision = JSON.parse(capture(captures, record.capture));
    if (decision.conclusion?.subject !== 'preview-stage2-answer' || typeof decision.conclusion.value !== 'string')
      throw Error('migration accepted answer malformed');
    turn.reserved = true; turn.answer = decision.conclusion.value;
  }
  const outbound = facts.filter(fact => fact.kind === 'effect-OutboundMessage' && body(fact).purpose === 'ordinary-reply');
  const messages = new Map();
  for (const fact of outbound) {
    const record = body(fact), turn = byFact.get(String(record.id).replace(/^serving-telegram-reply:/, ''));
    if (!turn) throw Error('migration reply lacks intake');
    if (typeof record.text !== 'string' || !record.text.startsWith('PREVIEW')) throw Error('migration reply malformed');
    // A durable outbound message may not have reached dispatch. Fencing it is
    // conservative; desk can reconcile it without risking a duplicate.
    turn.intent = record.text;
    if (turn.answer === null) { turn.answer = record.text.split('\n').slice(1).join('\n'); turn.reserved = true; }
    messages.set(record.id, turn);
  }
  const requests = new Map(facts.filter(fact => fact.kind === 'effect-EffectRequest').map(fact => [body(fact).id, body(fact)]));
  for (const fact of facts.filter(fact => fact.kind === 'effect-OperationObservation' && body(fact).stage === 'response')) {
    const record = body(fact), request = requests.get(record.request), turn = messages.get(request?.message);
    if (!turn) continue;
    const observed = JSON.parse(capture(captures, record.capture));
    const message = observed.result;
    if (observed.ok === true && String(message?.chat?.id) === input.chat
      && message?.text === turn.intent && Number.isSafeInteger(message.message_id) && message.message_id > 0)
      turn.sent = message.message_id;
  }
  const bot = input.bot, chat = input.chat, operator = input.operator;
  for (const turn of turns.filter(turn => turn.accepted)) {
    const update = JSON.parse(turn.raw);
    if (String(update.message?.chat?.id) !== chat || String(update.message?.from?.id) !== operator)
      throw Error('migration bound audience differs');
  }
  if (!Number.isSafeInteger(sidecar.cursor) || !Number.isSafeInteger(state.trial.expiresAt)
    || sidecar.cursor < Math.max(0, ...turns.map(turn => turn.update + 1))) throw Error('migration cursor or expiry malformed');
  const reserved = turns.filter(turn => turn.reserved).length;
  return { version: 1, sourceRoot: old,
    source: hash(JSON.stringify({ root: old, trial: state.trial.id, cursor: sidecar.cursor, turns: turns.length })),
    genesis: { kind: 'genesis', bot, chat, operator, grant: state.trial.id,
      configurationDigest: state.trial.configurationDigest, expires: state.trial.expiresAt,
      maxCalls: input.maxCalls, maxReplies: input.maxReplies,
      maxTurns: Math.max(turns.length, Math.min(PREVIEW_LIVE_LIMITS.turns, state.trial.maxTrialTurns)),
      maxBytes: input.maxBytes, cursor: 0, importCursor: sidecar.cursor },
    priorCalls: Math.max(0, attempts.size - reserved),
    priorReplies: Math.max(0, state.replyWindow.count - turns.filter(turn => turn.intent).length),
    remainingCalls: Math.max(0, input.maxCalls - attempts.size),
    remainingReplies: Math.max(0, input.maxReplies - Math.max(state.replyWindow.count, turns.filter(turn => turn.intent).length)),
    oldStop: state.stop ?? JSON.parse(readFileSync(join(old, 'preview-stop.json'), 'utf8')),
    turns };
}
function writeExport(path, manifest, keyBytes) {
  const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', keyBytes, nonce);
  cipher.setAAD(Buffer.from('preview-export-v1'));
  const bytes = Buffer.concat([cipher.update(JSON.stringify(manifest)), cipher.final()]);
  const fd = openSync(path, 'wx', 0o600);
  try { writeFileSync(fd, JSON.stringify({ version: 1, nonce: nonce.toString('hex'), tag: cipher.getAuthTag().toString('hex'), bytes: bytes.toString('base64') })); fsyncSync(fd); }
  finally { closeSync(fd); }
  const directory = openSync(dirname(path), 'r'); try { fsyncSync(directory); } finally { closeSync(directory); }
}
function readExport(path, keyBytes) {
  if (lstatSync(path).isSymbolicLink()) throw Error('migration export symlink refused');
  const record = JSON.parse(readFileSync(path, 'utf8'));
  if (record.version !== 1) throw Error('migration export version');
  const cipher = createDecipheriv('aes-256-gcm', keyBytes, Buffer.from(record.nonce, 'hex'));
  cipher.setAAD(Buffer.from('preview-export-v1')); cipher.setAuthTag(Buffer.from(record.tag, 'hex'));
  return JSON.parse(Buffer.concat([cipher.update(Buffer.from(record.bytes, 'base64')), cipher.final()]).toString());
}
function importNew(root, manifest, keyBytes) {
  const path = resolve(root);
  if (path !== root) throw Error('migration target not canonical');
  if (typeof manifest.sourceRoot !== 'string' || resolve(manifest.sourceRoot) !== manifest.sourceRoot
    || realpathSync(manifest.sourceRoot) !== manifest.sourceRoot
    || manifest.source !== hash(JSON.stringify({ root: manifest.sourceRoot, trial: manifest.genesis.grant,
      cursor: manifest.genesis.importCursor, turns: manifest.turns.length }))) throw Error('migration lineage malformed');
  if (existsSync(path) && realpathSync(path) !== path) throw Error('migration target substituted');
  if (existsSync(path) && readdirSync(path).length) throw Error('migration target is not empty');
  // The claim is keyed by source lineage, outside the unchanged old root and
  // independent of the export filename. A crash retains its destination fence.
  const claimPath = join(dirname(manifest.sourceRoot), `.preview-lineage-${manifest.source.slice(7)}.json`);
  const claim = openSync(claimPath, 'wx', 0o600);
  try { writeFileSync(claim, JSON.stringify({ source: manifest.source, destination: path })); fsyncSync(claim); }
  finally { closeSync(claim); }
  const claimDir = openSync(dirname(claimPath), 'r'); try { fsyncSync(claimDir); } finally { closeSync(claimDir); }
  mkdirSync(path, { mode: 0o700, recursive: true });
  durablePreviewWrite(join(path, 'preview-import.json'), { version: 1, source: manifest.source });
  const leaseResult = openProductionStorage({ root: join(path, '.writer'), machine: 'preview-local-machine',
    key: keyBytes, policy: 'preview-journal', store: 'preview-journal', context, io: productionStorageIO });
  if (leaseResult.kind !== 'Success') throw Error('migration second writer refused');
  const lease = leaseResult.value;
  let journal;
  try {
    journal = openPreviewJournal(join(path, 'journal.encrypted'), keyBytes,
      { ...manifest.genesis, importSource: manifest.source }, stage => {
        if (stage === process.env.INSTAR_PREVIEW_IMPORT_KILL_AT) process.kill(process.pid, 'SIGKILL');
      });
    for (const turn of manifest.turns) {
      const id = `telegram:${manifest.genesis.bot}:update:${turn.update}`;
      journal.append({ kind: 'intake', id, update: turn.update, text: turn.text, raw: turn.raw,
        accepted: turn.accepted, cursor: 0, at: 0 });
      if (turn.reserved) journal.append({ kind: 'reserve', id, at: 0 });
      if (turn.answer !== null) journal.append({ kind: 'answer', id, text: turn.answer, at: 0 });
      if (turn.intent !== null) journal.append({ kind: 'intent', id, text: turn.intent, chat: manifest.genesis.chat,
        update: turn.update, grant: manifest.genesis.grant, at: 0 });
      if (turn.sent !== null) journal.append({ kind: 'sent', id, message: turn.sent, at: 0 });
    }
    for (let i = 0; i < manifest.priorCalls; i++) journal.append({kind:'legacy-call',at:0});
    for (let i = 0; i < manifest.priorReplies; i++) journal.append({kind:'legacy-reply',at:0});
    if (journal.view.calls > manifest.genesis.maxCalls || journal.view.replies > manifest.genesis.maxReplies)
      throw Error('migration counters exceed cap');
    journal.append({kind:'import',source:manifest.source,remainingCalls:manifest.remainingCalls,
      remainingReplies:manifest.remainingReplies,oldStop:manifest.oldStop.reason,at:0});
  } finally { journal?.close(); lease.close(); }
}

try {
  const { command, options } = args(process.argv.slice(2)), keyBytes = key();
  if (command === 'export') {
    const maxCalls = Number(options['max-calls'] ?? 16), maxReplies = Number(options['max-replies'] ?? 16);
    const maxBytes = Number(options['max-context-bytes'] ?? 32768);
    if (![maxCalls,maxReplies,maxBytes].every(value => Number.isSafeInteger(value) && value > 0)
      || maxCalls > PREVIEW_LIVE_LIMITS.calls || maxReplies > PREVIEW_LIVE_LIMITS.replies
      || maxBytes > PREVIEW_LIVE_LIMITS.contextBytes) throw Error('migration allowance outside approved bound');
    const manifest = exportOld(need(options, 'old-root'), { key: keyBytes, bot: need(options, 'bot-id'),
      chat: need(options, 'chat-id'), operator: need(options, 'operator-sender-id'),
      maxCalls, maxReplies, maxBytes });
    writeExport(need(options, 'export-file'), manifest, keyBytes);
  } else if (command === 'import') importNew(need(options, 'new-root'), readExport(need(options, 'export-file'), keyBytes), keyBytes);
  else throw Error('migration command unknown');
} catch { process.stderr.write('preview migration refused; details suppressed\n'); process.exitCode = 1; }
