import { redact } from '../../src/recall/redact.js';
import { createHash } from 'node:crypto';
import { isoMinute } from '../../src/recall/ground.js';

// Audit the exact packet saved with the last model reservation. This file reads
// the existing projection; it creates no memory store or model/effect path.
export function auditPacket(view, turn, packet, memoryCount = view.memory.length) {
  const items = [], findings = [];
  const fault = (code, at) => findings.push({ code, at });
  const add = (kind, at, chain) => items.push({ kind, at, chain });
  const list = (value, at) => {
    if (value === undefined) return [];
    if (!Array.isArray(value)) { fault('malformed-list', at); return []; }
    return value;
  };
  const source = (id, at) => {
    const found = view.turns.get(id);
    if (!found?.accepted || found.update >= turn.update) { fault('source-turn-absent', at); return null; }
    let sender;
    try { sender = JSON.parse(found.raw)?.message?.from?.id; } catch { /* malformed raw is unverified */ }
    if (String(sender) !== view.genesis.operator) fault('source-sender-unverified', at);
    return found;
  };
  const channel = (id, at) => {
    if (typeof id !== 'string' || !id.startsWith('channel:')) { fault('channel-id-absent', at); return null; }
    const found = view.channelItems.get(id.slice(8));
    if (!found) fault('channel-source-absent', at);
    return found ?? null;
  };
  const speaker = found => {
    let sender;
    try { sender = JSON.parse(found.raw)?.message?.from?.id; } catch { /* invalid raw stays unattributed */ }
    return String(sender) === view.genesis.operator ? 'the operator (verified sender)'
      : `Telegram user ${String(sender)} (authenticated sender, not the operator)`;
  };
  const dated = found => {
    let sent;
    try { sent = JSON.parse(found.raw)?.message?.date; } catch { /* journal retains raw */ }
    const at = typeof sent === 'number' && Number.isSafeInteger(sent) && sent > 0 ? sent * 1000
      : found.at > 0 ? found.at : null;
    return at === null ? 'date unknown' : isoMinute(at);
  };
  const body = value => JSON.stringify(value ?? {});
  const channelRef = id => `sha256:${createHash('sha256').update(id).digest('hex')}`;
  const strings = value => typeof value === 'string' ? [value]
    : Array.isArray(value) ? value.flatMap(strings)
      : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
  const activeChanges = view.memory.slice(0, memoryCount)
    .filter(change => (view.turns.get(change.trigger)?.update ?? Infinity) < turn.update);
  const clean = value => activeChanges.reduce((text, change) => {
    let next = text.replaceAll(change.quote, '[withheld: operator correction or forgetting]');
    for (const passage of change.summaryPassages ?? [])
      next = next.replaceAll(passage, '[withheld: operator correction or forgetting]');
    return next;
  }, redact(value).text);
  const replyFor = found => {
    const sent = found.intent?.replace(/^PREVIEW — /u, '');
    if (found.noticeClass) return clean(sent ?? '');
    if (activeChanges.some(change => change.source === found.id || change.replies?.includes(found.id)))
      return '[withheld: operator correction or forgetting]';
    return clean(sent ?? '');
  };
  const checkReply = (item, found, at) => {
    const expected = found.noticeClass || found.intent === undefined ? null : replyFor(found);
    if (item.answer !== expected) fault('reply-text-source', at);
    const notice = found.noticeClass && found.intent ? replyFor(found) : undefined;
    if (item.notice !== notice) fault('notice-text-source', at);
  };
  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) {
    return { update: turn.update, items, findings: [{ code: 'packet-malformed', at: 'packet' }] };
  }
  const summary = packet.summary;
  if (packet.historyMode === 'summary-plus-recent') {
    const record = view.summaries.find(row => row.through === summary?.through);
    if (!record || record.through >= turn.update) fault('summary-source-absent', 'summary');
    else {
      if (summary.text !== clean(record.text)) fault('summary-text-source', 'summary');
      add('summary', 'summary', [
        { kind: 'summary', through: record.through },
        ...view.order.filter(item => item.accepted && item.update <= record.through)
          .map(item => ({ kind: 'source-turn', id: item.id, update: item.update }))]);
    }
  } else if (packet.historyMode !== 'complete' || summary !== undefined) fault('history-mode-invalid', 'summary');
  if (packet.memorySummary !== undefined) {
    if (summary === undefined || packet.memorySummary?.text !== summary.text) fault('memory-summary-source', 'memorySummary');
    else add('memory-summary', 'memorySummary', [{ kind: 'summary', through: summary.through }]);
  }
  const expected = view.order.filter(item => item.accepted && item.update < turn.update
    && (summary === undefined || item.update > summary.through)).map(item => item.id);
  const history = list(packet.history, 'history');
  if (body(history.map(item => item?.id)) !== body(expected)) fault('history-coverage', 'history');
  for (const [n, item] of history.entries()) {
    const at = `history[${n}]`, found = source(item?.id, at);
    if (found) {
      if (item.user !== clean(found.text)) fault('history-text-source', at);
      checkReply(item, found, at);
      if (item.date !== undefined && item.date !== dated(found)) fault('history-date-source', at);
      if (item.from !== undefined && item.from !== speaker(found)
        || item.from === undefined && speaker(found) !== 'the operator (verified sender)') fault('history-attribution', at);
      add('history-turn', at, [{ kind: 'source-turn', id: found.id, update: found.update }]);
    }
  }
  for (const [n, item] of list(packet.recalled, 'recalled').entries()) {
    const at = `recalled[${n}]`, found = source(item?.id, at);
    if (found) {
      if (item.user !== clean(found.text)) fault('recalled-text-source', at);
      checkReply(item, found, at);
      if (item.date !== dated(found)) fault('recalled-date-source', at);
      add('recalled-turn', at, [{ kind: 'source-turn', id: found.id, update: found.update },
        ...(summary ? [{ kind: 'selected-beside-summary', through: summary.through }] : [])]);
    }
  }
  for (const [n, item] of list(packet.people, 'people').entries()) {
    const at = `people[${n}]`, found = source(item?.source, at);
    if (found && item.from !== speaker(found)) fault('people-attribution', at);
    if (found && item.message !== clean(found.text)) fault('people-message-source', at);
    if (found && item.date !== dated(found)) fault('people-date-source', at);
    const mentions = list(item?.mentions, `${at}.mentions`);
    if (!mentions.length) fault('people-note-absent', at);
    for (const [m, mention] of mentions.entries()) {
      const place = `${at}.mentions[${m}]`;
      if (!found || !view.people.some(note => note.source === found.id && note.name === mention?.person
        && clean(note.quote) === mention?.quote)) fault('people-note-source', place);
      if (found) add('people-note', place, [{ kind: 'source-turn', id: found.id, update: found.update },
        { kind: 'summary-note', through: summary?.through ?? null }]);
    }
  }
  for (const [n, item] of list(packet.commitments, 'commitments').entries()) {
    const at = `commitments[${n}]`, found = source(item?.source, at);
    if (found && item.from !== (item.reply === undefined ? speaker(found) : 'you, in your own earlier reply'))
      fault('commitment-attribution', at);
    if (found && item.date !== dated(found)) fault('commitment-date-source', at);
    if (found && item.message !== undefined && item.message !== clean(found.text)) fault('commitment-message-source', at);
    if (found && item.reply !== undefined && (item.reply !== replyFor(found) || item.answering !== clean(found.text)))
      fault('commitment-reply-source', at);
    for (const [m, note] of list(item?.items, `${at}.items`).entries()) {
      const place = `${at}.items[${m}]`, stored = view.commitments[note?.id];
      if (!found || !stored || stored.source !== found.id || view.closed.has(note.id)
        || note.quote !== clean(stored.quote)) fault('commitment-source', place);
      if (found) add('commitment', place, [{ kind: 'source-turn', id: found.id, update: found.update },
        { kind: 'commitment-note', id: note?.id }]);
    }
  }
  for (const [n, item] of list(packet.channelMemory, 'channelMemory').entries()) {
    const at = `channelMemory[${n}]`, id = `channel:${JSON.stringify([item?.source, item?.account, item?.sourceId])}`;
    const found = channel(id, at);
    if (found && (redact(found.from).text !== item.from || found.at === undefined)) fault('channel-attribution', at);
    if (found && item.quote !== clean(found.text)) fault('channel-text-source', at);
    if (found && (item.date !== isoMinute(found.at)
      || item.subject !== (found.subject === undefined ? undefined : clean(found.subject))
      || item.conversation !== (found.conversation === undefined ? undefined : clean(found.conversation))))
      fault('channel-metadata-source', at);
    if (found) add('channel-import', at, [{ kind: 'channel-import', source: found.source, ref: channelRef(id) }]);
  }
  for (const [n, item] of list(packet.memoryCandidates, 'memoryCandidates').entries()) {
    const at = `memoryCandidates[${n}]`;
    if (item?.id?.startsWith?.('channel:')) {
      const found = channel(item.id, at);
      if (found && item.message !== clean(`${found.subject ?? ''} ${found.text}`).slice(0, 1000)
        && item.message !== clean(`${found.subject ?? ''} ${found.text}`))
        fault('candidate-text-source', at);
      if (found) add('memory-candidate', at, [{ kind: 'channel-import', source: found.source, ref: channelRef(item.id) }]);
    } else {
      const found = source(item?.id, at);
      if (found && item.message !== clean(found.text).slice(0, 1000) && item.message !== clean(found.text))
        fault('candidate-text-source', at);
      if (found) add('memory-candidate', at, [{ kind: 'source-turn', id: found.id, update: found.update }]);
    }
  }
  if (packet.memoryRequest !== undefined) {
    const request = view.turns.get(packet.memoryRequest?.id);
    if (!request?.accepted || request.update > turn.update
      || packet.memoryRequest.message !== clean(request.text)) fault('memory-request-source', 'memoryRequest');
    if (request) add('memory-request', 'memoryRequest', [{ kind: 'operator-turn', id: request.id, update: request.update }]);
  }
  for (const [n, item] of list(packet.openCommitments, 'openCommitments').entries()) {
    const at = `openCommitments[${n}]`, note = view.commitments[item?.id];
    if (!note || view.closed.has(item.id) || note.in !== item.in || clean(note.quote) !== item.quote)
      fault('open-commitment-source', at);
    else add('open-commitment', at, [{ kind: 'source-turn', id: note.source }, { kind: 'commitment-note', id: item.id }]);
  }
  for (const [n, item] of list(packet.memory, 'memory').entries()) {
    const at = `memory[${n}]`, change = view.memory.find(row => row.source === item?.source && row.trigger === item?.trigger);
    if (!change) fault('memory-change-source', at);
    else {
      const trigger = view.turns.get(change.trigger);
      if (!trigger?.accepted) fault('memory-trigger-absent', at);
      if (change.source.startsWith('channel:')) channel(change.source, at);
      else source(change.source, at);
      if (item.mode !== (change.mode === 'forget' ? 'forgotten' : 'corrected')) fault('memory-mode', at);
      add(item.mode, at, [{ kind: change.source.startsWith('channel:') ? 'channel-import' : 'source-turn',
        ...(change.source.startsWith('channel:') ? { ref: channelRef(change.source) } : { id: change.source }) },
        { kind: 'operator-correction', id: change.trigger, update: trigger?.update ?? null }]);
    }
  }
  for (const [n, item] of list(packet.corrections, 'corrections').entries()) {
    const at = `corrections[${n}]`, found = source(item?.source, at);
    if (found) add('reply-check-note', at, [{ kind: 'source-turn', id: found.id, update: found.update }]);
  }
  // Exact clauses are the only claim identity the preview records. Scan the
  // whole memory packet, including candidates and notes, without emitting text.
  const offered = strings(packet);
  const packetMemory = list(packet.memory, 'memory');
  for (const [n, change] of activeChanges.entries()) {
    const trigger = view.turns.get(change.trigger);
    if (!trigger || trigger.update >= turn.update) continue;
    const superseded = change.mode === 'correct' && activeChanges.slice(n + 1)
      .some(next => next.quote.includes(change.replacement));
    if (!superseded && !packetMemory.some(item => item?.source === change.source && item?.trigger === change.trigger))
      fault('memory-change-unrepresented', `memory-change[${n}]`);
    if (offered.some(value => value.includes(change.quote)))
      fault(change.mode === 'forget' ? 'forgotten-reachable' : 'superseded-current', `memory-change[${n}]`);
  }
  for (const [n, note] of view.people.entries()) {
    const found = view.turns.get(note.source);
    let sender;
    try { sender = JSON.parse(found?.raw)?.message?.from?.id; } catch { /* invalid raw stays unattributed */ }
    if (!found?.accepted || String(sender) !== view.genesis.operator
      || !redact(found.text).text.includes(note.quote) || !note.quote.includes(note.name))
      fault('stored-people-note-unattributed', `stored-people[${n}]`);
  }
  return { update: turn.update, items, findings };
}

