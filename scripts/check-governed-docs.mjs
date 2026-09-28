#!/usr/bin/env node
// Rule 91's named enforcer: walk every governed document and fail on a history marker in
// the body. Governed is a property a document declares (its status line says "Governed"),
// never a folder. A document is also governed by reference: a rule book, policy register or
// register entry that names a document makes it governed, and the build then requires it to
// declare so. Discovery covers every tracked markdown file, inside docs/ or not. History
// belongs in the sibling NAME.changelog.json, which scripts/validate-changelog.mjs checks for
// every discovered governed document.
//
// Markers, exactly as rule 91 lists them: the words "revision", "first draft",
// "what changed in", or a "§R" marker. A governed document must also have its sibling
// changelog beside it.
//
// Usage: node scripts/check-governed-docs.mjs <path-or-dir> [more...]
//        node scripts/check-governed-docs.mjs docs
// The paths add to the discovered set; they never narrow it.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

// Sources whose references govern the documents they name (rule 91, "Referenced").
export const REFERENCE_SOURCES = ["docs/00-the-purpose.md", "docs/00-the-policy-register.md", "docs/01-the-rules.md", "docs/02-the-register.md", "generated/register.json"];

// Rule 91: a governed document needs its sibling changelog once it has MORE THAN ONE approved
// version. Rule 90's version count is not built yet; the honest proxy is the number of commits
// on main that touched the document. One commit = one version = no changelog required yet.
function approvedVersions(file) {
  try {
    return Number(execFileSync("git", ["rev-list", "--count", "origin/main", "--", file], { encoding: "utf8" }).trim());
  } catch { return Infinity; } // no git: assume many, so the stricter rule applies
}

// Known non-history uses of a marker word, each with the reason it is content rather than
// history. Every entry is a visible, reviewable exception; adding one is a reviewed change.
const ALLOW = [
  { file: "docs/21-the-recall-doorway/15-operator-decisions-and-honest-limits.md", line: 121, why: "names the pending constitutional authority in PR #71, not this design's history" },
  { file: "docs/21-the-recall-doorway/15-operator-decisions-and-honest-limits.md", line: 133, why: "names the pending constitutional authority in PR #71, not this design's history" },
  { file: "docs/21-the-recall-doorway/15-operator-decisions-and-honest-limits.md", line: 192, why: "names the pending constitutional authority in PR #71, not this design's history" },
  { file: "docs/rules/91-a-document-reads-as-its-first-version.md", why: "the rule's own full text quotes the markers it bans" },
  { file: "docs/02-the-register.md", line: 218, why: "'revision' names a round of the pre-send review pattern, not a document history" },
  { file: "docs/01-the-rules.md", line: 233, why: "rule 91's own row in the rule book quotes the marker it bans" },
];

const MARKERS = [
  { re: /\brevision\b/i, name: "revision" },
  { re: /\bfirst draft\b/i, name: "first draft" },
  { re: /\bwhat changed in\b/i, name: "what changed in" },
  { re: /§R/, name: "§R marker" },
];

export function walk(p, out) {
  const st = statSync(p);
  if (st.isDirectory()) { for (const f of readdirSync(p)) walk(join(p, f), out); return; }
  if (p.endsWith(".md") && !p.endsWith(".changelog.md")) out.push(p);
}

export function isGoverned(text) {
  // The status line is the first bold "**Status: ...**" line; governed is declared there.
  const m = text.match(/^\*\*Status:[^\n]*\*\*/m);
  return !!m && /\bGoverned\b/.test(m[0]);
}

