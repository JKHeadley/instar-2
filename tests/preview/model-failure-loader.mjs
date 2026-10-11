export async function resolve(specifier, context, next) {
  if (context.parentURL?.endsWith('/journal-agent.mjs') && specifier.endsWith('/production-provider.js'))
    return { url: new URL('./model-failure-route.mjs', import.meta.url).href, shortCircuit: true };
  if (context.parentURL?.endsWith('/journal-agent.mjs') && specifier.endsWith('/production-boot-io.mjs'))
    return { url: new URL('./model-failure-io.mjs', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
}
