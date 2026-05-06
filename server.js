const express = require('express');
const cors = require('cors');
require('dotenv').config();
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

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

app.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));
