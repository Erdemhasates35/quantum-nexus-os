#!/bin/bash
# 9 İş Modeli Aktiviteleri
MODELS=("SaaS_Dev" "DeFi_Arb" "Cyber_Sec" "Bio_Data" "OSINT_Intelligence" "AI_Edu" "E-Gov_Entegrasyon" "Quantum_VQE" "Token_Deploy")

for model in "${MODELS[@]}"; do
  echo "[EVOLVE] $model ajanları %200 verimlilikle başlatılıyor..."
  # Her model için arka planda otonom işlem başlar
  nohup python3 core/nexon_agents.py --model $model > logs/swarm_$model.log 2>&1 &
done
