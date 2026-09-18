import { createHash } from 'node:crypto';
import type { Result } from '../index.js';
import type { ProviderObservation } from '../judgment/index.js';
import { boundary, ensure, take } from './boundary.js';
import { createProviderCredentialCustodian } from './provider-credential-custodian.js';
import type { ProviderCredentialCustodianInput } from './provider-credential-custodian.js';
import type { ConfinedProviderRoute } from './provider-invocation.js';

export interface ProductionProviderIO {
  realpath(path: string): string;
  executableBytes(path: string): Uint8Array;
  execute(input: Readonly<{ executable: string; args: readonly string[]; cwd: string;
    env: Readonly<Record<string, string>>; stdin: string; timeout: number; maxBytes: number }>):
    Promise<Readonly<{ code: number | null; limited: boolean; stdout: string }>>;
}

/** Ten-only transport construction. The executable digest and model come from
 * the admitted route; credentials are resolved once inside the custodian. */
export function createClaudeCodeProductionRoute(input: Omit<ProviderCredentialCustodianInput, 'submit'> & Readonly<{
  executable: string; artifact: string; workingDirectory: string; io: ProductionProviderIO;
}>): Result<ConfinedProviderRoute> {
  input = Object.freeze({ ...input });
  return boundary('ProductionClaudeCodeRoute', null, input.context, () => {
    const exactExecutable = () => {
      ensure(input.io.realpath(input.executable) === input.executable,
        'provider-route: exact executable required');
      ensure(`sha256:${createHash('sha256').update(input.io.executableBytes(input.executable)).digest('hex')}` === input.artifact,
        'provider-route: executable artifact changed');
    };
    exactExecutable();
    ensure(input.io.realpath(input.workingDirectory) === input.workingDirectory,
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
      const args = ['--bare', '--print', '--input-format', 'text', '--output-format', 'json',
        '--model', config.model, '--tools', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
        '--setting-sources', '', '--settings', '{"disableAllHooks":true}', '--disable-slash-commands',
        '--no-session-persistence', '--max-turns', '1', '--max-budget-usd', String(bounds.maxCharge / 1_000_000)];
      const response = await config.io.execute({ executable: config.executable, args,
        cwd: config.workingDirectory,
        env: { PATH: '/usr/bin:/bin', HOME: config.workingDirectory,
          CLAUDE_CONFIG_DIR: config.workingDirectory, ANTHROPIC_API_KEY: credential,
          CLAUDE_CODE_MAX_RETRIES: '0', CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(bounds.maxTokens),
          CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' },
        stdin: bytes, timeout: bounds.timeout, maxBytes: 6 * bounds.maxOutputBytes + 8192 });
      if (response.limited || response.code !== 0) return uncertain();
      try {
            const result = JSON.parse(response.stdout);
            const output = result.structured_output === undefined ? result.result : JSON.stringify(result.structured_output);
            const integer = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
            const charge = Math.ceil(result.total_cost_usd * 1_000_000);
            ensure(result.type === 'result' && result.is_error === false && typeof output === 'string'
              && Buffer.byteLength(output) <= bounds.maxOutputBytes && typeof result.session_id === 'string'
              && result.session_id.length <= 256 && integer(result.usage?.input_tokens)
              && integer(result.usage?.output_tokens) && result.usage.output_tokens <= bounds.maxTokens
              && integer(charge) && charge <= bounds.maxCharge, 'provider response outside admitted bounds');
            return { state: 'complete', bytes: output, providerOperation: result.session_id,
              usage: { inputTokens: result.usage.input_tokens, outputTokens: result.usage.output_tokens,
                charge, source: 'Claude Code result usage; charge in micro-USD' }, retryBlocked: false };
      } catch { return uncertain(); }
    } }));
  });
}
