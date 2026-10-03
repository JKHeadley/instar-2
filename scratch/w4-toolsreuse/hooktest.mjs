// Layer A: feed admit.mjs fixed PreToolUse inputs; record exit code + decision. No model.
import { spawnSync } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path';
const H = path.dirname(new URL(import.meta.url).pathname); const T = path.join(H, 'hooktest');
fs.rmSync(T, { recursive: true, force: true });
for (const d of ['ws/sub', 'state', 'outside']) fs.mkdirSync(path.join(T, d), { recursive: true });
const WS = fs.realpathSync(path.join(T, 'ws')); const OUT = path.join(T, 'outside');
fs.writeFileSync(path.join(WS, 'in.txt'), 'hi\n'); fs.writeFileSync(path.join(OUT, 'canary.txt'), 'CANARY-DUMMY-0001\n');
fs.symlinkSync(OUT, path.join(WS, 'link'));
const j = (tool_name, tool_input) => JSON.stringify({ tool_name, tool_input });
const cases = [
  ['read-inside', 'allow', j('Read', { file_path: `${WS}/in.txt` })],
  ['read-outside-abs', 'deny', j('Read', { file_path: `${OUT}/canary.txt` })],
  ['read-dotdot', 'deny', j('Read', { file_path: `${WS}/../outside/canary.txt` })],
  ['read-relative-dotdot', 'deny', j('Read', { file_path: '../outside/canary.txt' })],
  ['read-via-symlink', 'deny', j('Read', { file_path: `${WS}/link/canary.txt` })],
  ['read-missing-path', 'deny', j('Read', {})],
  ['write-inside-new', 'allow', j('Write', { file_path: `${WS}/sub/new.txt`, content: 'x' })],
  ['write-outside', 'deny', j('Write', { file_path: `${OUT}/x.txt`, content: 'x' })],
  ['write-via-symlink', 'deny', j('Write', { file_path: `${WS}/link/x.txt`, content: 'x' })],
  ['write-nonexistent-dotdot', 'deny', j('Write', { file_path: `${WS}/nope/../../outside/y.txt`, content: 'x' })],
  ['edit-inside', 'allow', j('Edit', { file_path: `${WS}/in.txt`, old_string: 'hi', new_string: 'ho' })],
  ['edit-dotdot', 'deny', j('Edit', { file_path: `${WS}/sub/../../outside/canary.txt`, old_string: 'a', new_string: 'b' })],
  ['glob-inside', 'allow', j('Glob', { pattern: '**/*.txt' })],
  ['glob-outside-path', 'deny', j('Glob', { pattern: '*', path: OUT })],
  ['glob-via-symlink-path', 'deny', j('Glob', { pattern: '*', path: `${WS}/link` })],
  ['glob-dotdot-pattern', 'deny', j('Glob', { pattern: '../outside/*' })],
  ['glob-abs-pattern', 'deny', j('Glob', { pattern: '/etc/*' })],
  ['bash-plain', 'allow', j('Bash', { command: 'wc -c in.txt' })],
  ['bash-network-curl', 'deny', j('Bash', { command: 'curl -sI https://example.org' })],
  ['bash-network-git-push', 'deny', j('Bash', { command: 'git push origin main' })],
  ['bash-delete', 'deny', j('Bash', { command: 'rm -f in.txt' })],
  ['bash-host-control', 'deny', j('Bash', { command: 'launchctl list' })],
  ['bash-send', 'deny', j('Bash', { command: 'mail -s hi a@b.c < in.txt' })],
  ['bash-unsandboxed-flag', 'deny', j('Bash', { command: 'ls', dangerouslyDisableSandbox: true })],
  ['webfetch', 'deny', j('WebFetch', { url: 'https://example.com', prompt: 'x' })],
  ['websearch', 'deny', j('WebSearch', { query: 'x' })],
  ['mcp', 'deny', j('mcp__threadline__threadline_send', { to: 'x' })],
  ['agent-tool', 'deny', j('Agent', { prompt: 'x' })],
  ['unknown-tool', 'deny', j('FooTool', {})],
  ['malformed-json', 'refuse', '{"tool_name":"Read",'],
  ['empty-input', 'refuse', ''],
  ['cap-3rd-of-3', 'allow', j('Bash', { command: 'wc -c in.txt' }), 3, 2],
  ['cap-4th-of-3', 'deny', j('Bash', { command: 'wc -c in.txt' }), 3, 3],
];
let bad = 0;
for (const [label, want, input, cap = 50, preset] of cases) {
  const cf = path.join(T, 'state', 'calls'); fs.rmSync(cf, { force: true }); if (preset != null) fs.writeFileSync(cf, String(preset));
  const r = spawnSync('node', [path.join(H, 'admit.mjs'), path.join(T, 'state'), WS, String(cap), 'enforce'], { input, encoding: 'utf8' });
  const m = r.stdout.match(/"permissionDecision":"(\w+)"/); let got = m ? m[1] : 'allow';
  if (r.status === 2) got = 'refuse'; // Claude Code treats PreToolUse exit 2 as a block
  const ok = got === want; if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label.padEnd(26)} exit=${r.status} decision=${got.padEnd(6)} want=${want}${r.status === 2 ? '  stderr=' + r.stderr.trim().slice(0, 70) : ''}`);
}
console.log(`${cases.length - bad}/${cases.length} as expected`); process.exit(bad ? 1 : 0);
