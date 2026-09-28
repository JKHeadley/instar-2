import { createHash } from 'node:crypto';

/**
 * The preview installation: this repository checkout (the shipped runner and the core it loads)
 * plus the runner's root (journal, run log). An update switches the checkout; the root stays.
 *
 * Rule 44: an update must reach the existing installation, not only new ones. The runner records
 * the exact code and briefing it loaded at each launch, detects that it is running a changed
 * installation, and carries that change into the agent's own context until a sent answer
 * provably included it. Rules 26/33 (verified installed revision): the running process's code is
 * compared with the files now installed, so a switch that was never restarted is visible.
 */
const sha256 = (bytes: string | Uint8Array) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

export interface InstalledCode { readonly revision: string | null; readonly codeDigest: string; readonly files: number }
export interface Installation extends InstalledCode {
  readonly briefingDigest: string; readonly harness: string; readonly stallClasses: number; readonly doorway: string;
}
export interface InstalledUpdate {
  readonly at: number; readonly from: { revision: string | null; codeDigest: string };
  readonly to: { revision: string | null; codeDigest: string }; readonly briefingChanged: boolean;
}

/** Digest over the exact bytes of every file the runner loaded, by repository path. */
export function codeDigestOf(files: readonly { path: string; bytes: Uint8Array | string }[]): string {
  const lines = [...files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
    .map(file => `${file.path}\0${sha256(file.bytes)}`);
  if (new Set(files.map(file => file.path)).size !== files.length) throw Error('preview: duplicate installed path');
  return sha256(lines.join('\n'));
}
/** Digest of what the agent is told about itself: its sources, instructions and capability note. */
export function briefingDigestOf(parts: readonly string[]): string { return sha256(JSON.stringify(parts)); }

/** Launch rows that recorded their installation, in launch order. */
export function installationRows(runsText: string): (Installation & { launch: number })[] {
  const rows: (Installation & { launch: number })[] = [];
  for (const line of runsText.split('\n')) {
    if (!line) continue;
    let row: { v?: unknown; launch?: unknown; exit?: unknown; install?: Partial<Installation> };
    try { row = JSON.parse(line) as typeof row; } catch { continue; }
    const install = row?.install;
    if (row?.v !== 1 || typeof row.launch !== 'number' || row.exit !== undefined || !install
      || typeof install.codeDigest !== 'string' || typeof install.briefingDigest !== 'string') continue;
    rows.push({ ...(install as Installation), launch: row.launch });
  }
  return rows.sort((a, b) => a.launch - b.launch);
}

const same = (a: Installation, b: Installation) => a.codeDigest === b.codeDigest && a.briefingDigest === b.briefingDigest;
/**
 * The update that installed the current code: the last recorded launch on different code, and
 * the first launch on this code after it. A restart on the same code keeps the same update, so a
 * briefing change is never lost because the runner restarted before delivering it. A first
 * recorded installation is not an update.
 */
export function installedUpdateFrom(rows: readonly (Installation & { launch: number })[], current: Installation,
  launchedAt: number): InstalledUpdate | null {
  const earlier = rows.filter(row => row.launch < launchedAt);
  const index = earlier.map(row => !same(row, current)).lastIndexOf(true);
  if (index < 0) return null;
  const previous = earlier[index]!, first = earlier.slice(index + 1).find(row => same(row, current));
  return { at: first?.launch ?? launchedAt, from: { revision: previous.revision, codeDigest: previous.codeDigest },
    to: { revision: current.revision, codeDigest: current.codeDigest }, briefingChanged: previous.briefingDigest !== current.briefingDigest };
}

/** The packet item that tells the agent its own installation changed (quoted data, never an instruction). */
export function updatePacketItem(update: InstalledUpdate) {
  return { at: update.at, from: update.from.revision ?? update.from.codeDigest, to: update.to.revision ?? update.to.codeDigest,
    briefingChanged: update.briefingChanged,
    note: 'Your installed code changed since your previous run. Your current sources and capability note describe what you can do now; earlier replies in history may describe an older installation. Say so if the operator relies on an older description.' };
}

/** The installed-update item a recorded prompt carried, read the same way the journal reads recall hits. */
function promptUpdate(prompt: string | undefined): { to?: unknown } | null {
  if (prompt === undefined) return null;
  try {
    const envelope = JSON.parse(prompt) as { messages?: { role?: string; content?: string }[] };
    const content = envelope.messages?.find(message => message.role === 'context')?.content;
    if (typeof content !== 'string') return null;
    const item = (JSON.parse(content) as { packet?: { installedUpdate?: unknown } }).packet?.installedUpdate;
    return item && typeof item === 'object' ? item as { to?: unknown } : null;
  } catch { return null; }
}
/** Delivery is proven only by a sent answer whose recorded prompt carried this exact update. */
export function updateDelivery(update: InstalledUpdate, turns: readonly { update: number; sentAt?: number; prompt?: string }[]) {
  const to = update.to.revision ?? update.to.codeDigest;
  const turn = turns.find(item => item.sentAt !== undefined && item.sentAt >= update.at && promptUpdate(item.prompt)?.to === to);
  return turn ? { deliveredInReplyTo: turn.update } : null;
}

/** Fixed status lines for the operator's pull surface. */
export function installationStatusLines(launched: Installation, launchedAt: number, installedNow: InstalledCode | null,
  update: InstalledUpdate | null, delivered: { deliveredInReplyTo: number } | null, zone: string): string[] {
  const short = (value: string | null, digest: string) => value ? value.slice(0, 8) : digest.slice(7, 15);
  const time = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(launchedAt).replace(',', '');
  const stale = installedNow !== null && installedNow.codeDigest !== launched.codeDigest;
  return [
    `Build: ${short(launched.revision, launched.codeDigest)} running since ${time}; ${installedNow === null ? 'installed files could not be re-read'
      : stale ? `installed files changed to ${short(installedNow.revision, installedNow.codeDigest)} — a restart is needed to run them`
        : 'running code matches the installed files'}.`,
    `Harness: ${launched.harness} via ${launched.doorway}; ${launched.stallClasses} of 9 silent-stop classes covered.`,
    ...(update ? [`Update: from ${short(update.from.revision, update.from.codeDigest)}; ${update.briefingChanged ? 'briefing changed' : 'briefing unchanged'}; `
      + `${delivered ? `delivered in my reply to update ${delivered.deliveredInReplyTo}` : 'not yet carried into a sent reply'}.`] : []),
  ];
}
