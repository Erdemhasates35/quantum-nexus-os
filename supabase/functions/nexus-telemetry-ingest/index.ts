import { Pool } from "jsr:@db/postgres@^0";

type JsonObject = Record<string, unknown>;
type TelemetryKind =
  | "run" | "agent" | "event" | "quote" | "attempt" | "settlement"
  | "order_intent" | "risk_decision" | "order_event" | "fill"
  | "position" | "balance" | "pnl" | "funding" | "heartbeat"
  | "alpha" | "venue_health" | "reconciliation" | "discrepancy"
  | "task" | "market_bar" | "order_book" | "order_flow" | "venue_account" | "instrument" | "authorize_live" | "submission_result" | "guard_approval" | "execution_config";

let pool: Pool | null = null;
const maxBodyBytes = 64 * 1024;
const maxJsonDepth = 8;
const maxSecretCount = 16;

const secretKeysJson = Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}";
let secretKeyValues: string[] = [];
try {
  const parsed = JSON.parse(secretKeysJson) as Record<string, unknown>;
  secretKeyValues = Object.values(parsed).filter((value): value is string => typeof value === "string" && value.length > 0).slice(0, maxSecretCount);
} catch {
  throw new Error("secret_key_configuration_invalid");
}
const legacyServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (legacyServiceRoleKey && secretKeyValues.length < maxSecretCount) secretKeyValues.push(legacyServiceRoleKey);

const fields: Record<TelemetryKind, Set<string>> = {
  run: new Set(["strategy_code","chain","execution_mode","status","source_commit_sha","config_sha256","correlation_id","started_at","finished_at","metadata"]),
  agent: new Set(["run_id","agent_code","agent_no","role_name","status","worker_id","started_at","heartbeat_at","finished_at","metrics"]),
  event: new Set(["run_id","agent_id","severity","event_type","message","payload","source_commit_sha","dedupe_key"]),
  quote: new Set(["run_id","chain","venue","pool_address","input_asset","output_asset","input_amount_atomic","output_amount_atomic","input_decimals","output_decimals","observed_slot","quote_source","quoted_at","valid_until","response_digest","metadata"]),
  attempt: new Set(["run_id","quote_id","attempt_no","provider","status","transaction_signature","bundle_id","recent_blockhash","requested_slot","landed_slot","compute_units","priority_fee_atomic","bundle_tip_atomic","expected_net_profit_atomic","profit_asset","profit_decimals","simulation_error","failure_code","submitted_at","confirmed_at"]),
  settlement: new Set(["attempt_id","status","asset","asset_decimals","borrowed_atomic","repaid_atomic","loan_fee_atomic","gross_profit_atomic","total_cost_atomic","net_profit_atomic","finalized_slot","transaction_signature","settled_at","evidence"]),
  order_intent: new Set(["run_id","strategy_code","strategy_version_id","account_id","instrument_id","client_order_id","idempotency_key","side","position_side","order_type","time_in_force","quantity","limit_price","stop_price","reduce_only","post_only","risk_profile_code","requested_mode","metadata"]),
  risk_decision: new Set(["intent_id","profile_code","decision","reason_code","explanation","metrics"]),
  order_event: new Set(["intent_id","venue_order_id","event_uid","event_type","exchange_status","cumulative_quantity","last_fill_quantity","average_fill_price","exchange_timestamp","payload"]),
  fill: new Set(["intent_id","order_event_id","account_id","instrument_id","venue_trade_id","side","quantity","price","fee_amount","fee_asset","liquidity_role","executed_at","source","raw_digest"]),
  position: new Set(["account_id","instrument_id","position_side","quantity","entry_price","mark_price","liquidation_price","leverage","initial_margin","maintenance_margin","realized_pnl","unrealized_pnl","observed_at","source","metadata"]),
  balance: new Set(["account_id","asset","wallet_balance","available_balance","locked_balance","unrealized_pnl","observed_at","source","metadata"]),
  pnl: new Set(["account_id","run_id","intent_id","fill_id","entry_type","asset","amount","usd_conversion_rate","amount_usd","source_reference","occurred_at","metadata"]),
  funding: new Set(["instrument_id","funding_rate","mark_price","index_price","next_funding_at","observed_at","source","metadata"]),
  heartbeat: new Set(["agent_code","worker_id","status","metrics"]),
  alpha: new Set(["run_id","strategy_code","instrument_id","signal_family","horizon_seconds","signal_value","confidence","expected_edge_bps","realized_edge_bps","evidence","observed_at"]),
  venue_health: new Set(["venue","environment","market_type","status","latency_ms","rate_limit_remaining","observed_at","metadata"]),
  reconciliation: new Set(["account_id","venue","status","started_at","finished_at","cursor","summary"]),
  discrepancy: new Set(["reconciliation_id","entity_type","local_reference","venue_reference","discrepancy_type","severity","local_value","venue_value","resolution_status","resolution_note","detected_at","resolved_at"]),
  task: new Set(["run_id","agent_id","agent_code","parent_task_id","task_type","priority","idempotency_key","input","max_attempts"]),
  market_bar: new Set(["instrument_id","interval_code","open_time","close_time","open_price","high_price","low_price","close_price","base_volume","quote_volume","trade_count","source","observed_at"]),
  order_book: new Set(["instrument_id","venue","sequence_number","bids","asks","checksum","depth_levels","source","observed_at"]),
  order_flow: new Set(["instrument_id","venue","event_type","side","price","quantity","event_sequence","exchange_trade_id","maker","occurred_at","received_at","payload_digest"]),
  venue_account: new Set(["venue","account_label","environment","account_type","capabilities"]),
  instrument: new Set(["venue","market_type","symbol","base_asset","quote_asset","settlement_asset","price_tick","quantity_step","min_quantity","min_notional","contract_multiplier","maker_fee_bps","taker_fee_bps","active","metadata"]),
  authorize_live: new Set(["intent_id","executor_id","approval_digest"]),
  submission_result: new Set(["authorization_id","executor_id","outcome","venue_order_id","error_code"]),
  guard_approval: new Set(["intent_id","intent_digest","policy_version","decision","reason_code","approval_digest","signer_key_id","signature_algorithm","signature","nonce","issued_at","expires_at","evidence"]),
  execution_config: new Set(["risk_profile_code","strategy_code","mode","account_id","instrument_id","symbol"]),
};

const forbiddenField = /(private[_-]?key|secret[_-]?key|api[_-]?key|api[_-]?secret|mnemonic|seed[_-]?phrase|service[_-]?role[_-]?key|authorization|access[_-]?token|password|credential)/i;
const forbiddenValue = /(-----BEGIN [A-Z ]*PRIVATE KEY-----|Bearer\s+[A-Za-z0-9._-]+|sb_secret_[A-Za-z0-9_-]{8,})/i;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const decimalPattern = /^-?\d{1,20}(?:\.\d{1,18})?$/;

function getPool(): Pool {
  if (pool) return pool;
  const databaseUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!databaseUrl) throw new Error("database_connection_unavailable");
  pool = new Pool(databaseUrl, 2, true);
  return pool;
}

function constantTimeEqual(left: string, right: string): boolean {
  const max = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < max; i++) diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  return diff === 0;
}

function authorized(req: Request): boolean {
  const authorization = req.headers.get("authorization") ?? "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const apiKey = req.headers.get("apikey") ?? "";
  const candidate = bearer || apiKey;
  if (!candidate || candidate.length > 512) return false;
  return secretKeyValues.some((key) => constantTimeEqual(candidate, key));
}

