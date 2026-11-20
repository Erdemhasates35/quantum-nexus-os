(() => {
  const text = (selector, value) => {
    document.querySelectorAll(selector).forEach((node) => { node.textContent = value; });
  };
  const request = async (path) => {
    const response = await fetch(path, { cache: "no-store", headers: { accept: "application/json" } });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.reason || payload.error || `HTTP ${response.status}`);
    return payload;
  };
  const unavailable = (selector, label) => text(selector, label);
  async function refresh() {
    const results = await Promise.allSettled([
      request("/api/registry"),
      request("/api/agents/status"),
      request("/api/revenue/summary"),
      request("/api/market"),
      request("/api/telemetry")
    ]);
    const [registry, agents, revenue, market, telemetry] = results;
    if (registry.status === "fulfilled") {
      const counts = registry.value.counts;
      text("[data-nexus-role-count]", String(counts.total));
      text("[data-nexus-core-count]", String(counts.core));
      text("[data-nexus-academic-count]", String(counts.academic));
      text("[data-nexus-frontier-count]", String(counts.frontier));
      text("[data-nexus-role-state]", "REGISTERED");
    } else {
      unavailable("[data-nexus-role-count],[data-nexus-core-count],[data-nexus-academic-count],[data-nexus-frontier-count]", "UNAVAILABLE");
    }
    if (agents.status === "fulfilled") {
      text("[data-nexus-active-count]", String(agents.value.activeCount));
      text("[data-nexus-agent-state]", "LIVE HEARTBEAT");
    } else {
      text("[data-nexus-active-count]", "0");
      text("[data-nexus-agent-state]", "NO WORKER HEARTBEAT");
    }
    if (revenue.status === "fulfilled" && revenue.value.verified === true) {
      const amount = Number(revenue.value.totalSettled).toLocaleString("en-US", { maximumFractionDigits: 2 });
      text("[data-nexus-revenue]", amount + " " + revenue.value.currency);
      text("[data-nexus-revenue-state]", "SETTLED LEDGER · " + (revenue.value.period || "VERIFIED"));
    } else {
      text("[data-nexus-revenue]", "NO VERIFIED LEDGER");
      text("[data-nexus-revenue-state]", "SETTLED REVENUE NOT CONNECTED");
    }
    if (market.status === "fulfilled") {
      text("[data-nexus-market-state]", market.value.status.toUpperCase());
      for (const [venue, data] of Object.entries(market.value.venues || {})) {
        text(`[data-nexus-market-venue="${venue}"]`, data.status.toUpperCase());
      }
    } else {
      text("[data-nexus-market-state]", "UNAVAILABLE");
    }
    if (telemetry.status === "fulfilled") {
      text("[data-nexus-uptime]", String(telemetry.value.uptimeSeconds) + "s");
      text("[data-nexus-memory]", Math.round(telemetry.value.memoryBytes.rss / 1048576) + " MB");
      text("[data-nexus-runtime-state]", "CONNECTED");
    } else {
      text("[data-nexus-runtime-state]", "UNAVAILABLE");
    }
  }
  window.NexusLiveTelemetry = { refresh };
  refresh();
  setInterval(refresh, 15000);
})();
