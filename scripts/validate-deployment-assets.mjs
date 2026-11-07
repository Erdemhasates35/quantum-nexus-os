import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const vercel = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8"));
const html = readFileSync(resolve(root, "index.html"), "utf8");
const urlIndex = readFileSync(resolve(root, "docs/operations/vercel-project-url-index.md"), "utf8");
const registryPath = "config/agent-registry.v16.json";
const errors = [];

const buildSources = new Set((vercel.builds ?? []).map((entry) => entry.src));
if (!buildSources.has("index.html")) errors.push("Vercel static build must include index.html");
if (!buildSources.has(registryPath)) errors.push("Vercel static build must publish the agent registry JSON");
if (!html.includes('fetch("/config/agent-registry.v16.json"')) {
  errors.push("dashboard must load the registry from the published static path");
}

const urls = [...urlIndex.matchAll(/\[[^\]]+\]\((https:\/\/[^)]+)\)/g)].map((match) => match[1]);
const uniqueUrls = new Set(urls);
if (urls.length !== 53) errors.push(`URL inventory must contain 53 HTTPS project URLs; found ${urls.length}`);
if (uniqueUrls.size !== urls.length) errors.push("URL inventory contains duplicate URLs");
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

if (errors.length) {
  for (const error of errors) console.error("DEPLOYMENT_ASSET_INVALID:", error);
  process.exitCode = 1;
} else {
  console.log("DEPLOYMENT_ASSETS_VALID: dashboard, published registry, and 53 unique HTTPS Vercel URLs.");
}
