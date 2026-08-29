import { getDatabase } from './db.js';
import crypto from 'crypto';

export interface LicenseRecord {
  key: string;
  tier: 'standard' | 'pro_vip';
  email: string;
  max_devices: number;
  created_at: string;
  status: 'active' | 'banned' | 'expired';
  payment_method: string;
  payment_ref: string;
  notes?: string;
}

export interface LicenseDeviceRecord {
  id: number;
  license_key: string;
  device_hwid: string;
  device_name: string;
  last_ip: string;
  last_seen_at: string;
  created_at: string;
}

export function initLicenseTables() {
  const db = getDatabase();
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS licenses (
      key TEXT PRIMARY KEY,
      tier TEXT NOT NULL,
      email TEXT NOT NULL,
      max_devices INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      status TEXT DEFAULT 'active',
      payment_method TEXT DEFAULT 'crypto',
      payment_ref TEXT DEFAULT '',
      notes TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS license_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_key TEXT NOT NULL,
      device_hwid TEXT NOT NULL,
      device_name TEXT DEFAULT 'Browser / PC',
      last_ip TEXT DEFAULT '',
      last_seen_at TEXT DEFAULT (datetime('now', 'localtime')),
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(license_key, device_hwid) ON CONFLICT REPLACE
    );

    CREATE TABLE IF NOT EXISTS license_access_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_key TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      hwid TEXT DEFAULT '',
      timestamp INTEGER NOT NULL,
      action TEXT DEFAULT 'verify'
    );

    CREATE INDEX IF NOT EXISTS idx_logs_key_time ON license_access_logs(license_key, timestamp);
    CREATE INDEX IF NOT EXISTS idx_dev_key ON license_devices(license_key);
  `);

  // Seed default master owner licenses if they don't exist
  seedMasterLicenses(db);
}

function seedMasterLicenses(db: any) {
  try {
    const ownerKey = 'XVAL-90TECH-VIP-2026';
    const checkStmt = db.prepare('SELECT key FROM licenses WHERE key = ?');
    const existing = checkStmt.get(ownerKey);

    if (!existing) {
      const insertStmt = db.prepare(`
        INSERT INTO licenses (key, tier, email, max_devices, created_at, status, payment_method, payment_ref, notes)
        VALUES (?, ?, ?, ?, datetime('now', 'localtime'), 'active', 'owner_seed', 'MASTER-KEY', 'Official Owner VIP License')
      `);
      insertStmt.run(ownerKey, 'pro_vip', 'Mr90tech@gmail.com', 10);
      
      // Also seed a standard demo key for testing
      const stdKey = 'XVAL-STD-DEMO-2026';
      insertStmt.run(stdKey, 'standard', 'demo@user.com', 1);
    }
  } catch (err) {
    console.error('License seed error:', err);
  }
}

/**
 * Validates or activates a license for a specific HWID with device-limit & multi-IP abuse checks
 */
export function verifyOrActivateLicense(params: {
  key: string;
  hwid: string;
  deviceName?: string;
  ip: string;
}): {
  success: boolean;
  tier?: 'standard' | 'pro_vip';
  maxDevices?: number;
  devicesCount?: number;
  devices?: Array<{ hwid: string; name: string; lastSeen: string; isCurrent: boolean }>;
  error?: string;
  license?: LicenseRecord;
} {
  const db = getDatabase();
  const rawKey = (params.key || '').trim().toUpperCase();
  const hwid = (params.hwid || '').trim();
  const ip = (params.ip || '127.0.0.1').trim();
  const deviceName = (params.deviceName || 'Web Browser').trim();

  if (!rawKey) {
    return { success: false, error: 'License key is required.' };
  }
  if (!hwid) {
    return { success: false, error: 'Device Hardware ID (HWID) fingerprint is missing.' };
  }

  // 1. Fetch license
  const licStmt = db.prepare('SELECT * FROM licenses WHERE key = ?');
  const license = licStmt.get(rawKey) as unknown as LicenseRecord | undefined;

  if (!license) {
    return { success: false, error: 'Invalid license key. Please verify or upgrade to Pro.' };
  }

  if (license.status === 'banned') {
    return {
      success: false,
      error: 'This license key has been suspended due to policy violations (excessive IP sharing). Contact support.'
    };
  }

  if (license.status === 'expired') {
    return { success: false, error: 'This license has expired. Please renew your subscription.' };
  }

  // 2. Abuse Protection: Check if > 10 distinct IPs accessed this key in the last 1 hour (3600000 ms)
  const oneHourAgo = Date.now() - 3600 * 1000;
  
  // Log current access
  const logStmt = db.prepare(`
    INSERT INTO license_access_logs (license_key, ip_address, hwid, timestamp, action)
    VALUES (?, ?, ?, ?, 'verify')
  `);
  logStmt.run(rawKey, ip, hwid, Date.now());

  // Count distinct IPs in last 1 hour
  const ipCountStmt = db.prepare(`
    SELECT COUNT(DISTINCT ip_address) as distinct_ips 
    FROM license_access_logs 
    WHERE license_key = ? AND timestamp > ?
  `);
  const ipResult = ipCountStmt.get(rawKey, oneHourAgo) as unknown as { distinct_ips: number } | undefined;
  const distinctIps = ipResult ? Number(ipResult.distinct_ips) : 1;

  if (distinctIps > 10 && license.key !== 'XVAL-90TECH-VIP-2026') {
    // Auto-ban key for multi-IP sharing abuse
    const banStmt = db.prepare("UPDATE licenses SET status = 'banned', notes = 'Auto-banned: >10 IPs/hour detected' WHERE key = ?");
    banStmt.run(rawKey);
    return {
      success: false,
      error: `License automatically locked: Excessive multi-location IP traffic detected (${distinctIps} different IPs in 1h). Sharing license keys is strictly prohibited.`
    };
  }

  // 3. Check registered devices
  const devListStmt = db.prepare('SELECT * FROM license_devices WHERE license_key = ? ORDER BY id ASC');
  let devices = devListStmt.all(rawKey) as unknown as LicenseDeviceRecord[];

  const existingDevice = devices.find(d => d.device_hwid === hwid);
  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

  if (existingDevice) {
    // Update last seen & IP
    const updateDevStmt = db.prepare(`
      UPDATE license_devices 
      SET last_seen_at = ?, last_ip = ?, device_name = ?
      WHERE id = ?
    `);
    updateDevStmt.run(nowStr, ip, deviceName, existingDevice.id);
  } else {
    // New device wants to bind
    if (devices.length >= license.max_devices) {
      return {
        success: false,
        error: `Device limit reached (${devices.length}/${license.max_devices} allowed). Your ${license.tier === 'pro_vip' ? 'VIP (3 devices)' : 'Standard (1 device)'} plan has reached maximum active slots. Please disconnect an old device to use this device.`,
        devices: devices.map(d => ({
          hwid: d.device_hwid,
          name: d.device_name,
          lastSeen: d.last_seen_at,
          isCurrent: false
        })),
        maxDevices: license.max_devices,
        devicesCount: devices.length,
        tier: license.tier
      };
    }

    // Register new device
    const insertDevStmt = db.prepare(`
      INSERT INTO license_devices (license_key, device_hwid, device_name, last_ip, last_seen_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertDevStmt.run(rawKey, hwid, deviceName, ip, nowStr, nowStr);

    // Refresh devices list
    devices = devListStmt.all(rawKey) as unknown as LicenseDeviceRecord[];
  }

  return {
    success: true,
    tier: license.tier,
    maxDevices: license.max_devices,
    devicesCount: devices.length,
    license,
    devices: devices.map(d => ({
      hwid: d.device_hwid,
      name: d.device_name,
      lastSeen: d.last_seen_at,
      isCurrent: d.device_hwid === hwid
    }))
  };
}

