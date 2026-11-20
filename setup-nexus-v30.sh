#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${ROOT}/v30-runtime"
PORT="${PORT:-3080}"

for command in node npm python3; do
  command -v "$command" >/dev/null 2>&1 || { printf 'Required command missing: %s\n' "$command" >&2; exit 1; }
done
node -e 'if (Number(process.versions.node.split(".")[0]) < 20) process.exit(1)' || {
  printf 'Node.js 20 or newer is required.\n' >&2; exit 1;
}

mkdir -p "$APP_DIR"

write_once() {
  local destination="$1"
  local temporary
  temporary="$(mktemp "${APP_DIR}/.write-once.XXXXXX")"
  cat > "$temporary"
  if [[ -e "$destination" ]]; then
    if cmp -s "$temporary" "$destination"; then
      rm -f "$temporary"
      printf 'UNCHANGED %s\n' "$destination"
      return 0
    fi
    rm -f "$temporary"
    printf 'PRESERVED existing file; content differs: %s\n' "$destination" >&2
    printf 'No existing file was overwritten.\n' >&2
    return 2
  fi
  mv -- "$temporary" "$destination"
  printf 'CREATED %s\n' "$destination"
}

write_once "$APP_DIR/package.json" <<'PACKAGE'
{
  "name": "quantum-nexus-v30-runtime",
  "private": true,
  "version": "30.0.0",
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": { "start": "node server.mjs", "check": "node --check server.mjs" },
  "dependencies": { "express": "5.1.0", "ws": "8.18.3" }
}
PACKAGE

write_once "$APP_DIR/server.mjs" <<'SERVER'
import express from "express";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.QUANTUM_NEXUS_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = express();
app.use(express.json({ limit: "1mb" }));
const MODULES = new Map([
  ["admin.html", "admin.html"],
  ["autonomous-swarm.html", "autonomous-swarm.html"],
  ["index-1.html", "index-1.html"],
  ["nexus-ultra.html", "nexus-ultra.html"],
  ["quantum-api-panel.html", "quantum-api-panel.html"],
  ["quantum-core.html", "quantum-core.html"],
  ["red-team-1.html", "red-team-1.html"],
  ["revenue-nexus.html", "revenue-nexus.html"],
  ["public.html", "public/index.html"],
  ["frontend.html", "frontend/public/index.html"],
  ["todo.html", "archive/todo-app-original.html"],
  ["nexus-live-telemetry.js", "nexus-live-telemetry.js"]
]);
app.get("/modules/:file", async (req, res) => {
  const relative = MODULES.get(req.params.file);
  if (!relative) return res.status(404).json({ error: "module_not_registered" });
  return res.sendFile(path.join(ROOT, relative));
});
const server = createServer(app);
const sockets = new WebSocketServer({ server, path: "/stream" });
const PORT = Number(process.env.PORT || 3080);
const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
let latest = null;

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`upstream_http_${response.status}`);
  return response.json();
}

async function marketSnapshot() {
  const [binance, bitget] = await Promise.allSettled([
    fetchJson("https://fapi.binance.com/fapi/v1/ticker/24hr"),
    fetchJson("https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES")
  ]);
  const venues = {};
  if (binance.status === "fulfilled") {
    const selected = binance.value.filter((row) => SYMBOLS.includes(row.symbol));
    venues.binance = { status: "connected", symbols: selected.map((row) => ({
      symbol: row.symbol, last: Number(row.lastPrice), change24hPct: Number(row.priceChangePercent), quoteVolume24h: Number(row.quoteVolume)
    })) };
  } else venues.binance = { status: "unavailable", error: binance.reason?.message || "request_failed" };

  if (bitget.status === "fulfilled" && bitget.value.code === "00000") {
    const selected = (bitget.value.data || []).filter((row) => SYMBOLS.includes(row.symbol));
    venues.bitget = { status: "connected", symbols: selected.map((row) => ({
      symbol: row.symbol, last: Number(row.lastPr), change24hPct: Number(row.change24h), quoteVolume24h: Number(row.usdtVolume)
    })) };
  } else venues.bitget = { status: "unavailable", error: bitget.status === "rejected" ? bitget.reason?.message || "request_failed" : "provider_error" };

  const connected = Object.values(venues).filter((venue) => venue.status === "connected").length;
  return { status: connected === 2 ? "connected" : connected === 1 ? "degraded" : "unavailable", timestamp: new Date().toISOString(), source: "live_exchange_rest", venues };
}

