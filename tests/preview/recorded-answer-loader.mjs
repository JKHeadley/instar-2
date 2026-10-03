// Offline launcher tests only: the subscription route is replaced by recorded real model outputs (recorded-answer-route.mjs).
export async function resolve(specifier, context, next) {
  if (context.parentURL?.endsWith('/journal-agent.mjs') && specifier.endsWith('/production-provider.js'))
    return { url: new URL('./recorded-answer-route.mjs', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
}
