import type { JournalEntry, Report, User } from '../types'

const entriesKey = 'my-diary.entries.v1'
const userKey = 'my-diary.user.v1'
const usersKey = 'my-diary.users.v1'
const reportsKey = 'my-diary.reports.v1'

const now = new Date().toISOString()

const seedEntries: JournalEntry[] = [
  {
    id: 'entry-0824',
    authorId: 'demo-user',
    authorName: '我的日誌',
    title: '今天去了咖啡廳',
    content: '今天發生了一些很有趣的事，帶著筆電去了熟悉的咖啡廳。窗邊剛好有一點陽光，讓下午的工作慢了下來。',
    excerpt: '今天發生了一些很有趣的事……',
    mood: 'Happy',
    entryDate: '2026-08-24',
    visibility: 'public',
    status: 'published',
    tags: ['生活', '咖啡'],
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'entry-0820',
    authorId: 'demo-user',
    authorName: '我的日誌',
    title: '最近的生活',
    content: '最近開始養成早起的習慣，房間裡的光線也變得很溫柔。',
    excerpt: '最近開始養成早起的習慣……',
    mood: 'Calm',
    entryDate: '2026-08-20',
    visibility: 'public',
    status: 'published',
    tags: ['生活', '習慣'],
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'entry-0816',
    authorId: 'demo-user',
    authorName: '我的日誌',
    title: '一個人的小旅行',
    content: '週末去了很久沒去的地方，沿著熟悉的路走，發現街角多了一間小書店。',
    excerpt: '週末去了很久沒去的地方……',
    mood: 'Curious',
    entryDate: '2026-08-16',
    visibility: 'public',
    status: 'published',
    tags: ['旅行'],
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  },
]

const seedUsers: User[] = [
  {
    id: 'demo-user',
    username: 'demo',
    displayName: '我的日誌',
    email: 'demo@example.com',
    role: 'user',
    bio: '把日子写下来，也把自己留在日子里。',
    password: 'demo1234',
    status: 'active',
    createdAt: now,
    lastSeenAt: now,
  },
  {
    id: 'admin-user',
    username: 'admin',
    displayName: '空间管理员',
    email: 'admin@example.com',
    role: 'admin',
    roleSource: 'seeded',
    bio: '照看这间安静的公共空间。',
    password: 'admin1234',
    status: 'active',
    createdAt: now,
    lastSeenAt: now,
  },
]

function read<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}

export function loadEntries() {
  return read<JournalEntry[]>(entriesKey, seedEntries)
}

export function saveEntries(entries: JournalEntry[]) {
  localStorage.setItem(entriesKey, JSON.stringify(entries))
}

export function loadUser() {
  return read<User | null>(userKey, null)
}

export function saveUser(user: User | null) {
  if (user) localStorage.setItem(userKey, JSON.stringify(user))
  else localStorage.removeItem(userKey)
}

export function loadUsers() {
  return read<User[]>(usersKey, seedUsers).map((item): User => ({
    ...item,
    role: item.id === 'admin-user' || item.roleSource === 'granted' ? 'admin' : 'user',
    roleSource: item.id === 'admin-user' ? 'seeded' : item.roleSource === 'granted' ? 'granted' : undefined,
    status: item.status ?? 'active',
    createdAt: item.createdAt ?? now,
    password: item.password ?? (item.role === 'admin' ? 'admin1234' : 'change-me-now'),
  }))
}

export function saveUsers(users: User[]) {
  localStorage.setItem(usersKey, JSON.stringify(users))
}

export function loadReports() {
  return read<Report[]>(reportsKey, [
    {
      id: 'report-1',
      entryId: 'entry-0816',
      title: '一個人的小旅行',
      reason: '需要確認內容是否包含個人資訊',
      status: 'open',
      createdAt: now,
    },
  ])
}

export function saveReports(reports: Report[]) {
  localStorage.setItem(reportsKey, JSON.stringify(reports))
}

export function makeExcerpt(content: string) {
  const plain = content.replace(/[#*_`>]/g, '').replace(/\s+/g, ' ').trim()
  return plain.length > 72 ? `${plain.slice(0, 72)}……` : plain
}
