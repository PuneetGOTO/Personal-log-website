import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataFile = path.join(root, 'data', 'app.json')

let password = ''
for await (const chunk of process.stdin) password += chunk
password = password.trim()

if (password.length < 8) {
  console.error('Password must be at least 8 characters.')
  process.exit(1)
}
if (!fs.existsSync(dataFile)) {
  console.error(`Data file not found: ${dataFile}`)
  process.exit(1)
}

const db = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
const admin = db.users.find((user) => user.id === 'admin-user' || user.role === 'admin')
if (!admin) {
  console.error('No administrator account found.')
  process.exit(1)
}

const salt = crypto.randomBytes(16).toString('hex')
admin.passwordSalt = salt
admin.passwordHash = crypto.scryptSync(password, salt, 64).toString('hex')
delete admin.hash
delete admin.salt
admin.lastSeenAt = new Date().toISOString()

const temporary = `${dataFile}.tmp`
fs.writeFileSync(temporary, JSON.stringify(db, null, 2), { mode: 0o600 })
fs.renameSync(temporary, dataFile)
console.log(`Administrator password reset for ${admin.email}. Restart the service to invalidate existing sessions.`)
