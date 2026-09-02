import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { initLicenseTables } from './license.js';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_DATA_DIR = path.join(DATA_DIR, 'users');
if (!fs.existsSync(USERS_DATA_DIR)) {
  fs.mkdirSync(USERS_DATA_DIR, { recursive: true });
}

// Master System DB for Global Licensing & Orders
const SYSTEM_DB_PATH = path.join(DATA_DIR, 'system_master.db');
let systemDbInstance: DatabaseSync | null = null;

// Cache map of active per-user SQLite database instances
const userDbInstances = new Map<string, DatabaseSync>();

export function sanitizeUserId(userId?: string): string {
  if (!userId) return 'default_user';
  const cleaned = String(userId)
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .substring(0, 64);
  return cleaned || 'default_user';
}

export function getSystemDatabase(): DatabaseSync {
  if (!systemDbInstance) {
    systemDbInstance = new DatabaseSync(SYSTEM_DB_PATH);
  }
  return systemDbInstance;
}

export function getUserDatabasePath(userId?: string): string {
  const cleanId = sanitizeUserId(userId);
  return path.join(USERS_DATA_DIR, `user_${cleanId}.db`);
}

export function getUserDatabaseFilename(userId?: string): string {
  const cleanId = sanitizeUserId(userId);
  const shortId = cleanId.length > 18 ? cleanId.substring(0, 18) : cleanId;
  return `xtream_user_${shortId}.db`;
}

export function getUserDatabase(userId?: string): DatabaseSync {
  const cleanId = sanitizeUserId(userId);
  let db = userDbInstances.get(cleanId);
  if (!db) {
    const dbFilePath = getUserDatabasePath(cleanId);
    db = new DatabaseSync(dbFilePath);
    initTables(db);
    userDbInstances.set(cleanId, db);
  }
  return db;
}

export function getDatabase(userId?: string): DatabaseSync {
  return getUserDatabase(userId);
}

export function getDatabasePath(userId?: string): string {
  return getUserDatabasePath(userId);
}

// Initialize system tables and default license store on startup
try {
  const sysDb = getSystemDatabase();
  initLicenseTables(sysDb);
} catch (e) {
  console.error('System DB init error:', e);
}

function initTables(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT NOT NULL,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      status TEXT NOT NULL,
      is_valid INTEGER DEFAULT 0,
      exp_date TEXT,
      max_connections INTEGER DEFAULT 0,
      active_cons INTEGER DEFAULT 0,
      is_trial INTEGER DEFAULT 0,
      server_name TEXT,
      timezone TEXT,
      response_time_ms INTEGER DEFAULT 0,
      last_checked TEXT NOT NULL,
      raw_data TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(domain, username, password) ON CONFLICT REPLACE
    );
    CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
    CREATE INDEX IF NOT EXISTS idx_accounts_valid ON accounts(is_valid);
    CREATE INDEX IF NOT EXISTS idx_accounts_domain ON accounts(domain);
  `);
}

export interface SaveAccountInput {
  domain: string;
  username: string;
  password: string;
  status: string;
  is_valid: boolean;
  exp_date?: string;
  max_connections?: number;
  active_cons?: number;
  is_trial?: boolean;
  server_name?: string;
  timezone?: string;
  response_time_ms?: number;
  raw_data?: any;
}

export function saveAccountToDb(account: SaveAccountInput, userId?: string): number {
  const db = getUserDatabase(userId);
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  const stmt = db.prepare(`
    INSERT INTO accounts (
      domain, username, password, status, is_valid,
      exp_date, max_connections, active_cons, is_trial,
      server_name, timezone, response_time_ms, last_checked, raw_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    account.domain,
    account.username,
    account.password,
    account.status || 'Unknown',
    account.is_valid ? 1 : 0,
    account.exp_date || '',
    account.max_connections || 0,
    account.active_cons || 0,
    account.is_trial ? 1 : 0,
    account.server_name || '',
    account.timezone || '',
    account.response_time_ms || 0,
    now,
    JSON.stringify(account.raw_data || {})
  );

  return Number(result.lastInsertRowid || 0);
}

