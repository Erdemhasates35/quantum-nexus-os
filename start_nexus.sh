#!/bin/bash
# ERDEM & AREL EMPIRE - TERMINAL BASH EXECUTION
echo -e "\e[1;36m[DEPLOYING] Nexus OS v15.5 - Omega Engine...\e[0m"

# Dosya Yazma Kontrolü
if [ -f "package.json" ]; then
    echo "Paketler kuruluyor..."
    npm install --quiet
fi

# Arka Plan Servislerini Tetikle
node api.js &
PYTHON_PID=$!

echo -e "\e[1;32m[SUCCESS] Sistem Aktif. http://localhost:3000 adresine bağlanın.\e[0m"
echo -e "\e[1;34mFrekans Kilidi: GHOST_SPECTRUM_ACTIVE\e[0m"
