export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { prompt } = req.body;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(401).json({ error: 'API key missing' });
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': key
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await response.json();
    res.status(200).json({ response: data.content?.[0]?.text || 'No response' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
