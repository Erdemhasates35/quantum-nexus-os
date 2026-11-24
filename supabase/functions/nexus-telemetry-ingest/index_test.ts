import { bookLevels, decimal, recordFor, requestDigest, verifyGuardApprovalSignature } from "./index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function expectThrow(fn: () => unknown, fragment: string): void {
  let thrown: unknown;
  try { fn(); } catch (error) { thrown = error; }
  assert(thrown instanceof Error, "expected function to throw");
  assert(thrown.message.includes(fragment), "unexpected error: " + thrown.message);
}

Deno.test("rejects unknown fields and secret-bearing keys", () => {
  expectThrow(() => recordFor("order_intent", { idempotency_key: "a", api_key: "secret" }), "unknown_record_fields");
  expectThrow(() => recordFor("order_intent", { idempotency_key: "a", metadata: { private_key: "x" } }), "sensitive_field_rejected");
});

Deno.test("decimal parser preserves exact string precision", () => {
  const value = decimal({ amount: "12345678901234567890.123456789012345678" }, "amount");
  assert(value === "12345678901234567890.123456789012345678", "decimal precision changed");
  expectThrow(() => decimal({ amount: "1e-8" }, "amount"), "invalid_decimal_amount");
  expectThrow(() => decimal({ amount: "-0.1" }, "amount"), "negative_value_not_allowed_amount");
});

Deno.test("order book parser validates positive price and quantity pairs", () => {
  const value = bookLevels({ bids: [["65000.10","0.25"],["64999","1.5"]] }, "bids");
  assert(JSON.parse(value).length === 2, "valid levels were not retained");
  expectThrow(() => bookLevels({ bids: [["0","1"]] }, "bids"), "invalid_bids");
  expectThrow(() => bookLevels({ bids: [["65000"]] }, "bids"), "invalid_bids");
});

Deno.test("canonical request digest ignores object key order", async () => {
  const first = await requestDigest({ side: "buy", quantity: "0.1", metadata: { z: 1, a: 2 } });
  const second = await requestDigest({ metadata: { a: 2, z: 1 }, quantity: "0.1", side: "buy" });
  const third = await requestDigest({ side: "sell", quantity: "0.1", metadata: { a: 2, z: 1 } });
  assert(first === second, "canonical digest depends on key order");
  assert(first !== third, "different order payloads produced the same digest");
});

Deno.test("HTTP method and content-type guards fail closed", async () => {
  const { handleRequest } = await import("./index.ts");
  const method = await handleRequest(new Request("https://edge.test/ingest", { method: "GET" }));
  assert(method.status === 405, "non-POST method was not rejected");
  const contentType = await handleRequest(new Request("https://edge.test/ingest", { method: "POST", body: "{}" }));
  assert(contentType.status === 415, "non-JSON content type was not rejected");
});

Deno.test("unauthenticated writes are rejected before database access", async () => {
  const { handleRequest } = await import("./index.ts");
  const result = await handleRequest(new Request("https://edge.test/ingest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "order_intent", record: {} }),
  }));
  assert(result.status === 401, "unauthenticated write was not rejected");
});

Deno.test("venue and instrument registration accept only non-secret metadata", () => {
  const account = recordFor("venue_account", { venue: "binance", account_label: "testnet-primary", environment: "testnet", capabilities: { futures: true } });
  assert(account.environment === "testnet", "venue account metadata was not preserved");
  expectThrow(() => recordFor("venue_account", { venue: "binance", account_label: "primary", environment: "production", api_key: "blocked" }), "unknown_record_fields");
  const instrument = recordFor("instrument", { venue: "binance", market_type: "perpetual", symbol: "BTCUSDT", base_asset: "BTC", quote_asset: "USDT", price_tick: "0.01", quantity_step: "0.001", min_quantity: "0.001", min_notional: "5" });
  assert(instrument.symbol === "BTCUSDT", "instrument metadata was not preserved");
});