/**
 * Disconnects / unbinds a specific device HWID so the user can register a new one
 */
export function disconnectDevice(key: string, hwid: string): boolean {
  const db = getDatabase();
  const rawKey = (key || '').trim().toUpperCase();
  const cleanHwid = (hwid || '').trim();

  const stmt = db.prepare('DELETE FROM license_devices WHERE license_key = ? AND device_hwid = ?');
  const res = stmt.run(rawKey, cleanHwid);
  return Number(res.changes || 0) > 0;
}

/**
 * Generates and saves a new license key upon payment or manual issue
 */
export function createNewLicense(params: {
  tier: 'standard' | 'pro_vip';
  email: string;
  paymentMethod: string;
  paymentRef?: string;
  maxDevices?: number;
  notes?: string;
}): LicenseRecord {
  const db = getDatabase();
  const prefix = params.tier === 'pro_vip' ? 'XVAL-VIP' : 'XVAL-STD';
  const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
  const yearPart = new Date().getFullYear();
  const key = `${prefix}-${randomPart}-${yearPart}`;
  
  const maxDevices = params.maxDevices || (params.tier === 'pro_vip' ? 3 : 1);
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const stmt = db.prepare(`
    INSERT INTO licenses (key, tier, email, max_devices, created_at, status, payment_method, payment_ref, notes)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)
  `);

  stmt.run(
    key,
    params.tier,
    params.email.trim(),
    maxDevices,
    now,
    params.paymentMethod,
    params.paymentRef || '',
    params.notes || ''
  );

  return {
    key,
    tier: params.tier,
    email: params.email,
    max_devices: maxDevices,
    created_at: now,
    status: 'active',
    payment_method: params.paymentMethod,
    payment_ref: params.paymentRef || '',
    notes: params.notes || ''
  };
}

/**
 * Retrieve all licenses for admin / owner overview
 */
export function getAllLicenses(): Array<LicenseRecord & { devices_count: number }> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT l.*, COUNT(d.id) as devices_count
    FROM licenses l
    LEFT JOIN license_devices d ON l.key = d.license_key
    GROUP BY l.key
    ORDER BY l.created_at DESC
  `);
  return stmt.all() as any;
}