function response(body: JsonObject, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function assertJsonSafe(value: unknown, depth = 0): void {
  if (depth > maxJsonDepth) throw new Error("payload_nesting_limit");
  if (typeof value === "string") {
    if (forbiddenValue.test(value)) throw new Error("sensitive_value_rejected");
    return;
  }
  if (Array.isArray(value)) {
    for (const child of value) assertJsonSafe(child, depth + 1);
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as JsonObject)) {
      if (forbiddenField.test(key)) throw new Error("sensitive_field_rejected");
      assertJsonSafe(child, depth + 1);
    }
  }
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error("non_finite_number_rejected");
}

export function recordFor(kind: TelemetryKind, value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("record_must_be_object");
  const record = value as JsonObject;
  const unknownFields = Object.keys(record).filter((key) => !fields[kind].has(key));
  if (unknownFields.length) throw new Error("unknown_record_fields");
  assertJsonSafe(record);
  return record;
}

function requiredText(record: JsonObject, key: string, max = 256): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) throw new Error("invalid_" + key);
  return value;
}

function optionalText(record: JsonObject, key: string, max = 512): string | null {
  const value = record[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > max) throw new Error("invalid_" + key);
  return value;
}

function integer(record: JsonObject, key: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) throw new Error("invalid_" + key);
  return value;
}

function optionalInteger(record: JsonObject, key: string, min = 0, max = Number.MAX_SAFE_INTEGER): number | null {
  if (record[key] === undefined || record[key] === null) return null;
  return integer(record, key, min, max);
}

function bool(record: JsonObject, key: string, fallback = false): boolean {
  const value = record[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") throw new Error("invalid_" + key);
  return value;
}

function uuid(record: JsonObject, key: string, required = true): string | null {
  const value = record[key];
  if ((value === undefined || value === null || value === "") && !required) return null;
  if (typeof value !== "string" || !uuidPattern.test(value)) throw new Error("invalid_" + key);
  return value;
}

export function decimal(record: JsonObject, key: string, allowNegative = false, required = true): string | null {
  const value = record[key];
  if ((value === undefined || value === null || value === "") && !required) return null;
  if (typeof value !== "string" || !decimalPattern.test(value)) throw new Error("invalid_decimal_" + key);
  if (!allowNegative && value.startsWith("-")) throw new Error("negative_value_not_allowed_" + key);
  return value;
}

function atomic(record: JsonObject, key: string, allowNegative = false, required = true): string | null {
  const value = record[key];
  if ((value === undefined || value === null || value === "") && !required) return null;
  if (typeof value !== "string") throw new Error("atomic_amount_must_be_string_" + key);
  const pattern = allowNegative ? /^-?\d{1,78}$/ : /^\d{1,78}$/;
  if (!pattern.test(value)) throw new Error("invalid_" + key);
  return value;
}

function jsonObject(record: JsonObject, key: string): string {
  const value = record[key] ?? {};
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_" + key);
  assertJsonSafe(value);
  return JSON.stringify(value);
}

export function bookLevels(record: JsonObject, key: string): string {
  const value = record[key];
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) throw new Error("invalid_" + key);
  for (const level of value) {
    if (!Array.isArray(level) || level.length !== 2 || typeof level[0] !== "string" || typeof level[1] !== "string") throw new Error("invalid_" + key);
    if (!decimalPattern.test(level[0]) || !decimalPattern.test(level[1]) || Number(level[0]) <= 0 || Number(level[1]) <= 0) throw new Error("invalid_" + key);
  }
  assertJsonSafe(value);
  return JSON.stringify(value);
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as JsonObject).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0);
    return Object.fromEntries(entries.map(([key,child]) => [key,canonical(child)]));
  }
  return value;
}

export async function requestDigest(record: JsonObject): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(record)));
  const hash = await crypto.subtle.digest("SHA-256",bytes);
  return Array.from(new Uint8Array(hash)).map(value => value.toString(16).padStart(2,"0")).join("");
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(value.byteLength);
  new Uint8Array(buffer).set(value);
  return buffer;
}

function decodeBase64(value: string): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error("invalid_signature_encoding");
  const decoded = atob(value);
  return Uint8Array.from(decoded, character => character.charCodeAt(0));
}

export async function verifyGuardApprovalSignature(input: {
  policyDocument: JsonObject;
  policySha256: string;
  signerKeyId: string;
  signatureAlgorithm: string;
  approvalDigest: string;
  signature: string;
}): Promise<boolean> {
  if (input.signatureAlgorithm !== "ed25519") return false;
  if (!/^[0-9a-f]{64}$/.test(input.policySha256) || !/^[0-9a-f]{64}$/.test(input.approvalDigest)) return false;
  if (!constantTimeEqual(await requestDigest(input.policyDocument), input.policySha256)) return false;
  const signer = input.policyDocument.signer;
  if (!signer || typeof signer !== "object" || Array.isArray(signer)) return false;
  const signerRecord = signer as JsonObject;
  if (signerRecord.key_id !== input.signerKeyId || signerRecord.algorithm !== "ed25519" || typeof signerRecord.public_key_base64 !== "string") return false;
  try {
    const publicKeyBytes = decodeBase64(signerRecord.public_key_base64);
    const signatureBytes = decodeBase64(input.signature);
    if (publicKeyBytes.length !== 32 || signatureBytes.length !== 64) return false;
    const publicKey = await crypto.subtle.importKey("raw", toArrayBuffer(publicKeyBytes), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "Ed25519" }, publicKey, toArrayBuffer(signatureBytes), toArrayBuffer(new TextEncoder().encode(input.approvalDigest)));
  } catch {
    return false;
  }
}

function timestamp(record: JsonObject, key: string, required = false): string | null {
  const value = record[key];
  if ((value === undefined || value === null || value === "") && !required) return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error("invalid_" + key);
  return value;
}

