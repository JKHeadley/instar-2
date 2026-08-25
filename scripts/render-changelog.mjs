#!/usr/bin/env node
// Render a governed document's changelog (NAME.changelog.json) to a human-readable
// NAME.changelog.md. The markdown is GENERATED, never hand-maintained (rule 91): people
// read the prose, the machine reads the JSON, and nobody keeps two copies in sync by hand.
//
// Usage: node scripts/render-changelog.mjs <path-to-.changelog.json> [more...]
//   writes <same-path with .json -> .md> beside each input.
import { readFileSync, writeFileSync } from "node:fs";

function docName(jsonPath) {
  // docs/foo.changelog.json -> foo.md  (the governed document this history belongs to)
  const base = jsonPath.split("/").pop();
  return base.replace(/\.changelog\.json$/, ".md");
}

function commitLink(sha) {
  return "`" + sha.slice(0, 9) + "`";
}

function renderChange(c) {
  const links = [];
  if (Array.isArray(c.commits)) for (const s of c.commits) links.push(commitLink(s));
  if (c.ref) links.push(c.ref);
  const tail = links.length ? ` _(${links.join(", ")})_` : "";
  return `- **${c.what}** — ${c.why}${tail}`;
}

function renderEntry(e) {
  const lines = [];
  const causeBits = [];
  if (e.cause) {
    if (e.cause.kind === "review" && e.cause.pr) causeBits.push(`operator review on PR #${e.cause.pr}`);
    // for non-review kinds, a note (when present) is more specific than the generic kind label
    else if (e.cause.note) { /* note carries it */ }
    else if (e.cause.kind === "conversation") causeBits.push("conversation with the operator");
    else if (e.cause.kind === "draft") causeBits.push("first draft");
    else if (e.cause.kind === "migration") causeBits.push("format migration");
    if (e.cause.note) causeBits.push(e.cause.note);
  }
  const cause = causeBits.length ? ` — ${causeBits.join("; ")}` : "";
  lines.push(`## Revision ${e.revision} · ${e.date} · ${e.status}${cause}`);
  lines.push("");
  for (const c of e.changes) lines.push(renderChange(c));
  if (e.approvedIn) {
    const a = [];
    if (e.approvedIn.pr) a.push(`PR #${e.approvedIn.pr}`);
    if (e.approvedIn.mergeCommit) a.push(`merge ${commitLink(e.approvedIn.mergeCommit)}`);
    if (a.length) { lines.push(""); lines.push(`Approved in: ${a.join(", ")}.`); }
  }
  return lines.join("\n");
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: render-changelog.mjs <NAME.changelog.json> [...]");
  process.exit(2);
}

for (const file of files) {
  const doc = JSON.parse(readFileSync(file, "utf8"));
  const name = docName(file);
  const header = [
    `# Changelog — \`${name}\``,
    "",
    "_Generated from `" + file.split("/").pop() + "` by `scripts/render-changelog.mjs` — do not edit by hand._",
    "The document itself reads as a first version; every change to it is recorded here, newest first,",
    "each linked to the git change that made it (rule 91).",
    "",
  ].join("\n");
  const body = doc.map(renderEntry).join("\n\n");
  const out = file.replace(/\.changelog\.json$/, ".changelog.md");
  writeFileSync(out, header + "\n" + body + "\n");
  console.log(`rendered ${out}`);
}
