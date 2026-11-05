// Carryover row 03: the shipped host's binding of the carried revival queue's attention and audit
// ports. Notices: ONE aggregated attention surface (Rules 52/87/88). Each raised notice is persisted
// in a bounded host-owned sidecar and rides its own topic's next answer as one infrastructure line
// through the existing reply-notice funnel, whose consumed keys dedupe it across restart; the
// drainer's durable markers already prevent a repeat raise. Audit: every decision transition is
// appended, scrubbed, to an append-only host log. Neither path sends anything by itself.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { durablePreviewWrite } from './durable-write.js';
import { openReplyNotices } from './credential-reminders.js';
import { appendLine } from './self-state.js';

export const REVIVAL_NOTICE_LIMIT = 64;
const topicPattern = /^(?:main|[1-9][0-9]{0,15})$/u;
const kindPattern = /^[a-z][a-z-]{0,40}$/u;
const valid = row => row && typeof row === 'object' && typeof row.key === 'string' && typeof row.line === 'string'
  && typeof row.topic === 'string' && Number.isSafeInteger(row.at);

/** The persisted notices; a missing or unreadable sidecar offers nothing and is rewritten on the next raise. */
export function readRevivalNotices(path) {
  try {
    const saved = JSON.parse(readFileSync(path, 'utf8'));
    return saved?.version === 1 && Array.isArray(saved.notices) ? saved.notices.filter(valid) : [];
  } catch { return []; }
}

const scrubDeep = (scrub, value) => typeof value === 'string' ? scrub(value)
  : Array.isArray(value) ? value.map(item => scrubDeep(scrub, item))
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, scrubDeep(scrub, item)]))
  : value;

export function createRevivalAttention({ path, auditPath, now, scrub }) {
  const write = notices => durablePreviewWrite(path, { version: 1, notices });
  return {
    /** Persist one aggregated notice for a topic. An identical line still open is the same notice; once an
     * answer has carried it, a later occurrence is a new notice with its own key. Returns the key. */
    raise(topic, kind, detail) {
      if (!topicPattern.test(topic) || !kindPattern.test(kind) || typeof detail !== 'string' || !detail.trim()) throw Error('revival notice identity required');
      const line = scrub(`Lost-worker recovery (${kind.replaceAll('-', ' ')}): ${detail.trim()}`).slice(0, 600);
      const current = readRevivalNotices(path);
      const open = current.find(row => row.topic === topic && row.line === line);
      if (open) return open.key;
      const at = now();
      const key = `revival:${topic}:${kind}:${createHash('sha256').update(line).digest('hex').slice(0, 16)}:${at}`;
      write([...current, { key, topic, line, at }].slice(-REVIVAL_NOTICE_LIMIT));
      return key;
    },
    /** This topic's open notices for the answer `current`, oldest first; consumed keys are pruned from the sidecar. */
    notices(topic, turns, current) {
      const saved = readRevivalNotices(path);
      const open = openReplyNotices(turns, saved.filter(row => row.topic === topic), current);
      const openKeys = new Set(open.map(row => row.key));
      const kept = saved.filter(row => row.topic !== topic || openKeys.has(row.key));
      if (kept.length !== saved.length) { try { write(kept); } catch { /* the next read prunes again */ } }
      return open.map(row => ({ key: row.key, line: row.line }));
    },
    /** Append one scrubbed decision-transition event; a failed append never changes the decision. */
    audit(topic, event) {
      try { appendLine(auditPath, scrubDeep(scrub, { v: 1, at: now(), topic, ...event })); }
      catch { /* observability only */ }
    },
  };
}
