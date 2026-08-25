import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Ban,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  Eye,
  Flag,
  FileText,
  Globe2,
  KeyRound,
  Link2,
  LockKeyhole,
  LogIn,
  Menu,
  Moon,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Smile,
  Star,
  Sun,
  Tag,
  Trash2,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
  UserX,
  X,
} from 'lucide-react'
import type { JournalEntry, Report, User, View, Visibility } from './types'
import { makeExcerpt } from './lib/storage'
import { api, type BanNotice } from './lib/api'

const moodOptions = [
  { value: 'Happy', label: 'Happy', icon: '🌞' },
  { value: 'Calm', label: 'Calm', icon: '🌿' },
  { value: 'Curious', label: 'Curious', icon: '🔎' },
  { value: 'Tired', label: 'Tired', icon: '🌙' },
  { value: 'Hopeful', label: 'Hopeful', icon: '🌱' },
]

function getLocalDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const today = getLocalDate()

type EditorValues = {
  title: string
  content: string
  mood: string
  entryDate: string
  visibility: Visibility
  tags: string[]
}

const emptyEditor: EditorValues = {
  title: '',
  content: '',
  mood: 'Happy',
  entryDate: today,
  visibility: 'private',
  tags: [],
}

function initialView(): View {
  const path = window.location.pathname
  if (path === '/login') return 'login'
  if (path === '/register') return 'register'
  if (path.startsWith('/me/drafts')) return 'drafts'
  if (path.startsWith('/me/settings')) return 'settings'
  if (path.startsWith('/me/entries/new')) return 'new'
  if (path.startsWith('/me/entries/')) return 'edit'
  if (path.startsWith('/me/entries')) return 'mine'
  if (path.startsWith('/admin')) return 'admin'
  if (path.startsWith('/tags')) return 'tags'
  if (path.startsWith('/about')) return 'about'
  if (path.startsWith('/public/entries/')) return 'preview'
  if (path.startsWith('/public')) return 'public'
  return 'home'
}

function initialSelection() {
  const match = window.location.pathname.match(/\/(?:public\/entries|me\/entries)\/([^/]+)/)
  return match?.[1] ?? null
}

function pathFor(view: View, id?: string | null) {
  if (view === 'home') return '/'
  if (view === 'public') return id ? `/public/entries/${id}` : '/public'
  if (view === 'mine') return id ? `/me/entries/${id}/edit` : '/me/entries'
  if (view === 'new') return '/me/entries/new'
  if (view === 'edit') return `/me/entries/${id ?? ''}/edit`
  if (view === 'preview') return `/public/entries/${id ?? ''}`
  if (view === 'drafts') return '/me/drafts'
  if (view === 'settings') return '/me/settings'
  if (view === 'tags') return '/tags'
  if (view === 'about') return '/about'
  if (view === 'admin') return '/admin'
  return view === 'login' ? '/login' : '/register'
}