export function getAccounts(
  filter?: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC' | 'asc' | 'desc';
  },
  userId?: string
) {
  const db = getUserDatabase(userId);
  let query = 'SELECT * FROM accounts WHERE 1=1';
  const params: any[] = [];

  if (filter?.status && filter.status !== 'All') {
    if (filter.status === 'Valid') {
      query += ' AND is_valid = 1';
    } else if (filter.status === 'Invalid') {
      query += ' AND is_valid = 0';
    } else if (filter.status === 'Trial') {
      query += ' AND is_trial = 1';
    } else {
      query += ' AND status = ?';
      params.push(filter.status);
    }
  }

  if (filter?.search) {
    query += ' AND (domain LIKE ? OR username LIKE ? OR server_name LIKE ?)';
    const s = `%${filter.search}%`;
    params.push(s, s, s);
  }

  // Handle sorting
  const sortDirection = filter?.sortOrder && filter.sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const sortBy = filter?.sortBy?.toLowerCase() || 'id';

  let orderClause = 'id DESC';
  if (sortBy === 'domain' || sortBy === 'name' || sortBy === 'host') {
    orderClause = `domain COLLATE NOCASE ${sortDirection}, username COLLATE NOCASE ASC`;
  } else if (sortBy === 'username' || sortBy === 'user') {
    orderClause = `username COLLATE NOCASE ${sortDirection}, domain COLLATE NOCASE ASC`;
  } else if (sortBy === 'max_connections' || sortBy === 'connections' || sortBy === 'max_con') {
    orderClause = `max_connections ${sortDirection}, id DESC`;
  } else if (sortBy === 'exp_date' || sortBy === 'expire') {
    orderClause = `CASE WHEN exp_date IS NULL OR exp_date = '' OR exp_date = '-' THEN 1 ELSE 0 END, exp_date ${sortDirection}, id DESC`;
  } else if (sortBy === 'status' || sortBy === 'is_valid') {
    orderClause = `is_valid ${sortDirection}, status ${sortDirection}, id DESC`;
  } else if (sortBy === 'response_time_ms' || sortBy === 'latency') {
    orderClause = `response_time_ms ${sortDirection}, id DESC`;
  } else if (sortBy === 'last_checked' || sortBy === 'checked_at') {
    orderClause = `last_checked ${sortDirection}, id DESC`;
  } else if (sortBy === 'id' || sortBy === 'created_at') {
    orderClause = `id ${sortDirection}`;
  }

  query += ` ORDER BY ${orderClause}`;

  if (filter?.limit) {
    query += ' LIMIT ?';
    params.push(filter.limit);
    if (filter?.offset) {
      query += ' OFFSET ?';
      params.push(filter.offset);
    }
  }

  const stmt = db.prepare(query);
  const rows = stmt.all(...params) as any[];
  return rows.map(r => ({
    ...r,
    is_valid: Boolean(r.is_valid),
    is_trial: Boolean(r.is_trial),
    raw_data: r.raw_data ? safeJsonParse(r.raw_data) : null
  }));
}

export function deleteAccountById(id: number | string, userId?: string): boolean {
  const db = getUserDatabase(userId);
  const numId = Number(id);
  if (isNaN(numId)) return false;
  const stmt = db.prepare('DELETE FROM accounts WHERE id = ?');
  const res = stmt.run(numId);
  return Number(res.changes) > 0;
}

export function deleteAccountsBulk(ids: (number | string)[], userId?: string): number {
  const cleanIds = ids.map(Number).filter(n => !isNaN(n));
  if (!cleanIds.length) return 0;
  const db = getUserDatabase(userId);
  const placeholders = cleanIds.map(() => '?').join(',');
  const stmt = db.prepare(`DELETE FROM accounts WHERE id IN (${placeholders})`);
  const res = stmt.run(...cleanIds);
  return Number(res.changes);
}

export function clearAllAccounts(userId?: string): void {
  const db = getUserDatabase(userId);
  db.exec('DELETE FROM accounts;');
  try {
    db.exec('VACUUM;');
  } catch {
    // ignore vacuum failure if busy
  }
}

export function getDatabaseStats(userId?: string) {
  const cleanId = sanitizeUserId(userId);
  const db = getUserDatabase(cleanId);
  const total = Number((db.prepare('SELECT COUNT(*) as count FROM accounts').get() as any)?.count || 0);
  const valid = Number((db.prepare('SELECT COUNT(*) as count FROM accounts WHERE is_valid = 1').get() as any)?.count || 0);
  const expired = Number((db.prepare("SELECT COUNT(*) as count FROM accounts WHERE status = 'Expired'").get() as any)?.count || 0);
  const invalid = Number((db.prepare('SELECT COUNT(*) as count FROM accounts WHERE is_valid = 0').get() as any)?.count || 0);
  const totalMaxConnections = Number((db.prepare('SELECT SUM(max_connections) as total_cons FROM accounts WHERE is_valid = 1').get() as any)?.total_cons || 0);

  // Expiring in next 7 days
  const nowStr = new Date().toISOString().substring(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10);
  const expiringSoon = Number((db.prepare("SELECT COUNT(*) as count FROM accounts WHERE is_valid = 1 AND exp_date != '' AND exp_date != 'Unlimited' AND exp_date >= ? AND exp_date <= ?").get(nowStr, nextWeek) as any)?.count || 0);

  return {
    total,
    valid,
    expired,
    invalid,
    expiringSoon,
    totalMaxConnections,
    userId: cleanId,
    dbFilename: getUserDatabaseFilename(cleanId)
  };
}

function safeJsonParse(val: string) {
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}

