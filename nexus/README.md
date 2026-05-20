# ⬡ QUANTUM NEXUS OS — Sovereign AI v2.0

Production-grade, gerçek API'larla çalışan Sovereign AI işletim sistemi.

## 🔥 Gerçek Özellikler

| Modül | Teknoloji | Durum |
|---|---|---|
| Sovereign Hub | OpenRouter (6 model) | ✅ Gerçek |
| AI Parliament | 4 ajan paralel çağrı | ✅ Gerçek |
| Konsensüs Engine | Weighted voting + MetaReasoner | ✅ Gerçek |
| Kod Derleyici | Claude/GPT-4o/Grok | ✅ Gerçek |
| Kripto Piyasası | CoinGecko API | ✅ Gerçek |
| GitHub Explorer | GitHub REST API | ✅ Gerçek |
| Discord Webhook | Discord API | ✅ Gerçek |
| Kanban | localStorage | ✅ Gerçek |
| Gelir Modeli | Matematiksel projeksiyon | ✅ Gerçek |

## 🚀 Deploy

```bash
# 1. Projeyi klon
git clone https://github.com/erdemhasates/quantum-nexus-os.git
cd quantum-nexus-os

# 2. Bağımlılıkları yükle
npm install

# 3. Local çalıştır
npm run dev

# 4. Vercel'e deploy
bash deploy.sh
```

## ⚙️ Vercel Environment Variables

Vercel dashboard'da ekle:

```
# Opsiyonel — server-side kullanım için
OPENROUTER_API_KEY=sk-or-v1-...
```

## 🏗️ Dosya Yapısı

```
quantum-nexus-os/
├── app/
│   ├── api/
│   │   ├── agents/route.ts    → AI Parliament (4 ajan)
│   │   ├── consensus/route.ts → Single model chat
│   │   └── crypto/route.ts    → CoinGecko proxy
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   └── QuantumNexus.tsx       → Ana UI
├── lib/
│   ├── types.ts
│   └── storage.ts
├── public/
├── vercel.json               → Framework: nextjs (zorunlu)
├── next.config.js
├── package.json
└── tsconfig.json
```

## 🤖 AI Parliament Nasıl Çalışır?

1. Kullanıcı sorgu girer
2. 4 farklı AI modeli **paralel** olarak çağrılır
3. Her model cevap + güven skoru üretir
4. MetaReasoner (Claude) tüm oyları sentezler
5. Weighted consensus sonucu döner

Bu **gerçek** dağıtık çoklu-ajan orchestration'dır.
