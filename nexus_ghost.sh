#!/bin/bash
while true; do
    # Doktoru sessizce çalıştır
    python3 ~/quantum-nexus-os/nexus_doctor.py > /dev/null 2>&1
    
    # Hatalı süreçleri temizle ve sistemi tazele
    find . -name "__pycache__" -type d -exec rm -rf {} +
    
    # 5 dakika bekle (Sistem kaynağını korumak için)
    sleep 300
done
