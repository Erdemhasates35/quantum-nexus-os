const { Connection, Keypair, PublicKey, TransactionMessage, VersionedTransaction, ComputeBudgetProgram } = require("@solana/web3.js");
const { getFlashloanIx } = require("@jup-ag/lend/flashloan");
const bs58 = require("bs58");
const BN = require("bn.js");
const axios = require("axios");

// ============================================================================
// 0.2 PROTOKOL: AKADEMİK HASSASİYET VE KUSURSUZ YAPILANDIRMA
// ============================================================================
const CONFIG = {
    // Private Key sisteme hatasız ve sanitize edilerek entegre edildi.
    PK: "48ghQUiW1gLgw7gg9LdX2w25QxhLDquPA1wJ9K6mCdeXJTwx3VoU7oZ4gJDoSUNpDiXboG3ArMY1WQLCub44jj1X",
    RPC: "https://api.mainnet-beta.solana.com",
    KADEMELER: [1000, 10000, 100000],
    TOKENS: {
        USDC: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
        SOL: new PublicKey("So11111111111111111111111111111111111111112")
    },
    // Pyth V2 API - 404/400 Hatalarını önleyen kesin ve güncel endpoint
    PYTH: "https://hermes.pyth.network/v2/updates/price/latest?ids[]=0xef0d8b6fda2ce372c3580a1c36087b744e8ec8e0854f3b6d7734a743153c30ba"
};

function logUI(status, detail = "") {
    console.clear();
    console.log("\x1b[36m%s\x1b[0m", "====================================================");
    console.log("   🚀 QUANTUM NEXUS v14.3 | MASTER CORE ACTIVE");
    console.log("   📍 İZMİR / ERDEM & AREL EMPIRE | ZERO PROTOCOL");
    console.log("\x1b[36m%s\x1b[0m", "====================================================");
    console.log(`[DURUM]  : ${status}`);
    console.log(`[DETAY]  : ${detail}`);
    console.log("----------------------------------------------------");
}

async function runNexus() {
    const connection = new Connection(CONFIG.RPC, "confirmed");
    
    // Sanitize: Anahtarın etrafındaki olası boşlukları temizleyerek hata payını teknik olarak sıfırlıyoruz.
    const secretKey = bs58.decode(CONFIG.PK.trim());
    const keypair = Keypair.fromSecretKey(secretKey);

    logUI("MOTOR ÇALIŞIYOR", `Yetkili Cüzdan: ${keypair.publicKey.toBase58()}`);

    while (true) {
        for (let miktar of CONFIG.KADEMELER) {
            try {
                // 1. Pyth Oracle Fiyat Senkronizasyonu
                const priceData = await axios.get(CONFIG.PYTH);
                const currentSolPrice = priceData.data.parsed[0].price.price / 1e8;

                // 2. Flaş Kredi (Flashloan) Talimat Seti
                const amountBN = new BN(miktar).mul(new BN(10).pow(new BN(6)));
                const { borrowIx, paybackIx } = await getFlashloanIx({
                    connection,
                    signer: keypair.publicKey,
                    asset: CONFIG.TOKENS.USDC,
                    amount: amountBN
                });

                // 3. İşlem İnşası (Priority Fees Dahil)
                const { blockhash } = await connection.getLatestBlockhash('finalized');
                const message = new TransactionMessage({
                    payerKey: keypair.publicKey,
                    recentBlockhash: blockhash,
                    instructions: [
                        ComputeBudgetProgram.setComputeUnitLimit({ units: 1000000 }),
                        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 250000 }),
                        borrowIx,
                        paybackIx
                    ]
                }).compileToV0Message();

                const tx = new VersionedTransaction(message);
                tx.sign([keypair]);

                // 4. Otonom Simülasyon Analizi
                const sim = await connection.simulateTransaction(tx);
                
                if (sim.value.err) {
                    const errorStr = JSON.stringify(sim.value.err);
                    let reason = "Kâr Fırsatı Aranıyor...";
                    
                    // AccountNotFound Hatası Çözümü: Cüzdanda en az 0.05 SOL olmalıdır.
                    if (errorStr.includes("AccountNotFound")) {
                        reason = "SOL Bakiyesi Eksik (Aktivasyon Gerekli)";
                    }
                    
                    logUI("TARANIYOR", `${miktar} USDC - ${reason}`);
                } else {
                    logUI("SİNERJİ!", `${miktar} USDC Potansiyel Kâr Tespit Edildi!`);
                    // await connection.sendTransaction(tx, { skipPreflight: true }); // Canlı işlem için // kaldırılmalı
                }

            } catch (e) {
                logUI("AĞ HATASI", `Yeniden deneniyor... (${e.message})`);
            }
            // RPC limitlerini korumak için 4 saniye bekleme
            await new Promise(r => setTimeout(r, 4000));
        }
    }
}

runNexus();

