import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.join(root, 'data')
const dataFile = path.join(dataDir, 'app.json')
const publicDir = path.join(root, 'dist')
const port = Number(process.env.PORT || 4173)
const isProduction = process.env.NODE_ENV === 'production'
const mimeTypes = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.html': 'text/html; charset=utf-8' }
const sessionTtlMs = 1000 * 60 * 60 * 24 * 7
const sessions = new Map()
const loginAttempts = new Map()
const loginWindowMs = 15 * 60 * 1000
const maxLoginAttempts = 10
const isInsidePublicDir = (file) => {
  const relative = path.relative(publicDir, file)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

const now = () => new Date().toISOString()
const id = (prefix) => `${prefix}-${crypto.randomUUID()}`
const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => ({ salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') })
const verifyPassword = (password, user) => {
  if (!user.passwordHash || !user.passwordSalt) return false
  const actual = Buffer.from(hashPassword(password, user.passwordSalt).hash, 'hex')
  const expected = Buffer.from(user.passwordHash, 'hex')
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}

function clientAddress(request) {
  return request.socket.remoteAddress || 'unknown'
}

function allowLogin(request) {
  const key = clientAddress(request)
  const timestamp = Date.now()
  const current = loginAttempts.get(key)
  if (!current || timestamp - current.startedAt >= loginWindowMs) {
    loginAttempts.set(key, { startedAt: timestamp, count: 1 })
    return true
  }
  if (current.count >= maxLoginAttempts) return false
  current.count += 1
  return true
}

function clearLoginAttempts(request) {
  loginAttempts.delete(clientAddress(request))
}

const entryStatuses = new Set(['draft', 'published', 'archived'])
const entryVisibilities = new Set(['private', 'public', 'unlisted'])
function normalizeEntryInput(input) {
  const title = String(input.title || '').trim().slice(0, 200)
  const content = String(input.content || '').trim().slice(0, 100000)
  const entryDate = String(input.entryDate || '').trim()
  if (!title || !content || !/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) return null
  const status = entryStatuses.has(input.status) ? input.status : 'draft'
  const visibility = entryVisibilities.has(input.visibility) ? input.visibility : 'private'
  const tags = Array.isArray(input.tags) ? input.tags.map((tag) => String(tag).trim().slice(0, 40)).filter(Boolean).slice(0, 20) : []
  return {
    title,
    content,
    excerpt: String(input.excerpt || content).trim().slice(0, 280),
    mood: String(input.mood || 'Happy').trim().slice(0, 40),
    entryDate,
    visibility,
    status,
    tags,
  }
}

const seed = () => {
  const timestamp = now()
  const adminPassword = hashPassword(process.env.ADMIN_INITIAL_PASSWORD || crypto.randomBytes(24).toString('base64url'))
  const demoPassword = hashPassword(process.env.DEMO_INITIAL_PASSWORD || crypto.randomBytes(24).toString('base64url'))
  return {
    users: [
      { id: 'admin-user', username: 'admin', displayName: '空间管理员', email: 'admin@example.com', role: 'admin', roleSource: 'seeded', bio: '照看这间安静的公共空间。', status: 'active', createdAt: timestamp, lastSeenAt: timestamp, ...adminPassword },
      { id: 'demo-user', username: 'demo', displayName: '我的日誌', email: 'demo@example.com', role: 'user', bio: '把日子写下来，也把自己留在日子里。', status: 'active', createdAt: timestamp, lastSeenAt: timestamp, ...demoPassword },
    ],
    entries: [
      { id: 'entry-0824', authorId: 'demo-user', authorName: '我的日誌', title: '今天去了咖啡廳', content: '今天發生了一些很有趣的事，帶著筆電去了熟悉的咖啡廳。窗邊剛好有一點陽光，讓下午的工作慢了下來。', excerpt: '今天發生了一些很有趣的事……', mood: 'Happy', entryDate: '2026-08-24', visibility: 'public', status: 'published', tags: ['生活', '咖啡'], publishedAt: timestamp, createdAt: timestamp, updatedAt: timestamp },
      { id: 'entry-0820', authorId: 'demo-user', authorName: '我的日誌', title: '最近的生活', content: '最近開始養成早起的習慣，房間裡的光線也變得很溫柔。', excerpt: '最近開始養成早起的習慣……', mood: 'Calm', entryDate: '2026-08-20', visibility: 'public', status: 'published', tags: ['生活', '習慣'], publishedAt: timestamp, createdAt: timestamp, updatedAt: timestamp },
      { id: 'entry-0816', authorId: 'demo-user', authorName: '我的日誌', title: '一個人的小旅行', content: '週末去了很久沒去的地方，沿著熟悉的路走，發現街角多了一間小書店。', excerpt: '週末去了很久沒去的地方……', mood: 'Curious', entryDate: '2026-08-16', visibility: 'public', status: 'published', tags: ['旅行'], publishedAt: timestamp, createdAt: timestamp, updatedAt: timestamp },
    ],
    reports: [{ id: 'report-1', entryId: 'entry-0816', title: '一個人的小旅行', reason: '需要確認內容是否包含個人資訊', status: 'open', createdAt: timestamp }],
  }
}

function readDb() {
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 })
  fs.chmodSync(dataDir, 0o700)
  if (!fs.existsSync(dataFile)) {
    const initial = seed()
    fs.writeFileSync(dataFile, JSON.stringify(initial, null, 2), { mode: 0o600 })
    return initial
  }
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'))
}

let db = readDb()
function saveDb() {
  const temporary = `${dataFile}.tmp`
  fs.writeFileSync(temporary, JSON.stringify(db, null, 2), { mode: 0o600 })
  fs.renameSync(temporary, dataFile)
}

function publicUser(user) {
  if (!user) return null
  const { passwordHash, passwordSalt, ...safe } = user
  return safe
}

function cookieValue(request, name) {
  const cookies = request.headers.cookie?.split(';').map((part) => part.trim()) ?? []
  const match = cookies.find((part) => part.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

function currentUser(request) {
  const token = cookieValue(request, 'my_diary_session')
  const session = token ? sessions.get(token) : null
  if (!session || session.expiresAt < Date.now()) {
    if (token) sessions.delete(token)
    return null
  }
  const user = db.users.find((item) => item.id === session.userId)
  if (!user || user.status === 'banned') return null
  return user
}

function sendJson(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders })
  response.end(JSON.stringify(payload))
}

function fail(response, status, message) { sendJson(response, status, { error: message }) }
async function body(request) {
  let raw = ''
  for await (const chunk of request) raw += chunk
  if (raw.length > 1024 * 1024) throw new Error('Request body too large')
  return raw ? JSON.parse(raw) : {}
}

function requireUser(request, response) {
  const user = currentUser(request)
  if (!user) { fail(response, 401, 'Authentication required'); return null }
  return user
}
function requireAdmin(request, response) {
  const user = requireUser(request, response)
  if (!user) return null
  if (user.role !== 'admin') { fail(response, 403, 'Administrator access required'); return null }
  return user
}
function visibleEntries(user) {
  return db.entries.filter((entry) => (
    (entry.status === 'published' && entry.visibility === 'public' && db.users.find((item) => item.id === entry.authorId)?.status !== 'banned')
    || Boolean(user && (entry.authorId === user.id || user.role === 'admin'))
  ))
}
function setSession(response, user) {
  const token = crypto.randomBytes(32).toString('base64url')
  sessions.set(token, { userId: user.id, expiresAt: Date.now() + sessionTtlMs })
  response.setHeader('Set-Cookie', `my_diary_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionTtlMs / 1000}${isProduction ? '; Secure' : ''}`)
}

async function api(request, response, pathname) {
  const method = request.method || 'GET'
  if (method !== 'GET' && request.headers.origin && request.headers.origin !== `http://${request.headers.host}` && request.headers.origin !== `https://${request.headers.host}`) return fail(response, 403, 'Origin rejected')
  if (pathname === '/api/health' && method === 'GET') return sendJson(response, 200, { ok: true })
  if (pathname === '/api/bootstrap' && method === 'GET') {
    const user = currentUser(request)
    return sendJson(response, 200, { user: publicUser(user), entries: visibleEntries(user), reports: user?.role === 'admin' ? db.reports : [], users: user?.role === 'admin' ? db.users.map(publicUser) : [] })
  }
  if (pathname === '/api/auth/register' && method === 'POST') {
    const input = await body(request)
    const email = String(input.email || '').trim().toLowerCase()
    const password = String(input.password || '')
    if (!email || password.length < 8 || !String(input.displayName || '').trim()) return fail(response, 400, 'Display name, email, and an 8-character password are required')
    if (db.users.some((item) => item.email === email)) return fail(response, 409, 'Email is already registered')
    const passwordData = hashPassword(password)
    const user = { id: id('user'), username: String(input.username || email.split('@')[0]).trim(), displayName: String(input.displayName).trim(), email, role: 'user', bio: '把日子写下来，也把自己留在日子里。', status: 'active', createdAt: now(), lastSeenAt: now(), ...passwordData }
    db.users.push(user); saveDb(); setSession(response, user)
    return sendJson(response, 201, { user: publicUser(user) })
  }
  if (pathname === '/api/auth/login' && method === 'POST') {
    if (!allowLogin(request)) {
      response.setHeader('Retry-After', String(Math.ceil(loginWindowMs / 1000)))
      return fail(response, 429, 'Too many login attempts. Try again later')
    }
    const input = await body(request)
    const user = db.users.find((item) => item.email === String(input.email || '').trim().toLowerCase())
    if (!user || user.status === 'banned' || !verifyPassword(String(input.password || ''), user)) return fail(response, 401, 'Email or password is incorrect')
    clearLoginAttempts(request)
    user.lastSeenAt = now(); saveDb(); setSession(response, user)
    return sendJson(response, 200, { user: publicUser(user) })
  }
  if (pathname === '/api/auth/logout' && method === 'POST') {
    const token = cookieValue(request, 'my_diary_session'); if (token) sessions.delete(token)
    response.setHeader('Set-Cookie', `my_diary_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${isProduction ? '; Secure' : ''}`)
    return sendJson(response, 200, { ok: true })
  }
  if (pathname === '/api/auth/me' && method === 'PATCH') {
    const authenticated = requireUser(request, response); if (!authenticated) return
    const input = await body(request)
    if (input.displayName !== undefined) authenticated.displayName = String(input.displayName).trim().slice(0, 120)
    if (input.username !== undefined) authenticated.username = String(input.username).trim().slice(0, 80)
    if (input.bio !== undefined) authenticated.bio = String(input.bio).slice(0, 1000)
    saveDb(); return sendJson(response, 200, { user: publicUser(authenticated) })
  }
  const user = currentUser(request)
  if (pathname === '/api/entries' && method === 'POST') {
    if (!user) return fail(response, 401, 'Authentication required')
    const input = await body(request); const normalized = normalizeEntryInput(input); if (!normalized) return fail(response, 400, 'Title, content, and a valid entry date are required')
    const stamp = now()
    const entry = { ...normalized, id: id('entry'), authorId: user.id, authorName: user.displayName, createdAt: stamp, updatedAt: stamp, publishedAt: normalized.status === 'published' ? stamp : null }
    db.entries.unshift(entry); saveDb(); return sendJson(response, 201, entry)
  }
  const entryMatch = pathname.match(/^\/api\/entries\/([^/]+)$/)
  if (entryMatch && method === 'PATCH') {
    if (!user) return fail(response, 401, 'Authentication required')
    const entry = db.entries.find((item) => item.id === entryMatch[1]); if (!entry) return fail(response, 404, 'Entry not found')
    if (entry.authorId !== user.id && user.role !== 'admin') return fail(response, 403, 'Not allowed')
    const input = await body(request); const normalized = normalizeEntryInput({ ...entry, ...input }); if (!normalized) return fail(response, 400, 'Title, content, and a valid entry date are required')
    const stamp = now(); Object.assign(entry, normalized, { updatedAt: stamp, authorName: db.users.find((item) => item.id === entry.authorId)?.displayName ?? entry.authorName })
    if (normalized.status === 'published' && !entry.publishedAt) entry.publishedAt = stamp
    saveDb(); return sendJson(response, 200, entry)
  }
  if (entryMatch && method === 'DELETE') {
    if (!user) return fail(response, 401, 'Authentication required')
    const index = db.entries.findIndex((item) => item.id === entryMatch[1]); const entry = db.entries[index]; if (!entry) return fail(response, 404, 'Entry not found')
    if (entry.authorId !== user.id && user.role !== 'admin') return fail(response, 403, 'Not allowed')
    db.entries.splice(index, 1); db.reports = db.reports.filter((item) => item.entryId !== entry.id); saveDb(); return sendJson(response, 200, { ok: true })
  }
  if (pathname === '/api/reports' && method === 'POST') {
    if (!user) return fail(response, 401, 'Authentication required')
    const input = await body(request); const entry = db.entries.find((item) => item.id === input.entryId); if (!entry) return fail(response, 404, 'Entry not found')
    const report = { id: id('report'), entryId: entry.id, title: entry.title, reason: String(input.reason || 'Other'), status: 'open', createdAt: now() }; db.reports.unshift(report); saveDb(); return sendJson(response, 201, report)
  }
  if (pathname.startsWith('/api/admin/')) {
    if (!requireAdmin(request, response)) return
    const input = method === 'GET' ? {} : await body(request)
    const userMatch = pathname.match(/^\/api\/admin\/users(?:\/([^/]+))?$/)
    if (userMatch && method === 'POST' && !userMatch[1]) {
      const email = String(input.email || '').trim().toLowerCase(); if (!email || db.users.some((item) => item.email === email) || String(input.password || '').length < 8) return fail(response, 400, 'Unique email and an 8-character password are required')
      const passwordData = hashPassword(input.password); const created = { id: id('user'), username: String(input.username || email.split('@')[0]), displayName: String(input.displayName || email), email, role: input.role === 'admin' ? 'admin' : 'user', roleSource: input.role === 'admin' ? 'granted' : undefined, bio: '', status: 'active', createdAt: now(), ...passwordData }; db.users.unshift(created); saveDb(); return sendJson(response, 201, publicUser(created))
    }
    if (userMatch && method === 'PATCH' && userMatch[1]) {
      const target = db.users.find((item) => item.id === userMatch[1]); if (!target) return fail(response, 404, 'User not found')
      if (input.password !== undefined) { if (String(input.password).length < 8) return fail(response, 400, 'Password must be at least 8 characters'); Object.assign(target, hashPassword(input.password)) }
      if (input.status === 'banned' && target.id === user.id) return fail(response, 400, 'You cannot ban the current admin')
      if (input.role && target.id === user.id) return fail(response, 400, 'You cannot change the current admin role')
      if (input.status === 'active' || input.status === 'banned') target.status = input.status
      if (input.role === 'admin' || input.role === 'user') { target.role = input.role; target.roleSource = target.role === 'admin' ? 'granted' : undefined }
      saveDb(); return sendJson(response, 200, publicUser(target))
    }
    if (userMatch && method === 'DELETE' && userMatch[1]) {
      if (userMatch[1] === user.id) return fail(response, 400, 'You cannot delete the current admin')
      db.users = db.users.filter((item) => item.id !== userMatch[1]); const removed = new Set(db.entries.filter((item) => item.authorId === userMatch[1]).map((item) => item.id)); db.entries = db.entries.filter((item) => item.authorId !== userMatch[1]); db.reports = db.reports.filter((item) => !removed.has(item.entryId)); saveDb(); return sendJson(response, 200, { ok: true })
    }
    const adminEntryMatch = pathname.match(/^\/api\/admin\/entries\/([^/]+)$/)
    if (adminEntryMatch && method === 'PATCH') { const entry = db.entries.find((item) => item.id === adminEntryMatch[1]); if (!entry) return fail(response, 404, 'Entry not found'); const action = input.action; if (action === 'delete') { db.entries = db.entries.filter((item) => item.id !== entry.id); db.reports = db.reports.filter((item) => item.entryId !== entry.id) } else Object.assign(entry, action === 'hide' ? { status: 'archived' } : { status: 'published', visibility: 'public' }, { updatedAt: now() }); saveDb(); return sendJson(response, 200, { ok: true }) }
    const reportMatch = pathname.match(/^\/api\/admin\/reports\/([^/]+)$/)
    if (reportMatch && method === 'PATCH') { const report = db.reports.find((item) => item.id === reportMatch[1]); if (!report) return fail(response, 404, 'Report not found'); if (!['open', 'reviewing', 'resolved'].includes(input.status)) return fail(response, 400, 'Invalid report status'); report.status = input.status; saveDb(); return sendJson(response, 200, report) }
  }
  return fail(response, 404, 'Not found')
}

const server = http.createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('X-Frame-Options', 'SAMEORIGIN')
  response.setHeader('Referrer-Policy', 'same-origin')
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
  try {
    if (url.pathname.startsWith('/api/')) return await api(request, response, url.pathname)
    if (request.method !== 'GET' || !fs.existsSync(publicDir)) return fail(response, 404, 'Not found')
    let file = path.join(publicDir, url.pathname === '/' ? 'index.html' : url.pathname)
    if (!isInsidePublicDir(file) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(publicDir, 'index.html')
    const contentType = mimeTypes[path.extname(file).toLowerCase()] || 'application/octet-stream'
    response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': file.endsWith('.html') ? 'no-cache' : 'public, max-age=31536000, immutable' })
    fs.createReadStream(file).pipe(response)
  } catch (error) { console.error(error); fail(response, 500, 'Internal server error') }
})

server.listen(port, '127.0.0.1', () => console.log(`My Diary server listening on 127.0.0.1:${port}`))

function shutdown() {
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 5000).unref()
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
