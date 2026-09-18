import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import type { Result } from '../index.js';
import type { ProviderObservation } from '../judgment/index.js';
import { boundary, ensure, take } from './boundary.js';
import { createProviderCredentialCustodian } from './provider-credential-custodian.js';
import type { ProviderCredentialCustodianInput } from './provider-credential-custodian.js';
import type { ConfinedProviderRoute } from './provider-invocation.js';

/** Ten-only transport construction. The executable digest and model come from
 * the admitted route; credentials are resolved once inside the custodian. */
export function createClaudeCodeProductionRoute(input: Omit<ProviderCredentialCustodianInput, 'submit'> & Readonly<{
  executable: string; artifact: string; workingDirectory: string;
}>): Result<ConfinedProviderRoute> {
  input = Object.freeze({ ...input });
  return boundary('ProductionClaudeCodeRoute', null, input.context, () => {
    const exactExecutable = () => {
      ensure(realpathSync(input.executable) === input.executable && lstatSync(input.executable).isFile(),
        'provider-route: exact executable required');
      ensure(`sha256:${createHash('sha256').update(readFileSync(input.executable)).digest('hex')}` === input.artifact,
        'provider-route: executable artifact changed');
    };
    exactExecutable();
    ensure(realpathSync(input.workingDirectory) === input.workingDirectory,
      'provider-route: canonical working directory required');
    ensure(input.provider === 'anthropic' && input.model.length > 0 && !input.model.startsWith('-'),
      'provider-route: one explicit Anthropic model required');
    const config = Object.freeze({ ...input });
    return take(createProviderCredentialCustodian({ ...config, submit: async (credential, bytes, bounds) => {
      exactExecutable();
      const uncertain = (): ProviderObservation => ({ state: 'uncertain', bytes: null, providerOperation: null,
        usage: { inputTokens: null, outputTokens: null, charge: null,
          source: 'Claude Code transport unresolved; no retry; liability retained' }, retryBlocked: false });
      if (!Number.isSafeInteger(bounds.timeout) || bounds.timeout <= 0 || bounds.automaticRetries !== 0)
        return uncertain();
      // No inherited credentials, settings, plugins, project hooks, tools, MCP,
      // conversation history, or working-tree instructions enter this child.
      const args = ['--print', '--input-format', 'text', '--output-format', 'json',
        '--model', config.model, '--tools', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
        '--setting-sources', '', '--settings', '{"disableAllHooks":true}', '--disable-slash-commands',
        '--no-session-persistence', '--max-turns', '1', '--max-budget-usd', String(bounds.maxCharge / 1_000_000)];
      return await new Promise<ProviderObservation>(resolve => {
        const child = spawn(config.executable, args, { cwd: config.workingDirectory, shell: false,
          env: { PATH: '/usr/bin:/bin', HOME: config.workingDirectory,
            CLAUDE_CONFIG_DIR: config.workingDirectory, ANTHROPIC_API_KEY: credential,
            CLAUDE_CODE_MAX_RETRIES: '0', CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(bounds.maxTokens),
            CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' }, stdio: ['pipe', 'pipe', 'ignore'] });
        let chunks: Buffer[] = [], size = 0, failed = false;
        const fail = () => { failed = true; chunks = []; child.kill('SIGKILL'); };
        const timer = setTimeout(fail, bounds.timeout);
        child.on('error', () => { clearTimeout(timer); resolve(uncertain()); });
        child.stdin.on('error', fail);
        child.stdout.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > 6 * bounds.maxOutputBytes + 8192) fail();
          else if (!failed) chunks.push(chunk);
        });
        child.on('close', code => {
          clearTimeout(timer);
          if (failed || code !== 0) { resolve(uncertain()); return; }
          try {
            const response = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            const output = response.structured_output === undefined ? response.result : JSON.stringify(response.structured_output);
            const integer = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
            const charge = Math.ceil(response.total_cost_usd * 1_000_000);
            ensure(response.type === 'result' && response.is_error === false && typeof output === 'string'
              && Buffer.byteLength(output) <= bounds.maxOutputBytes && typeof response.session_id === 'string'
              && response.session_id.length <= 256 && integer(response.usage?.input_tokens)
              && integer(response.usage?.output_tokens) && response.usage.output_tokens <= bounds.maxTokens
              && integer(charge) && charge <= bounds.maxCharge, 'provider response outside admitted bounds');
            resolve({ state: 'complete', bytes: output, providerOperation: response.session_id,
              usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
                charge, source: 'Claude Code result usage; charge in micro-USD' }, retryBlocked: false });
          } catch { resolve(uncertain()); }
        });
        // These are Seven's exact recorded bytes, with no prompt reformatting.
        child.stdin.end(bytes, 'utf8');
      });
    } }));
  });
}
