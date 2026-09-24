import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import initSqlJs from 'sql.js'
import type Database from 'better-sqlite3'
import { migrateExistingTables, seedInitialDataIfEmpty } from '../../src/main/database/db'

// Initialize SQL.js WebAssembly instance (supported natively in modern Vite/Vitest)
const SQL = await initSqlJs()

function normalizeParams(params: any[]): any {
  if (params.length === 0) return []
  if (params.length === 1 && typeof params[0] === 'object' && params[0] !== null && !Array.isArray(params[0])) {
    const obj = params[0]
    const normalized: Record<string, any> = {}
    for (const [k, v] of Object.entries(obj)) {
      const val = v === undefined ? null : v
      normalized[k] = val
      if (!k.startsWith('@') && !k.startsWith(':') && !k.startsWith('$')) {
        normalized[`@${k}`] = val
        normalized[`:${k}`] = val
        normalized[`$${k}`] = val
      }
    }
    return normalized
  }
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0].map((v) => (v === undefined ? null : v))
  }
  return params.map((v) => (v === undefined ? null : v))
}

/**
 * Creates an in-memory BetterSqlite3-compatible wrapper around sql.js
 * in case the native C++ addon has an ABI mismatch with the host Node version.
 */
class WasmBetterSqliteAdapter {
  private sqlDb: any
  public open = true

  constructor() {
    this.sqlDb = new SQL.Database()
  }

  pragma(source: string): any {
    const trimmed = source.trim()
    if (trimmed.toLowerCase().startsWith('table_info')) {
      const match = trimmed.match(/table_info\s*\(\s*['"]?([a-zA-Z0-9_]+)['"]?\s*\)/i)
      if (match) {
        const tableName = match[1]
        const res = this.sqlDb.exec(`PRAGMA table_info(${tableName});`)
        if (!res || res.length === 0) return []
        const cols = res[0].columns
        return res[0].values.map((row: any[]) => {
          const obj: any = {}
          cols.forEach((col: string, idx: number) => {
            obj[col] = row[idx]
          })
          return obj
        })
      }
    }

    try {
      this.sqlDb.run(`PRAGMA ${source};`)
    } catch {
      // ignore pragma warnings
    }
    return []
  }

  exec(source: string): this {
    this.sqlDb.run(source)
    return this
  }

  prepare(source: string) {
    const db = this.sqlDb

    return {
      run: (...args: any[]) => {
        const params = normalizeParams(args)
        const stmt = db.prepare(source)
        try {
          stmt.bind(params)
          stmt.step()
          const changes = db.getRowsModified()
          return { changes, lastInsertRowid: 1 }
        } finally {
          stmt.free()
        }
      },
      get: (...args: any[]) => {
        const params = normalizeParams(args)
        const stmt = db.prepare(source)
        try {
          stmt.bind(params)
          if (stmt.step()) {
            return stmt.getAsObject()
          }
          return undefined
        } finally {
          stmt.free()
        }
      },
      all: (...args: any[]) => {
        const params = normalizeParams(args)
        const stmt = db.prepare(source)
        const rows: any[] = []
        try {
          stmt.bind(params)
          while (stmt.step()) {
            rows.push(stmt.getAsObject())
          }
          return rows
        } finally {
          stmt.free()
        }
      }
    }
  }

  transaction(fn: (...args: any[]) => any) {
    return (...args: any[]) => {
      this.sqlDb.run('BEGIN TRANSACTION;')
      try {
        const res = fn(...args)
        this.sqlDb.run('COMMIT;')
        return res
      } catch (err) {
        this.sqlDb.run('ROLLBACK;')
        throw err
      }
    }
  }

  close(): this {
    if (this.open) {
      this.sqlDb.close()
      this.open = false
    }
    return this
  }
}

/**
 * Creates an isolated in-memory SQLite database instance for testing.
 * Automatically executes the full schema.sql and applies migrateExistingTables.
 * Supports both native better-sqlite3 and pure wasm SQLite.
 */
export function createTestDatabase(withSeeds = false): Database.Database {
  let db: any = null

  try {
    const BetterSqlite = require('better-sqlite3')
    db = new BetterSqlite(':memory:')
  } catch {
    // Fallback to Wasm adapter when native addon has an ABI mismatch
    db = new WasmBetterSqliteAdapter()
  }

  db.pragma('foreign_keys = ON')

  const candidatePaths = [
    resolve(__dirname, '../../src/main/database/schema.sql'),
    resolve(process.cwd(), 'src/main/database/schema.sql')
  ]

  let schemaApplied = false
  for (const schemaPath of candidatePaths) {
    if (existsSync(schemaPath)) {
      const ddl = readFileSync(schemaPath, 'utf-8')
      db.exec(ddl)
      schemaApplied = true
      break
    }
  }

  if (!schemaApplied) {
    throw new Error('Could not locate schema.sql to initialize test database')
  }

  // Run schema migration checks and dynamic column alterations
  migrateExistingTables(db as Database.Database)

  if (withSeeds) {
    seedInitialDataIfEmpty(db as Database.Database)
  }

  return db as Database.Database
}

/**
 * Helper to seed a test patient into the in-memory database
 */
export function seedTestPatient(
  db: Database.Database,
  overrides?: {
    id?: string
    patientNumber?: string
    firstName?: string
    lastName?: string
    phone?: string
    wilaya?: string
  }
) {
  const id = overrides?.id || 'pat-test-101'
  const patientNumber = overrides?.patientNumber || 'DZ-2026-0101'
  const firstName = overrides?.firstName || 'Karim'
  const lastName = overrides?.lastName || 'Boudiaf'
  const phone = overrides?.phone || '0555123456'
  const wilaya = overrides?.wilaya || 'Alger'
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO patients (id, patientNumber, firstName, lastName, phone, wilaya, bloodGroup, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, 'A+', ?, ?)
  `).run(id, patientNumber, firstName, lastName, phone, wilaya, now, now)

  return { id, patientNumber, firstName, lastName, phone, wilaya }
}
