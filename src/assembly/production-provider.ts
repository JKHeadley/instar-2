import { createHash } from 'node:crypto';
import type { Result } from '../index.js';
import type { ProviderObservation } from '../judgment/index.js';
import { hashBytes } from '../facts/index.js';
import { boundary, encoded, ensure, take } from './boundary.js';
import { createProviderCredentialCustodian } from './provider-credential-custodian.js';
import type { ProviderCredentialCustodianInput } from './provider-credential-custodian.js';
import { registerProviderResponseEvidenceBounds } from './provider-invocation.js';
import type { ConfinedProviderRoute, ProviderResponseEvidenceDraft } from './provider-invocation.js';

export interface ProductionProviderIO {
  realpath(path: string): string;
  executableBytes(path: string): Uint8Array;
  execute(input: Readonly<{ executable: string; args: readonly string[]; cwd: string;
    env: Readonly<Record<string, string>>; stdin: string; timeout: number; maxBytes: number }>):
    Promise<Readonly<{ code: number | null; limited: boolean; stdout: string; stdoutBytes: Uint8Array }>>;
}

export interface ProviderAdapterEvidenceContract {
  readonly reference: string; readonly version: string; readonly parserReference: string; readonly parserVersion: string;
  readonly endpoint: string; readonly account: string; readonly credentialReference: string; readonly controller: string;
  readonly sourceEvidence: readonly string[]; readonly terminalEvidence: string; readonly terminalReasonField: string;
  readonly successfulFinalReplyReasons: readonly string[]; readonly strength: 'proof' | 'observation' | 'attestation' | 'inference';
  readonly maxMetadataBytes: number; readonly maxRawTerminalBytes: number; readonly maxCaptureBytes: number;
}

/** Ten-only transport construction. The executable digest and model come from
 * the admitted route; credentials are resolved once inside the custodian. */
