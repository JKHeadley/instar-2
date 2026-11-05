// Carryover row 88. Only the authenticated operator sees this bounded pull page.
// No external sends, model calls, approvals or per-item conversations.
import { createHash } from 'node:crypto';
import { DASHBOARD_STYLE } from './operator-dashboard.mjs';
const escape = value => String(value).replace(/[&<>"']/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const hash = value => createHash('sha256').update(value).digest('hex');
export const attentionCsrf = session => hash(`attention-form:${session}`);
export const attentionReceipt = (session, fields) => `dashboard:${hash(JSON.stringify([session, fields]))}`;
export function attentionPage(snapshot, csrf, message = '', offset = 0) {
  const start = Number.isSafeInteger(offset) && offset >= 0 ? Math.min(offset, Math.max(0, snapshot.items.length - 1)) : 0;
  const items = [...snapshot.items].reverse().slice(start, start + 100);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Attention</title><style>${DASHBOARD_STYLE}</style></head><body>
<nav><a href="/dashboard">Your agent</a></nav><main><h1>Attention</h1><p>Items you are tracking. Acknowledging an item does not approve any action.</p>
${message ? `<p role="status">${escape(message)}</p>` : ''}
<form method="post" action="/dashboard/attention"><input type="hidden" name="csrf" value="${csrf}"><label>Add an item<input class="field" name="title" maxlength="200" required></label><button class="button primary">Save item</button></form>
<p>${snapshot.items.length} saved items. Showing ${start + (items.length ? 1 : 0)}–${start + items.length}.</p>
${start > 0 ? `<a href="/dashboard/attention?offset=${Math.max(0, start - 100)}">Previous items</a>` : ''}
${start + 100 < snapshot.items.length ? `<a href="/dashboard/attention?offset=${start + 100}">More items</a>` : ''}
${items.map(item => `<article class="row"><h2>${escape(item.title)}</h2><p>${escape(item.summary)}</p><p>${escape(item.status)} · ${escape(item.priority)}</p>
<form method="post" action="/dashboard/attention"><input type="hidden" name="csrf" value="${csrf}"><input type="hidden" name="id" value="${escape(item.id)}"><input type="hidden" name="revision" value="${item.revision}">
<label>Status<select class="field" name="status">${['OPEN','ACKNOWLEDGED','IN_PROGRESS','DONE','WONT_DO'].map(s => `<option${item.status === s ? ' selected' : ''}>${s}</option>`).join('')}</select></label><button class="button primary">Save status</button></form></article>`).join('')}
${snapshot.acknowledgements.filter(a => !['delivered'].includes(a.outcome)).slice(-100).map(a => `<p>Acknowledgement: ${escape(a.outcome)} (${a.attempts} attempts).</p>`).join('')}
</main></body></html>`;
}
