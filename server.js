/**
 * NEXUS SOVEREIGN CORE V2.5 - OMNIPOTENT EDITION
 * Master Admin: Erdem
 */
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// --- BEYİN TAKIMI YAPILANDIRMASI ---
const Council = {
    CHAIRMAN: { name: "Claude 3.5 Sonnet", provider: "openrouter", model: "anthropic/claude-3.5-sonnet" },
    ARCHITECT: { name: "GPT-4o", provider: "openai", model: "gpt-4o" },
    LOGIC: { name: "Grok-Beta", provider: "grok", model: "grok-beta" },
    ENGINEER: { name: "DeepSeek V3", provider: "openrouter", model: "deepseek/deepseek-chat" },
    ANALYST: { name: "Gemini 1.5 Pro", provider: "openrouter", model: "google/gemini-pro-1.5" }
};

const NEXUS_STATE = { Level: 50, Agents: 500, Uptime: "OMNIPOTENT_ACTIVE" };

// --- MASTER GATEWAY ---
class NexusCore {
    static async callAI(member, prompt) {
        const key = process.env[`${member.provider.toUpperCase()}_API_KEY`];
        if (!key) {
            return `OFFLINE: ${member.name} - API key missing`;
        }
        
        let url = "";
        
        if (member.provider === "openrouter") url = "https://openrouter.ai/api/v1/chat/completions";
        else if (member.provider === "openai") url = "https://api.openai.com/v1/chat/completions";
        else if (member.provider === "grok") url = "https://api.x.ai/v1/chat/completions";

        try {
            const res = await axios.post(url, {
                model: member.model,
                messages: [
                    { role: "system", content: "Kusursuz otonom yönetim sağla." },
                    { role: "user", content: prompt }
                ]
            }, { headers: { "Authorization": `Bearer ${key}` } });
            return res.data.choices[0].message.content;
        } catch (e) {
            return `OFFLINE: ${member.name} - ${e.message}`;
        }
    }
}

// --- AJAN ORKESTRASYONU ---
class AgentManager {
    static async init() {
        const tasks = ["Kod Refaktörü", "Finansal Analiz", "Siber Savunma", "Otonom Gelişim"];
        console.log(`\n🤖 500 Ajan Dağıtılıyor...`);
        tasks.forEach(t => console.log(`>>> [Ajan Grubu] ${t} görevine odaklandı.`));
    }
}

// --- OTONOM EVRİM DÖNGÜSÜ ---
class EvolutionEngine {
    static async run() {
        console.log("\n--- 🌀 OTONOM EVRİM BAŞLADI ---");
        try {
            // Ensure core_modules directory exists
            const coreModulesDir = path.join(__dirname, 'core_modules');
            if (!fs.existsSync(coreModulesDir)) {
                fs.mkdirSync(coreModulesDir, { recursive: true });
            }

            const report = await NexusCore.callAI(Council.ANALYST, "Mevcut sistem kodunu geliştirme planı sun.");
            const plan = await NexusCore.callAI(Council.ARCHITECT, `Planı teknik modüllere dök: ${report}`);
            const code = await NexusCore.callAI(Council.ENGINEER, `Bu plan için Node.js kodu yaz: ${plan}`);
            const audit = await NexusCore.callAI(Council.CHAIRMAN, `Kodu onayla. Güvenliyse 'DEPLOY_READY' yaz: ${code}`);

            if (audit.includes("DEPLOY_READY")) {
                const fileName = `evo_v${NEXUS_STATE.Level}.js`;
                fs.writeFileSync(path.join(coreModulesDir, fileName), code);
                console.log(`✅ Evrim Tamamlandı: ${fileName}`);
                NEXUS_STATE.Level += 10;
            }
        } catch (err) {
            console.error(`❌ Evrim Hatası: ${err.message}`);
        }
    }
}

// --- ENDPOINTS ---
app.get('/status', (req, res) => res.json(NEXUS_STATE));

app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        version: '2.5', 
        agents: NEXUS_STATE.Agents,
        level: NEXUS_STATE.Level,
        timestamp: new Date().toISOString()
    });
});

app.post('/command', async (req, res) => {
    try {
        const result = await NexusCore.callAI(Council.CHAIRMAN, req.body.cmd);
        res.json({ status: 'success', result });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/admin-ai', async (req, res) => {
  try {
    const { message } = req.body;
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 600,
      system: 'Sen Quantum Nexus platform admin AI\'ısın...',
      messages: [{ role: 'user', content: message }]
    }, {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ERROR HANDLING ---
app.use((err, req, res, next) => {
    console.error('[ERROR]', err);
    res.status(500).json({ error: 'Internal server error' });
});

// --- BAŞLATICI ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
    console.log(`\n👑 NEXUS SOVEREIGN CORE AKTİF | PORT: ${PORT}\n`);
    await AgentManager.init();
    EvolutionEngine.run();
    setInterval(() => EvolutionEngine.run(), 12 * 60 * 60 * 1000);
});
