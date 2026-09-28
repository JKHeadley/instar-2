import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { lintClientImports, lintHarnessNames, lintParityRegister, lintReplacedStores, shippedClientFiles } from '../../scripts/check-architecture.mjs';

const read = (path: string) => { try { return readFileSync(path, 'utf8'); } catch { return null; } };

it('R30 flags a harness-name branch or a harness-specific adapter outside its adapter, and passes the shipped runner', () => {
  const flagged = lintHarnessNames({
    'tests/preview/client.mjs': "if (framework === 'codex-cli') wait(1500);\nswitch (h) { case 'claude-code': break; }\nimport { createClaudeCodeSubscriptionRoute } from 'x';",
    'src/assembly/production-session-driver.ts': "if (framework === 'codex-cli') wait(1500);",
  });
  expect(flagged.map(issue => [issue.file, issue.line])).toEqual([
    ['tests/preview/client.mjs', 1], ['tests/preview/client.mjs', 2], ['tests/preview/client.mjs', 3]]);
  // The runner as it was before this build selected the Claude Code route by name.
  const before = execFileSync('git', ['show', 'a6f026e5:tests/preview/journal-agent.mjs'], { encoding: 'utf8' });
  expect(lintHarnessNames({ 'tests/preview/journal-agent.mjs': before }).length).toBeGreaterThan(0);
  expect(lintHarnessNames({ 'tests/preview/journal-agent.mjs': read('tests/preview/journal-agent.mjs')! })).toEqual([]);
});

it('NF-51 includes shipped clients: a private core import from a script fails, the public index passes', () => {
  expect(lintClientImports({ 'scripts/monitor.mjs': "import { canonicalText } from '../dist/decode/canonical.js';" })).toHaveLength(1);
  expect(lintClientImports({ 'scripts/monitor.mjs': "import { canonical } from '../dist/index.js';" })).toEqual([]);
  const clients = shippedClientFiles();
  expect(clients).toContain('tests/preview/journal-agent.mjs');
  expect(clients).toContain('scripts/fixed-native-worker-monitor.mjs');
  expect(lintClientImports(Object.fromEntries(clients.map(path => [path, read(path)!])))).toEqual([]);
});

it('R45 refuses a live consumer of a replaced store and an undeclared reader, and passes the migrated runner', () => {
  const files: Record<string, string> = {
    'tests/preview/live.mjs': "import { readState } from './legacy.ts';\n",
    'tests/preview/legacy.ts': "export const readState = root => read(join(root, 'preview-state.json'));\n",
    'tests/preview/tool.mjs': "const old = 'successive-state.json';\n",
  };
  const fake = (path: string) => files[path] ?? read(path);
  const exists = (path: string) => path in files || read(path) !== null;
  const issues = lintReplacedStores(files, ['tests/preview/live.mjs'], fake, exists).map(issue => `${issue.file}: ${issue.detail}`);
  expect(issues).toContain('tests/preview/legacy.ts: live consumer still reads the replaced store preview-state.json');
  expect(issues).toContain('tests/preview/tool.mjs: undeclared reader of replaced store successive-state.json');
  // Before this build the live runner loaded the replaced preview-state module for one helper.
  const before = { 'tests/preview/journal-agent.mjs': "import { durablePreviewWrite } from './state.js';\n" };
  expect(lintReplacedStores({}, ['tests/preview/journal-agent.mjs'], path => before[path as keyof typeof before] ?? read(path),
    path => read(path) !== null || path in before).some(issue => issue.file === 'tests/preview/state.ts')).toBe(true);
  expect(lintReplacedStores({})).toEqual([]);
});

it('R105 refuses a declared channel operation, a channel or a doorway without its parity row, and passes the register', () => {
  const register = JSON.parse(read('src/conversation/parity.register.json')!);
  const telegram = JSON.parse(read('src/conversation/telegram.declarations.json')!);
  const slack = JSON.parse(read('src/conversation/slack.declarations.json')!);
  const clean = lintParityRegister(register, { telegram, slack }, read, ['claude-code-subscription']);
  expect(clean).toEqual([]);
  const details = (value: unknown, declarations: Record<string, unknown> = { telegram, slack }, doorways = ['claude-code-subscription']) =>
    lintParityRegister(value, declarations, read, doorways).map(issue => issue.detail);
  // A new declared Telegram operation lands without its row.
  const newOperation = structuredClone(telegram); newOperation[0].requiredFacts.metrics.push('telegram.operation.poll.supported');
  expect(details(register, { telegram: newOperation, slack })).toContain('declared operation telegram.operation.poll.supported has no parity row');
  // A new channel adapter lands without a column.
  expect(details(register, { telegram, slack, whatsapp: [] })).toContain('channel whatsapp has an adapter but no parity column');
  // A supported cell must cite a captured test that exists; a declared-inhibited operation cannot be supported.
  const broken = structuredClone(register);
  broken.features[0].cells.telegram.evidence.title = 'a test nobody wrote';
  broken.features.find((row: { id: string }) => row.id === 'media').cells.telegram = { status: 'supported',
    evidence: broken.features[1].cells.telegram.evidence };
  expect(details(broken)).toEqual(expect.arrayContaining(['ordinary-reply × telegram: supported without a resolvable captured test',
    'telegram.operation.media.inhibited disagrees with its parity cell (supported)']));
  expect(details(register, { telegram, slack }, ['claude-code-subscription', 'new-doorway']))
    .toContain('registered doorway new-doorway has no native harness tuple');
});
