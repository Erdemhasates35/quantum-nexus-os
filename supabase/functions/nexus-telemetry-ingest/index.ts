import { Pool } from "jsr:@db/postgres@^0";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type JsonObject = Record<string, unknown>;
type TelemetryKind = "run" | "agent" | "event" | "quote" | "attempt" | "settlement";

const databaseUrl = Deno.env.get("SUPABASE_DB_URL");
if (!databaseUrl) throw new Error("database_connection_unavailable");

const pool = new Pool(databaseUrl, 1, true);
const maxBodyBytes = 16 * 1024;
const maxJsonDepth = 8;

const secretKeysJson = Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}";
let secretKeyValues: string[] = [];
try {
  const parsed = JSON.parse(secretKeysJson) as Record<string, unknown>;
  secretKeyValues = Object.values(parsed).filter((value): value is string => typeof value === "string" && value.length > 0);
} catch {
  throw new Error("secret_key_configuration_invalid");
}
const legacyServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (legacyServiceRoleKey) secretKeyValues.push(legacyServiceRoleKey);

const fields: Record<TelemetryKind, Set<string>> = {
  run: new Set(["strategy_code", "chain", "execution_mode", "status", "source_commit_sha", "config_sha256", "correlation_id", "started_at", "finished_at", "metadata"]),
  agent: new Set(["run_id", "agent_code", "agent_no", "role_name", "status", "worker_id", "started_at", "heartbeat_at", "finished_at", "metrics"]),
  event: new Set(["run_id", "agent_id", "severity", "event_type", "message", "payload", "source_commit_sha", "dedupe_key"]),
  quote: new Set(["run_id", "chain", "venue", "pool_address", "input_asset", "output_asset", "input_amount_atomic", "output_amount_atomic", "input_decimals", "output_decimals", "observed_slot", "quote_source", "quoted_at", "valid_until", "response_digest", "metadata"]),
  attempt: new Set(["run_id", "quote_id", "attempt_no", "provider", "status", "transaction_signature", "bundle_id", "recent_blockhash", "requested_slot", "landed_slot", "compute_units", "priority_fee_atomic", "bundle_tip_atomic", "expected_net_profit_atomic", "profit_asset", "profit_decimals", "simulation_error", "failure_code", "submitted_at", "confirmed_at"]),
  settlement: new Set(["attempt_id", "status", "asset", "asset_decimals", "borrowed_atomic", "repaid_atomic", "loan_fee_atomic", "gross_profit_atomic", "total_cost_atomic", "net_profit_atomic", "finalized_slot", "transaction_signature", "settled_at", "evidence"]),
};

const forbiddenField = /(private[_-]?key|secret[_-]?key|mnemonic|seed[_-]?phrase|service[_-]?role[_-]?key|authorization|access[_-]?token)/i;
const forbiddenValue = /(-----BEGIN [A-Z ]*PRIVATE KEY-----|Bearer\s+[A-Za-z0-9._-]+|sb_secret_[A-Za-z0-9_-]{8,})/i;

