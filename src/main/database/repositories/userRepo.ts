import Database from 'better-sqlite3'
import { User } from '@shared/types'
import { hashPassword } from '../db'

export class UserRepository {
  constructor(private db: Database.Database) {}

  getAll(): User[] {
    const stmt = this.db.prepare(`
      SELECT id, username, fullName, role, active, createdAt, updatedAt, deletedAt
      FROM users
      WHERE deletedAt IS NULL
      ORDER BY role ASC, fullName ASC
    `)
    return stmt.all() as User[]
  }

  getById(id: string): User | null {
    const stmt = this.db.prepare(`
      SELECT id, username, fullName, role, active, createdAt, updatedAt, deletedAt
      FROM users
      WHERE id = ? AND deletedAt IS NULL
    `)
    return (stmt.get(id) as User) || null
  }

  findByUsername(username: string): (User & { passwordHash: string }) | null {
    const stmt = this.db.prepare(`
      SELECT * FROM users
      WHERE username = ? AND deletedAt IS NULL AND active = 1
    `)
    return (stmt.get(username) as (User & { passwordHash: string })) || null
  }

  verifyCredentials(username: string, rawPassword: string): User | null {
    const user = this.findByUsername(username)
    if (!user) return null

    const expectedHash = hashPassword(rawPassword)
    if (user.passwordHash === expectedHash) {
      const { passwordHash: _, ...safeUser } = user
      return safeUser
    }
    return null
  }
}
