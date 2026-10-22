// Narrow page step from normal-chrome-browser section 4. This only operates on
// the expected account's Claude Code consent page for this CLI's OAuth state.
// Google login and any provider challenges remain the existing browser flow.
function pageStep(expectedAccount, state, action) {
  if (!['https://claude.ai', 'https://claude.com'].includes(location.origin)
    || !['/oauth/authorize', '/cai/oauth/authorize'].includes(location.pathname)) return 'waiting';
  if (new URL(location.href).searchParams.get('state') !== state) return 'refused';
  const text = document.body?.innerText ?? '';
  if (!text.includes('Claude Code would like to connect to your Claude chat account')) return 'waiting';
  const identity = text.split('\n').map(line => line.trim()).filter(line => line.startsWith('Logged in as '));
  if (identity.length !== 1) return 'waiting';
  if (identity[0].toLowerCase() !== `Logged in as ${expectedAccount}`.toLowerCase()) return 'refused';
  const buttons = [...document.querySelectorAll('button')].filter(button => button.innerText.trim() === 'Authorize');
  if (buttons.length !== 1) return 'waiting';
  const button = buttons[0], rect = button.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return 'waiting';
  if (action === 'inspect') return 'ready';
  if (action === 'focus') {
    window.dispatchEvent(new FocusEvent('focus'));
    return 'focused';
  }
  if (button.disabled || button.getAttribute('aria-disabled') === 'true') return 'disabled';
  button.click();
  return 'clicked';
}

function expression(expectedAccount, state, action) {
  const call = `(${pageStep.toString()})(${JSON.stringify(expectedAccount)},${JSON.stringify(state)},${JSON.stringify(action)})`;
  if (action !== 'focus') return call;
  // Apple Events run in an isolated world. The skill's script-element bridge
  // dispatches in the page's own world; each fresh node holds only its own result.
  // CSP failure is unavailable, never success; no security policy is changed.
  return `(() => { const s = document.createElement('script');
    s.textContent = ${JSON.stringify(`document.currentScript.dataset.result = ${call};`)};
    try { (document.head || document.documentElement).appendChild(s);
      return s.dataset.result || 'unavailable'; } finally { s.remove(); }
  })()`;
}

export async function authorizeSigninPage({ evaluate, expectedAccount, state, signal, pause }) {
  if (signal.aborted) return 'stopped';
  let observed;
  try { observed = await evaluate(expression(expectedAccount, state, 'inspect')); }
  catch { return 'waiting'; } // Read-only observation during navigation; bounded by the caller.
  if (observed !== 'ready') return observed;
  if (signal.aborted) return 'stopped';
  const focused = await evaluate(expression(expectedAccount, state, 'focus'));
  if (focused !== 'focused') return focused;
  await pause(2000);
  if (signal.aborted) return 'stopped';
  return evaluate(expression(expectedAccount, state, 'click'));
}

/** Wait only for the offered consent page while the native CLI is alive. An
 * uncertain click or still-disabled control is never automatically clicked again. */
export async function waitForSigninAuthorization(options) {
  for (let attempt = 0; attempt < 300 && !options.signal.aborted; attempt++) {
    const result = await authorizeSigninPage(options);
    if (result !== 'waiting') return result;
    await options.pause(2000);
  }
  return options.signal.aborted ? 'stopped' : 'unavailable';
}
