// @ts-nocheck -- replay the recorded provider DOM with only its secret substituted.
import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { readSigninCode } from '../../scripts/claude-signin-code.mjs';
const recorded = JSON.parse(readFileSync(new URL('./fixtures/signin/claude-code-studio.json', import.meta.url), 'utf8')).page;
function page() {
  const location = new URL(recorded.origin + recorded.path);
  const code = 'synthetic-code#fixture-state';
  const elements = recorded.codeElement.map(e => ({ textContent: code }));
  const document = { body: { innerText: `${recorded.heading}\n${recorded.instruction}` },
    querySelectorAll: () => elements };
  const evaluate = vi.fn(async script => runInNewContext(script, { location, document, JSON }));
  const controller = new AbortController(), pause = vi.fn(async () => {});
  return { location, elements, document, evaluate, controller, pause, code,
    read: () => readSigninCode({ evaluate, state: 'fixture-state', signal: controller.signal, pause }) };
}
it('reads the real callback shape with its code kept in memory', async () => {
  const p = page(); expect(await p.read()).toBe(p.code);
});
it.each(['origin', 'path', 'instruction', 'state', 'ambiguous', 'empty', 'control', 'url', 'oversize', 'stop'])('never returns a code for %s', async change => {
  const p = page();
  if (change === 'origin') p.location.hostname = 'platform.claude.com.attacker.invalid';
  if (change === 'path') p.location.pathname = '/settings';
  if (change === 'instruction') p.document.body.innerText = 'Unrelated page';
  if (change === 'state') p.elements[0].textContent = 'synthetic-code#other-state';
  if (change === 'ambiguous') p.elements.push({ textContent: p.code });
  if (change === 'empty') p.elements.length = 0;
  if (change === 'control') p.elements[0].textContent = 'synthetic\ncode#fixture-state';
  if (change === 'url') p.elements[0].textContent = 'https://wrong.invalid/#fixture-state';
  if (change === 'oversize') p.elements[0].textContent = 'x'.repeat(513) + '#fixture-state';
  if (change === 'stop') p.controller.abort();
  expect(await p.read()).toBeNull();
});
it('bounds navigation reads and survives a transient read failure', async () => {
  const p = page(); p.evaluate.mockRejectedValueOnce(Error('navigation'));
  expect(await p.read()).toBe(p.code); expect(p.pause).toHaveBeenCalledTimes(1);
  const q = page(); q.evaluate.mockResolvedValue('');
  expect(await q.read()).toBeNull(); expect(q.evaluate).toHaveBeenCalledTimes(30);
});
it('discards a code when stop arrives during its read', async () => {
  const p = page(); p.evaluate.mockImplementation(async () => { p.controller.abort(); return p.code; });
  expect(await p.read()).toBeNull(); expect(p.pause).not.toHaveBeenCalled();
});
