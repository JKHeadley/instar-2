import { redact } from '../../src/recall/redact.js';
import { createHash } from 'node:crypto';
import { isoMinute } from '../../src/recall/ground.js';
import { statedFacts } from './memory-sentinel.js';
import { activePersonMerges } from './journal.js';

// Audit the exact packet saved with the last model reservation. This file reads
// the existing projection; it creates no memory store or model/effect path.
export function auditPacket(view, turn, packet, memoryCount = view.memory.length,
  summaryCount = view.summaries.length, closedCount = view.closed.size) {
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
  const publicSource = id => typeof id === 'string' && id.startsWith('channel:')
    ? `channel-ref:${createHash('sha256').update(id).digest('hex')}` : id;
  const channel = (id, at) => {
    if (typeof id !== 'string' || !(id.startsWith('channel:') || id.startsWith('channel-ref:'))) {
      fault('channel-id-absent', at); return null;
    }
    const found = id.startsWith('channel-ref:')
      ? [...view.channelItems.entries()].find(([key]) => publicSource(`channel:${key}`) === id)?.[1]
      : view.channelItems.get(id.slice(8));
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
  const recordedSummaries = view.summaries.slice(0, summaryCount);
  const closedAtReservation = new Set([...view.closed.keys()].slice(0, closedCount));
  const preferenceKeys = new Set(activeChanges.filter(change => change.mode === 'prefer')
    .map(change => JSON.stringify([change.source, change.quote])));
  const clean = value => activeChanges.filter(change => change.mode !== 'prefer'
    && !preferenceKeys.has(JSON.stringify([change.source, change.quote]))).reduce((text, change) => {
    let next = text.replaceAll(change.quote, '[withheld: operator correction or forgetting]');
    for (const passage of change.summaryPassages ?? [])
      next = next.replaceAll(passage, '[withheld: operator correction or forgetting]');
    return next;
  }, redact(value).text);
  const metadata = value => activeChanges.filter(change => change.mode !== 'prefer')
    .flatMap(change => statedFacts(change.quote).map(fact => fact.value))
    .filter(value => value.length >= 4)
    .reduce((text, term) => text.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'giu'),
      '[withheld: operator correction or forgetting]'), clean(value));
  const replyFor = found => {
    const sent = found.intent?.replace(/^PREVIEW — /u, '');
    if (found.noticeClass) return clean(sent ?? '');
    if (activeChanges.some(change => change.mode !== 'prefer' && (change.source === found.id || change.replies?.includes(found.id))))
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
    const record = recordedSummaries.find(row => row.through === summary?.through);
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
    const record = recordedSummaries.at(-1);
    if (!record || packet.memorySummary?.text !== clean(record.text)) fault('memory-summary-source', 'memorySummary');
    else add('memory-summary', 'memorySummary', [{ kind: 'summary', through: record.through }]);
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
    const at = `people[${n}]`;
    if (typeof item?.sourceId === 'string' && item.sourceId.startsWith('channel-ref:')) {
      const imported = [...view.channelItems.values()].find(candidate => {
        const id = `channel:${JSON.stringify([candidate.source, candidate.account, candidate.id])}`;
        return `channel-ref:${createHash('sha256').update(id).digest('hex')}` === item.sourceId;
      });
      if (!imported || item.source !== imported.source || item.date !== isoMinute(imported.at)
        || item.from !== `${metadata(imported.from)} (export sender metadata, unverified)`
        || item.message !== clean(`${imported.subject ?? ''} ${imported.text}`.trim())) fault('people-import-source', at);
      for (const [m, mention] of list(item?.mentions, `${at}.mentions`).entries()) {
        if (!imported || mention?.quote !== clean(`${imported.subject ?? ''} ${imported.text}`.trim()))
          fault('people-note-source', `${at}.mentions[${m}]`);
      }
      if (imported) add('people-note', at, [{ kind: 'channel-import', source: imported.source,
        ref: `sha256:${createHash('sha256').update(JSON.stringify([imported.source, imported.account, imported.id])).digest('hex')}` }]);
      continue;
    }
    const found = source(item?.source, at);
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
    const at = `channelMemory[${n}]`;
    const displayedId = `channel:${JSON.stringify([item?.source, item?.account, item?.sourceId])}`;
    const found = channel(item?.sourceRef ?? displayedId, at);
    if (found) {
      const rawId = `channel:${JSON.stringify([found.source, found.account, found.id])}`;
      const needsRef = metadata(found.account) !== found.account
        || metadata(found.id) !== found.id;
      if (item.sourceRef !== (needsRef ? publicSource(rawId) : undefined)) fault('channel-reference-source', at);
      if (metadata(found.account) !== item.account || metadata(found.id) !== item.sourceId
        || metadata(found.from) !== item.from || found.at === undefined) fault('channel-attribution', at);
      if (item.quote !== clean(found.text)) fault('channel-text-source', at);
      if (item.date !== isoMinute(found.at)
        || item.subject !== (found.subject === undefined ? undefined : metadata(found.subject))
        || item.conversation !== (found.conversation === undefined ? undefined : metadata(found.conversation)))
        fault('channel-metadata-source', at);
      add('channel-import', at, [{ kind: 'channel-import', source: found.source, ref: channelRef(rawId) }]);
    }
  }
  for (const [n, item] of list(packet.memoryCandidates, 'memoryCandidates').entries()) {
    const at = `memoryCandidates[${n}]`;
    if ((item?.id?.startsWith?.('channel:') || item?.id?.startsWith?.('channel-ref:'))) {
      const found = channel(item.id, at);
      if (found && item.message !== clean(`${found.subject ?? ''} ${found.text}`).slice(0, 1000)
        && item.message !== clean(`${found.subject ?? ''} ${found.text}`))
        fault('candidate-text-source', at);
      if (found && item.reply !== '') fault('candidate-reply-source', at);
      if (found) add('memory-candidate', at, [{ kind: 'channel-import', source: found.source, ref: channelRef(item.id) }]);
    } else {
      const found = source(item?.id, at);
      if (found && item.message !== clean(found.text).slice(0, 1000) && item.message !== clean(found.text))
        fault('candidate-text-source', at);
      const preference = found && activeChanges.some(change => change.mode === 'prefer'
        && change.source === found.id && change.quote === item.message);
      if (found && item.reply !== (preference ? '' : replyFor(found).slice(0, 1000))
        && item.reply !== (preference ? '' : replyFor(found))) fault('candidate-reply-source', at);
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
    if (!note || closedAtReservation.has(item.id) || note.in !== item.in || clean(note.quote) !== item.quote)
      fault('open-commitment-source', at);
    else add('open-commitment', at, [{ kind: 'source-turn', id: note.source }, { kind: 'commitment-note', id: item.id }]);
  }
  for (const [n, item] of list(packet.memory, 'memory').entries()) {
    const at = `memory[${n}]`, change = activeChanges.find(row => publicSource(row.source) === item?.source && row.trigger === item?.trigger);
    if (!change || change.mode === 'prefer') fault('memory-change-source', at);
    else {
      const trigger = view.turns.get(change.trigger);
      if (!trigger?.accepted) fault('memory-trigger-absent', at);
      if (change.source.startsWith('channel:')) channel(change.source, at);
      else source(change.source, at);
      if (item.mode !== (change.mode === 'forget' ? 'forgotten' : 'corrected')) fault('memory-mode', at);
      if (item.replacement !== (change.mode === 'correct' ? clean(change.replacement ?? '') : undefined))
        fault('memory-replacement-source', at);
      add(item.mode, at, [{ kind: change.source.startsWith('channel:') ? 'channel-import' : 'source-turn',
        ...(change.source.startsWith('channel:') ? { ref: channelRef(change.source) } : { id: change.source }) },
        { kind: 'operator-correction', id: change.trigger, update: trigger?.update ?? null }]);
    }
  }
  for (const [n, item] of list(packet.corrections, 'corrections').entries()) {
    const at = `corrections[${n}]`, found = source(item?.source, at);
    if (found) add('reply-check-note', at, [{ kind: 'source-turn', id: found.id, update: found.update }]);
  }
  const activePreferences = new Map();
  for (const change of activeChanges) {
    const key = JSON.stringify([change.source, change.quote]);
    if (change.mode === 'prefer') activePreferences.set(key, { source: change.source, quote: change.quote });
    else if (activePreferences.delete(key) && change.mode === 'correct') activePreferences.set(
      JSON.stringify([change.trigger, change.replacement]), { source: change.trigger, quote: change.replacement });
  }
  const expectedPreferences = [...activePreferences.values()].map(item => ({ text: clean(item.quote), source: item.source }));
  const packetPreferences = list(packet.preferences, 'preferences');
  if (packetPreferences.length !== expectedPreferences.length || packetPreferences.some((item, n) =>
    item?.source !== expectedPreferences[n].source || item?.text !== expectedPreferences[n].text))
    fault('preference-source', 'preferences');
  for (const [n, item] of packetPreferences.entries()) {
    if (expectedPreferences.some(expected => expected.source === item?.source && expected.text === item?.text))
      add('preference', `preferences[${n}]`, [{ kind: 'operator-turn', id: item.source }]);
  }
  // Exact clauses are the only claim identity the preview records. Scan the
  // whole memory packet, including candidates and notes, without emitting text.
  const offered = strings(packet);
  const packetMemory = list(packet.memory, 'memory');
  for (const [n, change] of activeChanges.entries()) {
    const trigger = view.turns.get(change.trigger);
    if (!trigger || trigger.update >= turn.update || change.mode === 'prefer') continue;
    const superseded = change.mode === 'correct' && activeChanges.slice(n + 1)
      .some(next => next.quote.includes(change.replacement));
    if (!superseded && !packetMemory.some(item => item?.source === publicSource(change.source) && item?.trigger === change.trigger))
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
  const memory = auditActiveMemory(view);
  const latest = view.lastPrompt;
  if (!latest) return { update: null, modelCall: null, ...memory };
  if (!latest.prompt) return { update: latest.kind === 'summary' ? latest.through : view.turns.get(latest.id)?.update ?? null,
    modelCall: latest.kind, items: memory.items, findings: [...memory.findings, { code: 'recorded-prompt-absent', at: 'prompt' }] };
  const turn = latest.kind === 'answer' ? view.turns.get(latest.id)
    : { id: `summary:${latest.through}`, update: latest.through + 1 };
  if (!turn) return { update: null, modelCall: latest.kind, items: memory.items, findings: [...memory.findings, { code: 'source-turn-absent', at: 'prompt' }] };
  let packet, question;
  try {
    const envelope = JSON.parse(latest.prompt);
    packet = JSON.parse(envelope.messages.find(message => message.role === 'context').content).packet;
    question = envelope.messages.find(message => message.role === 'user')?.content;
  }
  catch { return { update: latest.kind === 'summary' ? latest.through : turn.update, modelCall: latest.kind,
    items: memory.items, findings: [...memory.findings, { code: 'recorded-prompt-unreadable', at: 'prompt' }] }; }
  const report = auditPacket(view, turn, packet, latest.memoryCount, latest.summaryCount, latest.closedCount);
  if (latest.kind === 'answer') {
    if (question !== redact(turn.text).text) report.findings.push({ code: 'current-turn-source', at: 'question' });
    report.items.unshift({ kind: 'current-turn', at: 'question',
      chain: [{ kind: 'source-turn', id: turn.id, update: turn.update }] });
  }
  return { ...report, items: [...memory.items, ...report.items], findings: [...memory.findings, ...report.findings],
    update: latest.kind === 'summary' ? latest.through : turn.update, modelCall: latest.kind };
}

/** Trace the entire active projection, including items outside the latest fitted packet.
 * The authenticated journal proves lineage; it cannot prove a summary's semantics. */
export function auditActiveMemory(view) {
  const items = [], findings = [];
  const fault = (code, at) => findings.push({ code, at });
  const add = (kind, at, chain) => items.push({ kind, at, chain });
  const operator = (id, at) => {
    const turn = view.turns.get(id);
    let raw;
    try { raw = JSON.parse(turn?.raw); } catch { /* missing authenticated envelope */ }
    if (!turn?.accepted || raw?.update_id !== turn.update || raw?.message?.chat?.type !== 'private'
      || String(raw?.message?.from?.id) !== view.genesis.operator
      || String(raw?.message?.chat?.id) !== view.genesis.chat
      || raw?.message?.text !== turn.text) {
      fault('memory-operator-source-absent', at); return null;
    }
    return { kind: 'operator-turn', id, update: turn.update };
  };
  const imported = (id, at) => {
    if (typeof id !== 'string' || !id.startsWith('channel:')) {
      fault('memory-import-source-absent', at); return null;
    }
    const found = view.channelItems.get(id.slice(8));
    if (!found || !['email', 'conversation'].includes(found.source)
      || !found.account || !found.id || !found.from || !Number.isSafeInteger(found.at)
      || typeof found.text !== 'string'
      || JSON.stringify([found.source, found.account, found.id]) !== id.slice(8)) {
      fault('memory-import-source-absent', at); return null;
    }
    return { kind: 'approved-import', ref: `sha256:${createHash('sha256').update(id).digest('hex')}` };
  };
  const origin = (id, at) => typeof id === 'string' && id.startsWith('channel:')
    ? imported(id, at) : operator(id, at);
  const active = (source, quote) => !view.memory.some(change => change.mode !== 'prefer'
    && change.source === source && (quote.includes(change.quote) || change.quote.includes(quote)));
  for (const [id, item] of view.channelItems) {
    const at = `stored-import[${items.length}]`, link = imported(`channel:${id}`, at);
    if (link) add('channel-import', at, [link]);
  }
  for (const [n, note] of view.people.entries()) {
    if (!active(note.source, note.quote)) continue;
    const at = `stored-people[${n}]`, link = operator(note.source, at);
    if (!link || !redact(view.turns.get(note.source).text).text.includes(note.quote) || !note.quote.includes(note.name))
      fault('stored-people-note-unattributed', at);
    else add('people-note', at, [link]);
  }
  for (const [n, merge] of activePersonMerges(view).entries()) {
    const at = `person-merge[${n}]`, trigger = operator(merge.trigger, at);
    const left = view.people[merge.left], right = view.people[merge.right];
    const first = left && operator(left.source, at), second = right && operator(right.source, at);
    if (!trigger || !first || !second || !view.turns.get(merge.trigger).text.includes(merge.confirmation))
      fault('person-merge-unattributed', at);
    else add('person-merge', at, [first, second, trigger]);
  }
  for (const [n, note] of view.commitments.entries()) {
    if (view.closed.has(n) || !active(note.source, note.quote)) continue;
    const at = `commitment[${n}]`, link = operator(note.source, at);
    const turn = view.turns.get(note.source);
    if (!link || note.in === 'message' && !redact(turn.text).text.includes(note.quote)
      || note.in === 'reply' && !redact(turn.intent?.replace(/^PREVIEW — /u, '') ?? '').text.includes(note.quote))
      fault('commitment-unattributed', at);
    else {
      const chain = [link];
      for (const extra of note.sources ?? []) {
        const source = operator(extra.source, at);
        if (!source || !redact(view.turns.get(extra.source).text).text.includes(extra.quote)) fault('commitment-merge-unattributed', at);
        else chain.push(source);
      }
      add('commitment', at, chain);
    }
  }
  for (const [n, change] of view.memory.entries()) {
    const at = `memory-change[${n}]`, source = origin(change.source, at), trigger = operator(change.trigger, at);
    const importedItem = change.source.startsWith('channel:') ? view.channelItems.get(change.source.slice(8)) : undefined;
    const original = importedItem ? `${importedItem.subject ?? ''} ${importedItem.text}`.trim()
      : view.turns.get(change.source)?.text;
    const replyLinks = (change.replies ?? []).map(id => {
      const link = operator(id, at), reply = view.turns.get(id);
      if (!link || !reply?.intent || !trigger || reply.update >= trigger.update)
        fault('memory-reply-source-absent', at);
      return link;
    }).filter(Boolean);
    const passageLinks = (change.summaryPassages ?? []).map(passage => {
      const summary = view.summaries.find(row => row.at < view.turns.get(change.trigger)?.at
        && row.text.includes(passage));
      if (!summary) fault('memory-summary-passage-absent', at);
      return summary && { kind: 'summary', through: summary.through };
    }).filter(Boolean);
    if (!source || !trigger || typeof change.quote !== 'string' || !redact(original ?? '').text.includes(change.quote)
      || change.mode !== 'prefer' && (change.source.startsWith('channel:')
        ? view.channelItems.get(change.source.slice(8)).at >= view.turns.get(change.trigger).at
        : view.turns.get(change.source).update >= view.turns.get(change.trigger).update)
      || change.mode === 'correct' && (!change.replacement
        || !redact(view.turns.get(change.trigger).text).text.includes(change.replacement))
      || change.mode === 'prefer' && change.trigger !== change.source)
      fault('memory-change-unattributed', at);
    else add(change.mode === 'prefer' ? 'preference' : change.mode === 'forget' ? 'forgetting' : 'correction', at,
      [source, trigger, ...replyLinks, ...passageLinks]);
  }
  for (const [n, item] of view.dated.entries()) {
    if (!active(item.source, item.quote)) continue;
    const at = `dated[${n}]`, link = operator(item.source, at);
    const message = view.turns.get(item.source)?.text;
    if (!link || !message.includes(item.quote) || !item.quote.includes(item.when)) fault('dated-unattributed', at);
    else add('dated', at, [link]);
  }
  for (const [n, item] of view.questions.entries()) {
    if (!active(item.source, item.quote)) continue;
    const at = `question[${n}]`, link = operator(item.source, at);
    if (!link || !redact(view.turns.get(item.source).text).text.includes(item.quote)) fault('question-unattributed', at);
    else add('open-question', at, [link]);
  }
  const summary = view.summaries.at(-1);
  if (summary) {
    const at = 'active-summary', covered = view.order.filter(turn => turn.accepted && turn.update <= summary.through);
    const chain = covered
      .map(turn => operator(turn.id, at)).filter(Boolean);
    for (const id of view.channelItems.keys()) {
      if (view.channelItems.get(id).at > summary.at) continue;
      const link = imported(`channel:${id}`, at);
      if (link) chain.push(link);
    }
    if (!covered.length || !covered.some(turn => turn.update === summary.through)
      || chain.filter(link => link.kind === 'operator-turn').length !== covered.length)
      fault('summary-unattributed', at);
    else add('summary', at, [{ kind: 'summary', through: summary.through }, ...chain]);
  }
  return { items, findings };
}
