#!/bin/bash
# QUANTUM NEXUS — Wi-Fi CSI Radar Push Script
# Termux'ta çalıştır: bash push_wifi_update.sh
# Önce: nexus-ultra.html dosyasını ~/quantum-nexus-os/ klasörüne kopyala

set -e
REPO="$HOME/quantum-nexus-os"
GREEN='\033[92m'
YELLOW='\033[93m'
RED='\033[91m'
END='\033[0m'

echo -e "${GREEN}⬡ QUANTUM NEXUS — Wi-Fi CSI Radar Deploy${END}"
echo "========================================="

# Repo kontrolü
if [ ! -d "$REPO" ]; then
  echo -e "${YELLOW}Repo bulunamadı, klonlanıyor...${END}"
  git clone https://github.com/Erdemhasates35/quantum-nexus-os.git "$REPO"
fi

cd "$REPO"
echo -e "${GREEN}✓ Repo: $REPO${END}"

# En son değişiklikleri çek
echo "Git pull..."
git pull origin main --rebase 2>/dev/null || echo "Pull uyarısı (devam ediliyor)"

# nexus-ultra.html indirilmiş mi kontrol et
if [ ! -f "$REPO/nexus-ultra.html" ]; then
  echo -e "${RED}HATA: nexus-ultra.html bulunamadı!${END}"
  echo -e "${YELLOW}Şu adımı yap:${END}"
  echo "  1. Claude'dan indirilen nexus-ultra.html dosyasını bul"
  echo "  2. cp ~/storage/downloads/nexus-ultra.html $REPO/"
  echo "  3. Sonra bu scripti tekrar çalıştır"
  exit 1
fi

# physical_nexus_engine.py ekle (opsiyonel)
if [ -f "$HOME/storage/downloads/physical_nexus_engine.py" ]; then
  cp "$HOME/storage/downloads/physical_nexus_engine.py" "$REPO/"
  echo -e "${GREEN}✓ physical_nexus_engine.py eklendi${END}"
fi

# self_evolution.py de repo'da yoksa ekle
if [ ! -f "$REPO/self_evolution.py" ] && [ -f "$HOME/storage/downloads/self_evolution.py" ]; then
  cp "$HOME/storage/downloads/self_evolution.py" "$REPO/"
  echo -e "${GREEN}✓ self_evolution.py eklendi${END}"
fi

# Git işlemleri
echo ""
echo "Değişen dosyalar:"
git status --short

git add nexus-ultra.html
[ -f physical_nexus_engine.py ] && git add physical_nexus_engine.py
[ -f self_evolution.py ] && git add self_evolution.py 2>/dev/null || true

git commit -m "feat: Wi-Fi CSI Visual Radar modülü eklendi"

- 📡 Gerçek zamanlı CSI radar canvas (sweep + hareket noktaları)
- 〰 Dalga formu grafiği (amplitüd, frekans, SNR)
- 4 mod: Hareket, Nefes, İzinsiz Giriş, Kalabalık
- 🧠 Claude AI CSI analiz entegrasyonu
- physical_nexus_engine.py RF+GSM köprüsü hazır"

echo ""
echo "GitHub'a push ediliyor..."
git push origin main

echo ""
echo -e "${GREEN}✅ BAŞARILI! Vercel otomatik deploy başladı.${END}"
echo -e "${GREEN}🌐 https://quantum-nexus-os.vercel.app${END}"
echo ""
echo "2-3 dakika içinde canlıya geçer."
echo "Kontrol: https://vercel.com/erdemhasates-projects/quantum-nexus-os"
]]]]"