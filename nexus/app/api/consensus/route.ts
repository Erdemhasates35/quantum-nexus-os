import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { messages, model, apiKey, systemPrompt } = await req.json()
    if (!messages || !apiKey) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://quantum-nexus-os.vercel.app',
        'X-Title': 'Quantum Nexus',
      },
      body: JSON.stringify({
        model: model ?? 'anthropic/claude-sonnet-4-5',
        messages: systemPrompt
          ? [{ role: 'system', content: systemPrompt }, ...messages]
          : messages,
        max_tokens: 4096,
        temperature: 0.7,
      }),
    })

    if (res.status === 401) return NextResponse.json({ error: 'Geçersiz API key' }, { status: 401 })
    if (res.status === 429) return NextResponse.json({ error: 'Rate limit — bekle' }, { status: 429 })
    if (!res.ok) return NextResponse.json({ error: `OpenRouter HTTP ${res.status}` }, { status: res.status })

    const data = await res.json()
    return NextResponse.json({
      content: data.choices?.[0]?.message?.content ?? '',
      model: data.model,
      usage: data.usage,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
