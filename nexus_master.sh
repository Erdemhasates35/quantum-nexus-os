#!/bin/bash
echo "--- QUANTUM NEXUS OS: MASTER ADMIN CONTROL ---"

# 1. Ortam Kontrolü
source ~/quantum-nexus-os/nexus_env/bin/activate
export PATH=$PATH:$(pwd)/node_modules/.bin

# 2. Alternatif Dosya Kontrolü (Merge Gerektirenler)
ALT_FILES=$(ls *_v_alt 2>/dev/null | wc -l)
if [ "$ALT_FILES" -gt 0 ]; then
    echo "[!] DİKKAT: $ALT_FILES adet alternatif dosya bulundu. Manuel kontrol önerilir."
fi

# 3. Çekirdek Servisleri Başlat
echo "[+] CSI Sinyal İşleyici Başlatılıyor..."
python3 csi_signal_processor.py &

echo "[+] Solana MEV & Flash Loan Protokolü Aktif Ediliyor..."
# Eğer nexus-ultra core varsa onu, yoksa ana core'u çalıştır
if [ -f "annie_ultra_core.py" ]; then
    python3 annie_ultra_core.py &
else
    python3 main_nexus_core.py &
fi

echo "[+] Web Arayüzü (React/Vite) Yayına Alınıyor..."
npm run dev -- --host &

wait
