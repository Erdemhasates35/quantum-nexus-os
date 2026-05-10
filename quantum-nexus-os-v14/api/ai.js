export default async function handler(req, res) {
  const { provider, prompt, system } = req.body;
  const key = process.env[`${provider.toUpperCase()}_API_KEY`];

  if (!key) return res.status(400).json({ error: "API key eksik. Vercel Environment Variables'a ekleyin." });

  let url, headers = {}, body;

  if (provider === 'openrouter') {
    url = 'https://openrouter.ai/api/v1/chat/completions';
    headers = {
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer': 'https://quantum-nexus-os-v14.vercel.app',
      'X-Title': 'Quantum Nexus OS'
    };
    body = { model: "anthropic/claude-3.5-sonnet", messages: [{role:"system", content: system||""}, {role:"user", content: prompt}] };
  } else if (provider === 'groq') {
    url = 'https://api.groq.com/openai/v1/chat/completions';
    headers = { 'Authorization': `Bearer ${key}` };
    body = { model: "llama-3.3-70b-versatile", messages: [{role:"user", content: prompt}] };
  } else if (provider === 'gemini') {
    url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
    body = { contents: [{ parts: [{ text: prompt }] }] };
  }

  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await response.json();
  res.status(200).json(data);
}
