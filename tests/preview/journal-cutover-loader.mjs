// Process-level fixture: only the physical Telegram port and model route are replaced.
export async function resolve(specifier, context, next) {
  if (context.parentURL?.endsWith('/journal-agent.mjs') && specifier.endsWith('/production-boot-io.mjs'))
    return { url: new URL('./journal-cutover-ports.mjs', import.meta.url).href, shortCircuit: true };
  if (context.parentURL?.endsWith('/journal-agent.mjs') && specifier.endsWith('/production-provider.js'))
    return { url: new URL('./journal-cutover-model.mjs', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
}
