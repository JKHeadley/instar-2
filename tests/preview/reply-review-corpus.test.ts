import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

it('matches the subscription terminal token boundary and invocation environment', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'reply-corpus-')));
  try {
    const cli = join(root, 'claude');
    const decision = { type: 'Decision', conclusion: { subject: 'preview-stage2-answer',
      value: JSON.stringify({ verdict: 'pass', ruleIds: [], reason: 'Requested example.' }) } };
    writeFileSync(cli, `#!/usr/bin/env node
const frame = { type: 'result', subtype: process.env.STUB_SUBTYPE || 'success', is_error: false,
  session_id: 'offline-probe', result: ${JSON.stringify(JSON.stringify(decision))},
  usage: { input_tokens: 1, output_tokens: Number(process.env.STUB_OUTPUT_TOKENS) } };
if (process.env.CLAUDE_CODE_MAX_RETRIES !== '0' || process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS !== '2048'
  || process.env.MAX_THINKING_TOKENS !== '0') process.exit(3);
process.stdout.write(JSON.stringify(frame));
process.exit(Number(process.env.STUB_EXIT_CODE || '0'));
`, { mode: 0o755 });
    const run = (tokens: number, subtype = 'success', exitCode = 0) => {
      const output = join(root, `${tokens}-${subtype}-${exitCode}.json`);
      const result = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
        'tests/preview/reply-review-corpus.mjs', 'path-relative-code', output], {
        cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, PATH: `${root}:${process.env.PATH ?? ''}`,
          STUB_OUTPUT_TOKENS: String(tokens), STUB_SUBTYPE: subtype, STUB_EXIT_CODE: String(exitCode),
          CLAUDE_CODE_MAX_RETRIES: '9', CLAUDE_CODE_MAX_OUTPUT_TOKENS: '9999' } });
      expect(result.status, result.stderr).toBe(0);
      return JSON.parse(readFileSync(output, 'utf8')).cases[0];
    };
    expect(run(2048)).toMatchObject({ verdict: 'pass', rejectionClass: null,
      usage: { inputTokens: 1, outputTokens: 2048, charge: null } });
    expect(run(2049)).toMatchObject({ verdict: 'unavailable', rejectionClass: 'output-limit',
      usage: { inputTokens: 1, outputTokens: 2049, charge: null } });
    expect(run(2048, 'error')).toMatchObject({ verdict: 'unavailable', rejectionClass: 'terminal-rejected',
      usage: { inputTokens: 1, outputTokens: 2048, charge: null } });
    expect(run(2048, 'success', 1)).toMatchObject({ verdict: 'unavailable', rejectionClass: 'terminal-rejected',
      usage: { inputTokens: 1, outputTokens: 2048, charge: null } });
  } finally { rmSync(root, { recursive: true, force: true }); }
});
