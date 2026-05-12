import os
import time


def check_nexus_health():
    print("--- NEXUS OS SİSTEM VERGİ & KAYNAK YÖNETİMİ (Termux Versiyonu) ---")
    # /proc/stat erişimi yerine basit yük kontrolü
    load = os.getloadavg()[0] if hasattr(os, "getloadavg") else 0
    print(f"[STATUS] Sistem Yükü: {load}")

    # Önbellek temizliği (Ruh/Ruff ve Black ile uyumlu)
    os.system("find . -name '__pycache__' -type d -exec rm -rf {} +")

    # Servis kontrolü
    check_core = os.popen("pgrep -f python3").read()
    if not check_core:
        print("[RECOVERY] Servisler başlatılıyor...")
        os.system("./nexus_master.sh &")


if __name__ == "__main__":
    while True:
        check_nexus_health()
        time.sleep(60)
