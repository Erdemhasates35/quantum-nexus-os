#!/bin/bash

# --- RENKLER ---
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== QUANTUM NEXUS OTONOM ORKESTRASYON BAŞLATILIYOR ===${NC}"

# Modül Listesi
declare -A modules=(
    [1]="python3 ai_decision_core.py"
    [2]="python3 agents_swarm.py"
    [3]="node api.js"
    [4]="bash start_arbitrage.sh"
    [5]="python3 self_evolution.py"
    [6]="python3 csi_signal_processor.py"
)

# Kendi Kendini Onaran Fonksiyon
run_and_monitor() {
    local cmd=$1
    local name=$2
    
    while true; do
        echo -e "${GREEN}[RUNNING]${NC} $name başlatılıyor..."
        $cmd >> logs/sentinel.log 2>&1
        
        # Hata Kontrolü ve Onarım Başlangıcı
        if [ $? -ne 0 ]; then
            echo -e "${RED}[ERROR]${NC} $name çöktü veya hata verdi. Onarım deneniyor..."
            # Syntax hataları için basit bir onarım (Opsiyonel: autopep8 veya ruff gibi araçlar varsa tetiklenebilir)
            # Burada 'self_evolution.py' dosyasının hatayı analiz etmesi için bir tetik gönderebiliriz.
            python3 self_evolution.py --fix "$name"
            sleep 2
        fi
    done
}

# --- ARAYÜZ (MODÜLER SEÇİM) ---
echo "1) Tümünü Başlat (Full Autonomous Mode)"
echo "2) Sadece AI Modülleri (1, 2, 5)"
echo "3) Sadece Finans/Arbitraj (3, 4)"
read -p "Seçiminiz [1-3]: " choice

case $choice in
    1)
        for i in {1..6}; do
            run_and_monitor "${modules[$i]}" "Module_$i" &
        done
        ;;
    2)
        run_and_monitor "${modules[1]}" "AI_Core" &
        run_and_monitor "${modules[2]}" "Swarm" &
        run_and_monitor "${modules[5]}" "Evolution" &
        ;;
    3)
        run_and_monitor "${modules[3]}" "API" &
        run_and_monitor "${modules[4]}" "Arbitrage" &
        ;;
esac

echo -e "${GREEN}Sistem Arka Planda Yayında. Çıkmak için 'disown' yapabilirsin.${NC}"

]]]