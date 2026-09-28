import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { currentRuntime } from '../../scripts/composition-digest.mjs';
import { lintClientImports, lintHarnessNames, lintParityRegister, lintReplacedStores, NATIVE_HARNESS, parityMatrix,
  registerDeclarationSources, shippedClientFiles } from '../../scripts/check-architecture.mjs';
// @ts-expect-error The self-hosting harness is JavaScript.
import { selfHostCompositionEvidence } from '../preview/self-host-harness.mjs';

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

it('R105 derives the parity matrix from the register declarations and refuses a cell without its evidence', () => {
  const sources = registerDeclarationSources();
  expect(existsSync('src/conversation/parity.register.json')).toBe(false);
  const matrix = parityMatrix(sources);
  expect(matrix.channels).toEqual(['slack', 'telegram']);
  expect(matrix.derivedFrom).toEqual(expect.arrayContaining(['src/conversation/telegram.declarations.json',
    'src/conversation/slack.declarations.json', 'src/assembly/harness.declarations.json']));
  // Every declared Telegram operation state is a parity cell of the channel adapter's own declaration.
  expect(matrix.features.find(row => row.id === 'media')!.cells.telegram).toMatchObject({ status: 'unsupported', inhibited: true,
    declaration: 'telegram-conversation-adapter' });
  expect(matrix.features.find(row => row.id === 'ordinary-reply')!.cells.slack).toMatchObject({ status: 'unproven' });
  // The native reference harness is the self-hosting HarnessAdapterPort composition; its supported tuple is bound to the
  // exact composition (the static import closure of its declared entry points), the resolved runtime and the conformance digest. The journal runner's conversation case is not the shared
  // full-port contract, so its tuple is unproven (with its reason), as are the cells no captured case covers.
  expect(NATIVE_HARNESS).toBe('preview-self-host-native');
  expect(matrix.harnessTuples.find(tuple => tuple.harness === NATIVE_HARNESS)).toMatchObject({ mode: 'self-hosting', status: 'supported',
    doorway: 'claude-code-subscription', platform: 'darwin',
    artifact: ['createSelfHostHarness@tests/preview/self-host-harness.mjs'], route: ['claude-code-subscription@src/assembly/production-provider.ts'],
    runtime: [currentRuntime()], conformance: [expect.stringMatching(/^sha256:[a-f0-9]{64}$/u)],
    entries: ['tests/preview/self-host.mjs,scripts/slice-ts-loader.mjs,deploy/macos/fixed-worker/worker.sb'],
    evidence: [{ file: 'tests/preview/native-harness-contract.test.ts', title: 'native composition honours the harness contract through doorway claude-code-subscription' }] });
  const journal = matrix.harnessTuples.filter(tuple => tuple.harness === 'preview-journal-native');
  expect(journal.find(tuple => tuple.mode === 'conversation')).toMatchObject({ status: 'unproven', reason: expect.stringContaining('not the shared full-port contract') });
  expect(journal.find(tuple => tuple.mode === 'ordinary-exhaustion-recovery')).toMatchObject({ status: 'unproven' });
  expect(journal.find(tuple => tuple.mode === 'preventive-compaction')).toMatchObject({ status: 'unsupported' });

  const doorways = ['claude-code-subscription'];
  // Every issue below is an R105 finding about the committed declarations themselves.
  const clean = lintParityRegister(sources, read, doorways).map(issue => issue.detail);
  const details = (value: Record<string, unknown>, registered = doorways) =>
    lintParityRegister(value, read, registered).map(issue => issue.detail).filter(detail => !clean.includes(detail));
  const with_ = (path: string, edit: (entries: { id: string; requiredFacts: { metrics: string[] } }[]) => void) => {
    const copy = structuredClone(sources) as Record<string, { id: string; requiredFacts: { metrics: string[] } }[]>;
    edit(copy[path]!); return copy;
  };
  const telegram = 'src/conversation/telegram.declarations.json', harness = 'src/assembly/harness.declarations.json';
  // A new declared Telegram operation lands without its evidence and without a Slack cell.
  expect(details(with_(telegram, entries => entries[0]!.requiredFacts.metrics.push('telegram.operation.poll.supported'))))
    .toEqual(expect.arrayContaining(['poll × telegram: supported without a resolvable captured test', 'poll × slack: no parity cell']));
  // A new channel adapter lands without a column.
  expect(details({ ...sources, 'src/conversation/whatsapp.declarations.json': [] }))
    .toContain('channel whatsapp has an adapter but no parity column');
  // A supported cell must cite a captured test that exists; a declared-inhibited operation cannot also be supported.
  expect(details(with_(telegram, entries => { const metrics = entries[0]!.requiredFacts.metrics;
    metrics[metrics.findIndex(metric => metric.startsWith('telegram.operation.status-command.evidence='))] =
      'telegram.operation.status-command.evidence=tests/preview/status-command.test.ts#a test nobody wrote';
    metrics.push('telegram.operation.media.supported'); }))).toEqual(expect.arrayContaining([
    'status-command × telegram: supported without a resolvable captured test',
    'media × telegram declares more than one parity state (inhibited, supported)']));
  // An unproven cell must say why.
  expect(details(with_('src/conversation/slack.declarations.json', entries => {
    const metrics = entries[0]!.requiredFacts.metrics; metrics.splice(metrics.findIndex(metric => metric.startsWith('slack.operation.ordinary-reply.reason=')), 1);
  }))).toContain('ordinary-reply × slack: unproven without a reason');
  // A supported harness tuple is bound to its composition artifact and registered route, not only a test title.
  expect(details(with_(harness, entries => { const metrics = entries[0]!.requiredFacts.metrics;
    metrics[metrics.findIndex(metric => metric.endsWith('.self-hosting.route=claude-code-subscription@src/assembly/production-provider.ts'))] =
      'harness.preview-self-host-native.claude-code-subscription.darwin.self-hosting.route=claude-code-subscription@src/assembly/harness.ts';
    metrics.splice(metrics.findIndex(metric => metric.endsWith('.self-hosting.artifact=createSelfHostHarness@tests/preview/self-host-harness.mjs')), 1);
  }))).toEqual(expect.arrayContaining([
    'preview-self-host-native × claude-code-subscription × darwin × self-hosting: supported without an adapter artifact that names it',
    'preview-self-host-native × claude-code-subscription × darwin × self-hosting: supported without its registered route']));
  // D17 §2: support is for exact bytes on an exact runtime. Any executed file the entry points reach — the driver, the owners,
  // the tool inventory that decides which paths are checked, the production IO, the transport authority — a changed
  // runtime, or missing entry points each leave the tuple uncertified until its contract is re-run and re-declared.
  const edited = (path: string, text: string) => (file: string) => file === path ? text : read(file);
  const declarations = sources[harness];
  for (const path of ['tests/preview/self-host-owners.ts', 'src/assembly/tool-inventory.ts', 'scripts/production-boot-io.mjs', 'src/transport/authority.ts',
    'tests/preview/provider-owners.ts', 'scripts/slice-ts-loader.mjs',
    // Executed but not source: the built core the replica storage loads, and the compiler the loader runs.
    'dist/index.js', 'dist/types/internal.js', 'node_modules/typescript/lib/typescript.js']) {
    const changed = edited(path, `${read(path)}\n// changed executed bytes\n`);
    const drift = lintParityRegister(sources, changed, doorways)
      .map(issue => issue.detail).filter(detail => !clean.includes(detail));
    expect(drift, path).toEqual([expect.stringContaining('preview-self-host-native × claude-code-subscription × darwin × self-hosting: conformance is not for the current composition bytes')]);
    // The harness's own admission agrees: no executed file outside the certified bytes can leave it claiming exact support.
    const evidence = selfHostCompositionEvidence(declarations, changed);
    expect(evidence.files, path).toContain(path);
    expect(evidence.supported, path).toBe(false);
  }
  expect(selfHostCompositionEvidence(declarations, read).supported).toBe(true);
  expect(details(with_(harness, entries => { const metrics = entries[0]!.requiredFacts.metrics;
    metrics[metrics.findIndex(metric => metric.includes('.self-hosting.runtime='))] = 'harness.preview-self-host-native.claude-code-subscription.darwin.self-hosting.runtime=node-24';
  }))).toContain(`preview-self-host-native × claude-code-subscription × darwin × self-hosting: certified on node-24, running ${currentRuntime()}`);
  expect(details(with_(harness, entries => { const metrics = entries[0]!.requiredFacts.metrics;
    metrics.splice(metrics.findIndex(metric => metric.includes('.self-hosting.entries=')), 1);
  }))).toContain('preview-self-host-native × claude-code-subscription × darwin × self-hosting: supported without complete composition entry points (closure reaching its artifact and route) and runtime');
  // A newly registered doorway lands without a native harness tuple.
  expect(details(sources, [...doorways, 'new-doorway'])).toContain('registered doorway new-doorway has no native harness tuple');
  // The committed declarations carry no other finding.
  expect(clean).toEqual([]);
});