async function readExecutionConfig(r: JsonObject): Promise<JsonObject> {
  const profileCode = requiredText(r,"risk_profile_code",128);
  const strategyCode = requiredText(r,"strategy_code",128);
  const mode = requiredText(r,"mode",16);
  const accountId = typeof r.account_id === "string" ? uuid(r,"account_id",true) ?? "" : "";
  const instrumentId = typeof r.instrument_id === "string" ? uuid(r,"instrument_id",true) ?? "" : "";
  const symbol = typeof r.symbol === "string" ? r.symbol : "";
  if (!["paper","testnet","live"].includes(mode)) throw new Error("invalid_execution_mode");
  const client = await getPool().connect();
  try {
    const result = await client.queryObject<{
      profile_code: string;
      max_risk_per_trade: string;
      max_daily_loss: string;
      max_drawdown: string;
      max_leverage: string;
      max_open_orders: number;
      max_position_notional: string;
      max_slippage_bps: string;
      max_fee_bps: string;
      max_funding_bps: string;
      max_concentration: string;
      risk_profile_enabled: boolean;
      risk_profile_config: JsonObject | string;
      strategy_code: string;
      strategy_enabled: boolean;
      strategy_modes: string[];
      strategy_config: JsonObject | string;
      strategy_version_id: string | null;
      strategy_version: string | null;
      source_commit_sha: string | null;
      config_sha256: string | null;
      parameter_schema: JsonObject | string | null;
      parameters: JsonObject | string | null;
      validation_status: string | null;
      policy_version: string | null;
      policy_sha256: string | null;
      signer_key_id: string | null;
      policy_document: JsonObject | string | null;
    }>(
      "select rp.profile_code,rp.max_risk_per_trade::text,rp.max_daily_loss::text,rp.max_drawdown::text,rp.max_leverage::text,rp.max_open_orders,rp.max_position_notional::text,rp.max_slippage_bps::text,rp.max_fee_bps::text,rp.max_funding_bps::text,rp.max_concentration::text,rp.enabled as risk_profile_enabled,rp.config as risk_profile_config,sc.strategy_code,sc.enabled as strategy_enabled,sc.supported_modes as strategy_modes,sc.config as strategy_config,sv.id::text as strategy_version_id,sv.version as strategy_version,sv.source_commit_sha,sv.config_sha256,sv.parameter_schema,sv.parameters,sv.validation_status,gp.policy_version,gp.policy_sha256,gp.signer_key_id,gp.policy_document from nexus_private.risk_profiles rp join nexus_private.strategy_catalog sc on sc.strategy_code=$2 left join lateral (select id,version,source_commit_sha,config_sha256,parameter_schema,parameters,validation_status from nexus_private.strategy_versions where strategy_code=sc.strategy_code order by created_at desc limit 1) sv on true left join lateral (select policy_version,policy_sha256,signer_key_id,policy_document from nexus_private.guard_policy_versions where status='active' and effective_at<=now() and (retired_at is null or retired_at>now()) order by created_at desc limit 1) gp on true where rp.profile_code=$1",
      [profileCode,strategyCode],
    );
    const row = result.rows[0];
    if (!row) throw new Error("execution_profile_or_strategy_not_found");
    if (!row.risk_profile_enabled) throw new Error("execution_risk_profile_disabled");
    if (!row.strategy_enabled) throw new Error("execution_strategy_disabled");
    if (!Array.isArray(row.strategy_modes) || !row.strategy_modes.includes(mode)) throw new Error("execution_strategy_mode_not_supported");
    if (!row.strategy_version_id || !["validated","approved"].includes(row.validation_status ?? "")) throw new Error("execution_strategy_version_not_validated");
    const breakerResult = await client.queryObject<{ scope: string; scope_key: string; state: string; trigger_code: string | null; reset_after: string | null }>(
      "select scope,scope_key,state,trigger_code,reset_after from nexus_private.circuit_breakers where state <> 'closed' and (scope='global' or (scope='venue' and scope_key='binance') or (scope='strategy' and scope_key=$1) or (scope='account' and scope_key=$2) or (scope='instrument' and scope_key in (nullif($3,''),nullif($4,'')))) order by scope,scope_key",
      [strategyCode,accountId,instrumentId,symbol],
    );
    if (breakerResult.rows.length > 0) throw new Error("execution_circuit_breaker_open");
    if (mode === "live" && !row.policy_version) throw new Error("execution_active_guard_policy_missing");
    const riskConfig = typeof row.risk_profile_config === "string" ? JSON.parse(row.risk_profile_config) as JsonObject : row.risk_profile_config;
    const strategyConfig = typeof row.strategy_config === "string" ? JSON.parse(row.strategy_config) as JsonObject : row.strategy_config;
    const parameterSchema = typeof row.parameter_schema === "string" ? JSON.parse(row.parameter_schema) as JsonObject : row.parameter_schema;
    const parameters = typeof row.parameters === "string" ? JSON.parse(row.parameters) as JsonObject : row.parameters;
    const policyDocument = typeof row.policy_document === "string" ? JSON.parse(row.policy_document) as JsonObject : row.policy_document;
    assertJsonSafe(riskConfig);
    assertJsonSafe(strategyConfig);
    if (parameterSchema) assertJsonSafe(parameterSchema);
    if (parameters) assertJsonSafe(parameters);
    if (policyDocument) assertJsonSafe(policyDocument);
    return {
      mode,
      riskProfile: {
        profileCode: row.profile_code,
        enabled: row.risk_profile_enabled,
        maxRiskPerTrade: Number(row.max_risk_per_trade),
        maxDailyLoss: Number(row.max_daily_loss),
        maxDrawdown: Number(row.max_drawdown),
        maxLeverage: Number(row.max_leverage),
        maxOpenOrders: row.max_open_orders,
        maxPositionNotional: Number(row.max_position_notional),
        maxSlippageBps: Number(row.max_slippage_bps),
        maxFeeBps: Number(row.max_fee_bps),
        maxFundingBps: Number(row.max_funding_bps),
        maxConcentration: Number(row.max_concentration),
        minRewardRisk: Number(riskConfig.minRewardRisk ?? riskConfig.min_reward_risk ?? 1.5),
        config: riskConfig,
      },
      strategy: {
        strategyCode: row.strategy_code,
        enabled: row.strategy_enabled,
        supportedModes: row.strategy_modes,
        config: strategyConfig,
        version: {
          id: row.strategy_version_id,
          version: row.strategy_version,
          sourceCommitSha: row.source_commit_sha,
          configSha256: row.config_sha256,
          validationStatus: row.validation_status,
          parameterSchema,
          parameters,
        },
      },
      activeGuardPolicy: row.policy_version ? {
        policyVersion: row.policy_version,
        policySha256: row.policy_sha256,
        signerKeyId: row.signer_key_id,
        policyDocument,
      } : null,
      circuitBreakers: breakerResult.rows,
    };
  } finally {
    client.release();
  }
}