export function auditJournal(view) {
  const latest = view.lastPrompt;
  if (!latest) return { update: null, modelCall: null, items: [], findings: [] };
  if (!latest.prompt) return { update: latest.kind === 'summary' ? latest.through : view.turns.get(latest.id)?.update ?? null,
    modelCall: latest.kind, items: [], findings: [{ code: 'recorded-prompt-absent', at: 'prompt' }] };
  const turn = latest.kind === 'answer' ? view.turns.get(latest.id)
    : { id: `summary:${latest.through}`, update: latest.through + 1 };
  if (!turn) return { update: null, modelCall: latest.kind, items: [], findings: [{ code: 'source-turn-absent', at: 'prompt' }] };
  let packet, question;
  try {
    const envelope = JSON.parse(latest.prompt);
    packet = JSON.parse(envelope.messages.find(message => message.role === 'context').content).packet;
    question = envelope.messages.find(message => message.role === 'user')?.content;
  }
  catch { return { update: latest.kind === 'summary' ? latest.through : turn.update, modelCall: latest.kind,
    items: [], findings: [{ code: 'recorded-prompt-unreadable', at: 'prompt' }] }; }
  const report = auditPacket(view, turn, packet, latest.memoryCount);
  if (latest.kind === 'answer') {
    if (question !== redact(turn.text).text) report.findings.push({ code: 'current-turn-source', at: 'question' });
    report.items.unshift({ kind: 'current-turn', at: 'question',
      chain: [{ kind: 'source-turn', id: turn.id, update: turn.update }] });
  }
  return { ...report, update: latest.kind === 'summary' ? latest.through : turn.update, modelCall: latest.kind };
}
