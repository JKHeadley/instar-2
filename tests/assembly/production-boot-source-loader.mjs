// Standalone U4-G fixture host: source imports and the bin's dist imports share
// the exact same owner module identities. No core code or admission is replaced.
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('.') || specifier.startsWith('file:')) {
    const url = new URL(specifier, context.parentURL);
    let file = fileURLToPath(url);
    if (file.startsWith(`${root}/dist/`)) file = `${root}/src/${file.slice(`${root}/dist/`.length)}`;
    if (file.startsWith(`${root}/`) && file.endsWith('.js') && existsSync(file.slice(0, -3) + '.ts'))
      return next(pathToFileURL(file.slice(0, -3) + '.ts').href, context);
  }
  return next(specifier, context);
} });