// A governed design may be a short index plus numbered section files. The index is
// the governance declaration and changelog owner; its linked sections are one body
// with it for the marker scan. Only the stable split-doc shape is followed, so an
// unrelated markdown link cannot silently enlarge the governed body.
export function indexedSections(file, text) {
  const sectionStart = text.search(/^## Sections\s*$/m);
  if (sectionStart < 0) return [];
  const body = text.slice(sectionStart);
  const expectedDir = normalize(file.replace(/\.md$/, ""));
  const linked = [];
  const seen = new Set();
  const link = /^\s*\d+\.\s+\[[^\]]+\]\(([^)#?]+\.md)\)\s*$/gm;
  for (let match = link.exec(body); match; match = link.exec(body)) {
    const child = normalize(join(dirname(file), match[1]));
    if (dirname(child) !== expectedDir || !/^\d{2}-[^/]+\.md$/.test(child.slice(expectedDir.length + 1))) continue;
    if (seen.has(child)) continue;
    seen.add(child);
    linked.push(child);
  }
  return linked;
}

function allowed(file, lineNo) {
  return ALLOW.some((a) => a.file === file && (a.line == null || a.line === lineNo));
}

// Every tracked markdown document (falls back to walking docs/ without git). Generated
// output (generated/, NAME.changelog.md) is not a governed document (rule 91): it is rebuilt
// from governed sources, and the register check refuses drift.
const GENERATED = /(^|\/)generated\/|\.changelog\.md$/;
export function trackedDocuments(root = ".") {
  try {
    return execFileSync("git", ["-C", root, "ls-files", "*.md"], { encoding: "utf8" }).split("\n")
      .filter((f) => f && !GENERATED.test(f)).map((f) => normalize(join(root, f)));
  } catch { const out = []; if (existsSync(join(root, "docs"))) walk(join(root, "docs"), out); return out.map(normalize); }
}

// Documents a rule or register entry names. Relative names resolve beside the naming source;
// a name that resolves to no file (a 1.x source, a template like NAME.md) is reported, not governed.
export function referencedDocuments(root = ".") {
  const found = new Map(); const unresolved = [];
  for (const source of REFERENCE_SOURCES) {
    const path = join(root, source);
    if (!existsSync(path)) continue;
    for (const name of new Set(readFileSync(path, "utf8").match(/[A-Za-z0-9_./-]+\.md\b/g) ?? [])) {
      if (name.endsWith(".changelog.md")) continue;
      const candidates = [normalize(join(root, name)), normalize(join(dirname(path), name))];
      const hit = candidates.find((c) => existsSync(c) && statSync(c).isFile());
      if (hit) { if (!found.has(hit)) found.set(hit, source); } else unresolved.push(`${source} -> ${name}`);
    }
  }
  return { referenced: [...found.entries()].map(([file, source]) => ({ file, source })), unresolved };
}

// The one governed set: declared documents plus referenced ones (which must declare).
export function discoverGoverned(root = ".", extra = []) {
  const files = [...new Set([...trackedDocuments(root), ...extra.map(normalize)])].filter((f) => existsSync(f) && !GENERATED.test(f));
  const texts = new Map(files.map((file) => [file, readFileSync(file, "utf8")]));
  const errors = [];
  const bodies = [];
  const sectionsOf = new Map();
  for (const file of files) {
    const text = texts.get(file);
    if (!isGoverned(text)) continue;
    const sections = indexedSections(file, text);
    for (const section of sections) sectionsOf.set(section, file);
    bodies.push({ file, text, sections });
  }
  const { referenced, unresolved } = referencedDocuments(root);
  for (const { file, source } of referenced) {
    const text = texts.get(file) ?? readFileSync(file, "utf8");
    if (!isGoverned(text) && !sectionsOf.has(file)) errors.push(`${file}: named by ${source} but does not declare itself governed (rule 91)`);
  }
  const governed = bodies.filter(({ file }) => !sectionsOf.has(file));
  return { files, texts, bodies, governed, sectionsOf, errors, unresolved };
}

// The governed document that owns a path: itself, or the index whose section it is.
export function governingDocument(path, discovery) {
  const file = normalize(path);
  if (discovery.sectionsOf.has(file)) return discovery.sectionsOf.get(file);
  return discovery.governed.some((g) => g.file === file) ? file : null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) { console.error("usage: check-governed-docs.mjs <path-or-dir> [...]"); process.exit(2); }
  const extra = [];
  for (const a of args) walk(a, extra);
  const discovery = discoverGoverned(".", extra);
  const errors = [...discovery.errors];
  let coveredSections = 0;
  const changelogs = [];
  for (const { file, text, sections } of discovery.governed) {
    for (const section of sections) if (!existsSync(section)) errors.push(`${file}: indexed section is missing: ${section}`);
    const changelog = file.replace(/\.md$/, ".changelog.json");
    if (existsSync(changelog)) changelogs.push(changelog);
    else if (approvedVersions(file) > 1)
      errors.push(`${file}: governed with more than one approved version but no sibling ${changelog.split("/").pop()} (rule 91)`);
    const bodyFiles = [{ file, text }];
    for (const section of sections) {
      if (!existsSync(section)) continue;
      coveredSections++;
      bodyFiles.push({ file: section, text: discovery.texts.get(section) ?? readFileSync(section, "utf8") });
    }
    for (const bodyFile of bodyFiles) {
      bodyFile.text.split("\n").forEach((line, i) => {
        const lineNo = i + 1;
        for (const m of MARKERS) {
          if (m.re.test(line) && !allowed(bodyFile.file, lineNo)) errors.push(`${bodyFile.file}:${lineNo}: history marker "${m.name}" in the body — move it to the changelog (rule 91)`);
        }
      });
    }
  }
  // The discovered set, not a pair of globs, decides which changelogs are validated.
  if (changelogs.length) {
    const validator = join(dirname(fileURLToPath(import.meta.url)), "validate-changelog.mjs");
    const run = spawnSync(process.execPath, [validator, ...changelogs], { encoding: "utf8" });
    if (run.status !== 0) errors.push(`sibling changelog validation failed:\n${(run.stderr || run.stdout).trim()}`);
  }
  if (errors.length) {
    console.error(`governed-document check FAILED (${errors.length}):`);
    for (const e of errors) console.error("  - " + e);
    process.exit(1);
  }
  const governed = discovery.governed.length;
  console.log(`governed-document check OK (${governed} governed bod${governed === 1 ? "y" : "ies"} of ${discovery.files.length} files scanned; ${coveredSections} indexed section file${coveredSections === 1 ? "" : "s"} covered; ${changelogs.length} changelogs validated; ${discovery.unresolved.length} unresolved references outside this repository)`);
}
