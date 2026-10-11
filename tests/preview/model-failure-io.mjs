// Only the provider executor is replaced. The launcher still observes executor entry,
// so a simulated lost answer is UNKNOWN after launch, not a pre-launch refusal.
export * from '../../scripts/production-boot-io.mjs';
export const createSubscriptionProviderIO = () => ({
  execute: async () => ({ code: null, stdout: '', stderr: '', limited: true, localLimit: 'timeout' }),
});