function formatDate(value: string) {
  return value.replace(/-/g, '.')
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${value}T00:00:00`))
}

function App() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [view, setView] = useState<View>(initialView)
  const [selectedId, setSelectedId] = useState<string | null>(initialSelection)
  const [adminPreview, setAdminPreview] = useState(false)
  const [night, setNight] = useState(() => localStorage.getItem('my-diary.night') === 'true')
  const [mobileNav, setMobileNav] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [reportingId, setReportingId] = useState<string | null>(null)
  const [banNotice, setBanNotice] = useState<BanNotice | null>(null)

  useEffect(() => {
    api.bootstrap().then((snapshot) => {
      setEntries(snapshot.entries)
      setReports(snapshot.reports)
      setUsers(snapshot.users)
      setUser(snapshot.user)
      setBanNotice(snapshot.banNotice)
    }).catch(() => notify('无法连接服务器，请稍后重试。', 'error')).finally(() => setReady(true))
  }, [])

  useEffect(() => {
    localStorage.setItem('my-diary.night', String(night))
  }, [night])

  useEffect(() => {
    const onPopState = () => { setView(initialView()); setSelectedId(initialSelection()); setAdminPreview(false) }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const navigate = (next: View, id?: string | null) => {
    if ((next === 'new' || next === 'mine' || next === 'drafts' || next === 'settings') && !user) {
      next = 'login'
    }
    setView(next)
    if (next !== 'preview') setAdminPreview(false)
    setSelectedId(id ?? null)
    setMobileNav(false)
    window.history.pushState({}, '', pathFor(next, id))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const notify = (message: string, type: 'success' | 'error' | 'info' = 'success') => setToast({ message, type })

  useEffect(() => {
    if (user?.status === 'banned') {
      setUser(null)
      setBanNotice({ email: user.email, reason: user.banReason || '违反社区使用条款，管理员已暂停此账号。' })
      notify('这个账号目前已被暂停。', 'error')
    }
  }, [user?.status])

  const selectedEntry = entries.find((entry) => entry.id === selectedId) ?? null
  const publicEntries = entries.filter((entry) => entry.status === 'published' && entry.visibility === 'public' && users.find((item) => item.id === entry.authorId)?.status !== 'banned')
  const ownEntries = user ? entries.filter((entry) => entry.authorId === user.id && entry.status !== 'archived') : []
  const allTags = Array.from(new Set(entries.flatMap((entry) => entry.tags))).sort()

  const handleAuth = async (mode: 'login' | 'register', values: { email: string; password: string; displayName: string; username: string }) => {
    try {
      const result = mode === 'login' ? await api.login(values) : await api.register(values)
      setUser(result.user)
      const snapshot = await api.bootstrap()
      setEntries(snapshot.entries); setReports(snapshot.reports); setUsers(snapshot.users)
      notify(mode === 'login' ? '歡迎回來，今天也寫一點吧。' : '帳號建立完成，歡迎來到你的日誌。')
      navigate('home')
    } catch (error) {
      const authError = error as Error & { code?: string; banReason?: string }
      if (authError.code === 'ACCOUNT_BANNED') {
        setUser(null)
        setBanNotice({ email: values.email, reason: authError.banReason || '违反社区使用条款，管理员已暂停此账号。' })
        return
      }
      notify(error instanceof Error ? error.message : '登录失败，请稍后重试。', 'error')
    }
  }

  const saveEntry = async (values: EditorValues, shouldPublish: boolean, existing?: JournalEntry | null) => {
    if (!user) {
      navigate('login')
      return
    }
    const stamp = new Date().toISOString()
    const entry: JournalEntry = {
      // New entries must use POST; the server assigns their canonical ID.
      id: existing?.id ?? '',
      authorId: existing?.authorId ?? user.id,
      authorName: user.displayName,
      title: values.title.trim(),
      content: values.content.trim(),
      excerpt: makeExcerpt(values.content),
      mood: values.mood,
      entryDate: values.entryDate,
      visibility: values.visibility,
      status: shouldPublish ? 'published' : 'draft',
      tags: values.tags,
      publishedAt: shouldPublish ? existing?.publishedAt ?? stamp : existing?.publishedAt ?? null,
      createdAt: existing?.createdAt ?? stamp,
      updatedAt: stamp,
    }
    try {
      const saved = await api.saveEntry(entry)
      setEntries((current) => [saved, ...current.filter((item) => item.id !== saved.id)])
      notify(shouldPublish ? '日誌已發布。' : '草稿已儲存。')
      navigate(shouldPublish ? (saved.visibility === 'public' ? 'preview' : 'mine') : 'drafts', saved.id)
    } catch (error) {
      notify(error instanceof Error ? error.message : '保存失败，请稍后重试。', 'error')
    }
  }

  const archiveEntry = async (entry: JournalEntry) => {
    try {
      const archived = await api.saveEntry({ ...entry, status: 'archived' })
      setEntries((current) => current.map((item) => item.id === archived.id ? archived : item))
      notify('日誌已封存。', 'info')
    } catch (error) { notify(error instanceof Error ? error.message : '操作失败。', 'error') }
  }

  const submitReport = async (entry: JournalEntry, reason: string) => {
    try {
      const report = await api.report(entry.id, reason)
      setReports((current) => [report, ...current])
      setReportingId(null)
      notify('謝謝你的回報，我們會查看這篇內容。', 'info')
    } catch (error) { notify(error instanceof Error ? error.message : '提交失败。', 'error') }
  }

  const updateReport = async (report: Report, status: Report['status']) => {
    try {
      const updated = await api.updateReport(report.id, status)
      setReports((current) => current.map((item) => item.id === updated.id ? updated : item))
      notify('檢舉狀態已更新。')
    } catch (error) { notify(error instanceof Error ? error.message : '更新失败。', 'error') }
  }

  const createManagedUser = async (values: { displayName: string; username: string; email: string; password: string; role: User['role'] }) => {
    const email = values.email.trim().toLowerCase()
    if (!email || !values.displayName.trim() || values.password.length < 8 || users.some((item) => item.email.toLowerCase() === email)) {
      notify('请填写完整资料，且邮箱不能重复。', 'error')
      return false
    }
    try {
      const created = await api.createUser({ ...values, email })
      setUsers((current) => [created, ...current]); notify('新账号已建立。'); return true
    } catch (error) { notify(error instanceof Error ? error.message : '创建失败。', 'error'); return false }
  }

  const setUserStatus = async (target: User, status: 'active' | 'banned', banReason = '') => {
    if (status === 'banned' && !banReason.trim()) {
      const entered = window.prompt('请输入封禁原因，用户登录时会看到这条说明：')
      if (!entered || entered.trim().length < 4) {
        notify('封禁必须填写至少 4 个字的原因。', 'error')
        return
      }
      banReason = entered.trim()
    }
    if (target.id === user?.id && status === 'banned') {
      notify('不能暂停当前管理员账号。', 'error')
      return
    }
    try { const updated = await api.updateUser(target.id, { status, banReason }); setUsers((current) => current.map((item) => item.id === updated.id ? updated : item)); if (user?.id === target.id) setUser(updated); notify(status === 'banned' ? '账号已暂停。' : '账号已恢复。', 'info') } catch (error) { notify(error instanceof Error ? error.message : '操作失败。', 'error') }
  }

  const setUserRole = async (target: User, role: User['role']) => {
    if (target.id === user?.id) {
      notify('不能修改当前管理员的角色。', 'error')
      return
    }
    try { const updated = await api.updateUser(target.id, { role }); setUsers((current) => current.map((item) => item.id === updated.id ? updated : item)); notify(role === 'admin' ? '账号已升级为管理员。' : '管理员权限已收回。', 'info') } catch (error) { notify(error instanceof Error ? error.message : '操作失败。', 'error') }
  }

  const updateManagedPassword = async (target: User, password: string) => {
    if (password.length < 8) {
      notify('密码至少需要 8 位。', 'error')
      return false
    }
    try { const updated = await api.updateUser(target.id, { password }); setUsers((current) => current.map((item) => item.id === updated.id ? updated : item)); if (user?.id === target.id) setUser(updated); notify('密码已更新。'); return true } catch (error) { notify(error instanceof Error ? error.message : '更新失败。', 'error'); return false }
  }

  const deleteManagedUser = async (target: User) => {
    if (target.id === user?.id) {
      notify('不能删除当前管理员账号。', 'error')
      return
    }
    if (!window.confirm(`确定删除「${target.displayName}」？其文章也会一并删除。`)) return
    try { await api.deleteUser(target.id); setUsers((current) => current.filter((item) => item.id !== target.id)); setEntries((current) => current.filter((entry) => entry.authorId !== target.id)); notify('账号及其内容已删除。', 'info') } catch (error) { notify(error instanceof Error ? error.message : '删除失败。', 'error') }
  }

  const moderateEntry = async (entry: JournalEntry, action: 'hide' | 'restore' | 'delete') => {
    if (action === 'delete') {
      if (!window.confirm(`确定删除「${entry.title}」？`)) return
      try { await api.moderateEntry(entry.id, action); setEntries((current) => current.filter((item) => item.id !== entry.id)); setReports((current) => current.filter((report) => report.entryId !== entry.id)); notify('文章已永久删除。', 'info') } catch (error) { notify(error instanceof Error ? error.message : '删除失败。', 'error') }
      return
    }
    try { await api.moderateEntry(entry.id, action); setEntries((current) => current.map((item) => item.id === entry.id ? { ...item, status: action === 'hide' ? 'archived' : 'published', visibility: action === 'hide' ? item.visibility : 'public', updatedAt: new Date().toISOString() } : item)); notify(action === 'hide' ? '文章已隐藏。' : '文章已恢复公开。', 'info') } catch (error) { notify(error instanceof Error ? error.message : '操作失败。', 'error') }
  }

  return (
    <div className={`app-root ${night ? 'theme-night' : ''}`}>
      <BrowserFrame>
        <SiteHeader user={user} view={view} night={night} mobileNav={mobileNav} onToggleNight={() => setNight((value) => !value)} onToggleNav={() => setMobileNav((value) => !value)} onNavigate={navigate} onLogout={async () => { await api.logout().catch(() => undefined); setUser(null); setEntries([]); setReports([]); setUsers([]); notify('已登出。', 'info'); navigate('home') }} />
        <main className="page-shell">
          {!ready ? <div className="permission-state"><BookOpen size={28} /><h2>正在连接服务器</h2><p>正在读取日誌与权限，请稍候。</p></div> : <>
          {view === 'home' && <HomePage user={user} entries={publicEntries} ownEntries={ownEntries} onNavigate={navigate} />}
          {view === 'public' && <PublicPage entries={publicEntries} allTags={allTags} onOpen={(id) => navigate('preview', id)} />}
          {view === 'mine' && <MinePage entries={ownEntries} onNew={() => navigate('new')} onEdit={(id) => navigate('edit', id)} onArchive={archiveEntry} onPreview={(id) => navigate('preview', id)} />}
          {view === 'drafts' && <DraftsPage entries={ownEntries.filter((entry) => entry.status === 'draft')} onNew={() => navigate('new')} onEdit={(id) => navigate('edit', id)} onPreview={(id) => navigate('preview', id)} />}
          {view === 'new' && <EditorPage key="new" entry={null} onSave={(values, publish) => saveEntry(values, publish)} onPreview={(values) => saveEntry(values, false)} onBack={() => navigate('mine')} />}
          {view === 'edit' && <EditorPage key={selectedId ?? 'edit'} entry={selectedEntry} onSave={(values, publish) => saveEntry(values, publish, selectedEntry)} onPreview={(values) => saveEntry(values, false, selectedEntry)} onBack={() => navigate('mine')} />}
          {view === 'preview' && <PreviewPage entry={selectedEntry} user={user} authorBanned={Boolean(selectedEntry && users.some((item) => item.id === selectedEntry.authorId && item.status === 'banned'))} onBack={() => adminPreview ? navigate('admin') : navigate(user && selectedEntry?.authorId === user.id ? 'mine' : 'public')} onEdit={(id) => navigate('edit', id)} onReport={(id) => setReportingId(id)} />}
          {(view === 'login' || view === 'register') && <AuthPage mode={view} onSubmit={(values) => handleAuth(view, values)} onSwitch={() => navigate(view === 'login' ? 'register' : 'login')} />}
          {view === 'settings' && <SettingsPage user={user} onSave={async (next) => { try { const result = await api.updateProfile(next); setUser(result.user); notify('個人設定已儲存。') } catch (error) { notify(error instanceof Error ? error.message : '保存失败。', 'error') } }} />}
          {view === 'tags' && <TagsPage tags={allTags} entries={publicEntries} onOpen={(id) => navigate('preview', id)} />}
          {view === 'about' && <AboutPage />}
          {view === 'admin' && <AdminPage user={user} users={users} reports={reports} entries={entries} onUpdateReport={updateReport} onCreateUser={createManagedUser} onSetUserStatus={setUserStatus} onSetUserRole={setUserRole} onUpdatePassword={updateManagedPassword} onDeleteUser={deleteManagedUser} onModerateEntry={moderateEntry} onViewEntry={(id) => { setAdminPreview(true); navigate('preview', id) }} />}
          </>}
        </main>
        <Footer />
      </BrowserFrame>
      {toast && <div className={`toast toast-${toast.type}`} role="status"><Check size={17} aria-hidden="true" /><span>{toast.message}</span><button className="icon-button toast-close" aria-label="關閉提示" onClick={() => setToast(null)}><X size={15} /></button></div>}
      {reportingId && <ReportModal entry={entries.find((item) => item.id === reportingId) ?? null} onClose={() => setReportingId(null)} onSubmit={submitReport} />}
      {banNotice && <BanNoticeModal notice={banNotice} onClose={() => setBanNotice(null)} onGoLogin={() => { setBanNotice(null); navigate('login') }} />}
    </div>
  )
}

function BrowserFrame({ children }: { children: React.ReactNode }) {
  return <div className="browser-frame">{children}</div>
}

function SiteHeader({ user, view, night, mobileNav, onToggleNight, onToggleNav, onNavigate, onLogout }: { user: User | null; view: View; night: boolean; mobileNav: boolean; onToggleNight: () => void; onToggleNav: () => void; onNavigate: (view: View) => void; onLogout: () => void }) {
  const navItems: Array<{ view: View; label: string }> = [
    { view: 'home', label: 'Home' },
    { view: 'public', label: '每日日誌' },
    { view: user ? 'new' : 'login', label: '更新日誌' },
    { view: 'about', label: '關於我' },
  ]
  return <header className="site-header">
    <button className="brand" onClick={() => onNavigate('home')} aria-label="回到首頁"><span className="brand-mark"><BookOpen size={18} /></span><span>My Diary</span></button>
    <button className="mobile-menu-button" onClick={onToggleNav} aria-label="開啟導覽選單" aria-expanded={mobileNav}><Menu size={20} /></button>
    <nav className={`site-nav ${mobileNav ? 'is-open' : ''}`} aria-label="主要導覽">
      {navItems.map((item) => <button key={item.label} className={`nav-button ${view === item.view ? 'is-active' : ''}`} onClick={() => onNavigate(item.view)}>{item.label}</button>)}
    </nav>
    <div className="header-actions">
      <button className="icon-button theme-toggle" onClick={onToggleNight} aria-label={night ? '切換日間模式' : '切換夜間模式'} title={night ? '日間模式' : '夜間模式'}>{night ? <Sun size={19} /> : <Moon size={19} />}</button>
      {user ? <div className="user-actions"><button className="user-chip" aria-label={`開啟 ${user.displayName} 的日誌`} onClick={() => onNavigate('mine')}><UserRound size={16} /><span>{user.displayName}</span></button><button className="outline-button small" onClick={onLogout}>登出</button>{user.role === 'admin' && <button className="outline-button small admin-link" onClick={() => onNavigate('admin')}>管理</button>}</div> : <button className="outline-button" onClick={() => onNavigate('login')}><LogIn size={16} />登入/註冊</button>}
    </div>
  </header>
}

function Footer() {
  return <footer className="site-footer"><span>© {new Date().getFullYear()} My Diary</span><span>留一點空白，讓日子慢慢發生。</span></footer>
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="page-title"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>
}

function Button({ children, variant = 'outline', onClick, type = 'button', disabled = false, className = '' }: { children: React.ReactNode; variant?: 'outline' | 'ink' | 'yellow' | 'text' | 'danger'; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean; className?: string }) {
  return <button type={type} disabled={disabled} className={`action-button action-${variant} ${className}`} onClick={onClick}>{children}</button>
}

function HomePage({ user, entries, ownEntries, onNavigate }: { user: User | null; entries: JournalEntry[]; ownEntries: JournalEntry[]; onNavigate: (view: View, id?: string | null) => void }) {
  const [currentDate, setCurrentDate] = useState(getLocalDate)
  useEffect(() => {
    const refreshDate = () => setCurrentDate(getLocalDate())
    const timer = window.setInterval(refreshDate, 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const cards = user && ownEntries.length ? ownEntries.filter((entry) => entry.status === 'published').slice(0, 3) : entries.slice(0, 3)
  return <PageContainer className="home-page">
    <section className="home-hero"><span className="hero-line">✦</span><h1>Welcome to My Diary</h1><p>｜在這一裏，你可以把每天美好的事件記錄下來｜</p></section>
    <section className="today-snapshot"><span className="section-label">今天日期：</span><strong>{formatDate(currentDate)}</strong><span className="today-mood">Today I’m feeling: <span className="mood-emoji">{moodOptions.find((item) => item.value === (user && ownEntries[0]?.mood) || 'Happy')?.icon ?? '🌞'}</span> {user && ownEntries[0] ? ownEntries[0].mood : 'Happy'}</span></section>
    <section className="recent-section"><div className="section-heading"><h2>最近日誌 <Star size={22} fill="var(--accent-yellow)" strokeWidth={1.5} aria-hidden="true" /></h2><Button variant="outline" onClick={() => onNavigate(user ? 'new' : 'login')}><Plus size={17} />寫一篇日誌</Button></div><JournalList entries={cards} onOpen={(id) => onNavigate('preview', id)} emptyTitle="還沒有公開日誌" emptyText="寫下今天的一小段，讓它成為未來的收藏。" /></section>
  </PageContainer>
}

function PublicPage({ entries, allTags, onOpen }: { entries: JournalEntry[]; allTags: string[]; onOpen: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')
  const filtered = entries.filter((entry) => (!query || `${entry.title} ${entry.excerpt} ${entry.authorName}`.toLowerCase().includes(query.toLowerCase())) && (!tag || entry.tags.includes(tag)))
  return <PageContainer><PageTitle eyebrow="PUBLIC JOURNAL" title="公共日誌" description="閱讀別人願意分享的日常片段。" action={<Button variant="yellow" onClick={() => document.getElementById('public-search')?.focus()}><Search size={16} />尋找一篇日誌</Button>} /><div className="filter-row"><label className="search-field"><Search size={17} aria-hidden="true" /><input id="public-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋標題、內容或作者" /></label><label className="select-field"><Tag size={16} aria-hidden="true" /><select value={tag} onChange={(event) => setTag(event.target.value)}><option value="">所有標籤</option>{allTags.map((item) => <option key={item} value={item}>{item}</option>)}</select><ChevronDown size={15} aria-hidden="true" /></label></div><JournalList entries={filtered} onOpen={onOpen} emptyTitle="找不到這樣的日誌" emptyText="試著換個關鍵字或清除篩選。" /></PageContainer>
}

function MinePage({ entries, onNew, onEdit, onArchive, onPreview }: { entries: JournalEntry[]; onNew: () => void; onEdit: (id: string) => void; onArchive: (entry: JournalEntry) => void; onPreview: (id: string) => void }) {
  return <PageContainer><PageTitle eyebrow="MY SPACE" title="我的日誌" description="只屬於你的書寫空間。" action={<Button variant="yellow" onClick={onNew}><Plus size={17} />新增日誌</Button>} />{entries.length === 0 ? <EmptyJournalState onCreate={onNew} title="還沒有自己的日誌" text="從一個簡單的句子開始，建立今天的記憶。" /> : <div className="journal-list journal-list-private">{entries.map((entry) => <JournalCard key={entry.id} entry={entry} onOpen={() => onPreview(entry.id)} actions={<><button className="icon-button" title="編輯" aria-label="編輯" onClick={() => onEdit(entry.id)}><Pencil size={16} /></button><button className="icon-button" title="封存" aria-label="封存" onClick={() => onArchive(entry)}><Archive size={16} /></button></>} />)}</div>}</PageContainer>
}

function DraftsPage({ entries, onNew, onEdit, onPreview }: { entries: JournalEntry[]; onNew: () => void; onEdit: (id: string) => void; onPreview: (id: string) => void }) {
  return <PageContainer><PageTitle eyebrow="IN PROGRESS" title="草稿" description="還沒準備好公開，也沒有關係。" action={<Button variant="yellow" onClick={onNew}><Plus size={17} />寫新草稿</Button>} />{entries.length === 0 ? <EmptyJournalState onCreate={onNew} title="沒有未完成的草稿" text="所有想法都已經找到自己的位置。" /> : <div className="journal-list journal-list-private">{entries.map((entry) => <JournalCard key={entry.id} entry={entry} onOpen={() => onPreview(entry.id)} actions={<button className="outline-button small" onClick={() => onEdit(entry.id)}>繼續寫</button>} />)}</div>}</PageContainer>
}

function JournalList({ entries, onOpen, emptyTitle, emptyText }: { entries: JournalEntry[]; onOpen: (id: string) => void; emptyTitle: string; emptyText: string }) {
  if (!entries.length) return <EmptyJournalState title={emptyTitle} text={emptyText} />
  return <div className="journal-list">{entries.map((entry) => <JournalCard key={entry.id} entry={entry} onOpen={() => onOpen(entry.id)} />)}</div>
}

function JournalCard({ entry, onOpen, actions }: { entry: JournalEntry; onOpen: () => void; actions?: React.ReactNode }) {
  const mood = moodOptions.find((item) => item.value === entry.mood)
  return <article className="journal-card">
    <button className="card-main" onClick={onOpen} aria-label={`閱讀：${entry.title}`}><div className="card-top"><span>{formatDate(entry.entryDate)}</span><span className={`visibility-badge visibility-${entry.visibility}`}>{entry.visibility === 'private' ? <LockKeyhole size={12} /> : entry.visibility === 'unlisted' ? <Link2 size={12} /> : <Globe2 size={12} />}{entry.visibility}</span></div><h3>{entry.title || '未命名日誌'}</h3><p>{entry.excerpt || '還沒有摘要。'}</p><span className="card-read">Read more <ArrowRight size={15} /></span></button>
    <div className="card-bottom"><span className="card-mood">{mood?.icon ?? '🌞'} {entry.mood}</span><span className="card-tags">{entry.tags.slice(0, 2).map((tag) => <span key={tag}>#{tag}</span>)}</span>{actions && <span className="card-actions">{actions}</span>}</div>
  </article>
}

function EmptyJournalState({ title, text, onCreate }: { title: string; text: string; onCreate?: () => void }) {
  return <div className="empty-state"><BookOpen size={31} strokeWidth={1.4} /><h3>{title}</h3><p>{text}</p>{onCreate && <Button variant="outline" onClick={onCreate}><Plus size={16} />開始寫作</Button>}</div>
}

function PageContainer({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`page-container ${className}`}>{children}</div>
}

function EditorPage({ entry, onSave, onPreview, onBack }: { entry: JournalEntry | null; onSave: (values: EditorValues, publish: boolean) => void; onPreview: (values: EditorValues) => void; onBack: () => void }) {
  const [values, setValues] = useState<EditorValues>(() => entry ? { title: entry.title, content: entry.content, mood: entry.mood, entryDate: entry.entryDate, visibility: entry.visibility, tags: entry.tags } : emptyEditor)
  const [tagInput, setTagInput] = useState('')
  const [dirty, setDirty] = useState(false)
  const update = <K extends keyof EditorValues>(key: K, value: EditorValues[K]) => { setValues((current) => ({ ...current, [key]: value })); setDirty(true) }
  const addTag = () => { const tag = tagInput.trim().replace(/^#/, ''); if (tag && !values.tags.includes(tag)) update('tags', [...values.tags, tag]); setTagInput('') }
  const removeTag = (tag: string) => update('tags', values.tags.filter((item) => item !== tag))
  const valid = values.title.trim().length > 0 && values.content.trim().length > 0
  const leave = () => { if (dirty && !window.confirm('還有尚未儲存的變更，要離開嗎？')) return; onBack() }
  return <PageContainer><PageTitle eyebrow={entry ? 'EDIT JOURNAL' : 'NEW JOURNAL'} title={entry ? '編輯日誌' : '寫一篇日誌'} description="讓內容保持真實，也讓選擇保持清楚。" action={<Button variant="text" onClick={leave}><ArrowLeft size={16} />返回</Button>} /><div className="editor-layout"><form className="editor-form" onSubmit={(event) => { event.preventDefault(); if (valid) { onSave(values, false); setDirty(false) } }}><label className="form-field"><span>標題</span><input value={values.title} maxLength={160} onChange={(event) => update('title', event.target.value)} placeholder="今天想記住什麼？" required /></label><div className="form-grid"><label className="form-field"><span><CalendarDays size={15} />日期</span><input type="date" value={values.entryDate} onChange={(event) => update('entryDate', event.target.value)} /></label><MoodSelector value={values.mood} onChange={(value) => update('mood', value)} /></div><label className="form-field"><span>內容</span><textarea value={values.content} onChange={(event) => update('content', event.target.value)} placeholder="寫下今天發生的事……" rows={14} required /></label><div className="form-grid"><VisibilitySelector value={values.visibility} onChange={(value) => update('visibility', value)} /><div className="form-field"><span><Tag size={15} />標籤</span><div className="tag-input"><input value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag() } }} placeholder="輸入後按 Enter" /><button type="button" className="icon-button" aria-label="加入標籤" onClick={addTag}><Plus size={16} /></button></div><div className="selected-tags">{values.tags.map((tag) => <button type="button" className="tag-chip" key={tag} onClick={() => removeTag(tag)}>#{tag}<X size={12} /></button>)}</div></div></div><div className="editor-actions"><Button variant="text" onClick={() => onPreview(values)} disabled={!valid}><Eye size={16} />預覽</Button><Button variant="outline" type="submit" disabled={!valid}><Save size={16} />儲存草稿</Button><Button variant="yellow" type="button" onClick={() => valid && onSave(values, true)} disabled={!valid}><Send size={16} />確認發布</Button></div></form><aside className="editor-aside"><div className="note-card"><Star size={19} fill="var(--accent-yellow)" /><h3>寫給未來的自己</h3><p>不需要寫得完美，只要寫得像你。你可以隨時保存為私人草稿。</p></div><div className="preview-mini"><span className="eyebrow">LIVE PREVIEW</span><h3>{values.title || '你的標題會在這裡出現'}</h3><p>{makeExcerpt(values.content) || '輸入內容後，這裡會顯示摘要。'}</p><span className={`visibility-badge visibility-${values.visibility}`}>{values.visibility}</span></div></aside></div></PageContainer>
}

function MoodSelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="form-field"><span><Smile size={15} />心情</span><div className="mood-options">{moodOptions.map((item) => <button type="button" key={item.value} className={`mood-option ${value === item.value ? 'is-selected' : ''}`} onClick={() => onChange(item.value)} aria-label={`選擇心情 ${item.label}`} aria-pressed={value === item.value}><span>{item.icon}</span><small>{item.label}</small></button>)}</div></label>
}

function VisibilitySelector({ value, onChange }: { value: Visibility; onChange: (value: Visibility) => void }) {
  const options: Array<{ value: Visibility; label: string; text: string; icon: React.ReactNode }> = [
    { value: 'private', label: '私人', text: '只有你看得到', icon: <LockKeyhole size={15} /> },
    { value: 'public', label: '公開', text: '會出現在公共日誌', icon: <Globe2 size={15} /> },
    { value: 'unlisted', label: '未列出', text: '知道連結才能閱讀', icon: <Link2 size={15} /> },
  ]
  return <fieldset className="form-field visibility-field"><legend>可見性</legend><div className="visibility-options">{options.map((item) => <button type="button" key={item.value} className={`visibility-option ${value === item.value ? 'is-selected' : ''}`} onClick={() => onChange(item.value)} aria-pressed={value === item.value}>{item.icon}<span><strong>{item.label}</strong><small>{item.text}</small></span></button>)}</div></fieldset>
}

function PreviewPage({ entry, user, authorBanned, onBack, onEdit, onReport }: { entry: JournalEntry | null; user: User | null; authorBanned: boolean; onBack: () => void; onEdit: (id: string) => void; onReport: (id: string) => void }) {
  if (!entry) return <PageContainer><EmptyJournalState title="找不到這篇日誌" text="它可能已經被封存，或連結已經失效。" onCreate={onBack} /></PageContainer>
  const own = user?.id === entry.authorId
  const canRead = own || !authorBanned && entry.status === 'published' && (entry.visibility === 'public' || entry.visibility === 'unlisted') || user?.role === 'admin'
  if (!canRead) return <PageContainer><div className="permission-state"><LockKeyhole size={28} /><h2>這是一篇私人日誌</h2><p>只有作者可以閱讀這裡的內容。</p><Button variant="outline" onClick={onBack}><ArrowLeft size={16} />返回</Button></div></PageContainer>
  return <PageContainer className="preview-page"><div className="preview-toolbar"><Button variant="text" onClick={onBack}><ArrowLeft size={16} />返回列表</Button><div className="button-row">{own && <Button variant="outline" onClick={() => onEdit(entry.id)}><Pencil size={15} />編輯</Button>}{!own && <Button variant="text" onClick={() => onReport(entry.id)}><Flag size={15} />檢舉</Button>}<Button variant="text" onClick={() => navigator.clipboard?.writeText(window.location.href)}><Link2 size={15} />複製連結</Button></div></div><article className="entry-reading"><div className="entry-heading"><span className="entry-date"><CalendarDays size={16} />{formatLongDate(entry.entryDate)}</span><span className={`visibility-badge visibility-${entry.visibility}`}>{entry.visibility}</span><h1>{entry.title}</h1><div className="entry-byline"><span>{entry.authorName}</span><span>·</span><span>{entry.mood} {moodOptions.find((item) => item.value === entry.mood)?.icon}</span></div></div><div className="entry-content">{entry.content.split('\n').map((paragraph, index) => <p key={`${entry.id}-${index}`}>{paragraph || '\u00a0'}</p>)}</div><div className="entry-footer"><div className="tag-row">{entry.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div><span>最後更新於 {formatDate(entry.updatedAt.slice(0, 10))}</span></div></article></PageContainer>
}

function AuthPage({ mode, onSubmit, onSwitch }: { mode: 'login' | 'register'; onSubmit: (values: { email: string; password: string; displayName: string; username: string }) => void; onSwitch: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  return <PageContainer className="auth-page"><div className="auth-card"><div className="auth-mark"><BookOpen size={25} /></div><span className="eyebrow">{mode === 'login' ? 'WELCOME BACK' : 'A NEW PAGE'}</span><h1>{mode === 'login' ? '登入你的日誌' : '建立一個帳號'}</h1><p>{mode === 'login' ? '回到你留下的每一段日子。' : '準備一個只屬於你的書寫空間。'}</p><form onSubmit={(event) => { event.preventDefault(); if (email && password) onSubmit({ email, password, displayName, username }) }}><label className="form-field"><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" /></label>{mode === 'register' && <div className="form-grid"><label className="form-field"><span>顯示名稱</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="你的名字" /></label><label className="form-field"><span>Username</span><input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="your-name" /></label></div>}<label className="form-field"><span>密碼</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required placeholder="至少 8 個字元" /></label><Button type="submit" variant="yellow" className="full-button"><LogIn size={16} />{mode === 'login' ? '登入' : '建立帳號'}</Button></form><button className="switch-auth" onClick={onSwitch}>{mode === 'login' ? '還沒有帳號？註冊' : '已經有帳號？登入'} <ArrowRight size={15} /></button><p className="auth-note">示範帳號可使用 demo@example.com；管理员权限只能由现有管理员授予。</p></div></PageContainer>
}

function SettingsPage({ user, onSave }: { user: User | null; onSave: (user: User) => void }) {
  const [values, setValues] = useState(user ?? { id: '', username: '', displayName: '', email: '', role: 'user' as const, bio: '' })
  return <PageContainer><PageTitle eyebrow="PERSONAL SETTINGS" title="個人設定" description="讓這個空間更像你的樣子。" /><form className="settings-form" onSubmit={(event) => { event.preventDefault(); onSave(values) }}><div className="settings-profile"><div className="avatar-placeholder"><UserRound size={30} /></div><div><h2>{values.displayName || '你的名字'}</h2><p>@{values.username || 'username'}</p></div></div><label className="form-field"><span>顯示名稱</span><input value={values.displayName} onChange={(event) => setValues({ ...values, displayName: event.target.value })} /></label><label className="form-field"><span>Username</span><input value={values.username} onChange={(event) => setValues({ ...values, username: event.target.value })} /></label><label className="form-field"><span>自我介紹</span><textarea value={values.bio} onChange={(event) => setValues({ ...values, bio: event.target.value })} rows={4} placeholder="留下一句關於你的話。" /></label><Button type="submit" variant="yellow"><Save size={16} />儲存設定</Button></form></PageContainer>
}

function TagsPage({ tags, entries, onOpen }: { tags: string[]; entries: JournalEntry[]; onOpen: (id: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const items = selected ? entries.filter((entry) => entry.tags.includes(selected)) : entries
  return <PageContainer><PageTitle eyebrow="TAGS" title="標籤列表" description="用一個詞，整理那些有重量的片段。" /><div className="tag-cloud">{tags.map((tag) => <button key={tag} className={selected === tag ? 'is-selected' : ''} onClick={() => setSelected(selected === tag ? null : tag)}>#{tag}</button>)}</div><JournalList entries={items} onOpen={onOpen} emptyTitle="這個標籤還沒有日誌" emptyText="換一個標籤看看。" /></PageContainer>
}

function AboutPage() {
  return <PageContainer className="about-page"><PageTitle eyebrow="ABOUT THIS SPACE" title="關於我" description="My Diary 是一個可以安靜記錄，也可以選擇分享的地方。" /><div className="about-grid"><div className="about-note"><Star size={23} fill="var(--accent-yellow)" /><p>有些日子適合被說出來，有些日子只需要被自己好好保存。</p></div><div className="about-copy"><p>這裡沒有追趕進度的通知，也沒有必須完成的清單。你可以把日誌留在私人空間，也可以讓一段文字成為公共日誌，和陌生人共享一點真實。</p><span>— 留一點空白，讓日子慢慢發生。</span></div></div></PageContainer>
}

type AdminTab = 'overview' | 'users' | 'entries' | 'reports'

function AdminPage({ user, users, reports, entries, onUpdateReport, onCreateUser, onSetUserStatus, onSetUserRole, onUpdatePassword, onDeleteUser, onModerateEntry, onViewEntry }: {
  user: User | null
  users: User[]
  reports: Report[]
  entries: JournalEntry[]
  onUpdateReport: (report: Report, status: Report['status']) => void
  onCreateUser: (values: { displayName: string; username: string; email: string; password: string; role: User['role'] }) => Promise<boolean>
  onSetUserStatus: (user: User, status: 'active' | 'banned', reason?: string) => Promise<void>
  onSetUserRole: (user: User, role: User['role']) => void
  onUpdatePassword: (user: User, password: string) => Promise<boolean>
  onDeleteUser: (user: User) => void
  onModerateEntry: (entry: JournalEntry, action: 'hide' | 'restore' | 'delete') => void
  onViewEntry: (id: string) => void
}) {
  const [tab, setTab] = useState<AdminTab>('overview')
  const [query, setQuery] = useState('')
  const [showUserForm, setShowUserForm] = useState(false)
  const [userForm, setUserForm] = useState({ displayName: '', username: '', email: '', password: '', role: 'user' as User['role'] })
  const [passwordTarget, setPasswordTarget] = useState<User | null>(null)
  const [passwordValue, setPasswordValue] = useState('')
  if (user?.role !== 'admin') return <PageContainer><div className="permission-state"><ShieldCheck size={28} /><h2>需要管理员权限</h2><p>这个区域只向管理员开放。</p></div></PageContainer>

  const openReports = reports.filter((report) => report.status !== 'resolved')
  const publicEntries = entries.filter((entry) => entry.status === 'published' && entry.visibility === 'public')
  const filteredUsers = users.filter((item) => `${item.displayName} ${item.username} ${item.email}`.toLowerCase().includes(query.toLowerCase()))
  const filteredEntries = entries.filter((item) => `${item.title} ${item.authorName} ${item.excerpt}`.toLowerCase().includes(query.toLowerCase()))
  const submitUser = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!await onCreateUser(userForm)) return
    setUserForm({ displayName: '', username: '', email: '', password: '', role: 'user' })
    setShowUserForm(false)
  }
  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!passwordTarget || !await onUpdatePassword(passwordTarget, passwordValue)) return
    setPasswordTarget(null)
    setPasswordValue('')
  }
  const tabItems: Array<{ id: AdminTab; label: string; icon: React.ReactNode; count?: number }> = [
    { id: 'overview', label: '总览', icon: <Settings2 size={16} /> },
    { id: 'users', label: '用户与权限', icon: <Users size={16} />, count: users.length },
    { id: 'entries', label: '文章管理', icon: <FileText size={16} />, count: entries.length },
    { id: 'reports', label: '检举处理', icon: <Flag size={16} />, count: openReports.length },
  ]
  return <PageContainer className="admin-page">
    <PageTitle eyebrow="ADMIN DESK" title="管理工作台" description="掌握账号、内容与公共空间的每一个角落。" action={<Button variant="yellow" onClick={() => { setTab('users'); setShowUserForm(true) }}><UserPlus size={16} />新增账号</Button>} />
    <nav className="admin-tabs" aria-label="管理区域">
      {tabItems.map((item) => <button key={item.id} className={`admin-tab ${tab === item.id ? 'is-active' : ''}`} onClick={() => setTab(item.id)}>{item.icon}<span>{item.label}</span>{typeof item.count === 'number' && <b>{item.count}</b>}</button>)}
    </nav>
    {tab === 'overview' && <section className="admin-overview">
      <div className="admin-summary"><div><span>注册用户</span><strong>{users.length}</strong><small><Users size={14} />全部账号</small></div><div><span>公开文章</span><strong>{publicEntries.length}</strong><small><FileText size={14} />正在展示</small></div><div><span>待处理检举</span><strong>{openReports.length}</strong><small className={openReports.length ? 'is-alert' : ''}><CircleAlert size={14} />需要留意</small></div></div>
      <div className="admin-overview-grid"><section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">QUICK ACCESS</span><h2>最近注册</h2></div><Button variant="text" onClick={() => setTab('users')}>查看全部 <ArrowRight size={15} /></Button></div><div className="admin-user-mini-list">{users.slice(0, 4).map((item) => <AdminUserLine key={item.id} user={item} compact />)}</div></section><section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">NEEDS ATTENTION</span><h2>最近检举</h2></div><Button variant="text" onClick={() => setTab('reports')}>处理检举 <ArrowRight size={15} /></Button></div>{openReports.slice(0, 3).map((report) => <div className="admin-activity" key={report.id}><Flag size={15} /><span>{report.title}</span><small>{report.status}</small></div>)}{!openReports.length && <p className="muted-copy">目前没有待处理事项，空间很安静。</p>}</section></div>
    </section>}
    {tab === 'users' && <section className="admin-section"><div className="admin-toolbar"><label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名、用户名或邮箱" /></label><Button variant="yellow" onClick={() => setShowUserForm((value) => !value)}><UserPlus size={16} />新增账号</Button></div>{showUserForm && <form className="admin-create-form" onSubmit={submitUser}><div className="panel-heading"><div><span className="eyebrow">NEW ACCOUNT</span><h2>添加一个新账号</h2></div><button className="icon-button" type="button" aria-label="关闭" onClick={() => setShowUserForm(false)}><X size={17} /></button></div><div className="form-grid"><label className="form-field"><span>显示名称</span><input required value={userForm.displayName} onChange={(event) => setUserForm({ ...userForm, displayName: event.target.value })} /></label><label className="form-field"><span>用户名</span><input value={userForm.username} onChange={(event) => setUserForm({ ...userForm, username: event.target.value })} /></label></div><div className="form-grid"><label className="form-field"><span>邮箱</span><input required type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} /></label><label className="form-field"><span>初始密码</span><input required minLength={8} type="password" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} placeholder="至少 8 位" /></label></div><label className="form-field"><span>角色</span><select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value as User['role'] })}><option value="user">普通用户</option><option value="admin">管理员</option></select></label><div className="modal-actions"><Button variant="text" onClick={() => setShowUserForm(false)}>取消</Button><Button type="submit" variant="yellow"><UserPlus size={15} />建立账号</Button></div></form>}<div className="admin-table-wrap"><div className="admin-table-head"><span>账号</span><span>角色</span><span>状态</span><span>加入时间</span><span>操作</span></div>{filteredUsers.map((item) => <AdminUserRow key={item.id} user={item} currentUserId={user.id} onSetStatus={onSetUserStatus} onSetRole={onSetUserRole} onChangePassword={(target) => { setPasswordTarget(target); setPasswordValue('') }} onDelete={onDeleteUser} />)}{!filteredUsers.length && <EmptyJournalState title="找不到账号" text="试试换一个搜索词。" />}</div></section>}
    {tab === 'entries' && <section className="admin-section"><div className="admin-toolbar"><label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索文章标题或作者" /></label><span className="muted-copy">{entries.length} 篇文章</span></div><div className="admin-table-wrap"><div className="admin-table-head admin-entry-head"><span>文章</span><span>作者</span><span>可见性</span><span>状态</span><span>操作</span></div>{filteredEntries.map((entry) => <AdminEntryRow key={entry.id} entry={entry} onModerate={onModerateEntry} onView={onViewEntry} />)}</div></section>}
    {tab === 'reports' && <section className="admin-section"><div className="section-heading"><h2>检举管理</h2><span className="muted-copy">{reports.length} 笔记录</span></div>{reports.length === 0 ? <EmptyJournalState title="目前没有检举" text="公共空间一切平静。" /> : <div className="report-list">{reports.map((report) => { const entry = entries.find((item) => item.id === report.entryId); return <article className="report-row" key={report.id}><div className="report-icon"><Flag size={17} /></div><div className="report-main"><strong>{report.title}</strong><span>{report.reason}</span><small>{formatDate(report.createdAt.slice(0, 10))}</small></div><span className={`report-status report-${report.status}`}>{report.status}</span><div className="report-actions">{report.status !== 'resolved' && <Button variant="outline" onClick={() => onUpdateReport(report, 'resolved')}><Check size={15} />完成</Button>}{entry && entry.status !== 'archived' && <Button variant="danger" onClick={() => onModerateEntry(entry, 'hide')}><Archive size={15} />隐藏</Button>}</div></article> })}</div>}</section>}
    {passwordTarget && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setPasswordTarget(null)}><form className="modal-card" onSubmit={submitPassword}><div className="modal-header"><h2>修改账号密码</h2><button className="icon-button" type="button" aria-label="关闭" onClick={() => setPasswordTarget(null)}><X size={18} /></button></div><p>正在修改「{passwordTarget.displayName}」的登录密码。</p><label className="form-field"><span>新密码</span><input required minLength={8} type="password" value={passwordValue} onChange={(event) => setPasswordValue(event.target.value)} placeholder="至少 8 位" autoFocus /></label><div className="modal-actions"><Button variant="text" onClick={() => setPasswordTarget(null)}>取消</Button><Button type="submit" variant="yellow"><KeyRound size={15} />保存密码</Button></div></form></div>}
  </PageContainer>
}

function AdminUserLine({ user, compact = false }: { user: User; compact?: boolean }) {
  return <div className={`admin-user-line ${compact ? 'is-compact' : ''}`}><span className="admin-avatar"><UserRound size={16} /></span><span><strong>{user.displayName}</strong><small>@{user.username} · {user.email}</small></span><em className={`user-status user-status-${user.status ?? 'active'}`}>{user.status === 'banned' ? '已暂停' : '正常'}</em></div>
}

function AdminUserRow({ user, currentUserId, onSetStatus, onSetRole, onChangePassword, onDelete }: { user: User; currentUserId: string; onSetStatus: (user: User, status: 'active' | 'banned') => void; onSetRole: (user: User, role: User['role']) => void; onChangePassword: (user: User) => void; onDelete: (user: User) => void }) {
  return <div className="admin-table-row"><AdminUserLine user={user} /><span className="role-badge"><ShieldCheck size={13} />{user.role === 'admin' ? '管理员' : '用户'}</span><span className={`user-status user-status-${user.status ?? 'active'}`}>{user.status === 'banned' ? '已暂停' : '正常'}</span><span className="table-date">{formatDate((user.createdAt ?? today).slice(0, 10))}</span><div className="table-actions"><button className="icon-button" title="修改密码" aria-label="修改密码" onClick={() => onChangePassword(user)}><KeyRound size={16} /></button>{user.id !== currentUserId && <>{user.status === 'banned' ? <button className="icon-button" title="恢复账号" aria-label="恢复账号" onClick={() => onSetStatus(user, 'active')}><UserCheck size={16} /></button> : <button className="icon-button" title="暂停账号" aria-label="暂停账号" onClick={() => onSetStatus(user, 'banned')}><Ban size={16} /></button>}<button className="icon-button" title={user.role === 'admin' ? '收回管理员权限' : '设为管理员'} aria-label={user.role === 'admin' ? '收回管理员权限' : '设为管理员'} onClick={() => onSetRole(user, user.role === 'admin' ? 'user' : 'admin')}><ShieldCheck size={16} /></button><button className="icon-button danger-icon" title="删除账号" aria-label="删除账号" onClick={() => onDelete(user)}><Trash2 size={16} /></button></>}</div></div>
}

function AdminEntryRow({ entry, onModerate, onView }: { entry: JournalEntry; onModerate: (entry: JournalEntry, action: 'hide' | 'restore' | 'delete') => void; onView: (id: string) => void }) {
  const hidden = entry.status === 'archived'
  return <div className="admin-table-row admin-entry-row"><span className="entry-cell"><FileText size={16} /><span><strong>{entry.title || '未命名文章'}</strong><small>{formatDate(entry.entryDate)}</small></span></span><span>{entry.authorName}</span><span>{entry.visibility}</span><span className={`entry-status entry-status-${entry.status}`}>{hidden ? '已隐藏' : entry.status === 'draft' ? '草稿' : '公开'}</span><div className="table-actions"><button className="icon-button" title="查看文章" aria-label="查看文章" onClick={() => onView(entry.id)}><Eye size={16} /></button>{hidden ? <button className="icon-button" title="恢复公开" aria-label="恢复公开" onClick={() => onModerate(entry, 'restore')}><RotateCcw size={16} /></button> : <button className="icon-button" title="隐藏文章" aria-label="隐藏文章" onClick={() => onModerate(entry, 'hide')}><Archive size={16} /></button>}<button className="icon-button danger-icon" title="删除文章" aria-label="删除文章" onClick={() => onModerate(entry, 'delete')}><Trash2 size={16} /></button></div></div>
}

function BanNoticeModal({ notice, onClose, onGoLogin }: { notice: BanNotice; onClose: () => void; onGoLogin: () => void }) {
  return <div className="modal-backdrop" role="presentation"><section className="modal-card ban-notice-card" role="dialog" aria-modal="true" aria-labelledby="ban-notice-title"><div className="modal-header"><div><span className="eyebrow">ACCOUNT ACTION</span><h2 id="ban-notice-title">账号已被暂停</h2></div><button className="icon-button" type="button" aria-label="关闭" onClick={onClose}><X size={18} /></button></div><p>账号「{notice.email}」目前无法登录、发布或管理内容。</p><div className="ban-reason"><strong>处理原因</strong><p>{notice.reason}</p></div><div className="ban-terms"><strong>社区使用条款</strong><p>请勿发布违法、骚扰、欺诈、侵犯他人隐私或违反平台规则的内容。账号被暂停后，相关内容可能会被隐藏。</p></div><div className="modal-actions"><Button variant="text" onClick={onClose}>知道了</Button><Button variant="yellow" onClick={onGoLogin}><LogIn size={15} />返回登录</Button></div></section></div>
}

function ReportModal({ entry, onClose, onSubmit }: { entry: JournalEntry | null; onClose: () => void; onSubmit: (entry: JournalEntry, reason: string) => void }) {
  const [reason, setReason] = useState('內容可能包含個人資訊')
  if (!entry) return null
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="report-title"><div className="modal-header"><h2 id="report-title">檢舉這篇日誌</h2><button className="icon-button" aria-label="關閉" onClick={onClose}><X size={18} /></button></div><p>你正在回報「{entry.title}」。請選擇最接近的原因。</p><label className="form-field"><span>檢舉原因</span><select value={reason} onChange={(event) => setReason(event.target.value)}><option>內容可能包含個人資訊</option><option>不適當或令人不舒服</option><option>疑似垃圾內容</option><option>其他</option></select></label><div className="modal-actions"><Button variant="text" onClick={onClose}>取消</Button><Button variant="yellow" onClick={() => onSubmit(entry, reason)}><Flag size={15} />送出檢舉</Button></div></section></div>
}

export default App
