const {
  Connection,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
  PublicKey
} = require("@solana/web3.js");
const bs58 = require("bs58");
const BN = require("bn.js");
const { getFlashloanIx } = require("@jup-ag/lend/flashloan");

// ============================================================================
// 0.2 PROTOCOL: STABLE CONFIGURATION
// ============================================================================
const PRIVATE_KEY_B58 = "48ghQUiW1gLgw7gg9LdX2w25QxhLDquPA1wJ9K6mCdeXJTwx3VoU7oZ4gJDoSUNpDiXboG3ArMY1WQLCub44jj1X";
const RPC_URL = "https://api.mainnet-beta.solana.com";
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const BORROW_AMOUNT = new BN("10000000000"); // 10,000 USDC

async function runNexus() {
    console.log("\n--- [ NEXUS V14 | STABLE ENGINE STARTED ] ---");
    
    const connection = new Connection(RPC_URL, "confirmed");

    // ANAHTAR DOĞRULAMA VE YÜKLEME
    let userKeypair;
    try {
        const decode = typeof bs58.decode === 'function' ? bs58.decode : bs58.default.decode;
        const decodedKey = decode(PRIVATE_KEY_B58);
        userKeypair = Keypair.fromSecretKey(decodedKey);
        console.log(`[✓] Cüzdan Doğrulandı: ${userKeypair.publicKey.toBase58()}`);
    } catch (e) {
        console.error("[!] Kritik Hata: Anahtar çözülemedi. Lütfen kopyalamayı kontrol et.");
        return;
    }

    const signer = userKeypair.publicKey;

    try {
        console.log("[*] Jupiter Lend Flaş Kredi Talimatları Alınıyor...");
        
        const { borrowIx, paybackIx } = await getFlashloanIx({
            connection,
            signer,
            asset: USDC_MINT,
            amount: BORROW_AMOUNT,
        });

        const { blockhash } = await connection.getLatestBlockhash('confirmed');

        const instructions = [
            ComputeBudgetProgram.setComputeUnitLimit({ units: 1400000 }),
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 150000 }),
            borrowIx,
            // Buraya Arbitraj (Swap) talimatlarını ekleyeceğiz
            paybackIx
        ];

        const message = new TransactionMessage({
            payerKey: signer,
            recentBlockhash: blockhash,
            instructions,
        }).compileToV0Message();

        const tx = new VersionedTransaction(message);
        tx.sign([userKeypair]);

        console.log("[*] Simülasyon Analizi Yapılıyor...");
        const sim = await connection.simulateTransaction(tx);

        if (sim.value.err) {
            console.log("\n[!] SİSTEM KORUMASI: İşlem kârsız veya hata veriyor, gönderilmedi.");
            console.log(`Hata Detayı: ${JSON.stringify(sim.value.err)}`);
            return;
        }

        const sig = await connection.sendTransaction(tx);
        console.log(`[✓] İŞLEM BAŞARILI: https://solscan.io/tx/${sig}`);

    } catch (err) {
        console.error("[!] Sistem Hatası:", err.message);
    }
}

runNexus();

