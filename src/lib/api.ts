import type { JournalEntry, Report, User, UserRole, Visibility } from '../types'

export type BanNotice = { email: string; reason: string }
type Bootstrap = { user: User | null; users: User[]; entries: JournalEntry[]; reports: Report[]; banNotice: BanNotice | null }
async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(path, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) }, ...options })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (${response.status})`) as Error & { code?: string; banReason?: string }
    error.code = payload.code
    error.banReason = payload.banReason
    throw error
  }
  return payload as T
}

export const api = {
  bootstrap: async () => {
    const payload = await request<Partial<Bootstrap>>('/api/bootstrap')
    if (!Array.isArray(payload.entries) || !Array.isArray(payload.users) || !Array.isArray(payload.reports)) {
      throw new Error('服务器 API 尚未启动，请重启 Node 服务后再试')
    }
    return { user: payload.user ?? null, entries: payload.entries, users: payload.users, reports: payload.reports, banNotice: payload.banNotice ?? null } satisfies Bootstrap
  },
  login: (values: { email: string; password: string }) => request<{ user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify(values) }),
  register: (values: { email: string; password: string; displayName: string; username: string }) => request<{ user: User }>('/api/auth/register', { method: 'POST', body: JSON.stringify(values) }),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  updateProfile: (values: { displayName: string; username: string; bio: string }) => request<{ user: User }>('/api/auth/me', { method: 'PATCH', body: JSON.stringify(values) }),
  saveEntry: (entry: Partial<JournalEntry> & { id?: string; title: string; content: string; mood: string; entryDate: string; visibility: Visibility; status: string; tags: string[] }) => {
    const isExisting = Boolean(entry.id)
    return request<JournalEntry>(isExisting ? `/api/entries/${entry.id}` : '/api/entries', { method: isExisting ? 'PATCH' : 'POST', body: JSON.stringify(entry) })
  },
  deleteEntry: (entryId: string) => request<{ ok: true }>(`/api/entries/${entryId}`, { method: 'DELETE' }),
  report: (entryId: string, reason: string) => request<Report>('/api/reports', { method: 'POST', body: JSON.stringify({ entryId, reason }) }),
  createUser: (values: { displayName: string; username: string; email: string; password: string; role: UserRole }) => request<User>('/api/admin/users', { method: 'POST', body: JSON.stringify(values) }),
  updateUser: (userId: string, values: { status?: 'active' | 'banned'; banReason?: string; role?: UserRole; password?: string }) => request<User>(`/api/admin/users/${userId}`, { method: 'PATCH', body: JSON.stringify(values) }),
  deleteUser: (userId: string) => request<{ ok: true }>(`/api/admin/users/${userId}`, { method: 'DELETE' }),
  moderateEntry: (entryId: string, action: 'hide' | 'restore' | 'delete') => request<{ ok: true }>(`/api/admin/entries/${entryId}`, { method: 'PATCH', body: JSON.stringify({ action }) }),
  updateReport: (reportId: string, status: Report['status']) => request<Report>(`/api/admin/reports/${reportId}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
}