async function insertRecord(kind: TelemetryKind, r: JsonObject): Promise<string> {
  const client = await getPool().connect();
  try {

    if (kind === "guard_approval") {
      const intentId = uuid(r,"intent_id")!;
      const intentDigest = requiredText(r,"intent_digest",64);
      const policyVersion = requiredText(r,"policy_version",128);
      const decision = requiredText(r,"decision",16);
      const reasonCode = requiredText(r,"reason_code",128);
      const approvalDigest = requiredText(r,"approval_digest",64);
      const signerKeyId = requiredText(r,"signer_key_id",128);
      const signatureAlgorithm = requiredText(r,"signature_algorithm",32);
      const signature = requiredText(r,"signature",2048);
      const nonce = requiredText(r,"nonce",128);
      const issuedAt = timestamp(r,"issued_at",true)!;
      const expiresAt = timestamp(r,"expires_at",true)!;
      if (decision !== "allow") throw new Error("guard_approval_must_be_allow");
      if (!/^[0-9a-f]{64}$/.test(intentDigest) || !/^[0-9a-f]{64}$/.test(approvalDigest)) throw new Error("invalid_guard_digest");
      if (nonce.length < 16) throw new Error("invalid_guard_nonce");
      const issuedMs = Date.parse(issuedAt);
      const expiresMs = Date.parse(expiresAt);
      const now = Date.now();
      if (issuedMs > now + 30000 || expiresMs <= now || expiresMs <= issuedMs || expiresMs > issuedMs + 300000 || expiresMs > now + 300000) throw new Error("guard_approval_time_window_invalid");
      const q = await client.queryObject<{
        request_digest: string | null;
        intent_state: string;
        requested_mode: string;
        risk_decision: string | null;
        account_status: string;
        account_environment: string;
        strategy_enabled: boolean;
        strategy_modes: string[];
        risk_enabled: boolean;
        policy_sha256: string;
        policy_document: JsonObject | string;
        policy_signer_key_id: string;
        policy_status: string;
        effective_at: string | null;
        retired_at: string | null;
      }>(
        "select oi.request_digest,oi.state as intent_state,oi.requested_mode,rd.decision as risk_decision,va.status as account_status,va.environment as account_environment,sc.enabled as strategy_enabled,sc.supported_modes as strategy_modes,rp.enabled as risk_enabled,gp.policy_sha256,gp.policy_document,gp.signer_key_id as policy_signer_key_id,gp.status as policy_status,gp.effective_at,gp.retired_at from nexus_private.order_intents oi join nexus_private.risk_decisions rd on rd.id=oi.risk_decision_id and rd.intent_id=oi.id join nexus_private.venue_accounts va on va.id=oi.account_id join nexus_private.strategy_catalog sc on sc.strategy_code=oi.strategy_code join nexus_private.risk_profiles rp on rp.profile_code=oi.risk_profile_code join nexus_private.guard_policy_versions gp on gp.policy_version=$2 where oi.id=$1::uuid",
        [intentId,policyVersion],
      );
      const row = q.rows[0];
      if (!row) throw new Error("guard_approval_context_unavailable");
      if (row.request_digest !== intentDigest) throw new Error("guard_intent_digest_mismatch");
      if (row.intent_state !== "approved" || row.requested_mode !== "live" || row.risk_decision !== "allow") throw new Error("guard_intent_not_approved");
      if (row.account_status !== "armed" || row.account_environment !== "production") throw new Error("guard_production_account_not_armed");
      if (!row.strategy_enabled || !row.strategy_modes?.includes("live")) throw new Error("guard_strategy_not_live_enabled");
      if (!row.risk_enabled) throw new Error("guard_risk_profile_not_enabled");
      if (row.policy_status !== "active" || !row.effective_at || Date.parse(row.effective_at) > now || (row.retired_at && Date.parse(row.retired_at) <= now)) throw new Error("guard_policy_not_active");
      if (row.policy_signer_key_id !== signerKeyId) throw new Error("guard_signer_key_mismatch");
      const policyDocument = typeof row.policy_document === "string" ? JSON.parse(row.policy_document) as JsonObject : row.policy_document;
      const approvalPayload: JsonObject = {
        intent_id: intentId,
        intent_digest: intentDigest,
        policy_version: policyVersion,
        decision,
        reason_code: reasonCode,
        signer_key_id: signerKeyId,
        nonce,
        issued_at: issuedAt,
        expires_at: expiresAt,
      };
      if (!constantTimeEqual(await requestDigest(approvalPayload),approvalDigest)) throw new Error("guard_approval_digest_mismatch");
      const signatureValid = await verifyGuardApprovalSignature({
        policyDocument,
        policySha256: row.policy_sha256,
        signerKeyId,
        signatureAlgorithm,
        approvalDigest,
        signature,
      });
      if (!signatureValid) throw new Error("guard_signature_invalid");
      const inserted = await client.queryObject<{ id: string }>(
        "insert into nexus_private.guard_approvals (intent_id,policy_version,decision,reason_code,intent_digest,approval_digest,signer_key_id,signature_algorithm,signature,nonce,issued_at,expires_at,evidence) values ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::timestamptz,$12::timestamptz,$13::jsonb) on conflict(intent_id) do nothing returning id::text as id",
        [intentId,policyVersion,decision,reasonCode,intentDigest,approvalDigest,signerKeyId,signatureAlgorithm,signature,nonce,issuedAt,expiresAt,jsonObject(r,"evidence")],
      );
      if (inserted.rows[0]?.id) return inserted.rows[0].id;
      const existing = await client.queryObject<{ id: string; approval_digest: string }>(
        "select id::text as id,approval_digest from nexus_private.guard_approvals where intent_id=$1::uuid",
        [intentId],
      );
      if (!existing.rows[0] || existing.rows[0].approval_digest !== approvalDigest) throw new Error("guard_approval_conflict");
      return existing.rows[0].id;
    }
    if (kind === "authorize_live") {
      const q = await client.queryObject<{ id: string }>(
        "select nexus_private.consume_live_authorization($1::uuid,$2,$3)::text as id",
        [uuid(r,"intent_id"),requiredText(r,"executor_id",128),requiredText(r,"approval_digest",64)],
      );
      if (!q.rows[0]?.id) throw new Error("live_authorization_denied");
      return q.rows[0].id;
    }
    if (kind === "submission_result") {
      const q = await client.queryObject<{ accepted: boolean }>(
        "select nexus_private.record_execution_submission($1::uuid,$2,$3,$4,$5) as accepted",
        [uuid(r,"authorization_id"),requiredText(r,"executor_id",128),requiredText(r,"outcome",16),optionalText(r,"venue_order_id",128),optionalText(r,"error_code",128)],
      );
      if (q.rows[0]?.accepted !== true) throw new Error("execution_submission_transition_rejected");
      return uuid(r,"authorization_id")!;
    }
    if (kind === "venue_account") {
      const q = await client.queryObject<{ id: string }>(
        "insert into nexus_private.venue_accounts (venue,account_label,environment,account_type,status,capabilities) values ($1,$2,$3,$4,'disabled',$5::jsonb) on conflict(venue,account_label,environment) do nothing returning id::text as id",
        [requiredText(r,"venue",64),requiredText(r,"account_label",128),requiredText(r,"environment",16),optionalText(r,"account_type",32) ?? "unified",jsonObject(r,"capabilities")],
      );
      if (q.rows[0]?.id) return q.rows[0].id;
      const existing = await client.queryObject<{ id: string }>("select id::text as id from nexus_private.venue_accounts where venue=$1 and account_label=$2 and environment=$3", [requiredText(r,"venue",64),requiredText(r,"account_label",128),requiredText(r,"environment",16)]);
      if (!existing.rows[0]) throw new Error("venue_account_registration_unavailable");
      return existing.rows[0].id;
    }
    if (kind === "instrument") {
      const q = await client.queryObject<{ id: string }>(
        "insert into nexus_private.instruments (venue,market_type,symbol,base_asset,quote_asset,settlement_asset,price_tick,quantity_step,min_quantity,min_notional,contract_multiplier,maker_fee_bps,taker_fee_bps,active,metadata,observed_at) values ($1,$2,$3,$4,$5,$6,$7::numeric,$8::numeric,$9::numeric,$10::numeric,$11::numeric,$12::numeric,$13::numeric,$14,$15::jsonb,pg_catalog.now()) on conflict(venue,market_type,symbol) do update set price_tick=excluded.price_tick,quantity_step=excluded.quantity_step,min_quantity=excluded.min_quantity,min_notional=excluded.min_notional,contract_multiplier=excluded.contract_multiplier,maker_fee_bps=excluded.maker_fee_bps,taker_fee_bps=excluded.taker_fee_bps,active=excluded.active,metadata=excluded.metadata,observed_at=excluded.observed_at returning id::text as id",
        [requiredText(r,"venue",64),requiredText(r,"market_type",16),requiredText(r,"symbol",64),requiredText(r,"base_asset",32),requiredText(r,"quote_asset",32),optionalText(r,"settlement_asset",32),decimal(r,"price_tick"),decimal(r,"quantity_step"),decimal(r,"min_quantity"),decimal(r,"min_notional") ?? "0",decimal(r,"contract_multiplier") ?? "1",decimal(r,"maker_fee_bps",false,false),decimal(r,"taker_fee_bps",false,false),bool(r,"active",true),jsonObject(r,"metadata")],
      );
      return q.rows[0].id;
    }
    if (kind === "run") {
      const q = await client.queryObject<{ id: string }>(
        "insert into nexus_private.strategy_runs (strategy_code,chain,execution_mode,status,source_commit_sha,config_sha256,correlation_id,started_at,finished_at,metadata) values ($1,$2,$3,$4,$5,$6,coalesce($7::uuid,pg_catalog.gen_random_uuid()),$8::timestamptz,$9::timestamptz,$10::jsonb) returning id::text as id",
        [requiredText(r,"strategy_code",64),requiredText(r,"chain",24),optionalText(r,"execution_mode",16) ?? "observe",optionalText(r,"status",16) ?? "queued",optionalText(r,"source_commit_sha",40),optionalText(r,"config_sha256",64),optionalText(r,"correlation_id",36),timestamp(r,"started_at"),timestamp(r,"finished_at"),jsonObject(r,"metadata")],
      );
      return q.rows[0].id;
    }
    if (kind === "agent") {
      const q = await client.queryObject<{ id: string }>(
        "insert into nexus_private.agents (run_id,agent_code,agent_no,role_name,status,worker_id,started_at,heartbeat_at,finished_at,metrics) values ($1::uuid,$2,$3,$4,$5,$6,$7::timestamptz,$8::timestamptz,$9::timestamptz,$10::jsonb) returning id::text as id",
        [uuid(r,"run_id") ,requiredText(r,"agent_code",64),integer(r,"agent_no",1,64),requiredText(r,"role_name",128),optionalText(r,"status",16) ?? "registered",optionalText(r,"worker_id",128),timestamp(r,"started_at"),timestamp(r,"heartbeat_at"),timestamp(r,"finished_at"),jsonObject(r,"metrics")],
      );
      return q.rows[0].id;
    }
    if (kind === "event") {
      const q = await client.queryObject<{ id: string }>(
        "insert into nexus_private.agent_events (run_id,agent_id,severity,event_type,message,payload,source_commit_sha,dedupe_key) values ($1::uuid,$2::uuid,$3,$4,$5,$6::jsonb,$7,$8) on conflict do nothing returning event_uid::text as id",
        [uuid(r,"run_id"),uuid(r,"agent_id",false),requiredText(r,"severity",16),requiredText(r,"event_type",128),requiredText(r,"message",4000),jsonObject(r,"payload"),optionalText(r,"source_commit_sha",40),optionalText(r,"dedupe_key",256)],
      );
      if (q.rows[0]?.id) return q.rows[0].id;
      const dedupeKey = optionalText(r,"dedupe_key",256);
      if (!dedupeKey) throw new Error("idempotency_record_unavailable");
      const existing = await client.queryObject<{ id: string }>("select event_uid::text as id from nexus_private.agent_events where run_id=$1::uuid and dedupe_key=$2", [uuid(r,"run_id"),dedupeKey]);
      if (!existing.rows[0]) throw new Error("idempotency_record_unavailable");
      return existing.rows[0].id;
    }
    if (kind === "quote") {
      const q = await client.queryObject<{ id: string }>(
        "insert into nexus_private.market_quotes (run_id,chain,venue,pool_address,input_asset,output_asset,input_amount_atomic,output_amount_atomic,input_decimals,output_decimals,observed_slot,quote_source,quoted_at,valid_until,response_digest,metadata) values ($1::uuid,$2,$3,$4,$5,$6,$7::numeric,$8::numeric,$9,$10,$11::bigint,$12,$13::timestamptz,$14::timestamptz,$15,$16::jsonb) returning id::text as id",
        [uuid(r,"run_id",false),requiredText(r,"chain",24),requiredText(r,"venue",128),optionalText(r,"pool_address",128),requiredText(r,"input_asset",128),requiredText(r,"output_asset",128),atomic(r,"input_amount_atomic"),atomic(r,"output_amount_atomic"),integer(r,"input_decimals",0,30),integer(r,"output_decimals",0,30),optionalInteger(r,"observed_slot"),requiredText(r,"quote_source",128),timestamp(r,"quoted_at",true),timestamp(r,"valid_until"),optionalText(r,"response_digest",128),jsonObject(r,"metadata")],
      );
      return q.rows[0].id;
    }
    if (kind === "attempt") {
      const q = await client.queryObject<{ id: string }>(
        "insert into nexus_private.execution_attempts (run_id,quote_id,attempt_no,provider,status,transaction_signature,bundle_id,recent_blockhash,requested_slot,landed_slot,compute_units,priority_fee_atomic,bundle_tip_atomic,expected_net_profit_atomic,profit_asset,profit_decimals,simulation_error,failure_code,submitted_at,confirmed_at) values ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9::bigint,$10::bigint,$11::integer,$12::numeric,$13::numeric,$14::numeric,$15,$16::smallint,$17::jsonb,$18,$19::timestamptz,$20::timestamptz) returning id::text as id",
        [uuid(r,"run_id"),uuid(r,"quote_id",false),integer(r,"attempt_no",1),requiredText(r,"provider",32),optionalText(r,"status",16) ?? "prepared",optionalText(r,"transaction_signature",128),optionalText(r,"bundle_id",128),optionalText(r,"recent_blockhash",128),optionalInteger(r,"requested_slot"),optionalInteger(r,"landed_slot"),optionalInteger(r,"compute_units"),atomic(r,"priority_fee_atomic") ?? "0",atomic(r,"bundle_tip_atomic") ?? "0",atomic(r,"expected_net_profit_atomic",true,false),optionalText(r,"profit_asset",128),optionalInteger(r,"profit_decimals",0,30),r.simulation_error === undefined || r.simulation_error === null ? null : JSON.stringify(r.simulation_error),optionalText(r,"failure_code",128),timestamp(r,"submitted_at"),timestamp(r,"confirmed_at")],
      );
      return q.rows[0].id;
    }
    if (kind === "settlement") {
      const q = await client.queryObject<{ id: string }>(
        "insert into nexus_private.settlements (attempt_id,status,asset,asset_decimals,borrowed_atomic,repaid_atomic,loan_fee_atomic,gross_profit_atomic,total_cost_atomic,net_profit_atomic,finalized_slot,transaction_signature,settled_at,evidence) values ($1::uuid,$2,$3,$4,$5::numeric,$6::numeric,$7::numeric,$8::numeric,$9::numeric,$10::numeric,$11::bigint,$12,$13::timestamptz,$14::jsonb) returning id::text as id",
        [uuid(r,"attempt_id"),requiredText(r,"status",16),requiredText(r,"asset",128),integer(r,"asset_decimals",0,30),atomic(r,"borrowed_atomic") ?? "0",atomic(r,"repaid_atomic") ?? "0",atomic(r,"loan_fee_atomic") ?? "0",atomic(r,"gross_profit_atomic",true) ?? "0",atomic(r,"total_cost_atomic") ?? "0",atomic(r,"net_profit_atomic",true) ?? "0",optionalInteger(r,"finalized_slot"),optionalText(r,"transaction_signature",128),timestamp(r,"settled_at"),jsonObject(r,"evidence")],
      );
      return q.rows[0].id;
    }
    if (kind === "order_intent") {
      const digest = await requestDigest(r);
      const q = await client.queryObject<{ id: string }>(
        "insert into nexus_private.order_intents (run_id,strategy_code,strategy_version_id,account_id,instrument_id,client_order_id,idempotency_key,request_digest,side,position_side,order_type,time_in_force,quantity,limit_price,stop_price,reduce_only,post_only,risk_profile_code,requested_mode,metadata) values ($1::uuid,$2,$3::uuid,$4::uuid,$5::uuid,$6,$7,$8,$9,$10,$11,$12,$13::numeric,$14::numeric,$15::numeric,$16,$17,$18,$19,$20::jsonb) on conflict(account_id,idempotency_key) do nothing returning id::text as id",
        [uuid(r,"run_id",false),requiredText(r,"strategy_code",64),uuid(r,"strategy_version_id",false),uuid(r,"account_id"),uuid(r,"instrument_id"),requiredText(r,"client_order_id",128),requiredText(r,"idempotency_key",128),digest,requiredText(r,"side",8),optionalText(r,"position_side",8),requiredText(r,"order_type",32),optionalText(r,"time_in_force",16),decimal(r,"quantity"),decimal(r,"limit_price",false,false),decimal(r,"stop_price",false,false),bool(r,"reduce_only"),bool(r,"post_only"),optionalText(r,"risk_profile_code",64),requiredText(r,"requested_mode",16),jsonObject(r,"metadata")],
      );
      if (q.rows[0]?.id) return q.rows[0].id;
      const existing = await client.queryObject<{ id: string; request_digest: string | null }>("select id::text as id,request_digest from nexus_private.order_intents where account_id=$1::uuid and idempotency_key=$2", [uuid(r,"account_id"),requiredText(r,"idempotency_key",128)]);
      if (!existing.rows[0]) throw new Error("idempotency_record_unavailable");
      if (existing.rows[0].request_digest !== digest) throw new Error("idempotency_key_reused_with_different_payload");
      return existing.rows[0].id;
    }
    if (kind === "risk_decision") {
      await client.queryObject("begin");
      try {
        const q = await client.queryObject<{ id: string }>(
          "insert into nexus_private.risk_decisions (intent_id,profile_code,decision,reason_code,explanation,metrics) values ($1::uuid,$2,$3,$4,$5,$6::jsonb) returning id::text as id",
          [uuid(r,"intent_id"),optionalText(r,"profile_code",64),requiredText(r,"decision",16),requiredText(r,"reason_code",128),optionalText(r,"explanation",2000) ?? "",jsonObject(r,"metrics")],
        );
        const applied = await client.queryObject<{ id: string }>(
          "update nexus_private.order_intents set risk_decision_id=$1::uuid,state=case when $2='allow' then 'approved' else 'risk_rejected' end,updated_at=pg_catalog.now() where id=$3::uuid and risk_decision_id is null and state='created' returning id::text as id",
          [q.rows[0].id,requiredText(r,"decision",16),uuid(r,"intent_id")],
        );
        if (!applied.rows[0]) throw new Error("risk_decision_not_applied");
        await client.queryObject("commit");
        return q.rows[0].id;
      } catch (error) {
        await client.queryObject("rollback");
        throw error;
      }
    }
    if (kind === "order_event") {
      const q = await client.queryObject<{ id: string }>(
        "insert into nexus_private.order_events (intent_id,venue_order_id,event_uid,event_type,exchange_status,cumulative_quantity,last_fill_quantity,average_fill_price,exchange_timestamp,payload) values ($1::uuid,$2,$3,$4,$5,$6::numeric,$7::numeric,$8::numeric,$9::timestamptz,$10::jsonb) on conflict(event_uid) do nothing returning id::text as id",
        [uuid(r,"intent_id"),optionalText(r,"venue_order_id",128),requiredText(r,"event_uid",256),requiredText(r,"event_type",64),optionalText(r,"exchange_status",32),decimal(r,"cumulative_quantity",false,false),decimal(r,"last_fill_quantity",false,false),decimal(r,"average_fill_price",false,false),timestamp(r,"exchange_timestamp"),jsonObject(r,"payload")],
      );
      if (q.rows[0]?.id) {
        const status = optionalText(r,"exchange_status",32)?.toUpperCase();
        const nextState = status === "NEW" ? "accepted" : status === "PARTIALLY_FILLED" ? "partially_filled" : status === "FILLED" ? "filled" : status === "CANCELED" ? "canceled" : status === "REJECTED" ? "rejected" : status === "EXPIRED" ? "expired" : status ? "unknown" : null;
        if (nextState) await client.queryObject(
          "update nexus_private.order_intents set state=case when $1='accepted' and state='partially_filled' then state else $1 end,updated_at=pg_catalog.now() where id=$2::uuid and state not in ('risk_rejected','filled','canceled','rejected','expired','reconciled')",
          [nextState,uuid(r,"intent_id")],
        );
        return q.rows[0].id;
      }
      const existing = await client.queryObject<{ id: string }>("select id::text as id from nexus_private.order_events where event_uid=$1", [requiredText(r,"event_uid",256)]);
      if (!existing.rows[0]) throw new Error("idempotency_record_unavailable");
      return existing.rows[0].id;
    }
    if (kind === "fill") {
      const q = await client.queryObject<{ id: string }>(
        "insert into nexus_private.fills (intent_id,order_event_id,account_id,instrument_id,venue_trade_id,side,quantity,price,fee_amount,fee_asset,liquidity_role,executed_at,source,raw_digest) values ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7::numeric,$8::numeric,$9::numeric,$10,$11,$12::timestamptz,$13,$14) on conflict(account_id,venue_trade_id) do nothing returning id::text as id",
        [uuid(r,"intent_id"),uuid(r,"order_event_id",false),uuid(r,"account_id"),uuid(r,"instrument_id"),requiredText(r,"venue_trade_id",128),requiredText(r,"side",8),decimal(r,"quantity"),decimal(r,"price"),decimal(r,"fee_amount",false,false) ?? "0",requiredText(r,"fee_asset",32),optionalText(r,"liquidity_role",16),timestamp(r,"executed_at",true),requiredText(r,"source",64),optionalText(r,"raw_digest",128)],
      );
      if (q.rows[0]?.id) return q.rows[0].id;
      const existing = await client.queryObject<{ id: string }>("select id::text as id from nexus_private.fills where account_id=$1::uuid and venue_trade_id=$2", [uuid(r,"account_id"),requiredText(r,"venue_trade_id",128)]);
      if (!existing.rows[0]) throw new Error("idempotency_record_unavailable");
      return existing.rows[0].id;
    }
    if (kind === "position") {
      const q = await client.queryObject<{ id: string }>(
        "insert into nexus_private.position_snapshots (account_id,instrument_id,position_side,quantity,entry_price,mark_price,liquidation_price,leverage,initial_margin,maintenance_margin,realized_pnl,unrealized_pnl,observed_at,source,metadata) values ($1::uuid,$2::uuid,$3,$4::numeric,$5::numeric,$6::numeric,$7::numeric,$8::numeric,$9::numeric,$10::numeric,$11::numeric,$12::numeric,$13::timestamptz,$14,$15::jsonb) returning id::text as id",
        [uuid(r,"account_id"),uuid(r,"instrument_id"),requiredText(r,"position_side",8),decimal(r,"quantity"),decimal(r,"entry_price",false,false),decimal(r,"mark_price",false,false),decimal(r,"liquidation_price",false,false),decimal(r,"leverage",false,false),decimal(r,"initial_margin",false,false),decimal(r,"maintenance_margin",false,false),decimal(r,"realized_pnl",true,false),decimal(r,"unrealized_pnl",true,false),timestamp(r,"observed_at",true),requiredText(r,"source",64),jsonObject(r,"metadata")],
      );
      return q.rows[0].id;
    }
    if (kind === "balance") {
      const q = await client.queryObject<{ id: string }>(
        "insert into nexus_private.balance_snapshots (account_id,asset,wallet_balance,available_balance,locked_balance,unrealized_pnl,observed_at,source,metadata) values ($1::uuid,$2,$3::numeric,$4::numeric,$5::numeric,$6::numeric,$7::timestamptz,$8,$9::jsonb) returning id::text as id",
        [uuid(r,"account_id"),requiredText(r,"asset",32),decimal(r,"wallet_balance"),decimal(r,"available_balance"),decimal(r,"locked_balance") ?? "0",decimal(r,"unrealized_pnl",true) ?? "0",timestamp(r,"observed_at",true),requiredText(r,"source",64),jsonObject(r,"metadata")],
      );
      return q.rows[0].id;
    }
    if (kind === "pnl") {
      const q = await client.queryObject<{ id: string }>(
        "insert into nexus_private.pnl_ledger (account_id,run_id,intent_id,fill_id,entry_type,asset,amount,usd_conversion_rate,amount_usd,source_reference,occurred_at,metadata) values ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7::numeric,$8::numeric,$9::numeric,$10,$11::timestamptz,$12::jsonb) on conflict(account_id,source_reference,entry_type) do nothing returning id::text as id",
        [uuid(r,"account_id"),uuid(r,"run_id",false),uuid(r,"intent_id",false),uuid(r,"fill_id",false),requiredText(r,"entry_type",32),requiredText(r,"asset",32),decimal(r,"amount",true),decimal(r,"usd_conversion_rate",false,false),decimal(r,"amount_usd",true,false),requiredText(r,"source_reference",256),timestamp(r,"occurred_at",true),jsonObject(r,"metadata")],
      );
      if (q.rows[0]?.id) return q.rows[0].id;
      const existing = await client.queryObject<{ id: string }>("select id::text as id from nexus_private.pnl_ledger where account_id=$1::uuid and source_reference=$2 and entry_type=$3", [uuid(r,"account_id"),requiredText(r,"source_reference",256),requiredText(r,"entry_type",32)]);
      if (!existing.rows[0]) throw new Error("idempotency_record_unavailable");
      return existing.rows[0].id;
    }
    if (kind === "funding") {
      const q = await client.queryObject<{ id: string }>(
        "insert into nexus_private.funding_observations (instrument_id,funding_rate,mark_price,index_price,next_funding_at,observed_at,source,metadata) values ($1::uuid,$2::numeric,$3::numeric,$4::numeric,$5::timestamptz,$6::timestamptz,$7,$8::jsonb) on conflict(instrument_id,source,observed_at) do nothing returning id::text as id",
        [uuid(r,"instrument_id"),decimal(r,"funding_rate",true),decimal(r,"mark_price",false,false),decimal(r,"index_price",false,false),timestamp(r,"next_funding_at"),timestamp(r,"observed_at",true),requiredText(r,"source",64),jsonObject(r,"metadata")],
      );
      if (q.rows[0]?.id) return q.rows[0].id;
      const existing = await client.queryObject<{ id: string }>("select id::text as id from nexus_private.funding_observations where instrument_id=$1::uuid and source=$2 and observed_at=$3::timestamptz", [uuid(r,"instrument_id"),requiredText(r,"source",64),timestamp(r,"observed_at",true)]);
      if (!existing.rows[0]) throw new Error("idempotency_record_unavailable");
      return existing.rows[0].id;
    }
    if (kind === "heartbeat") {
      await client.queryObject(
        "select nexus_private.heartbeat_agent($1,$2,$3,$4::jsonb)",
        [requiredText(r,"agent_code",64),requiredText(r,"worker_id",128),requiredText(r,"status",16),jsonObject(r,"metrics")],
      );
      return requiredText(r,"agent_code",64) + ":" + requiredText(r,"worker_id",128);
    }
    if (kind === "alpha") {
      const q = await client.queryObject<{ id: string }>(
        "insert into nexus_private.alpha_observations (run_id,strategy_code,instrument_id,signal_family,horizon_seconds,signal_value,confidence,expected_edge_bps,realized_edge_bps,evidence,observed_at) values ($1::uuid,$2,$3::uuid,$4,$5,$6::numeric,$7::numeric,$8::numeric,$9::numeric,$10::jsonb,$11::timestamptz) returning id::text as id",
        [uuid(r,"run_id",false),optionalText(r,"strategy_code",64),uuid(r,"instrument_id",false),requiredText(r,"signal_family",64),integer(r,"horizon_seconds",1,31536000),decimal(r,"signal_value",true),decimal(r,"confidence",false,false),decimal(r,"expected_edge_bps",true,false),decimal(r,"realized_edge_bps",true,false),jsonObject(r,"evidence"),timestamp(r,"observed_at",true)],
      );
      return q.rows[0].id;
    }
    if (kind === "venue_health") {
      const q = await client.queryObject<{ id: string }>(
        "insert into nexus_private.venue_health (venue,environment,market_type,status,latency_ms,rate_limit_remaining,observed_at,metadata) values ($1,$2,$3,$4,$5::numeric,$6,$7::timestamptz,$8::jsonb) returning id::text as id",
        [requiredText(r,"venue",64),requiredText(r,"environment",16),requiredText(r,"market_type",16),requiredText(r,"status",24),decimal(r,"latency_ms",false,false),optionalInteger(r,"rate_limit_remaining"),timestamp(r,"observed_at") ?? new Date().toISOString(),jsonObject(r,"metadata")],
      );
      return q.rows[0].id;
    }
    if (kind === "reconciliation") {
      const q = await client.queryObject<{ id: string }>(
        "insert into nexus_private.reconciliation_runs (account_id,venue,status,started_at,finished_at,cursor,summary) values ($1::uuid,$2,$3,$4::timestamptz,$5::timestamptz,$6::jsonb,$7::jsonb) returning id::text as id",
        [uuid(r,"account_id"),requiredText(r,"venue",64),optionalText(r,"status",16) ?? "running",timestamp(r,"started_at") ?? new Date().toISOString(),timestamp(r,"finished_at"),jsonObject(r,"cursor"),jsonObject(r,"summary")],
      );
      return q.rows[0].id;
    }
    if (kind === "discrepancy") {
      const q = await client.queryObject<{ id: string }>(
        "insert into nexus_private.reconciliation_discrepancies (reconciliation_id,entity_type,local_reference,venue_reference,discrepancy_type,severity,local_value,venue_value,resolution_status,resolution_note,detected_at,resolved_at) values ($1::uuid,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11::timestamptz,$12::timestamptz) returning id::text as id",
        [uuid(r,"reconciliation_id"),requiredText(r,"entity_type",64),optionalText(r,"local_reference",256),optionalText(r,"venue_reference",256),requiredText(r,"discrepancy_type",64),optionalText(r,"severity",16) ?? "warning",r.local_value === undefined || r.local_value === null ? null : JSON.stringify(r.local_value),r.venue_value === undefined || r.venue_value === null ? null : JSON.stringify(r.venue_value),optionalText(r,"resolution_status",16) ?? "open",optionalText(r,"resolution_note",2000),timestamp(r,"detected_at") ?? new Date().toISOString(),timestamp(r,"resolved_at")],
      );
      return q.rows[0].id;
    }
    if (kind === "task") {
      const q = await client.queryObject<{ id: string }>(
        "insert into nexus_private.agent_tasks (run_id,agent_id,agent_code,parent_task_id,task_type,priority,idempotency_key,input,max_attempts) values ($1::uuid,$2::uuid,$3,$4::uuid,$5,$6,$7,$8::jsonb,$9) on conflict(idempotency_key) do nothing returning id::text as id",
        [uuid(r,"run_id",false),uuid(r,"agent_id",false),requiredText(r,"agent_code",64),uuid(r,"parent_task_id",false),requiredText(r,"task_type",64),optionalInteger(r,"priority",0,100) ?? 50,requiredText(r,"idempotency_key",128),jsonObject(r,"input"),optionalInteger(r,"max_attempts",1,20) ?? 3],
      );
      if (q.rows[0]?.id) return q.rows[0].id;
      const existing = await client.queryObject<{ id: string }>("select id::text as id from nexus_private.agent_tasks where idempotency_key=$1", [requiredText(r,"idempotency_key",128)]);
      if (!existing.rows[0]) throw new Error("idempotency_record_unavailable");
      return existing.rows[0].id;
    }
    if (kind === "market_bar") {
      const q = await client.queryObject<{ id: string }>(
        "insert into nexus_private.market_bars (instrument_id,interval_code,open_time,close_time,open_price,high_price,low_price,close_price,base_volume,quote_volume,trade_count,source,observed_at) values ($1::uuid,$2,$3::timestamptz,$4::timestamptz,$5::numeric,$6::numeric,$7::numeric,$8::numeric,$9::numeric,$10::numeric,$11,$12,$13::timestamptz) on conflict(instrument_id,interval_code,open_time,source) do nothing returning id::text as id",
        [uuid(r,"instrument_id"),requiredText(r,"interval_code",8),timestamp(r,"open_time",true),timestamp(r,"close_time",true),decimal(r,"open_price"),decimal(r,"high_price"),decimal(r,"low_price"),decimal(r,"close_price"),decimal(r,"base_volume"),decimal(r,"quote_volume") ?? "0",optionalInteger(r,"trade_count") ?? 0,requiredText(r,"source",64),timestamp(r,"observed_at") ?? new Date().toISOString()],
      );
      if (q.rows[0]?.id) return q.rows[0].id;
      const existing = await client.queryObject<{ id: string }>("select id::text as id from nexus_private.market_bars where instrument_id=$1::uuid and interval_code=$2 and open_time=$3::timestamptz and source=$4", [uuid(r,"instrument_id"),requiredText(r,"interval_code",8),timestamp(r,"open_time",true),requiredText(r,"source",64)]);
      if (!existing.rows[0]) throw new Error("idempotency_record_unavailable");
      return existing.rows[0].id;
    }
    if (kind === "order_book") {
      const q = await client.queryObject<{ id: string }>(
        "insert into nexus_private.order_book_snapshots (instrument_id,venue,sequence_number,bids,asks,checksum,depth_levels,source,observed_at) values ($1::uuid,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8,$9::timestamptz) on conflict do nothing returning id::text as id",
        [uuid(r,"instrument_id"),requiredText(r,"venue",64),requiredText(r,"sequence_number",128),bookLevels(r,"bids"),bookLevels(r,"asks"),optionalText(r,"checksum",128),integer(r,"depth_levels",1,100),requiredText(r,"source",64),timestamp(r,"observed_at",true)],
      );
      if (q.rows[0]?.id) return q.rows[0].id;
      const existing = await client.queryObject<{ id: string }>("select id::text as id from nexus_private.order_book_snapshots where instrument_id=$1::uuid and venue=$2 and sequence_number=$3", [uuid(r,"instrument_id"),requiredText(r,"venue",64),requiredText(r,"sequence_number",128)]);
      if (!existing.rows[0]) throw new Error("idempotency_record_unavailable");
      return existing.rows[0].id;
    }
    if (kind === "order_flow") {
      const sequence = optionalText(r,"event_sequence",128);
      const tradeId = optionalText(r,"exchange_trade_id",128);
      if (!sequence && !tradeId) throw new Error("event_sequence_or_trade_id_required");
      const q = await client.queryObject<{ id: string }>(
        "insert into nexus_private.order_flow_events (instrument_id,venue,event_type,side,price,quantity,event_sequence,exchange_trade_id,maker,occurred_at,received_at,payload_digest) values ($1::uuid,$2,$3,$4,$5::numeric,$6::numeric,$7,$8,$9,$10::timestamptz,$11::timestamptz,$12) on conflict do nothing returning id::text as id",
        [uuid(r,"instrument_id"),requiredText(r,"venue",64),requiredText(r,"event_type",16),requiredText(r,"side",8),decimal(r,"price"),decimal(r,"quantity"),optionalText(r,"event_sequence",128),optionalText(r,"exchange_trade_id",128),r.maker === undefined || r.maker === null ? null : bool(r,"maker"),timestamp(r,"occurred_at",true),timestamp(r,"received_at") ?? new Date().toISOString(),optionalText(r,"payload_digest",128)],
      );
      if (q.rows[0]?.id) return q.rows[0].id;
      const existing = await client.queryObject<{ id: string }>("select id::text as id from nexus_private.order_flow_events where instrument_id=$1::uuid and venue=$2 and (($3::text is not null and event_sequence=$3) or ($4::text is not null and exchange_trade_id=$4)) limit 1", [uuid(r,"instrument_id"),requiredText(r,"venue",64),sequence,tradeId]);
      if (!existing.rows[0]) throw new Error("idempotency_record_unavailable");
      return existing.rows[0].id;
    }
    throw new Error("unsupported_kind");
  } finally {
    client.release();
  }
}

