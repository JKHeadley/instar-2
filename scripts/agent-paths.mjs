// Rules 4/26/93/103: exact enforcement of Justin's 2026-10-15 installation
// direction. TCC access can be revoked while an agent is running; do not put
// its root, workspace or state in these folders. Physical IO stays outside src/.
import { lstatSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';

const protectedFolders = ['Documents', 'Desktop', 'Downloads', 'Library/Mobile Documents'];

// This diagnostic contains only fixed labels, never raw configuration or paths.
export class AgentPathRefused extends Error {
  constructor(folder) {
    super(`Agent directory refused: macOS protected folder ~/${folder}. Use the agent home instead (~/.instar/agents/<agent>/).`);
  }
}

// Setup paths need not exist yet. Resolve the nearest existing ancestor, retaining
// the absent suffix. A dangling link is an error, never an absent directory.
function realLocation(path) {
  try { return realpathSync(path); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    let existing = false;
    try { lstatSync(path); existing = true; }
    catch (statError) { if (statError.code !== 'ENOENT') throw statError; }
    if (existing) throw error;
    const parent = dirname(path);
    if (parent === path) throw error;
    return join(realLocation(parent), basename(path));
  }
}

function protectedLocation(home, folder) {
  try { return realLocation(resolve(home, folder)); }
  catch (error) {
    // Revoked access or a broken unrelated desktop link must not prevent boot
    // in the agent home. The canonical home still anchors the protected name.
    if (!['EACCES', 'EPERM', 'ENOENT', 'ELOOP'].includes(error.code)) throw error;
    return join(realLocation(resolve(home)), folder);
  }
}

/** No writes, network, or policy changes. Linux deliberately has no TCC guard. */
export function assertAgentPaths(paths, { platform = process.platform, home = homedir() } = {}) {
  if (platform !== 'darwin') return;
  const within = (path, folder) => {
    const candidate = path.toLowerCase(), base = folder.toLowerCase();
    return candidate === base || candidate.startsWith(`${base}${sep}`);
  };
  for (const input of Object.values(paths)) {
    const path = resolve(input);
    // Check every protected spelling before IO: a denied TCC folder may not
    // be readable, even when its protected name is later in this list.
    for (const folder of protectedFolders)
      if (within(path, resolve(home, folder))) throw new AgentPathRefused(folder);
    const real = realLocation(path);
    for (const folder of protectedFolders)
      if (within(real, protectedLocation(home, folder))) throw new AgentPathRefused(folder);
  }
}
