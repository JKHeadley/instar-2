import type { OpenCommitment, WorkItem } from './grounding.js';

/**
 * Awareness of the agent's own running work — the 2.0 port of 1.x
 * ParallelActivityIndex + ParallelWorkOverlap. Pure: sessions and commitments
 * arrive as data; the output is one row per topic plus overlap pairs.
 *
 * Overlap stays conservative (a noisy councilor gets muted): only recently
 * active topics are compared, at least one side must be running, and only
 * high-specificity tokens (paths, identifiers, issue numbers) count — never
 * generic words.
 */

export interface SessionActivity {
  readonly topic: string;
  readonly topicName?: string;
  readonly session: string | null;
  readonly running: boolean;
  readonly focus: string;
  readonly updatedAt: number;
  readonly secret?: boolean;
}
export interface WorkEntry extends WorkItem {
  readonly sessions: readonly string[];
  readonly sessionWork: readonly SessionActivity[];
  readonly openCommitments: number;
  readonly tags: readonly string[];
}
export interface OverlapPair {
  readonly topicA: string;
  readonly topicB: string;
  readonly shared: readonly string[];
  readonly score: number;
  readonly signature: string;
}

const boilerplate = new Set(['e.g', 'i.e', 'etc', 'n/a', 'todo', 'wip', 'pr', 'ok']);

/** High-specificity tokens only: paths, dotted/snake/kebab/camel identifiers, #issues, digit-bearing codes. */
export function extractTags(text: string): readonly string[] {
  const tags = new Set<string>();
  for (const raw of text.split(/[\s,;:()[\]{}"'`<>]+/)) {
    const token = raw.replace(/^[.!?]+|[.!?]+$/g, '');
    if (token.length < 3 || token.length > 120) continue;
    const specific = /[/\\]/.test(token) || /^#\d+$/.test(token) || /^[A-Za-z]+-\d+$/.test(token)
      || /[a-z][A-Z]/.test(token) || /^\w+(?:\.\w+)+$/.test(token) && /[a-z]{2}/i.test(token) || /^[a-z0-9]+(?:_[a-z0-9]+)+$/i.test(token)
      || /^[a-z0-9]+(?:-[a-z0-9]+){2,}$/i.test(token) && token.split('-').every(part => part.length >= 3)
      || (/\d/.test(token) && /[a-z]/i.test(token));
    const lower = token.toLowerCase();
    if (specific && !boilerplate.has(lower)) tags.add(lower);
  }
  return [...tags].sort();
}

/** One row per topic: sessions merged, freshest focus wins, open commitments counted. */
export function buildWorkIndex(sessions: readonly SessionActivity[], commitments: readonly OpenCommitment[]): readonly WorkEntry[] {
  const byTopic = new Map<string, SessionActivity[]>();
  for (const row of sessions) if (!row.secret) byTopic.set(row.topic, [...(byTopic.get(row.topic) ?? []), row]);
  for (const row of commitments) if (!byTopic.has(row.topic)) byTopic.set(row.topic, []);
  return [...byTopic.entries()].map(([topic, rows]) => {
    const latest = [...rows].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    const running = rows.filter(row => row.running);
    const openCommitments = commitments.filter(row => row.topic === topic && !row.secret).length;
    const focus = latest?.focus ?? '';
    return Object.freeze({
      topic, ...(latest?.topicName !== undefined ? { topicName: latest.topicName } : {}),
      session: (running[0] ?? latest)?.session ?? null,
      sessions: [...new Set(rows.map(row => row.session).filter((value): value is string => !!value))].sort(),
      sessionWork: rows, running: running.length > 0, focus, updatedAt: latest?.updatedAt ?? 0, openCommitments,
      tags: [...new Set(rows.flatMap(row => extractTags(row.focus)))].sort(),
    });
  }).sort((a, b) => b.updatedAt - a.updatedAt || a.topic.localeCompare(b.topic));
}

export function detectOverlaps(entries: readonly WorkEntry[], options: Readonly<{
  now: number; activityWindowMs?: number; minShared?: number; requireRunning?: boolean;
}>): readonly OverlapPair[] {
  const cutoff = options.now - (options.activityWindowMs ?? 4 * 3_600_000);
  const minShared = options.minShared ?? 1, requireRunning = options.requireRunning ?? true;
  const active = entries.filter(row => row.updatedAt >= cutoff && row.tags.length);
  const frequency = new Map<string, number>();
  for (const row of active) for (const tag of row.tags) frequency.set(tag, (frequency.get(tag) ?? 0) + 1);
  const pairs: OverlapPair[] = [];
  for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
    const a = active[i]!, b = active[j]!;
    if (a.topic === b.topic || (requireRunning && !a.running && !b.running)) continue;
    const other = new Set(b.tags);
    const shared = a.tags.filter(tag => other.has(tag));
    if (shared.length < minShared) continue;
    const [topicA, topicB] = a.topic < b.topic ? [a.topic, b.topic] : [b.topic, a.topic];
    pairs.push(Object.freeze({ topicA, topicB, shared, signature: shared.join('|'),
      score: shared.reduce((sum, tag) => sum + Math.log(1 + active.length / (frequency.get(tag) ?? 1)), 0) }));
  }
  return pairs.sort((x, y) => y.score - x.score || x.signature.localeCompare(y.signature));
}

/** Work rows for one topic's grounding, preserving each session's checkpoint. */
export function workForTopic(topic: string, entries: readonly WorkEntry[], overlaps: readonly OverlapPair[]): readonly WorkItem[] {
  return entries.flatMap(row => {
    const pair = overlaps.find(p => (p.topicA === topic && p.topicB === row.topic) || (p.topicB === topic && p.topicA === row.topic));
    return row.sessionWork.map(work => Object.freeze({ topic: row.topic,
      ...(work.topicName !== undefined ? { topicName: work.topicName } : {}),
      session: work.session, focus: work.focus, running: work.running, updatedAt: work.updatedAt,
      ...(pair && row.topic !== topic ? { overlap: pair.shared } : {}) }));
  });
}
