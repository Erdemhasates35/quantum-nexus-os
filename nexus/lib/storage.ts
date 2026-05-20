export const ls = {
  get: <T,>(key: string, fallback: T): T => {
    if (typeof window === 'undefined') return fallback
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback }
    catch { return fallback }
  },
  set: (key: string, value: unknown): void => {
    if (typeof window === 'undefined') return
    try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota */ }
  },
}
