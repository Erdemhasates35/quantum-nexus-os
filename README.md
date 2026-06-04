# ⬡ QUANTUM NEXUS OS v2.0

## Multi-AI Unified Enterprise Platform

### 🚀 Features

- **10+ AI Models Integrated**: Anthropic Claude, Groq, OpenAI GPT, xAI Grok, Google Gemini, DeepSeek, Cohere, Mistral, Perplexity, Together AI
- **Autonomous Agent Swarm**: 8+ specialized agents (AR-GE, Security, Finance, Data, ML, Marketing, Strategy, Evolution)
- **Multi-Stream Revenue**: API arbitrage, SaaS, DeFi, White-label, Affiliate
- **Dual Database**: MongoDB + PostgreSQL
- **Real-time Dashboards**: Live KPI monitoring, Agent status, Revenue tracking
- **Self-Evolution Engine**: Automatic optimization and module updates
- **Production Ready**: Vercel deployment, security hardened, enterprise-grade

### 🛠 Setup

```bash
# Install dependencies
npm install
pip install -r requirements.txt

# Add environment variables
cp .env.example .env

# Development
npm run dev

# Build for production
npm run build
npm start
```

### 🔑 API Keys Required

- `ANTHROPIC_API_KEY` - Claude API
- `GROQ_API_KEY` - Groq (free tier available)
- `OPENAI_API_KEY` - GPT-4
- `XAI_API_KEY` - Grok API
- `GOOGLE_API_KEY` - Gemini
- `DEEPSEEK_API_KEY` - DeepSeek Chat
- `COHERE_API_KEY` - Cohere Command
- `MISTRAL_API_KEY` - Mistral Large
- `PERPLEXITY_API_KEY` - Perplexity Pro
- `MONGODB_URI` - MongoDB connection
- `POSTGRES_URI` - PostgreSQL connection

### 📊 Dashboard

Access the main dashboard at `/` after deployment.

### 🚀 Deploy to Vercel

```bash
vercel link
vercel env add ANTHROPIC_API_KEY
# (repeat for all API keys)
vercel deploy --prod
```

### 📝 License

MIT
