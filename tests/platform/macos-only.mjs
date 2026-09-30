// Which test files exercise a macOS-only mechanism, so a full test run can be split between a
// Linux host (INSTAR_TEST_PLATFORM_SPLIT=exclude-macos) and a Mac (only-macos). The checked-in
// list is tests/platform/macos-only.txt; tests/platform/macos-only.test.ts fails when the list
// and this detection disagree. `node tests/platform/macos-only.mjs` prints the detected list.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LIST_PATH = 'tests/platform/macos-only.txt';

// A macOS-only tool launched as a process: the seatbelt sandbox, launchd, property lists,
// disk images, or BSD `stat -f` (GNU stat reads -f as "file system").
const MACOS_SPAWN = /\b(?:spawn|spawnSync|execFile|execFileSync|exec|execSync)\(\s*['"`](?:\/usr\/s?bin\/|\/s?bin\/)?(?:sandbox-exec|launchctl|plutil|hdiutil|diskutil)['"`]/;
const BSD_STAT = /['"`]\/usr\/bin\/stat['"`]\s*,\s*\[\s*['"`]-f['"`]/;
// A test gated on darwin, so on any other host it is skipped and would never run in the split.
const DARWIN_CONST = /\b(?:const|let)\s+(\w+)\s*=\s*process\.platform\s*===\s*['"`]darwin['"`]/g;
const DARWIN_GATE = /\.(?:runIf|skipIf)\(\s*!?\s*(?:process\.platform\s*[!=]==\s*['"`]darwin['"`]|['"`]darwin['"`])/;

const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"`](\.{1,2}\/[^'"`]+)['"`]/g;

/** The mechanism a source text exercises directly, or null. */
export function macosMechanism(text) {
  if (MACOS_SPAWN.test(text)) return 'spawns a macOS-only tool';
  if (BSD_STAT.test(text)) return 'uses BSD stat -f';
  if (DARWIN_GATE.test(text)) return 'gates tests on darwin';
  for (const [, name] of text.matchAll(DARWIN_CONST))
    if (new RegExp(`\\.(?:runIf|skipIf)\\(\\s*!?\\s*${name}\\b`).test(text)) return 'gates tests on darwin';
  return null;
}

// Relative imports resolved to files under tests/ or scripts/; tests/setup/ is the platform-aware
// run harness every file shares, so it is not followed.
function localImports(root, file, text) {
  const out = [];
  for (const [, spec] of text.matchAll(IMPORT)) {
    const base = resolve(dirname(join(root, file)), spec);
    const found = [base, base.replace(/\.js$/, '.ts'), `${base}.ts`, `${base}.mjs`, `${base}.js`]
      .find(path => existsSync(path) && statSync(path).isFile());
    if (!found) continue;
    const rel = relative(root, found).split(sep).join('/');
    if ((rel.startsWith('tests/') || rel.startsWith('scripts/')) && !rel.startsWith('tests/setup/')) out.push(rel);
  }
  return out;
}

/** The macOS mechanism a file reaches, itself or through its local imports, or null. */
export function reachedMechanism(root, file, read = path => readFileSync(join(root, path), 'utf8')) {
  const seen = new Set(), queue = [file];
  while (queue.length) {
    const next = queue.shift();
    if (seen.has(next)) continue;
    seen.add(next);
    const text = read(next);
    const found = macosMechanism(text);
    if (found) return next === file ? found : `${found} (via ${next})`;
    queue.push(...localImports(root, next, text));
  }
  return null;
}

function testFiles(root, dir = 'tests') {
  const out = [];
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...testFiles(root, rel));
    else if (entry.name.endsWith('.test.ts')) out.push(rel);
  }
  return out;
}

/** Every test file that exercises a macOS-only mechanism, sorted, with its reason. */
export function detectMacosOnly(root) {
  return testFiles(root).sort().flatMap(file => {
    const reason = reachedMechanism(root, file);
    return reason ? [{ file, reason }] : [];
  });
}

/** The checked-in list: one path per line; blank lines and # comments ignored. */
export function readList(text) {
  return text.split('\n').map(line => line.replace(/#.*/, '').trim()).filter(Boolean);
}

/** Detected files missing from the list, and listed files the detection no longer finds. */
export function listDrift(detected, listed) {
  return { missing: detected.filter(file => !listed.includes(file)), stale: listed.filter(file => !detected.includes(file)) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const { file, reason } of detectMacosOnly(process.cwd())) console.log(`${file}  # ${reason}`);
}