app.get("/api/health", (_req, res) => res.status(latest ? 200 : 503).json({
  status: latest?.status || "initializing", marketData: latest?.status || "not_checked", timestamp: new Date().toISOString()
}));
app.get("/api/market", async (_req, res) => {
  try {
    latest = await marketSnapshot();
    res.status(latest.status === "unavailable" ? 503 : 200).json(latest);
  } catch (error) {
    res.status(502).json({ status: "unavailable", error: error.message, timestamp: new Date().toISOString() });
  }
});
app.get("/api/registry", async (_req, res) => {
  try {
    const registry = JSON.parse(await readFile(path.join(ROOT, "config/agent-registry.v16.json"), "utf8"));
    const core = (registry.core || []).flatMap((cluster) => (cluster.slice(2) || []).map((role) => ({ id: cluster[0], cluster: cluster[1], role })));
    const academic = (registry.academic || []).map((role) => ({ role }));
    const frontier = (registry.frontier || []).map((role) => ({ role }));
    return res.json({
      version: registry.version,
      counts: { core: core.length, academic: academic.length, frontier: frontier.length, total: core.length + academic.length + frontier.length },
      states: registry.states || [],
      execution: "role_definitions_only",
      roles: { core, academic, frontier }
    });
  } catch (error) {
    return res.status(503).json({ status: "unavailable", error: error.message });
  }
});
app.get("/api/agents/status", async (_req, res) => {
  const endpoint = process.env.AGENT_STATUS_URL;
  if (!endpoint) return res.status(503).json({ status: "unavailable", activeCount: 0, reason: "No worker heartbeat endpoint configured" });
  try {
    const headers = process.env.AGENT_STATUS_TOKEN ? { authorization: "Bearer " + process.env.AGENT_STATUS_TOKEN } : {};
    const response = await fetch(endpoint, { headers, signal: AbortSignal.timeout(8000) });
    const data = await response.json();
    if (!response.ok || !Number.isInteger(data.activeCount) || typeof data.observedAt !== "string") throw new Error("Worker heartbeat schema or HTTP status invalid");
    return res.json({ status: "connected", activeCount: data.activeCount, observedAt: data.observedAt, workers: data.workers || [] });
  } catch (error) {
    return res.status(503).json({ status: "unavailable", activeCount: 0, reason: error.message });
  }
});
app.get("/api/revenue/summary", async (_req, res) => {
  const endpoint = process.env.REVENUE_LEDGER_URL;
  if (!endpoint) return res.status(503).json({ status: "unavailable", verified: false, reason: "No settled-revenue ledger endpoint configured" });
  try {
    const headers = process.env.REVENUE_LEDGER_TOKEN ? { authorization: "Bearer " + process.env.REVENUE_LEDGER_TOKEN } : {};
    const response = await fetch(endpoint, { headers, signal: AbortSignal.timeout(8000) });
    const data = await response.json();
    if (!response.ok || data.verified !== true || typeof data.currency !== "string" || !Number.isFinite(data.totalSettled)) {
      throw new Error("Revenue ledger must return verified=true, currency and numeric totalSettled");
    }
    return res.json({ status: "connected", verified: true, currency: data.currency, totalSettled: data.totalSettled, period: data.period || null, observedAt: data.observedAt || new Date().toISOString() });
  } catch (error) {
    return res.status(503).json({ status: "unavailable", verified: false, reason: error.message });
  }
});
app.get("/api/integrations/status", (_req, res) => {
  return res.json({ providers: {
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    groq: Boolean(process.env.GROQ_API_KEY),
    github: Boolean(process.env.GITHUB_TOKEN),
    supabase: Boolean(process.env.NEXUS_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    securityScanner: Boolean(process.env.SECURITY_SCAN_URL && process.env.SECURITY_SCAN_TOKEN)
  }});
});
app.get("/api/integrations/test/:provider", async (req, res) => {
  const provider = req.params.provider;
  try {
    let response;
    if (provider === "github" && process.env.GITHUB_TOKEN) {
      response = await fetch("https://api.github.com/user", { headers: { authorization: "Bearer " + process.env.GITHUB_TOKEN, accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(8000) });
    } else if (provider === "supabase" && process.env.NEXUS_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      response = await fetch(process.env.NEXUS_SUPABASE_URL.replace(/\\/$/, "") + "/rest/v1/", { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY }, signal: AbortSignal.timeout(8000) });
    } else if (provider === "stripe" && process.env.STRIPE_SECRET_KEY) {
      response = await fetch("https://api.stripe.com/v1/balance", { headers: { authorization: "Basic " + Buffer.from(process.env.STRIPE_SECRET_KEY + ":").toString("base64") }, signal: AbortSignal.timeout(8000) });
    } else {
      return res.status(503).json({ status: "unavailable", provider, reason: "Server-side credentials not configured" });
    }
    const payload = await response.json();
    if (!response.ok) return res.status(502).json({ status: "error", provider, upstreamStatus: response.status, error: payload.message || payload.error || "upstream_error" });
    return res.json({ status: "connected", provider, checkedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(502).json({ status: "unavailable", provider, reason: error.message });
  }
});
app.post("/api/security/scan", async (req, res) => {
  const endpoint = process.env.SECURITY_SCAN_URL;
  const token = process.env.SECURITY_SCAN_TOKEN;
  const allowedHosts = (process.env.SCAN_ALLOWED_HOSTS || "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  let target;
  try { target = new URL(String(req.body?.target || "")); } catch { return res.status(400).json({ error: "invalid_target_url" }); }
  if (target.protocol !== "https:" || !allowedHosts.includes(target.hostname.toLowerCase())) {
    return res.status(403).json({ error: "target_not_in_explicit_https_allowlist" });
  }
  if (!endpoint || !token) return res.status(503).json({ status: "unavailable", reason: "Authorized security scanner endpoint is not configured" });
  const type = String(req.body?.type || "");
  if (!["web", "api", "contract", "network", "mobile"].includes(type)) return res.status(400).json({ error: "unsupported_scan_type" });
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + token },
      body: JSON.stringify({ target: target.toString(), type, requestedAt: new Date().toISOString() }),
      signal: AbortSignal.timeout(15000)
    });
    const data = await response.json();
    if (!response.ok || typeof data.scanId !== "string" || typeof data.status !== "string") {
      throw new Error("Scanner response schema or HTTP status invalid");
    }
    return res.status(202).json({ status: "accepted", scanId: data.scanId, scannerStatus: data.status, events: Array.isArray(data.events) ? data.events : [] });
  } catch (error) {
    return res.status(502).json({ status: "unavailable", reason: error.message });
  }
});
app.get("/api/telemetry", (_req, res) => {
  const memory = process.memoryUsage();
  return res.json({
    status: "connected",
    service: "quantum-nexus-v30-runtime",
    uptimeSeconds: Math.floor(process.uptime()),
    memoryBytes: { rss: memory.rss, heapUsed: memory.heapUsed, heapTotal: memory.heapTotal },
    timestamp: new Date().toISOString()
  });
});
app.post("/api/ai/:provider", async (req, res) => {
  const providers = {
    anthropic: { key: process.env.ANTHROPIC_API_KEY, url: "https://api.anthropic.com/v1/messages", headers: { "anthropic-version": "2023-06-01" } },
    openai: { key: process.env.OPENAI_API_KEY, url: "https://api.openai.com/v1/chat/completions", headers: {} },
    groq: { key: process.env.GROQ_API_KEY, url: "https://api.groq.com/openai/v1/chat/completions", headers: {} }
  };
  const provider = providers[req.params.provider];
  if (!provider) return res.status(404).json({ error: "provider_not_supported" });
  if (!provider.key) return res.status(503).json({ error: "provider_server_key_not_configured" });
  try {
    const headers = { "content-type": "application/json", ...provider.headers };
    if (req.params.provider === "anthropic") headers["x-api-key"] = provider.key;
    else headers.authorization = "Bearer " + provider.key;
    const response = await fetch(provider.url, { method: "POST", headers, body: JSON.stringify(req.body || {}), signal: AbortSignal.timeout(30000) });
    const payload = await response.json();
    return res.status(response.status).json(payload);
  } catch (error) {
    return res.status(502).json({ error: "provider_request_failed", detail: error.message });
  }
});
app.get("/", (_req, res) => res.sendFile(new URL("./index.html", import.meta.url).pathname));

