import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const vercel = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8"));
const html = readFileSync(resolve(root, "index.html"), "utf8");
const urlIndex = readFileSync(resolve(root, "docs/operations/vercel-project-url-index.md"), "utf8");
const registry = JSON.parse(readFileSync(resolve(root, "config/agent-registry.v16.json"), "utf8"));
const errors = [];

const buildSources = new Set((vercel.builds ?? []).map((entry) => entry.src));
if (!buildSources.has("index.html")) errors.push("Vercel static build must include index.html");
if (!buildSources.has("config/agent-registry.v16.json")) errors.push("Vercel static build must publish the agent registry JSON");
if (!html.includes('fetch("/config/agent-registry.v16.json"')) errors.push("dashboard registry fetch path is missing");
if (!html.includes('data.academicProfiles.forEach')) errors.push("dashboard does not render academic evidence profiles");
if (!html.includes('id="academicCount">20</strong>')) errors.push("dashboard academic role count is not 20");

const links = [...urlIndex.matchAll(/^\d+\. \[([^\]]+)\]\((https:\/\/[^)]+)\)$/gm)]
  .map((match) => [match[1], match[2]]);
const urls = links.map(([, url]) => url);
if (links.length !== 53) errors.push(`URL inventory must contain 53 project domains; found ${links.length}`);
if (new Set(urls).size !== urls.length) errors.push("URL inventory contains duplicate URLs");
for (const url of urls) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".vercel.app")) {
      errors.push(`unsupported project URL: ${url}`);
    }
  } catch {
    errors.push(`invalid project URL: ${url}`);
  }
}

const projectsMatch = html.match(/const projects = (\[[\s\S]*?\]);/);
if (!projectsMatch) {
  errors.push("dashboard project directory is missing");
} else {
  try {
    const dashboardLinks = JSON.parse(projectsMatch[1]);
    if (JSON.stringify(dashboardLinks) !== JSON.stringify(links)) {
      errors.push("dashboard project links do not exactly match the 53-domain Vercel inventory");
    }
  } catch {
    errors.push("dashboard project directory is not valid JSON");
  }
}

const coreRoles = (registry.core ?? []).reduce((count, cluster) => count + Math.max(0, cluster.length - 2), 0);
if (registry.core?.length !== 10 || coreRoles !== 30) errors.push("core topology must be 10 clusters and 30 roles");
if (registry.academic?.length !== 20 || registry.academicProfiles?.length !== 20) errors.push("academic control layer must contain 20 evidence profiles");
if (registry.frontier?.length !== 10) errors.push("frontier research layer must contain 10 roles");
const profileNames = new Set((registry.academicProfiles ?? []).map((profile) => profile?.role));
if (profileNames.size !== 20 || (registry.academic ?? []).some((role) => !profileNames.has(role))) {
  errors.push("academic role names and evidence profiles do not match one-to-one");
}
if (coreRoles + (registry.academic?.length ?? 0) + (registry.frontier?.length ?? 0) !== 60) {
  errors.push("agent topology must total 60 roles");
}

if (errors.length) {
  for (const error of errors) console.error("DEPLOYMENT_ASSET_INVALID:", error);
  process.exitCode = 1;
} else {
  console.log("DEPLOYMENT_ASSETS_VALID: dashboard, 60-role registry, and 53 matching Vercel domains.");
}
