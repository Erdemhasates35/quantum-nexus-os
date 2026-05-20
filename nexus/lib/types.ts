export type LogType = 'info' | 'success' | 'error' | 'warn' | 'agent' | 'system'
export type KanbanCol = 'todo' | 'doing' | 'done'
export type Tab = 'sovereign' | 'parliament' | 'code' | 'crypto' | 'github' | 'kanban' | 'revenue' | 'keys'

export interface LogEntry   { time: string; msg: string; type: LogType }
export interface Message    { role: 'user' | 'assistant'; content: string; model?: string }
export interface CoinData   { id: string; price: number; change: number; cap: number; vol: number }
export interface Repo       { id: number; name: string; description: string | null; stargazers_count: number; language: string | null; html_url: string }
export interface AgentVote  { agentId: string; agentName: string; response: string; confidence: number; model: string; weight: number }
export interface Keys       { openRouter: string; discordWebhook: string; githubToken: string }
export interface RevParams  { users: number; price: number; growth: number; churn: number; cost: number }