sockets.on("connection", (socket) => {
  if (latest) socket.send(JSON.stringify(latest));
});
let polling = false;
async function publishSnapshot() {
  if (polling) return;
  polling = true;
  try {
    latest = await marketSnapshot();
    const payload = JSON.stringify(latest);
    for (const socket of sockets.clients) if (socket.readyState === 1) socket.send(payload);
  } catch (error) {
    console.error("market_poll_failed", error.message);
  } finally {
    polling = false;
    setTimeout(publishSnapshot, 10000).unref();
  }
}
server.listen(PORT, () => {
  console.log(`Quantum Nexus v30 live market gateway listening on :${PORT}`);
  publishSnapshot();
});
SERVER

write_once "$APP_DIR/index.html" <<'HTML'
<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Quantum Nexus v30 — Live Market Gateway</title>
<style>
:root{color-scheme:dark;--bg:#050b12;--panel:#0c1925;--line:#17374b;--cyan:#00e5ff;--green:#00d49a;--red:#ff667d;--text:#d5e8f5;--muted:#7893a8}
*{box-sizing:border-box}body{margin:0;padding:24px;background:var(--bg);color:var(--text);font:14px system-ui,sans-serif}
header{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
h1{font-size:clamp(20px,4vw,30px);margin:0;color:var(--cyan)}#status{color:var(--muted)}
main{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin-top:24px}
section{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px}
h2{font-size:16px;margin:0 0 12px}.row{display:flex;justify-content:space-between;padding:9px 0;border-top:1px solid var(--line)}
small{color:var(--muted)}.error{color:var(--red)}.ok{color:var(--green)}
</style></head>
<body>
<header><h1>QUANTUM NEXUS v30</h1><div id="status">Gerçek piyasa verisi bekleniyor…</div></header>
<main id="venues"></main>
<script>
const statusNode=document.querySelector("#status"),venuesNode=document.querySelector("#venues");
function render(data){
 statusNode.textContent="Kaynak: "+data.source+" · "+data.timestamp+" · "+data.status;
 venuesNode.replaceChildren();
 for(const [name,venue] of Object.entries(data.venues||{})){
  const card=document.createElement("section"),heading=document.createElement("h2");
  heading.textContent=name.toUpperCase()+" · "+venue.status;heading.className=venue.status==="connected"?"ok":"error";card.append(heading);
  if(venue.symbols?.length) for(const item of venue.symbols){
   const row=document.createElement("div");row.className="row";
   const label=document.createElement("span"),value=document.createElement("strong");
   label.textContent=item.symbol;value.textContent=Number.isFinite(item.last)?item.last.toLocaleString("en-US",{maximumFractionDigits:8}):"—";
   row.append(label,value);card.append(row);
  } else {const note=document.createElement("small");note.textContent=venue.error||"Gerçek veri alınamadı";card.append(note);}
  venuesNode.append(card);
 }
}
async function refresh(){try{const response=await fetch("/api/market",{cache:"no-store"});const data=await response.json();render(data);}catch(error){statusNode.textContent="Veri bağlantısı başarısız: "+error.message;}}
refresh();setInterval(refresh,15000);
const protocol=location.protocol==="https:"?"wss:":"ws:";
const stream=new WebSocket(protocol+"//"+location.host+"/stream");
stream.onmessage=(event)=>{try{render(JSON.parse(event.data));}catch{}};
stream.onclose=()=>{statusNode.textContent+=" · WebSocket yeniden bağlanacak sayfa yenilenebilir";}
</script></body></html>
HTML

write_once "$APP_DIR/market_risk_gate.py" <<'PY'
#!/usr/bin/env python3
"""Fail-closed live-data freshness gate; it does not fabricate trades or PnL."""
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

base = os.environ.get("NEXUS_API_BASE", "http://127.0.0.1:3080").rstrip("/")
request = urllib.request.Request(base + "/api/market", headers={"Accept": "application/json"})
try:
    with urllib.request.urlopen(request, timeout=8) as response:
        payload = json.load(response)
except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
    print(json.dumps({"decision": "NO_TRADE", "reason": "live_market_unavailable", "detail": str(exc)}))
    sys.exit(2)

venues = payload.get("venues", {})
connected = [name for name, venue in venues.items() if venue.get("status") == "connected" and venue.get("symbols")]
if payload.get("status") != "connected" or len(connected) < 2:
    print(json.dumps({"decision": "NO_TRADE", "reason": "insufficient_live_venues", "connected_venues": connected}))
    sys.exit(3)

print(json.dumps({
    "decision": "OBSERVE_ONLY",
    "reason": "market_data_verified_no_execution_adapter_configured",
    "venues": connected,
    "observed_at": datetime.now(timezone.utc).isoformat()
}))
PY

write_once "$APP_DIR/.env.example" <<'ENV'
PORT=3080
NEXUS_API_BASE=http://127.0.0.1:3080
SOLANA_RPC_URL=
JUPITER_API_KEY=
AGENT_STATUS_URL=
AGENT_STATUS_TOKEN=
REVENUE_LEDGER_URL=
REVENUE_LEDGER_TOKEN=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GROQ_API_KEY=
GITHUB_TOKEN=
NEXUS_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
SECURITY_SCAN_URL=
SECURITY_SCAN_TOKEN=
SCAN_ALLOWED_HOSTS=

ENV

(
  cd "$APP_DIR"
  npm install --no-audit
  npm run check
  python3 -m py_compile market_risk_gate.py
)

printf '\nQuantum Nexus v30 additive runtime initialized.\n'
printf 'Start: cd "%s" && npm start\n' "$APP_DIR"
printf 'Dashboard: http://127.0.0.1:%s\n' "$PORT"
printf 'No root access, existing project files, or existing runtime files are overwritten.\n'
