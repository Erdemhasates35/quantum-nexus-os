import { NextRequest, NextResponse } from 'next/server'

type Agent = {
  id: string
  name: string
  model: string
  role: string
  weight: number
}

const AGENTS: Agent[] = [
  {
    id: 'reasoning',
    name: 'GPT6_Reasoning',
    model: process.env.NEXUS_MODEL_REASONING || 'openai/gpt-6-luna',
    role: 'Strategic reasoning, decision arbitration, and multi-step analysis.',
    weight: 1.2,
  },
  {
    id: 'core',
    name: 'DeepSeek_Core',
    model: process.env.NEXUS_MODEL_CORE || 'deepseek/deepseek-v4.1-flash-1017',
    role: 'Mathematics, quantitative analysis, logic, and analytical verification.',
    weight: 1.1,
  },
  {
    id: 'code',
    name: 'GPT6_Engineering',
    model: process.env.NEXUS_MODEL_CODE || 'openai/gpt-6-sol',
    role: 'Software engineering, code generation, debugging, and architecture review.',
    weight: 1.2,
  },
  {
    id: 'general',
    name: 'Claude_Sovereign',
    model: process.env.NEXUS_MODEL_GENERAL || 'anthropic/claude-opus-5.5',
    role: 'Synthesis, strategic guidance, and independent review.',
    weight: 1.3,
  },
]

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const REQUEST_TIMEOUT_MS = 45_000
const MAX_MESSAGE_LENGTH = 50_000

type AgentResult = {
  agentId: string
  agentName: string
  response: string
  confidence: number
  model: string
  weight: number
  status: 'completed' | 'failed'
  error?: string
}

function apiKey(): string | null {
  return process.env.OPENROUTER_API_KEY || null
}

async function completion(
  model: string,
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  maxTokens: number,
): Promise<{ content: string; model: string; usage?: unknown }> {
  const key = apiKey()
  if (!key) throw new Error('OPENROUTER_API_KEY is not configured on the server')

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://quantum-nexus-os.vercel.app',
      'X-Title': 'Quantum Nexus OS',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const providerMessage =
      typeof payload?.error?.message === 'string'
        ? payload.error.message.slice(0, 500)
        : `HTTP ${response.status}`
    throw new Error(`OpenRouter request failed: ${providerMessage}`)
  }

  const content = payload?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Provider returned no textual completion')
  }

  return {
    content: content.trim(),
    model: typeof payload.model === 'string' ? payload.model : model,
    usage: payload.usage,
  }
}

async function callAgent(agent: Agent, message: string): Promise<AgentResult> {
  const systemPrompt = [
    `You are ${agent.name}, a specialist in Quantum Nexus OS.`,
    `Specialization: ${agent.role}`,
    'Analyze only the supplied evidence. Never invent measurements, test results, transactions, market data, or execution status.',
    'State assumptions and uncertainty. End with [CONFIDENCE: integer] where the integer is 0-100 and reflects evidence quality.',
  ].join('\n')

  try {
    const result = await completion(
      agent.model,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      1200,
    )
    const match = result.content.match(/\[CONFIDENCE:\s*(\d{1,3})\]/i)
    const confidence = match ? Math.min(100, Number(match[1])) : 0
    const response = result.content.replace(/\[CONFIDENCE:\s*\d{1,3}\]/i, '').trim()

    return {
      agentId: agent.id,
      agentName: agent.name,
      response,
      confidence,
      model: result.model,
      weight: agent.weight,
      status: 'completed',
    }
  } catch (error) {
    return {
      agentId: agent.id,
      agentName: agent.name,
      response: '',
      confidence: 0,
      model: agent.model,
      weight: agent.weight,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Provider request failed',
    }
  }
}

