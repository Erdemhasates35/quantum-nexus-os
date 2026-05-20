#!/bin/bash
# ─────────────────────────────────────────────────────────
# QUANTUM NEXUS OS — GitHub Push & Vercel Deploy Script
# Kullanım: bash deploy.sh
# ─────────────────────────────────────────────────────────

set -e

REPO="erdemhasates/quantum-nexus-os"
BRANCH="main"

echo ""
echo "⬡ QUANTUM NEXUS OS — DEPLOY BAŞLIYOR"
echo "══════════════════════════════════════"

# Git durumu kontrol
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "📦 Git repo başlatılıyor..."
  git init
  git remote add origin "https://github.com/${REPO}.git" 2>/dev/null || git remote set-url origin "https://github.com/${REPO}.git"
fi

# Dosyaları ekle
echo "📁 Dosyalar hazırlanıyor..."
git add -A

# Commit
MSG="Quantum Nexus OS v2.0 — Sovereign AI Parliament Deploy $(date '+%Y-%m-%d %H:%M')"
git commit -m "$MSG" || echo "ℹ Commit yok (değişiklik yok)"

# Push
echo "🚀 GitHub'a gönderiliyor..."
git push -u origin $BRANCH --force

echo ""
echo "✅ GitHub push tamamlandı!"
echo "🌐 Vercel otomatik deploy başlayacak."
echo ""
echo "Proje URL'leri:"
echo "  → https://quantum-nexus-ultimate.vercel.app"
echo "  → https://quantum-nexus-real.vercel.app (yedek)"
echo ""
echo "⬡ QUANTUM NEXUS OS — DEPLOY TAMAMLANDI"
