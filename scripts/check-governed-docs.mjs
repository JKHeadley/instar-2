#!/usr/bin/env node
// Rule 91's named enforcer: walk every governed document and fail on a history marker in
// the body. Governed is a property a document declares (its status line says "Governed"),
// never a folder. History belongs in the sibling NAME.changelog.json, which
// scripts/validate-changelog.mjs checks.
//
// Markers, exactly as rule 91 lists them: the words "revision", "first draft",
// "what changed in", or a "§R" marker. A governed document must also have its sibling
// changelog beside it.
//
// Usage: node scripts/check-governed-docs.mjs <path-or-dir> [more...]
//        node scripts/check-governed-docs.mjs docs
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { execFileSync } from "node:child_process";

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
  { file: "docs/01-the-rules.md", line: 228, why: "rule 91's own row in the rule book quotes the marker it bans" },
];

const MARKERS = [
  { re: /\brevision\b/i, name: "revision" },
  { re: /\bfirst draft\b/i, name: "first draft" },
  { re: /\bwhat changed in\b/i, name: "what changed in" },
  { re: /§R/, name: "§R marker" },
];

function walk(p, out) {
  const st = statSync(p);
  if (st.isDirectory()) { for (const f of readdirSync(p)) walk(join(p, f), out); return; }
  if (p.endsWith(".md") && !p.endsWith(".changelog.md")) out.push(p);
}

function isGoverned(text) {
  // The status line is the first bold "**Status: ...**" line; governed is declared there.
  const m = text.match(/^\*\*Status:[^\n]*\*\*/m);
  return !!m && /\bGoverned\b/.test(m[0]);
}

// A governed design may be a short index plus numbered section files. The index is
// the governance declaration and changelog owner; its linked sections are one body
// with it for the marker scan. Only the stable split-doc shape is followed, so an
// unrelated markdown link cannot silently enlarge the governed body.
function indexedSections(file, text) {
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

const args = process.argv.slice(2);
if (args.length === 0) { console.error("usage: check-governed-docs.mjs <path-or-dir> [...]"); process.exit(2); }

const files = [];
for (const a of args) walk(a, files);

const errors = [];
let governed = 0;
let coveredSections = 0;
const texts = new Map(files.map((file) => [normalize(file), readFileSync(file, "utf8")]));
const governedBodies = [];
const includedSections = new Set();
for (const file of files.map(normalize)) {
  const text = texts.get(file);
  if (!isGoverned(text)) continue;
  const sections = indexedSections(file, text);
  for (const section of sections) {
    includedSections.add(section);
    if (!existsSync(section)) errors.push(`${file}: indexed section is missing: ${section}`);
  }
  governedBodies.push({ file, text, sections });
}

for (const { file, text, sections } of governedBodies) {
  if (includedSections.has(file)) continue; // counted and scanned once under its governed parent
  governed++;
  const changelog = file.replace(/\.md$/, ".changelog.json");
  if (!existsSync(changelog) && approvedVersions(file) > 1)
    errors.push(`${file}: governed with more than one approved version but no sibling ${changelog.split("/").pop()} (rule 91)`);
  const bodyFiles = [{ file, text }];
  for (const section of sections) {
    if (!existsSync(section)) continue;
    coveredSections++;
    bodyFiles.push({ file: section, text: texts.get(section) ?? readFileSync(section, "utf8") });
  }
  for (const bodyFile of bodyFiles) {
    const lines = bodyFile.text.split("\n");
    lines.forEach((line, i) => {
      const lineNo = i + 1;
      for (const m of MARKERS) {
        if (m.re.test(line) && !allowed(bodyFile.file, lineNo)) errors.push(`${bodyFile.file}:${lineNo}: history marker "${m.name}" in the body — move it to the changelog (rule 91)`);
      }
    });
  }
}

if (errors.length) {
  console.error(`governed-document check FAILED (${errors.length}):`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log(`governed-document check OK (${governed} governed bod${governed === 1 ? "y" : "ies"} of ${files.length} files scanned; ${coveredSections} indexed section file${coveredSections === 1 ? "" : "s"} covered)`);
