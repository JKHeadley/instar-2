// @ts-nocheck -- offline conformance fixtures replace only each doorway's physical IO.
import { offlineProfile } from './successive-fixture.js';

export type DoorwayOutcome = 'complete' | 'refused' | 'timeout' | 'over-cap';
/**
 * Rule 115: one captured-frame conformance fixture per registered model doorway. Each fixture
 * replaces only the doorway's physical IO and reproduces that doorway's real output frames, so the
 * shared harness contract runs through the doorway's own adapter code. A registered doorway with
 * no fixture here must be listed unsupported, with its reason, in the parity register.
 */
export const DOORWAY_CONFORMANCE = Object.freeze({
  'claude-code-subscription': {
    profile: offlineProfile, provider: 'anthropic',
    io(state: { outcome: DoorwayOutcome; calls: number; stdin: string[] }) {
      return { realpath: path => path, executableBytes: () => Buffer.from('offline executable bytes'),
        inspectSubscriptionProfile: profile => ({ loginProfileIdentity: profile.loginProfileIdentity,
          managedConfigurationDigest: profile.managedConfigurationDigest }),
        execute: async command => {
          let stdout;
          if (command.args[0] === '--version') stdout = '2.1.280 (Claude Code)';
          else if (command.args[0] === 'auth') stdout = JSON.stringify({ loggedIn: true, authMethod: 'claude.ai',
            apiProvider: 'firstParty', analyticsDisabled: true, projectsDirectory: `${offlineProfile.configDirectory}/projects`,
            configDirectory: offlineProfile.configDirectory, email: offlineProfile.expectedAccount,
            orgId: offlineProfile.organization, orgName: 'Offline', subscriptionType: 'max' });
          else {
            state.calls++; state.stdin.push(command.stdin);
            if (state.outcome === 'timeout') return { code: null, limited: true, localLimit: 'timeout', stdout: '', stdoutBytes: new Uint8Array() };
            const decision = { type: 'Decision', schemaVersion: 1, id: 'conformance-answer',
              conclusion: { subject: 'preview-stage2-answer', value: 'conformance answer' } };
            stdout = JSON.stringify(state.outcome === 'refused'
              ? { type: 'result', subtype: 'success', is_error: true, result: 'provider refusal', session_id: 'conformance-refused',
                usage: { input_tokens: 8, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 } }
              : { type: 'result', subtype: 'success', is_error: false, result: JSON.stringify(decision), session_id: 'conformance-call',
                usage: { input_tokens: 8, cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
                  output_tokens: state.outcome === 'over-cap' ? 1_000_000 : 3 } });
          }
          return { code: state.outcome === 'refused' && command.args.includes('--print') ? 1 : 0, limited: false,
            stdout, stdoutBytes: new Uint8Array(Buffer.from(stdout)) };
        } };
    },
  },
});
