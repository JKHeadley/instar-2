// Port of JKHeadley/instar db3ed6d3 PrivateViewer.renderHtml: GFM, escaped title, self-contained phone page.
// Existing dashboard style replaces the duplicate stylesheet. HTML is inert; links/images cannot load resources.
import { Marked } from 'marked';
import { DASHBOARD_STYLE } from './operator-dashboard.mjs';
const escape = text => String(text).replace(/[&<>"']/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const markdown = new Marked({ async: false, gfm: true, renderer: {
  html: ({ text }) => escape(text), image: ({ text }) => escape(text),
  link({ tokens }) { return this.parser.parseInline(tokens); },
} });
export const PRIVATE_VIEW_CSP = "sandbox; default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'";
export function renderPrivateView(view) {
  const title = view ? view.title : 'Report unavailable';
  const body = view ? markdown.parse(view.markdown) : '<p>This report is missing, expired, or unavailable to this account.</p>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title><style>${DASHBOARD_STYLE}
pre,table{display:block;max-width:100%;overflow-x:auto}pre{padding:1rem;background:#f1f3f4}th,td{padding:.5rem;border:1px solid #ddd}
</style></head><body><main><h1>${escape(title)}</h1>${body}<p class="meta">${view ? 'Private to you. Available for seven days from creation.' : ''}</p></main></body></html>`;
}