function constantTimeEqual(left: string, right: string): boolean {
  const max = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < max; i++) {
    diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function authorized(req: Request): boolean {
  const authorization = req.headers.get("authorization") ?? "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const apiKey = req.headers.get("apikey") ?? "";
  const candidate = bearer || apiKey;
  if (!candidate) return false;
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

function recordFor(kind: TelemetryKind, value: unknown): JsonObject {
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

function timestamp(record: JsonObject, key: string, required = false): string | null {
  const value = record[key];
  if ((value === undefined || value === null || value === "") && !required) return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error("invalid_" + key);
  return value;
}

async function insertRecord(kind: TelemetryKind, r: JsonObject): Promise<string> {
  const client = await pool.connect();
  try {
    if (kind === "run") {
      const q = await client.queryObject<{ id: string }>(
        "insert into nexus_private.strategy_runs (strategy_code,chain,execution_mode,status,source_commit_sha,config_sha256,correlation_id,started_at,finished_at,metadata) values ($1,$2,$3,$4,$5,$6,coalesce($7::uuid,pg_catalog.gen_random_uuid()),$8::timestamptz,$9::timestamptz,$10::jsonb) returning id::text as id",
        [requiredText(r,"strategy_code",64), requiredText(r,"chain",24), optionalText(r,"execution_mode",16) ?? "observe", optionalText(r,"status",16) ?? "queued", optionalText(r,"source_commit_sha",40), optionalText(r,"config_sha256",64), optionalText(r,"correlation_id",36), timestamp(r,"started_at"), timestamp(r,"finished_at"), jsonObject(r,"metadata")],
      );
      return q.rows[0].id;
    }

    if (kind === "agent") {
      const q = await client.queryObject<{ id: string }>(
        "insert into nexus_private.agents (run_id,agent_code,agent_no,role_name,status,worker_id,started_at,heartbeat_at,finished_at,metrics) values ($1::uuid,$2,$3,$4,$5,$6,$7::timestamptz,$8::timestamptz,$9::timestamptz,$10::jsonb) returning id::text as id",
        [requiredText(r,"run_id",36), requiredText(r,"agent_code",64), integer(r,"agent_no",1,3), requiredText(r,"role_name",128), optionalText(r,"status",16) ?? "registered", optionalText(r,"worker_id",128), timestamp(r,"started_at"), timestamp(r,"heartbeat_at"), timestamp(r,"finished_at"), jsonObject(r,"metrics")],
      );
      return q.rows[0].id;
    }

    if (kind === "event") {
      const q = await client.queryObject<{ id: string }>(
        "insert into nexus_private.agent_events (run_id,agent_id,severity,event_type,message,payload,source_commit_sha,dedupe_key) values ($1::uuid,$2::uuid,$3,$4,$5,$6::jsonb,$7,$8) returning event_uid::text as id",
        [requiredText(r,"run_id",36), optionalText(r,"agent_id",36), requiredText(r,"severity",16), requiredText(r,"event_type",128), requiredText(r,"message",4000), jsonObject(r,"payload"), optionalText(r,"source_commit_sha",40), optionalText(r,"dedupe_key",256)],
      );
      return q.rows[0].id;
    }

    if (kind === "quote") {
      const q = await client.queryObject<{ id: string }>(
        "insert into nexus_private.market_quotes (run_id,chain,venue,pool_address,input_asset,output_asset,input_amount_atomic,output_amount_atomic,input_decimals,output_decimals,observed_slot,quote_source,quoted_at,valid_until,response_digest,metadata) values ($1::uuid,$2,$3,$4,$5,$6,$7::numeric,$8::numeric,$9,$10,$11::bigint,$12,$13::timestamptz,$14::timestamptz,$15,$16::jsonb) returning id::text as id",
        [optionalText(r,"run_id",36), requiredText(r,"chain",24), requiredText(r,"venue",128), optionalText(r,"pool_address",128), requiredText(r,"input_asset",128), requiredText(r,"output_asset",128), atomic(r,"input_amount_atomic"), atomic(r,"output_amount_atomic"), integer(r,"input_decimals",0,30), integer(r,"output_decimals",0,30), optionalInteger(r,"observed_slot"), requiredText(r,"quote_source",128), timestamp(r,"quoted_at",true), timestamp(r,"valid_until"), optionalText(r,"response_digest",128), jsonObject(r,"metadata")],
      );
      return q.rows[0].id;
    }

    if (kind === "attempt") {
      const q = await client.queryObject<{ id: string }>(
        "insert into nexus_private.execution_attempts (run_id,quote_id,attempt_no,provider,status,transaction_signature,bundle_id,recent_blockhash,requested_slot,landed_slot,compute_units,priority_fee_atomic,bundle_tip_atomic,expected_net_profit_atomic,profit_asset,profit_decimals,simulation_error,failure_code,submitted_at,confirmed_at) values ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9::bigint,$10::bigint,$11::integer,$12::numeric,$13::numeric,$14::numeric,$15,$16::smallint,$17::jsonb,$18,$19::timestamptz,$20::timestamptz) returning id::text as id",
        [requiredText(r,"run_id",36), optionalText(r,"quote_id",36), integer(r,"attempt_no",1), requiredText(r,"provider",32), optionalText(r,"status",16) ?? "prepared", optionalText(r,"transaction_signature",128), optionalText(r,"bundle_id",128), optionalText(r,"recent_blockhash",128), optionalInteger(r,"requested_slot"), optionalInteger(r,"landed_slot"), optionalInteger(r,"compute_units"), atomic(r,"priority_fee_atomic") ?? "0", atomic(r,"bundle_tip_atomic") ?? "0", atomic(r,"expected_net_profit_atomic",true,false), optionalText(r,"profit_asset",128), optionalInteger(r,"profit_decimals",0,30), r.simulation_error === undefined || r.simulation_error === null ? null : JSON.stringify(r.simulation_error), optionalText(r,"failure_code",128), timestamp(r,"submitted_at"), timestamp(r,"confirmed_at")],
      );
      return q.rows[0].id;
    }

    if (kind === "settlement") {
      const q = await client.queryObject<{ id: string }>(
        "insert into nexus_private.settlements (attempt_id,status,asset,asset_decimals,borrowed_atomic,repaid_atomic,loan_fee_atomic,gross_profit_atomic,total_cost_atomic,net_profit_atomic,finalized_slot,transaction_signature,settled_at,evidence) values ($1::uuid,$2,$3,$4,$5::numeric,$6::numeric,$7::numeric,$8::numeric,$9::numeric,$10::numeric,$11::bigint,$12,$13::timestamptz,$14::jsonb) returning id::text as id",
        [requiredText(r,"attempt_id",36), requiredText(r,"status",16), requiredText(r,"asset",128), integer(r,"asset_decimals",0,30), atomic(r,"borrowed_atomic") ?? "0", atomic(r,"repaid_atomic") ?? "0", atomic(r,"loan_fee_atomic") ?? "0", atomic(r,"gross_profit_atomic",true) ?? "0", atomic(r,"total_cost_atomic") ?? "0", atomic(r,"net_profit_atomic",true) ?? "0", optionalInteger(r,"finalized_slot"), optionalText(r,"transaction_signature",128), timestamp(r,"settled_at"), jsonObject(r,"evidence")],
      );
      return q.rows[0].id;
    }

    throw new Error("unsupported_kind");
  } finally {
    client.release();
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return response({ error: "method_not_allowed" }, 405);
  if (!(req.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return response({ error: "application_json_required" }, 415);
  }
  if (!authorized(req)) return response({ error: "unauthorized" }, 401);

  const body = await req.text();
  if (new TextEncoder().encode(body).byteLength > maxBodyBytes) return response({ error: "payload_too_large" }, 413);

  try {
    const input = JSON.parse(body) as JsonObject;
    const kind = input.kind;
    if (typeof kind !== "string" || !Object.hasOwn(fields, kind)) return response({ error: "unsupported_kind" }, 400);
    const record = recordFor(kind as TelemetryKind, input.record);
    const id = await insertRecord(kind as TelemetryKind, record);
    return response({ ok: true, kind, id }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "request_rejected";
    if (/^(record_|unknown_|sensitive_|payload_|non_finite_|atomic_|invalid_|unsupported_)/.test(message)) {
      return response({ error: message }, 400);
    }
    console.error("nexus_telemetry_ingest_failed");
    return response({ error: "telemetry_write_failed" }, 422);
  }
});
