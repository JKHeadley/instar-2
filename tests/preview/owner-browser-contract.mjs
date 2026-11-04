// Rules 1, 18, 57, 100, 103: the worker names bounded pages; custody and navigation stay owner-side.
export const OWNER_BROWSER_TOOL = 'mcp__owner_github__observe';
export const OWNER_BROWSER_URL = 'https://github.com/settings/profile';
export const OWNER_BROWSER_PAGES = Object.freeze({ 'account-profile': OWNER_BROWSER_URL, 'account-repositories': 'https://github.com/EchoOfDawn?tab=repositories' });
export const ownerBrowserPages = input => input.page ? [input.page] : input.pages;
export const ownerBrowserRequest = input => input !== null && typeof input === 'object' && !Array.isArray(input)
  && Object.keys(input).length === 1 && (input.page === 'account-profile'
    || (Array.isArray(input.pages) && input.pages.length >= 2 && input.pages.length <= 4
      && input.pages.every(page => typeof page === 'string' && Object.hasOwn(OWNER_BROWSER_PAGES, page))));
export const ownerBrowserRefused = reason => ({ status: 'refused', reason });
/** A generic MCP read entry or broad account grant cannot confer this exact owner operation. */
export function ownerBrowserPolicy(policy, now, input = { page: 'account-profile' }) {
  const exact = row => row.effect === 'tool:mcp' && row.target === OWNER_BROWSER_TOOL;
  const registration = policy.registered.find(row => row.effect === 'tool:mcp'
    && (row.target === undefined || row.target === OWNER_BROWSER_TOOL));
  return registration && exact(registration) && registration.reversibility === 'reversible' && registration.costUsd === 0
    && registration.reach === 'agent' && registration.consequence === 'data'
    && policy.grants.some(row => exact(row) && row.approves.includes('scope')
      && (row.ownerBrowserPages === undefined || (Array.isArray(row.ownerBrowserPages)
        && row.ownerBrowserPages.every(page => typeof page === 'string' && Object.hasOwn(OWNER_BROWSER_PAGES, page))))
      && ownerBrowserPages(input).every(page => (row.ownerBrowserPages ?? ['account-profile']).includes(page))
      && (row.expiresAt === undefined || now < row.expiresAt));
}
