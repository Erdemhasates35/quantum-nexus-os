require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const OLLAMA_URL = 'http://localhost:11434/api/generate';

app.get('/health', (req, res) => {
    res.json({ status: 'Server running ✅', port: process.env.PORT || 3001 });
});

app.post('/api/admin-ai', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message || message.trim() === '') {
            return res.status(400).json({ error: 'Message is required' });
        }

        console.log('📤 Sending to Ollama:', message);

        const response = await axios.post(OLLAMA_URL, {
            model: 'mistral',
            prompt: `Sen Quantum Nexus platform admin AI'ısın. Türkçe, kısa ve eyleme geçirilebilir tavsiyeler ver.\n\nSoru: ${message}`,
            stream: false
        });

        const result = response.data.response;
        console.log('📥 Response from Ollama:', result);
        
        res.json({ 
            content: [{ text: result }],
            model: 'mistral'
        });
    } catch (error) {
        console.error('❌ Ollama Error:', error.message);
        res.status(500).json({ 
            error: 'API Error',
            message: 'Ollama server açık mı? Kontrol et: http://localhost:11434',
            details: error.message
        });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📡 Admin AI API: POST http://localhost:${PORT}/api/admin-ai`);
    console.log(`✅ Using: Ollama (Mistral)`);
});