async function synthesizeConsensus(
  votes: AgentResult[],
  query: string,
): Promise<{ content: string; model: string; usage?: unknown }> {
  const evidence = votes
    .filter((vote) => vote.status === 'completed' && vote.response.length > 0)
    .map((vote) =>
      `${vote.agentName} | model=${vote.model} | confidence=${vote.confidence} | weight=${vote.weight}\n${vote.response}`,
    )
    .join('\n\n---\n\n')

  if (!evidence) throw new Error('No successful agent evidence is available')

  return completion(
    process.env.NEXUS_MODEL_CONSENSUS || 'anthropic/claude-opus-5.5',
    [
      {
        role: 'system',
        content: [
          'You are the independent consensus reviewer for Quantum Nexus OS.',
          'Synthesize the supplied agent evidence; do not treat confidence scores as calibrated probabilities.',
          'Identify agreement, contradictions, missing evidence, and unresolved risks.',
          'Never convert a model claim into a verified fact without supporting evidence.',
          'Respond in the same language as the original request.',
        ].join(' '),
      },
      {
        role: 'user',
        content: `Original request:\n${query}\n\nAgent evidence:\n${evidence}\n\nProduce a concise, evidence-qualified consensus.`,
      },
    ],
    1800,
  )
}

export async function POST(req: NextRequest) {
  if (!apiKey()) {
    return NextResponse.json(
      { error: 'OPENROUTER_API_KEY is not configured in the server environment' },
      { status: 503 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const input = body as { message?: unknown; agentIds?: unknown }
  if (typeof input.message !== 'string' || !input.message.trim()) {
    return NextResponse.json({ error: 'message must be a non-empty string' }, { status: 400 })
  }
  if (input.message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `message exceeds ${MAX_MESSAGE_LENGTH} characters` }, { status: 413 })
  }

  if (input.agentIds !== undefined && (
    !Array.isArray(input.agentIds) ||
    !input.agentIds.every((id) => typeof id === 'string')
  )) {
    return NextResponse.json({ error: 'agentIds must be an array of agent identifiers' }, { status: 400 })
  }

  const selectedAgents = Array.isArray(input.agentIds) && input.agentIds.length
    ? AGENTS.filter((agent) => input.agentIds!.includes(agent.id))
    : AGENTS

  if (!selectedAgents.length) {
    return NextResponse.json({ error: 'No valid agents selected' }, { status: 400 })
  }

  const votes = await Promise.all(selectedAgents.map((agent) => callAgent(agent, input.message as string)))
  const successful = votes.filter((vote) => vote.status === 'completed' && vote.response.length > 0)

  if (!successful.length) {
    return NextResponse.json(
      {
        error: 'All selected model requests failed',
        votes,
        agentCount: selectedAgents.length,
        successfulAgentCount: 0,
        timestamp: new Date().toISOString(),
      },
      { status: 502 },
    )
  }

  try {
    const consensus = await synthesizeConsensus(successful, input.message)
    const confidenceValues = successful.filter((vote) => vote.confidence > 0)
    const weightedConfidence = confidenceValues.length
      ? confidenceValues.reduce((sum, vote) => sum + vote.confidence * vote.weight, 0) /
        confidenceValues.reduce((sum, vote) => sum + vote.weight, 0)
      : null

    return NextResponse.json({
      votes,
      consensus: consensus.content,
      consensusModel: consensus.model,
      avgConfidence: weightedConfidence === null ? null : Math.round(weightedConfidence),
      agentCount: selectedAgents.length,
      successfulAgentCount: successful.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Consensus synthesis failed',
        votes,
        agentCount: selectedAgents.length,
        successfulAgentCount: successful.length,
        timestamp: new Date().toISOString(),
      },
      { status: 502 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    agents: AGENTS.map(({ id, name, model, role, weight }) => ({
      id,
      name,
      model,
      role,
      weight,
    })),
    provider: 'OpenRouter',
    configured: Boolean(apiKey()),
    status: apiKey() ? 'configured' : 'missing_server_credential',
  })
}
