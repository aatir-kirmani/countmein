// Fails the build if any source file contains an em dash or en dash (literal or escaped).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".css", ".md", ".sql", ".json", ".webmanifest"]);
const SKIP = new Set(["node_modules", ".git", "package-lock.json"]);
const BAD = /[–—]|&mdash;|&ndash;|&#821[12];|\\u201[34]/;

const hits = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith(".next")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (EXT.has(extname(name))) {
      readFileSync(p, "utf8").split("\n").forEach((line, i) => {
        if (BAD.test(line) && !p.endsWith("check-copy.mjs")) hits.push(`${p}:${i + 1}: ${line.trim().slice(0, 100)}`);
      });
    }
  }
};
walk(process.cwd());
if (hits.length) {
  console.error(`Found ${hits.length} em/en dash(es). Use a comma, colon, period or "to" instead:\n${hits.join("\n")}`);
  process.exit(1);
}
console.log("copy check: no em or en dashes");