async function broadcastTelemetry(kind: TelemetryKind, id: string): Promise<boolean> {
  const client = await getPool().connect();
  try {
    await client.queryObject(
      "select realtime.send($1::jsonb,$2,$3,true)",
      [JSON.stringify({ kind, id }),"telemetry_updated","nexus:telemetry:admin"],
    );
    return true;
  } catch {
    console.error("nexus_telemetry_broadcast_failed");
    return false;
  } finally {
    client.release();
  }
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method !== "POST") return response({ error: "method_not_allowed" },405);
  if (!(req.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) return response({ error: "application_json_required" },415);
  if (!authorized(req)) return response({ error: "unauthorized" },401);
  const body = await req.text();
  if (new TextEncoder().encode(body).byteLength > maxBodyBytes) return response({ error: "payload_too_large" },413);
  try {
    const input = JSON.parse(body) as JsonObject;
    const kind = input.kind;
    if (typeof kind !== "string" || !Object.hasOwn(fields,kind)) return response({ error: "unsupported_kind" },400);
    const record = recordFor(kind as TelemetryKind,input.record);
    if (kind === "execution_config") {
      const data = await readExecutionConfig(record);
      return response({ ok: true,kind,data },200);
    }
    const id = await insertRecord(kind as TelemetryKind,record);
    const broadcasted = await broadcastTelemetry(kind as TelemetryKind,id);
    return response({ ok: true,kind,id,broadcast: broadcasted ? "sent" : "unavailable" },201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "request_rejected";
    if (/^(record_|unknown_|sensitive_|payload_|non_finite_|atomic_|invalid_|negative_|unsupported_|idempotency_|execution_)/.test(message)) return response({ error: message },400);
    console.error("nexus_telemetry_ingest_failed");
    return response({ error: "telemetry_write_failed" },422);
  }
}

if (import.meta.main) Deno.serve(handleRequest);
