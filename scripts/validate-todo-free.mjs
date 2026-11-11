import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { extname } from "node:path";

const ignoredPrefixes = [
  "nexmon_csi/",
  "backups/",
  "backup/",
  "node_modules/",
  ".git/",
  ".next/",
  ".vercel/",
  "dist/",
  "build/",
  "coverage/",
  "vendor/",
  "third_party/"
];
const ignoredExtensions = new Set([".png",".jpg",".jpeg",".gif",".webp",".ico",".pdf",".zip",".gz",".wasm",".so",".a",".bin",".lock"]);
const markerParts = [["TO","DO"].join(""), ["FIX","ME"].join(""), ["X","XX"].join("")];
const markerPattern = new RegExp("(^|[^A-Za-z0-9_])(?:" + markerParts.join("|") + ")(?=$|[^A-Za-z0-9_])");
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const findings = [];

for (const file of files) {
  if (ignoredPrefixes.some((prefix) => file.startsWith(prefix))) continue;
  if (ignoredExtensions.has(extname(file).toLowerCase())) continue;
  let stat;
  try { stat = statSync(file); } catch { continue; }
  if (!stat.isFile() || stat.size > 2_000_000) continue;
  let source;
  try { source = readFileSync(file, "utf8"); } catch { continue; }
  if (source.includes("\0")) continue;
  const lines = source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    if (markerPattern.test(lines[index])) findings.push({ file, line: index + 1, text: lines[index].trim().slice(0, 180) });
  }
}

if (findings.length) {
  for (const finding of findings) {
    console.error(`DEBT_MARKER_FOUND ${finding.file}:${finding.line} ${finding.text}`);
  }
  console.error(`DEBT_MARKER_SCAN_FAILED: ${findings.length} first-party tracked marker(s).`);
  process.exitCode = 1;
} else {
  console.log(`DEBT_MARKER_SCAN_PASSED: ${files.length} tracked files inspected; no first-party debt markers. Vendored Nexmon sources and archived backups are excluded from application-source scope.`);
}