export function createClaudeCodeProductionRoute(input: Omit<ProviderCredentialCustodianInput, 'submit'> & Readonly<{
  executable: string; artifact: string; workingDirectory: string; io: ProductionProviderIO;
  adapterEvidenceContract?: ProviderAdapterEvidenceContract;
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
    const route = take(createProviderCredentialCustodian({ ...config, submit: async (credential, bytes, bounds) => {
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
        stdin: bytes, timeout: bounds.timeout,
        maxBytes: config.adapterEvidenceContract?.maxRawTerminalBytes ?? 6 * bounds.maxOutputBytes + 8192 });
      if (response.limited || response.code !== 0) return uncertain();
      try {
            const terminalBytes = new Uint8Array(response.stdoutBytes);
            const terminal = new TextDecoder('utf-8', { fatal: true }).decode(terminalBytes);
            ensure(terminal === response.stdout, 'provider response text differs from exact stdout bytes');
            const result = JSON.parse(terminal);
            ensure(result && typeof result === 'object' && !Array.isArray(result), 'provider result frame must be one object');
            const output = result.structured_output === undefined ? result.result : JSON.stringify(result.structured_output);
            const integer = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
            const charge = Math.ceil(result.total_cost_usd * 1_000_000);
            ensure(result.type === 'result' && result.is_error === false && typeof output === 'string'
              && Buffer.byteLength(output) <= bounds.maxOutputBytes && typeof result.session_id === 'string'
              && result.session_id.length <= 256 && integer(result.usage?.input_tokens)
              && integer(result.usage?.output_tokens) && result.usage.output_tokens <= bounds.maxTokens
              && integer(charge) && charge <= bounds.maxCharge, 'provider response outside admitted bounds');
            const approved = config.adapterEvidenceContract;
            const terminalReason = approved ? result[approved.terminalReasonField] : undefined;
            const reasonText = typeof terminalReason === 'string' ? terminalReason.toLowerCase() : '';
            const admitted = !!approved && approved.reference.length > 0 && approved.version.length > 0
              && approved.parserReference.length > 0 && approved.parserVersion.length > 0
              && approved.endpoint.length > 0 && approved.account.length > 0
              && approved.credentialReference === config.credential.name && approved.controller.length > 0
              && approved.sourceEvidence.length > 0 && approved.terminalEvidence.length > 0
              && typeof terminalReason === 'string' && approved.successfulFinalReplyReasons.includes(terminalReason);
            const draft: ProviderResponseEvidenceDraft = {
              eligibility: admitted ? 'admitted' : 'held',
              contract: { parserReference: approved?.parserReference ?? 'claude-code-json-result',
                parserVersion: approved?.parserVersion ?? '1',
                evidenceContractReference: approved?.reference ?? 'HOLD-provider-response-source-and-completion-evidence',
                evidenceContractVersion: approved?.version ?? 'unapproved', mode: 'single-final-reply',
                maxMetadataBytes: approved?.maxMetadataBytes ?? 1,
                maxRawTerminalBytes: approved?.maxRawTerminalBytes ?? 1,
                maxCaptureBytes: approved?.maxCaptureBytes ?? 1 },
              basis: { sourceEvidence: approved?.sourceEvidence ?? [], terminalEvidence: approved?.terminalEvidence ?? '',
                terminalReasonField: approved?.terminalReasonField ?? '',
                successfulFinalReplyReasons: approved?.successfulFinalReplyReasons ?? [] },
              source: { controller: approved?.controller ?? '', evidence: approved?.sourceEvidence ?? [],
                endpoint: approved?.endpoint ?? '', account: approved?.account ?? '',
                credentialReference: approved?.credentialReference ?? '', executableArtifact: config.artifact,
                provider: config.provider, model: config.model, route: config.route, call: result.session_id,
                submittedDigest: encoded(bytes).hash, strength: approved?.strength ?? 'observation' },
              terminal: { rawBase64: Buffer.from(terminalBytes).toString('base64'),
                rawDigest: `sha256:${createHash('sha256').update(terminalBytes).digest('hex')}`,
                evidence: approved?.terminalEvidence ?? '', reason: admitted ? 'successful-final-reply' : 'unsupported-terminal-evidence',
                providerReason: typeof terminalReason === 'string' ? terminalReason : 'unsupported',
                limited: response.limited, errored: result.is_error === true, cancelled: reasonText.includes('cancel'),
                timedOut: reasonText.includes('timeout'), truncated: reasonText.includes('limit') || reasonText.includes('length'),
                toolCall: reasonText.includes('tool') || reasonText.includes('function') },
              answer: { extractionContract: `${approved?.parserReference ?? 'claude-code-json-result'}:${approved?.parserVersion ?? '1'}`,
                answerDigest: hashBytes(output) },
            };
            return { state: 'complete', bytes: output, providerOperation: result.session_id,
              usage: { inputTokens: result.usage.input_tokens, outputTokens: result.usage.output_tokens,
                charge, source: 'Claude Code result usage; charge in micro-USD' }, retryBlocked: false,
              responseEvidenceDraft: draft };
      } catch { return uncertain(); }
    } }));
    const approved = config.adapterEvidenceContract;
    if (approved) {
      ensure(approved.parserReference === 'claude-code-json-result' && approved.parserVersion === '1'
        && approved.reference.length > 0 && approved.version.length > 0 && approved.sourceEvidence.length > 0
        && approved.terminalEvidence.length > 0 && approved.terminalReasonField.length > 0
        && approved.successfulFinalReplyReasons.length > 0,
      'approved provider response evidence contract is incomplete or unsupported');
      registerProviderResponseEvidenceBounds(route, { parserReference: approved.parserReference,
        parserVersion: approved.parserVersion, evidenceContractReference: approved.reference,
        evidenceContractVersion: approved.version, mode: 'single-final-reply',
        maxMetadataBytes: approved.maxMetadataBytes, maxRawTerminalBytes: approved.maxRawTerminalBytes,
        maxCaptureBytes: approved.maxCaptureBytes });
    }
    return route;
  });
}
