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
import { join } from "node:path";
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
  { file: "docs/rules/91-a-document-reads-as-its-first-version.md", why: "the rule's own full text quotes the markers it bans" },
  { file: "docs/02-the-register.md", line: 214, why: "'revision' names a round of the pre-send review pattern, not a document history" },
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

function allowed(file, lineNo) {
  return ALLOW.some((a) => a.file === file && (a.line == null || a.line === lineNo));
}

const args = process.argv.slice(2);
if (args.length === 0) { console.error("usage: check-governed-docs.mjs <path-or-dir> [...]"); process.exit(2); }

const files = [];
for (const a of args) walk(a, files);

const errors = [];
let governed = 0;
for (const file of files) {
  const text = readFileSync(file, "utf8");
  if (!isGoverned(text)) continue;
  governed++;
  const changelog = file.replace(/\.md$/, ".changelog.json");
  if (!existsSync(changelog) && approvedVersions(file) > 1)
    errors.push(`${file}: governed with more than one approved version but no sibling ${changelog.split("/").pop()} (rule 91)`);
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    const lineNo = i + 1;
    for (const m of MARKERS) {
      if (m.re.test(line) && !allowed(file, lineNo)) errors.push(`${file}:${lineNo}: history marker "${m.name}" in the body — move it to the changelog (rule 91)`);
    }
  });
}

if (errors.length) {
  console.error(`governed-document check FAILED (${errors.length}):`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log(`governed-document check OK (${governed} governed document${governed === 1 ? "" : "s"} of ${files.length} scanned)`);
