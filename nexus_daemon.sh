#!/bin/bash
# NEXUS HAYALET MODU - Arka Planda Kesintisiz Onarım

LOG_FILE=~/quantum-nexus-os/logs/doctor_activity.log
mkdir -p ~/quantum-nexus-os/logs

echo "Nexus Doctor Daemon Aktif Edildi. [PID: $$]"

while true; do
    echo "[$(date)] Teşhis ve Onarım Döngüsü Başlatılıyor..." >> $LOG_FILE
    
    # Doktoru çalıştır
    python3 ~/quantum-nexus-os/nexus_doctor.py >> $LOG_FILE 2>&1
    
    # Kritik servislerin ayakta olduğunu kontrol et
    CHECK=$(pgrep -f nexus_master.sh)
    if [ -z "$CHECK" ]; then
        echo "[!] Kritik sistem durmuş! Yeniden canlandırılıyor..." >> $LOG_FILE
        nohup ~/quantum-nexus-os/nexus_master.sh > /dev/null 2>&1 &
    fi
    
    # Sistemi yormamak için her 5 dakikada bir check-up yap
    sleep 300
done
