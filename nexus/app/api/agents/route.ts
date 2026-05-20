import { NextRequest, NextResponse } from 'next/server'

// Gerçek agent tanımları — her biri OpenRouter üzerinden farklı model
const AGENTS = [
  {
    id: 'reasoning',
    name: 'Grok_Reasoning',
    model: 'x-ai/grok-2-1212',
    role: 'Strategic reasoning & decision arbitration. Logical analysis specialist.',
    weight: 1.2,
  },
  {
    id: 'core',
    name: 'DeepSeek_Core',
    model: 'deepseek/deepseek-chat',
    role: 'Mathematics, deep analysis, logic. Analytical precision specialist.',
    weight: 1.1,
  },
  {
    id: 'code',
    name: 'Mistral_Codestral',
    model: 'mistralai/mistral-7b-instruct',
    role: 'Code generation, refactoring, optimization. Engineering specialist.',
    weight: 1.0,
  },
  {
    id: 'general',
    name: 'Claude_Sovereign',
    model: 'anthropic/claude-sonnet-4-5',
    role: 'General intelligence, synthesis, strategic guidance. Chief coordinator.',
    weight: 1.3,
  },
]

async function callAgent(
  agent: typeof AGENTS[0],
  userMessage: string,
  apiKey: string,
  context: string = ''
): Promise<{ agentId: string; agentName: string; response: string; confidence: number; model: string }> {
  const systemPrompt = `You are ${agent.name}, an autonomous AI agent in the Quantum Nexus OS parliament.
Your specialization: ${agent.role}
Authority weight: ${agent.weight}
${context ? `Parliament context so far:\n${context}` : ''}

Respond concisely and precisely. Rate your confidence 0-100 at the end with format: [CONFIDENCE: XX]`

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://quantum-nexus-os.vercel.app',
        'X-Title': 'Quantum Nexus Parliament',
      },
      body: JSON.stringify({
        model: agent.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 600,
        temperature: 0.7,
      }),
    })

    if (!res.ok) throw new Error(`${agent.name} HTTP ${res.status}`)
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content ?? 'No response'

    // Extract confidence score
    const confMatch = text.match(/\[CONFIDENCE:\s*(\d+)\]/i)
    const confidence = confMatch ? parseInt(confMatch[1]) : 70
    const cleanResponse = text.replace(/\[CONFIDENCE:\s*\d+\]/i, '').trim()

    return { agentId: agent.id, agentName: agent.name, response: cleanResponse, confidence, model: agent.model }
  } catch (err) {
    return {
      agentId: agent.id,
      agentName: agent.name,
      response: `[OFFLINE] ${err instanceof Error ? err.message : 'Connection failed'}`,
      confidence: 0,
      model: agent.model,
    }
  }
}

async function synthesizeConsensus(
  votes: Array<{ agentName: string; response: string; confidence: number; weight: number }>,
  query: string,
  apiKey: string
): Promise<string> {
  const parliament = votes
    .filter(v => v.confidence > 0)
    .map(v => `${v.agentName} (güven: ${v.confidence}%, ağırlık: ${v.weight}):\n${v.response}`)
    .join('\n\n---\n\n')

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://quantum-nexus-os.vercel.app',
      'X-Title': 'Quantum Nexus Consensus',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4-5',
      messages: [
        {
          role: 'system',
          content: `You are the MetaReasoner — the Quantum Nexus Parliament's consensus synthesizer.
You receive votes from multiple AI agents and synthesize them into a single authoritative answer.
Weight higher-confidence, higher-authority answers more heavily.
Identify agreements, resolve contradictions, produce a unified sovereign response.
Respond in the same language as the original query.`,
        },
        {
          role: 'user',
          content: `Original query: "${query}"\n\nAgent Parliament Votes:\n\n${parliament}\n\nSynthesize a final consensus answer.`,
        },
      ],
      max_tokens: 1000,
    }),
  })

  if (!res.ok) throw new Error(`Consensus synthesis HTTP ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? 'Consensus could not be formed.'
}

export async function POST(req: NextRequest) {
  try {
    const { message, apiKey, agentIds } = await req.json()
    if (!message || !apiKey) return NextResponse.json({ error: 'message and apiKey required' }, { status: 400 })

    const selectedAgents = agentIds?.length
      ? AGENTS.filter(a => agentIds.includes(a.id))
      : AGENTS

    // Call all agents in parallel — gerçek distributed cognition
    const agentResults = await Promise.allSettled(
      selectedAgents.map(agent => callAgent(agent, message, apiKey))
    )

    const votes = agentResults.map((result, i) => {
      if (result.status === 'fulfilled') {
        return { ...result.value, weight: selectedAgents[i].weight }
      }
      return {
        agentId: selectedAgents[i].id,
        agentName: selectedAgents[i].name,
        response: '[TIMEOUT]',
        confidence: 0,
        model: selectedAgents[i].model,
        weight: selectedAgents[i].weight,
      }
    })

    // Weighted consensus
    const consensus = await synthesizeConsensus(votes, message, apiKey)
    const avgConfidence = votes.filter(v => v.confidence > 0).reduce((a, v) => a + v.confidence, 0) / Math.max(votes.filter(v => v.confidence > 0).length, 1)

    return NextResponse.json({
      votes,
      consensus,
      avgConfidence: Math.round(avgConfidence),
      agentCount: selectedAgents.length,
      timestamp: new Date().toISOString(),
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Parliament error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ agents: AGENTS.map(a => ({ id: a.id, name: a.name, model: a.model, role: a.role })) })
}
