import "dotenv/config";
import { Connection, ComputeBudgetProgram, Keypair, PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { getFlashloanIx } from "@jup-ag/lend/flashloan";
import BN from "bn.js";
import bs58 from "bs58";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const WSOL = "So11111111111111111111111111111111111111112";
const API = "https://api.jup.ag/swap/v2/build";
const asBigInt = (value, name) => {
  try { return BigInt(value?.toString?.() ?? value); }
  catch { throw new Error(`Invalid integer field: ${name}`); }
};
const numberEnv = (key, fallback) => {
  const value = Number(process.env[key] ?? fallback);
  if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid ${key}`);
  return value;
};
function loadSigner(mode) {
  const variable = mode === "live" ? "LIVE_PRIVATE_KEY_B58" : "TEST_PRIVATE_KEY_B58";
  const encoded = process.env[variable]?.trim();
  if (!encoded) throw new Error(`${variable} is required for ${mode} mode`);
  const secret = bs58.decode(encoded);
  if (secret.length !== 64) throw new Error(`${variable} must decode to a 64-byte Solana secret key`);
  const signer = Keypair.fromSecretKey(secret);
  const expected = process.env[mode === "live" ? "LIVE_PUBLIC_KEY" : "TEST_PUBLIC_KEY"];
  if (expected && signer.publicKey.toBase58() !== expected) throw new Error("Configured public key does not match private key");
  return signer;
}
async function buildSwap({ inputMint, outputMint, amount, taker, slippageBps, apiKey }) {
  const url = new URL(API);
  for (const [key, value] of Object.entries({ inputMint, outputMint, amount: String(amount), taker, slippageBps: String(slippageBps) })) {
    url.searchParams.set(key, value);
  }
  const headers = { accept: "application/json" };
  if (apiKey) headers["x-api-key"] = apiKey;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  const payload = await response.json();
  if (!response.ok) throw new Error(`Jupiter build HTTP ${response.status}: ${payload.error || payload.message || "request_failed"}`);
  if (!payload.swapInstruction || !payload.outAmount || !payload.otherAmountThreshold) throw new Error("Jupiter build response is missing required route/instruction fields");
  return payload;
}
function decodeInstruction(item) {
  if (!item) return null;
  return new TransactionInstruction({
    programId: new PublicKey(item.programId),
    keys: (item.accounts || []).map((account) => ({
      pubkey: new PublicKey(account.pubkey),
      isSigner: Boolean(account.isSigner),
      isWritable: Boolean(account.isWritable),
    })),
    data: Buffer.from(item.data, "base64"),
  });
}
function instructions(items = []) {
  return items.map(decodeInstruction).filter(Boolean);
}
async function loadLookupTables(connection, builds) {
  const addresses = [...new Set(builds.flatMap((build) => Object.keys(build.addressesByLookupTableAddress || {})))];
  const tables = await Promise.all(addresses.map(async (address) => {
    const result = await connection.getAddressLookupTable(new PublicKey(address));
    if (!result.value) throw new Error(`Address lookup table not found: ${address}`);
    return result.value;
  }));
  return tables;
}
async function buildTransaction({ connection, signer, flashloan, first, second, computeUnits }) {
  const tables = await loadLookupTables(connection, [first, second]);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const firstComputePrice = instructions(first.computeBudgetInstructions || []);
  const setup = [
    ...(flashloan.setupIxs || []),
    ...instructions(first.setupInstructions || []),
    ...instructions(second.setupInstructions || []),
  ];
  const routeInstructions = [
    ...(flashloan.setupIxs || []),
    ...instructions(first.setupInstructions || []),
    flashloan.borrowIx,
    ...instructions(first.otherInstructions || []),
    decodeInstruction(first.swapInstruction),
    ...instructions(second.otherInstructions || []),
    ...instructions(second.setupInstructions || []),
    decodeInstruction(second.swapInstruction),
    flashloan.paybackIx,
    ...(second.cleanupInstruction ? [decodeInstruction(second.cleanupInstruction)] : []),
    ...instructions(flashloan.cleanupIxs || []),
  ];
  const uniqueSetup = setup.length ? [] : [];
  void uniqueSetup;
  const message = new TransactionMessage({
    payerKey: signer.publicKey,
    recentBlockhash: blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }),
      ...firstComputePrice,
      ...routeInstructions,
    ],
  }).compileToV0Message(tables);
  const transaction = new VersionedTransaction(message);
  transaction.sign([signer]);
  return { transaction, blockhash, lastValidBlockHeight };
}
export async function runFlashloan({ entrypoint = "flashloan-engine" } = {}) {
  const mode = (process.env.EXECUTION_MODE || "simulate").toLowerCase();
  if (!["simulate", "live"].includes(mode)) throw new Error("EXECUTION_MODE must be simulate or live");
  if (mode === "live" && (process.env.ENABLE_LIVE_EXECUTION !== "true" || process.env.ALLOW_MAINNET_EXECUTION !== "true")) {
    throw new Error("Live execution requires ENABLE_LIVE_EXECUTION=true and ALLOW_MAINNET_EXECUTION=true");
  }
  const signer = loadSigner(mode);
  const rpcUrl = process.env.SOLANA_RPC_URL;
  if (!rpcUrl) throw new Error("SOLANA_RPC_URL is required");
  const connection = new Connection(rpcUrl, { commitment: "confirmed", confirmTransactionInitialTimeout: 45000 });
  const asset = new PublicKey(process.env.FLASHLOAN_ASSET_MINT || USDC);
  const intermediate = new PublicKey(process.env.FLASHLOAN_INTERMEDIATE_MINT || WSOL);
  const amount = asBigInt(process.env.FLASHLOAN_AMOUNT_BASE_UNITS || "1000000", "FLASHLOAN_AMOUNT_BASE_UNITS");
  const slippageBps = numberEnv("SLIPPAGE_BPS", 30);
  const maxPriceImpact = numberEnv("MAX_PRICE_IMPACT", 0.005);
  const minProfit = asBigInt(process.env.MIN_PROFIT_BASE_UNITS || "10000", "MIN_PROFIT_BASE_UNITS");
  const feeBuffer = asBigInt(process.env.FEE_BUFFER_USDC_BASE_UNITS || "10000", "FEE_BUFFER_USDC_BASE_UNITS");
  if (amount <= 0n || slippageBps > 500) throw new Error("Borrow amount must be positive and slippage must not exceed 500 bps");
  const signerAddress = signer.publicKey.toBase58();
  const apiKey = process.env.JUPITER_API_KEY;
  const amountBn = new BN(amount.toString());
  const [flashloan, first] = await Promise.all([
    getFlashloanIx({ connection, signer: signer.publicKey, asset, amount: amountBn }),
    buildSwap({ inputMint: asset.toBase58(), outputMint: intermediate.toBase58(), amount, taker: signerAddress, slippageBps, apiKey }),
  ]);
  const second = await buildSwap({
    inputMint: intermediate.toBase58(),
    outputMint: asset.toBase58(),
    amount: first.otherAmountThreshold,
    taker: signerAddress,
    slippageBps,
    apiKey,
  });
  const impact1 = Number(first.priceImpactPct || 0);
  const impact2 = Number(second.priceImpactPct || 0);
  const flashloanFee = asBigInt(flashloan.feeAmount ?? 0, "flashloan.feeAmount");
  const conservativeReturn = asBigInt(second.otherAmountThreshold, "second.otherAmountThreshold");
  const grossProfit = conservativeReturn - amount - flashloanFee;
  const requiredProfit = minProfit + feeBuffer;
  const report = {
    engine: entrypoint,
    protocol: "Jupiter Lend",
    swapRouter: "Jupiter Swap API v2 /build",
    network: await connection.getGenesisHash(),
    signer: signerAddress,
    mode,
    borrowedBaseUnits: amount.toString(),
    flashloanFeeBaseUnits: flashloanFee.toString(),
    conservativeReturnBaseUnits: conservativeReturn.toString(),
    conservativeGrossProfitBaseUnits: grossProfit.toString(),
    minimumProfitBaseUnits: minProfit.toString(),
    feeBufferBaseUnits: feeBuffer.toString(),
    route: {
      outbound: (first.routePlan || []).map((hop) => hop.swapInfo?.label).filter(Boolean),
      inbound: (second.routePlan || []).map((hop) => hop.swapInfo?.label).filter(Boolean),
      priceImpact: [impact1, impact2],
      slippageBps,
    },
  };
  if (impact1 > maxPriceImpact || impact2 > maxPriceImpact) {
    console.log(JSON.stringify({ ...report, decision: "NO_TRADE", reason: "price_impact_limit_exceeded" }, null, 2));
    return { decision: "NO_TRADE", reason: "price_impact_limit_exceeded" };
  }
  if (grossProfit <= requiredProfit) {
    console.log(JSON.stringify({ ...report, decision: "NO_TRADE", reason: "conservative_profit_below_cost_and_margin" }, null, 2));
    return { decision: "NO_TRADE", reason: "conservative_profit_below_cost_and_margin" };
  }
  const { transaction, blockhash, lastValidBlockHeight } = await buildTransaction({
    connection, signer, flashloan, first, second, computeUnits: 1_400_000,
  });
  const simulation = await connection.simulateTransaction(transaction, { sigVerify: true, commitment: "confirmed" });
  if (simulation.value.err) {
    console.log(JSON.stringify({ ...report, decision: "NO_TRADE", reason: "on_chain_simulation_failed", simulationError: simulation.value.err, logs: simulation.value.logs }, null, 2));
    return { decision: "NO_TRADE", reason: "on_chain_simulation_failed" };
  }
  const consumed = simulation.value.unitsConsumed || 1_400_000;
  if (consumed >= 1_400_000) throw new Error("Transaction reached the maximum compute budget; refusing submission");
  const tunedLimit = Math.min(1_400_000, Math.ceil(consumed * 1.2));
  const tuned = await buildTransaction({ connection, signer, flashloan, first, second, computeUnits: tunedLimit });
  const finalSimulation = await connection.simulateTransaction(tuned.transaction, { sigVerify: true, commitment: "confirmed" });
  if (finalSimulation.value.err) {
    console.log(JSON.stringify({ ...report, decision: "NO_TRADE", reason: "final_simulation_failed", simulationError: finalSimulation.value.err, logs: finalSimulation.value.logs }, null, 2));
    return { decision: "NO_TRADE", reason: "final_simulation_failed" };
  }
  if (mode !== "live") {
    console.log(JSON.stringify({ ...report, decision: "SIMULATION_PASSED", computeUnits: finalSimulation.value.unitsConsumed, lastValidBlockHeight, submitted: false }, null, 2));
    return { decision: "SIMULATION_PASSED", submitted: false };
  }
  const signature = await connection.sendRawTransaction(tuned.transaction.serialize(), { skipPreflight: false, maxRetries: 3, preflightCommitment: "confirmed" });
  const confirmation = await connection.confirmTransaction({ signature, blockhash: tuned.blockhash, lastValidBlockHeight: tuned.lastValidBlockHeight }, "finalized");
  if (confirmation.value.err) throw new Error(`On-chain transaction failed: ${JSON.stringify(confirmation.value.err)}; signature=${signature}`);
  console.log(JSON.stringify({ ...report, decision: "SETTLED", signature, explorer: `https://solscan.io/tx/${signature}`, computeUnits: finalSimulation.value.unitsConsumed }, null, 2));
  return { decision: "SETTLED", signature };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  runFlashloan().catch((error) => {
    console.error(JSON.stringify({ decision: "ERROR", message: error.message }));
    process.exitCode = 1;
  });
}
