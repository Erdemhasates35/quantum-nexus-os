export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { prompt, keys } = req.body;
  
  const responses = {};
  
  // Anthropic Claude
  if (keys.anthropic) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': keys.anthropic
        },
        body: JSON.stringify({
          model: 'claude-opus-4-5-20250514',
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const data = await response.json();
      responses.anthropic = data.content?.[0]?.text || 'No response';
    } catch (e) {
      responses.anthropic = `Error: ${e.message}`;
    }
  }
  
  // Groq Llama
  if (keys.groq) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${keys.groq}`
        },
        body: JSON.stringify({
          model: 'mixtral-8x7b-32768',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500
        })
      });
      const data = await response.json();
      responses.groq = data.choices?.[0]?.message?.content || 'No response';
    } catch (e) {
      responses.groq = `Error: ${e.message}`;
    }
  }
  
  // OpenAI GPT
  if (keys.openai) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${keys.openai}`
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500
        })
      });
      const data = await response.json();
      responses.openai = data.choices?.[0]?.message?.content || 'No response';
    } catch (e) {
      responses.openai = `Error: ${e.message}`;
    }
  }
  
  // xAI Grok
  if (keys.xai) {
    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${keys.xai}`
        },
        body: JSON.stringify({
          model: 'grok-3',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500
        })
      });
      const data = await response.json();
      responses.xai = data.choices?.[0]?.message?.content || 'No response';
    } catch (e) {
      responses.xai = `Error: ${e.message}`;
    }
  }
  
  // Google Gemini
  if (keys.google) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${keys.google}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      const data = await response.json();
      responses.google = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
    } catch (e) {
      responses.google = `Error: ${e.message}`;
    }
  }
  
  // DeepSeek
  if (keys.deepseek) {
    try {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${keys.deepseek}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500
        })
      });
      const data = await response.json();
      responses.deepseek = data.choices?.[0]?.message?.content || 'No response';
    } catch (e) {
      responses.deepseek = `Error: ${e.message}`;
    }
  }
  
  res.status(200).json({ responses, timestamp: new Date().toISOString() });
}
