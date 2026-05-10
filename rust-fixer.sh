#!/bin/bash

echo "[*] Rust Otonom Onarım Başlatılıyor..."

# 1. Sistem Paketlerini ve Sertifikaları Zorla Güncelle
pkg update -y && pkg upgrade -y
pkg install -y openssl libiconv rust-specific-packages ca-certificates

# 2. Sertifika Bağlantılarını Manuel Doğrula (Android Hatası İçin)
if [ ! -f "$SSL_CERT_FILE" ]; then
    echo "[!] Sertifika dosyası eksik, oluşturuluyor..."
    update-ca-trust
fi

# 3. Cargo Index ve Kayıt Defteri Temizliği (Panik Hatalarını Çözer)
echo "[*] Cargo indeksi temizleniyor..."
rm -rf $CARGO_HOME/registry/index/*

# 4. Toolchain Onarımı
echo "[*] Rustup bileşenleri kontrol ediliyor..."
rustup self update
rustup toolchain install stable
rustup default stable

# 5. Eksik Bağımlılıkları Tamamla
echo "[*] Geliştirme kütüphaneleri yükleniyor..."
pkg install -y binutils tar wget curl make

echo "[+] İşlem tamamlandı. Artık 'cargo build' komutunu güvenle kullanabilirsiniz."