Deno.test("live authorization messages are strictly allowlisted", () => {
  const approval = recordFor("authorize_live", { intent_id: "123e4567-e89b-42d3-a456-426614174000", executor_id: "executor-a", approval_digest: "a".repeat(64) });
  assert(approval.executor_id === "executor-a", "authorization payload was not preserved");
  expectThrow(() => recordFor("authorize_live", { intent_id: "123e4567-e89b-42d3-a456-426614174000", executor_id: "executor-a", approval_digest: "a".repeat(64), signature: "not-accepted-here" }), "unknown_record_fields");
});

Deno.test("signed Guard approvals require a valid Ed25519 signature and immutable policy digest", async () => {
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const publicBytes = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const publicKeyBase64 = btoa(Array.from(publicBytes, value => String.fromCharCode(value)).join(""));
  const policyDocument = {
    signer: {
      key_id: "guard-test-ed25519",
      algorithm: "ed25519",
      public_key_base64: publicKeyBase64,
    },
    policy: {
      max_order_notional: "100",
      max_leverage: "2",
      max_daily_loss: "5",
    },
  };
  const policySha256 = await requestDigest(policyDocument);
  const approvalDigest = "a".repeat(64);
  const signed = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, new TextEncoder().encode(approvalDigest)));
  const signature = btoa(Array.from(signed, value => String.fromCharCode(value)).join(""));
  const valid = await verifyGuardApprovalSignature({
    policyDocument,
    policySha256,
    signerKeyId: "guard-test-ed25519",
    signatureAlgorithm: "ed25519",
    approvalDigest,
    signature,
  });
  assert(valid, "valid Guard signature was rejected");
  const alteredDigest = await verifyGuardApprovalSignature({
    policyDocument,
    policySha256,
    signerKeyId: "guard-test-ed25519",
    signatureAlgorithm: "ed25519",
    approvalDigest: "b".repeat(64),
    signature,
  });
  assert(!alteredDigest, "signature for a different approval digest was accepted");
  const alteredPolicy = await verifyGuardApprovalSignature({
    policyDocument,
    policySha256: "0".repeat(64),
    signerKeyId: "guard-test-ed25519",
    signatureAlgorithm: "ed25519",
    approvalDigest,
    signature,
  });
  assert(!alteredPolicy, "signature under a mismatched policy digest was accepted");
});

Deno.test("Guard approval payloads accept only the signed intent-bound contract", () => {
  const approval = recordFor("guard_approval", {
    intent_id: "123e4567-e89b-42d3-a456-426614174000",
    intent_digest: "a".repeat(64),
    policy_version: "guard-policy-v1",
    decision: "allow",
    reason_code: "all_limits_passed",
    approval_digest: "b".repeat(64),
    signer_key_id: "guard-ed25519-01",
    signature_algorithm: "ed25519",
    signature: "A".repeat(88),
    nonce: "nonce-0123456789abcdef",
    issued_at: "2026-11-24T07:00:00.000Z",
    expires_at: "2026-11-24T07:01:00.000Z",
    evidence: { risk_verdict: "allow" },
  });
  assert(approval.policy_version === "guard-policy-v1", "Guard approval contract was not preserved");
  expectThrow(() => recordFor("guard_approval", {
    intent_id: "123e4567-e89b-42d3-a456-426614174000",
    intent_digest: "a".repeat(64),
    policy_version: "guard-policy-v1",
    decision: "allow",
    reason_code: "all_limits_passed",
    approval_digest: "b".repeat(64),
    signer_key_id: "guard-ed25519-01",
    signature_algorithm: "ed25519",
    signature: "A".repeat(88),
    nonce: "nonce-0123456789abcdef",
    issued_at: "2026-11-24T07:00:00.000Z",
    expires_at: "2026-11-24T07:01:00.000Z",
    evidence: {},
    private_key: "blocked",
  }), "unknown_record_fields");
});
