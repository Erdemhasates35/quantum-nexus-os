# Nexmon CSI Kurulumu (Derin Kullanım)

## Raspberry Pi (Önerilen)
1. `sudo apt update && sudo apt install git libgmp3-dev gawk qpdf bison flex make`
2. `git clone https://github.com/seemoo-lab/nexmon_csi`
3. `cd nexmon_csi && make -f Makefile.rpi install-firmware`
4. `nexutil -m1` (monitor mode)
5. `python3 csi_signal_processor.py`

## Diğer Platformlar
- **Kali Linux**: `apt install nexmon` + custom firmware
- **Ubuntu**: Docker + nexmon container
- **Termux (Android)**: Limited CSI (scapy + external adapter)

Gerçek CSI verisi → heatmap + aktivite tahmini (yürüyor/oturuyor) + mesafe.
