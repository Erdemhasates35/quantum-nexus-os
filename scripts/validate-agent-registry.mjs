import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = resolve(root, "config/agent-registry.v16.json");
const registry = JSON.parse(readFileSync(registryPath, "utf8"));

const errors = [];
if (registry.version !== "16.0") errors.push("registry version must be 16.0");
if (!Array.isArray(registry.core) || registry.core.length !== 10) errors.push("core must contain exactly ten clusters");
if (!Array.isArray(registry.academic) || registry.academic.length !== 20) errors.push("academic group must contain twenty roles");
if (!Array.isArray(registry.academicProfiles) || registry.academicProfiles.length !== 20) errors.push("academic profiles must contain twenty evidence contracts");
const profileNames = new Set((registry.academicProfiles ?? []).map((profile) => profile?.role));
if (profileNames.size !== 20 || (registry.academic ?? []).some((role) => !profileNames.has(role))) {
  errors.push("every academic role must have one unique evidence profile");
}
for (const profile of registry.academicProfiles ?? []) {
  if (!profile?.role || !profile?.scope || !profile?.evidence) errors.push("academic profiles require role, scope, and evidence fields");
}
if (!Array.isArray(registry.frontier) || registry.frontier.length !== 10) errors.push("frontier group must contain ten roles");

const clusterIds = new Set();
const roleNames = new Set();
for (const cluster of registry.core ?? []) {
  if (!Array.isArray(cluster) || cluster.length !== 5) {
    errors.push("each core cluster must contain id, name, and exactly three agent roles");
    continue;
  }
  const [id, name, ...agents] = cluster;
  if (clusterIds.has(id)) errors.push("duplicate cluster id: " + id);
  clusterIds.add(id);
  if (!name || agents.some((agent) => typeof agent !== "string" || !agent.trim())) {
    errors.push("cluster " + id + " contains an empty name or role");
  }
  for (const agent of agents) {
    const key = id + ":" + agent;
    if (roleNames.has(key)) errors.push("duplicate role: " + key);
    roleNames.add(key);
  }
}
for (const group of [registry.academic, registry.frontier]) {
  const local = new Set();
  for (const role of group ?? []) {
    if (typeof role !== "string" || !role.trim()) errors.push("support role names must be non-empty strings");
    else if (local.has(role)) errors.push("duplicate support role: " + role);
    else local.add(role);
  }
}
if (!Array.isArray(registry.states) || !registry.states.includes("HALTED") || !registry.states.includes("SETTLED")) {
  errors.push("state machine must include HALTED and SETTLED");
}
if (!registry.settlementEvidence?.includes("solana_signature_status") ||
    !registry.settlementEvidence?.includes("finalized_slot")) {
  errors.push("settlement evidence must include on-chain signature and finalized slot");
}
if (errors.length) {
  for (const error of errors) console.error("REGISTRY_INVALID:", error);
  process.exitCode = 1;
} else {
  console.log("REGISTRY_VALID: 10 clusters, 30 core roles, 20 academic roles, 10 frontier roles, 60 total roles.");
}
