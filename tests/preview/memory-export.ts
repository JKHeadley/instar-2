/** Bounded, read-only operator review of the journal's memory projection. */
import { redact } from '../../src/recall/redact.js';
import type { JournalView } from './journal.js';

type Action = { mode: 'correct' | 'forget' | 'prefer'; source: string; quote: string; trigger: string; replacement?: string };
type Dated = { source: string; quote: string; when: string; day?: string; time?: string; ambiguity?: string; zone: string };
type ExportView = JournalView & { dated?: Dated[] };

const MAX_BYTES = 16384;
const MAX_PER_SECTION = 20;
const MAX_FIELD_BYTES = 700;

export function memoryReport(view: ExportView): string {
  const actions = view.memory as Action[];
  // A retired exact clause can occur in another displayed field.
  const hidden = actions.filter(item => item.mode !== 'prefer').flatMap(item => [item.quote]);
  const safe = (value: string, retiredClauses = true): string => {
    // Redact the original before a recorded clause can remove a credential label.
    let text = redact(value).text;
    if (retiredClauses) for (const phrase of hidden) if (phrase) text = text.replaceAll(phrase, '[withheld]');
    text = text.replace(/[\r\n\t]+/gu, ' ').replace(/[\u0000-\u001f\u007f]/gu, ' ');
    if (Buffer.byteLength(text) > MAX_FIELD_BYTES) return '[field omitted: over 700 bytes]';
    return text.replace(/[\\`*_{}\[\]()#+!|<>]/gu, '\\$&').trim();
  };
  const source = (id: string) => {
    if (id.startsWith('channel:')) {
      const item = view.channelItems.get(id.slice('channel:'.length));
      return item ? `${item.source} ${safe(item.id)} (${safe(item.from)}, ${safe(new Date(item.at).toISOString())}; account ${safe(item.account)})` : 'channel source unavailable';
    }
    const turn = view.turns.get(id);
    return turn ? `Telegram update ${turn.update} (${safe(new Date(turn.at).toISOString())})` : 'source unavailable';
  };
  const lines: string[] = ['# Preview memory review', '', 'Read-only view of the encrypted journal for the bound operator. Imported sender metadata comes from an export fixture. Omitted entries remain in the journal.', ''];
  const sections: { title: string; rows: string[] }[] = [];
  const people = view.people.filter(note => !actions.some(change => change.mode !== 'prefer' && change.source === note.source
    && (change.quote.includes(note.quote) || note.quote.includes(change.quote))));
  sections.push({ title: 'People notes', rows: people.map(note => {
    const turn = view.turns.get(note.source);
    return `- **${safe(note.name)}** — ${turn ? safe(turn.text) : '[source unavailable]'}; source: ${source(note.source)}`;
  }) });
  const corrections = actions.filter((item, index) => item.mode === 'correct' && item.replacement
    && !actions.slice(index + 1).some(later => later.mode !== 'prefer' && later.source === item.trigger
      && (later.quote.includes(item.replacement!) || item.replacement!.includes(later.quote))));
  sections.push({ title: 'Corrections', rows: corrections.map(item =>
    `- ${safe(item.replacement!, false)}; original: ${source(item.source)}; corrected by ${source(item.trigger)}`) });
  sections.push({ title: 'Forgotten markers', rows: actions.filter(item => item.mode === 'forget').map(item =>
    `- Content withheld; original: ${source(item.source)}; requested by ${source(item.trigger)}`) });
  const dated = (view.dated ?? []).filter(item => !actions.some(change => change.mode !== 'prefer'
    && change.source === item.source && (change.quote.includes(item.quote) || item.quote.includes(change.quote))));
  sections.push({ title: 'Dated items', rows: dated.map(item =>
    `- ${safe(item.quote)}; ${safe(item.day ?? item.when)}${item.time ? ` ${safe(item.time)}` : ''}${item.ambiguity ? ` (${safe(item.ambiguity)})` : ''}; source: ${source(item.source)}`) });
  const active = new Map<string, { source: string; quote: string }>();
  for (const item of actions) {
    const key = JSON.stringify([item.source, item.quote]);
    if (item.mode === 'prefer') active.set(key, { source: item.source, quote: item.quote });
    else if (active.delete(key) && item.mode === 'correct' && item.replacement)
      active.set(JSON.stringify([item.trigger, item.replacement]), { source: item.trigger, quote: item.replacement });
  }
  sections.push({ title: 'Preferences', rows: [...active.values()].map(item =>
    `- ${safe(item.quote)}; source: ${source(item.source)}`) });
  sections.push({ title: 'Channel items', rows: [...view.channelItems.values()].map(item => {
    const id = `channel:${JSON.stringify([item.source, item.account, item.id])}`;
    const retired = actions.some(change => change.mode !== 'prefer' && change.source === id);
    return `- ${retired ? '[affected content withheld]' : safe(item.text)}; source: ${source(id)}${item.subject ? `; subject: ${safe(item.subject)}` : ''}${item.conversation ? `; conversation: ${safe(item.conversation)}` : ''}`;
  }) });
  // Newest evidence gets the finite display slots. Counts make every omission visible.
  for (const section of sections) {
    lines.push(`## ${section.title} (${section.rows.length})`, '');
    const shown = section.rows.slice(-MAX_PER_SECTION);
    let emitted = 0;
    for (const row of shown) {
      if (Buffer.byteLength([...lines, row, '', '- Additional entries omitted to keep this report bounded.', ''].join('\n')) > MAX_BYTES) break;
      lines.push(row); emitted++;
    }
    if (section.rows.length === 0) lines.push('- None recorded.');
    else if (emitted < section.rows.length) lines.push(`- ${section.rows.length - emitted} earlier or oversized entries omitted.`);
    lines.push('');
  }
  const report = `${lines.join('\n').trimEnd()}\n`;
  if (Buffer.byteLength(report) <= MAX_BYTES) return report;
  return `# Preview memory review\n\nReport exceeds the 16 KiB display bound. Counts: ${sections.map(section =>
    `${section.title} ${section.rows.length}`).join('; ')}. Original entries remain in the encrypted journal.\n`;
}
