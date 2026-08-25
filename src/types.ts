export type Visibility = 'private' | 'public' | 'unlisted'
export type EntryStatus = 'draft' | 'published' | 'archived'
export type UserRole = 'user' | 'admin'
export type UserStatus = 'active' | 'banned'
export type UserRoleSource = 'seeded' | 'granted'

export type JournalEntry = {
  id: string
  authorId: string
  authorName: string
  title: string
  content: string
  excerpt: string
  mood: string
  entryDate: string
  /** Approximate region detected from the request IP; raw IPs are never stored. */
  location?: string
  visibility: Visibility
  status: EntryStatus
  tags: string[]
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export type User = {
  id: string
  username: string
  displayName: string
  email: string
  role: UserRole
  roleSource?: UserRoleSource
  bio: string
  password?: string
  status?: UserStatus
  banReason?: string
  createdAt?: string
  lastSeenAt?: string
}

export type Report = {
  id: string
  entryId: string
  title: string
  reason: string
  status: 'open' | 'reviewing' | 'resolved'
  createdAt: string
}

export type View =
  | 'home'
  | 'public'
  | 'mine'
  | 'new'
  | 'edit'
  | 'preview'
  | 'drafts'
  | 'settings'
  | 'tags'
  | 'about'
  | 'admin'
  | 'login'
  | 'register'
