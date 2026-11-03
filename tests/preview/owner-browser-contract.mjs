// Rules 1, 18, 57, 100, 103: the worker names one page; custody and navigation stay owner-side.
export const OWNER_BROWSER_TOOL = 'mcp__owner_github__observe';
export const OWNER_BROWSER_URL = 'https://github.com/settings/profile';
export const ownerBrowserRequest = input => input !== null && typeof input === 'object' && !Array.isArray(input)
  && Object.keys(input).length === 1 && input.page === 'account-profile';
export const ownerBrowserRefused = reason => ({ status: 'refused', reason });
/** A generic MCP read entry or broad account grant cannot confer this exact owner operation. */
export function ownerBrowserPolicy(policy, now) {
  const exact = row => row.effect === 'tool:mcp' && row.target === OWNER_BROWSER_TOOL;
  const registration = policy.registered.find(row => row.effect === 'tool:mcp'
    && (row.target === undefined || row.target === OWNER_BROWSER_TOOL));
  return registration && exact(registration) && registration.reversibility === 'reversible' && registration.costUsd === 0
    && registration.reach === 'agent' && registration.consequence === 'data'
    && policy.grants.some(row => exact(row) && row.approves.includes('scope')
      && (row.expiresAt === undefined || now < row.expiresAt));
}
