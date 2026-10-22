// Narrow port of 1.x readPasteCode + ClaudePasteBackController: read only the
// provider's offered callback code, then hand it to the same waiting native CLI.
// R26/36/100: recorded DOM shape, exact OAuth state, memory only; no logs or argv.
function callbackCode(state) {
  if (!['https://platform.claude.com', 'https://console.anthropic.com'].includes(location.origin)
    || location.pathname !== '/oauth/code/callback') return '';
  const text = document.body?.innerText ?? '';
  if (!text.includes('Authentication code') || !text.includes('Paste this into Claude Code:')) return '';
  const candidates = [...document.querySelectorAll('p.select-all.text-code')];
  if (candidates.length !== 1) return '';
  const code = candidates[0].textContent.trim();
  if (code.length > 512 || !/^[A-Za-z0-9_-]+#[A-Za-z0-9_-]+$/u.test(code)
    || code.split('#')[1] !== state) return '';
  return code;
}

export async function readSigninCode({ evaluate, state, signal, pause }) {
  for (let attempt = 0; attempt < 30 && !signal.aborted; attempt++) {
    let code;
    try { code = await evaluate(`(${callbackCode.toString()})(${JSON.stringify(state)})`); }
    catch { /* Read-only navigation; the next observation is still bounded. */ }
    if (signal.aborted) return null;
    if (typeof code === 'string' && code.length <= 512 && /^[A-Za-z0-9_-]+#[A-Za-z0-9_-]+$/u.test(code)
      && code.split('#')[1] === state) return code;
    await pause(1000);
  }
  return null;
}
