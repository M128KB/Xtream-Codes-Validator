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

export interface PaymentOrderRecord {
  id: number;
  order_id: string;
  email: string;
  tier: 'standard' | 'pro_vip';
  amount_usd: number;
  payment_type: 'okx_internal' | 'okx_trc20';
  tx_hash: string;
  status: 'pending' | 'approved' | 'rejected';
  license_key: string | null;
  created_at: string;
  notes: string;
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

    CREATE TABLE IF NOT EXISTS payment_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      tier TEXT NOT NULL,
      amount_usd REAL NOT NULL,
      payment_type TEXT NOT NULL,
      tx_hash TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      license_key TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      notes TEXT DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_logs_key_time ON license_access_logs(license_key, timestamp);
    CREATE INDEX IF NOT EXISTS idx_dev_key ON license_devices(license_key);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON payment_orders(status);
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

export const TARGET_TRC20_WALLET = 'TQEVdoX82yQsj5gS9N8p52cH2panqUHTK3';
export const TARGET_OKX_EMAIL = 'm.128kb@gmail.com';

/**
 * Verifies on-chain Tron USDT (TRC-20) transaction using TronGrid public API
 */
export async function verifyTronTrc20Transaction(txHash: string, expectedUsd: number): Promise<{
  valid: boolean;
  amount?: number;
  from?: string;
  to?: string;
  error?: string;
}> {
  const cleanTx = (txHash || '').trim().replace(/^0x/, '');
  if (!cleanTx || cleanTx.length < 32) {
    return { valid: false, error: 'Invalid TRON transaction hash format.' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const url = `https://api.trongrid.io/v1/transactions/${cleanTx}/events`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return { valid: false, error: `TronGrid API returned HTTP ${res.status}` };
    }

    const data = (await res.json()) as any;
    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      return { valid: false, error: 'Transaction not found or has not confirmed yet on TRON.' };
    }

    // Look for Transfer event for USDT contract TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
    const transferEvent = data.data.find((e: any) => {
      return (
        e.event_name === 'Transfer' &&
        (e.result?.to === TARGET_TRC20_WALLET || e.result?.recipient === TARGET_TRC20_WALLET)
      );
    });

    if (!transferEvent) {
      return {
        valid: false,
        error: `Transaction was not sent to official deposit wallet ${TARGET_TRC20_WALLET}.`
      };
    }

    const rawValue = transferEvent.result?.value || transferEvent.result?.amount || 0;
    // USDT has 6 decimals on Tron
    const amountUsdt = Number(rawValue) / 1000000;

    // Tolerate minor network fee difference (e.g. 9.5 vs 9.99 or 19.5 vs 19.99)
    const minRequired = expectedUsd * 0.95;
    if (amountUsdt < minRequired) {
      return {
        valid: false,
        amount: amountUsdt,
        error: `Received ${amountUsdt} USDT, which is less than the required $${expectedUsd}.`
      };
    }

    return {
      valid: true,
      amount: amountUsdt,
      from: transferEvent.result?.from,
      to: TARGET_TRC20_WALLET
    };
  } catch (err: any) {
    console.error('TronGrid verification error:', err);
    return {
      valid: false,
      error: err.name === 'AbortError' ? 'TronGrid API timed out. Try again shortly.' : (err.message || 'Tron validation network error')
    };
  }
}

/**
 * Submits a new payment order for verification (requires valid TxID/Memo)
 */
export async function submitPaymentOrder(params: {
  email: string;
  tier: 'standard' | 'pro_vip';
  paymentType: 'okx_internal' | 'okx_trc20';
  txHash: string;
  notes?: string;
}): Promise<{
  success: boolean;
  order?: PaymentOrderRecord;
  autoActivated?: boolean;
  licenseKey?: string;
  error?: string;
}> {
  const db = getDatabase();
  const email = (params.email || '').trim();
  const txHash = (params.txHash || '').trim();
  const tier = params.tier === 'pro_vip' ? 'pro_vip' : 'standard';
  const amountUsd = tier === 'pro_vip' ? 19.99 : 9.99;

  if (!email || !email.includes('@')) {
    return { success: false, error: 'Valid email address is required.' };
  }

  if (!txHash) {
    return {
      success: false,
      error: params.paymentType === 'okx_internal'
        ? 'Please provide your OKX Transfer ID or sender email to verify payment.'
        : 'Please provide the TRON USDT (TRC-20) Transaction Hash (TxID).'
    };
  }

  // Anti-replay: Check if this TxID has already been used for an approved order or active license
  const existingOrderStmt = db.prepare(`
    SELECT * FROM payment_orders 
    WHERE tx_hash = ? AND status = 'approved'
  `);
  const usedOrder = existingOrderStmt.get(txHash) as unknown as PaymentOrderRecord | undefined;
  if (usedOrder) {
    return { success: false, error: 'This Transaction Hash / Reference has already been used and redeemed.' };
  }

  const orderId = `OKX-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  // If TRC-20 on-chain with full hash: Attempt automatic on-chain blockchain verification!
  let autoActivated = false;
  let issuedKey: string | null = null;
  let initialStatus: 'pending' | 'approved' = 'pending';
  let verificationNote = params.notes || '';

  if (params.paymentType === 'okx_trc20' && txHash.length >= 32) {
    const onChainResult = await verifyTronTrc20Transaction(txHash, amountUsd);
    if (onChainResult.valid) {
      // Blockchain confirmed! Auto-issue license key immediately
      const newLicense = createNewLicense({
        tier,
        email,
        paymentMethod: 'okx_trc20_verified',
        paymentRef: txHash,
        notes: `Auto-verified on TRON blockchain ($${onChainResult.amount} USDT from ${onChainResult.from})`
      });

      autoActivated = true;
      issuedKey = newLicense.key;
      initialStatus = 'approved';
      verificationNote = `Auto-verified on TRON network. Received ${onChainResult.amount} USDT`;
    }
  }

  const insertStmt = db.prepare(`
    INSERT INTO payment_orders (order_id, email, tier, amount_usd, payment_type, tx_hash, status, license_key, created_at, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertStmt.run(
    orderId,
    email,
    tier,
    amountUsd,
    params.paymentType,
    txHash,
    initialStatus,
    issuedKey,
    now,
    verificationNote
  );

  const getStmt = db.prepare('SELECT * FROM payment_orders WHERE order_id = ?');
  const orderRecord = getStmt.get(orderId) as unknown as PaymentOrderRecord;

  return {
    success: true,
    order: orderRecord,
    autoActivated,
    licenseKey: issuedKey || undefined
  };
}

/**
 * Retrieve all payment orders for admin review
 */
export function getAllPaymentOrders(): PaymentOrderRecord[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM payment_orders ORDER BY id DESC LIMIT 200');
  return stmt.all() as unknown as PaymentOrderRecord[];
}

/**
 * Admin action: Approve order and generate license key
 */
export function adminApprovePaymentOrder(orderId: string): {
  success: boolean;
  order?: PaymentOrderRecord;
  license?: LicenseRecord;
  error?: string;
} {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM payment_orders WHERE order_id = ?');
  const order = stmt.get(orderId) as unknown as PaymentOrderRecord | undefined;

  if (!order) {
    return { success: false, error: 'Order not found.' };
  }

  if (order.status === 'approved' && order.license_key) {
    const licStmt = db.prepare('SELECT * FROM licenses WHERE key = ?');
    const lic = licStmt.get(order.license_key) as unknown as LicenseRecord | undefined;
    return { success: true, order, license: lic };
  }

  // Create license for the order
  const newLic = createNewLicense({
    tier: order.tier,
    email: order.email,
    paymentMethod: order.payment_type,
    paymentRef: order.tx_hash,
    notes: `Approved order ${order.order_id} by Owner Admin`
  });

  const updateStmt = db.prepare(`
    UPDATE payment_orders 
    SET status = 'approved', license_key = ? 
    WHERE order_id = ?
  `);
  updateStmt.run(newLic.key, orderId);

  const updatedOrder = stmt.get(orderId) as unknown as PaymentOrderRecord;

  return {
    success: true,
    order: updatedOrder,
    license: newLic
  };
}

/**
 * Admin action: Reject order
 */
export function adminRejectPaymentOrder(orderId: string, reason?: string): { success: boolean; error?: string } {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE payment_orders 
    SET status = 'rejected', notes = ? 
    WHERE order_id = ?
  `);
  stmt.run(reason || 'Payment could not be confirmed in OKX', orderId);
  return { success: true };
}

/**
 * Retrieve all licenses for admin / owner overview
 */
export function getAllLicenses(): Array<LicenseRecord & { devices_count: number; devices?: LicenseDeviceRecord[] }> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT l.*, COUNT(d.id) as devices_count
    FROM licenses l
    LEFT JOIN license_devices d ON l.key = d.license_key
    GROUP BY l.key
    ORDER BY l.created_at DESC
  `);
  const licenses = stmt.all() as any[];

  // Attach devices to each license
  const devStmt = db.prepare('SELECT * FROM license_devices WHERE license_key = ? ORDER BY last_seen_at DESC');
  for (const lic of licenses) {
    lic.devices = devStmt.all(lic.key) as unknown as LicenseDeviceRecord[];
  }

  return licenses;
}

/**
 * Retrieve admin subscription stats
 */
export function getAdminSubscriptionStats(): {
  totalRevenueUsd: number;
  totalLicenses: number;
  activeLicenses: number;
  bannedLicenses: number;
  standardLicenses: number;
  vipLicenses: number;
  totalDevices: number;
  pendingOrders: number;
  approvedOrders: number;
  rejectedOrders: number;
} {
  const db = getDatabase();

  const revStmt = db.prepare("SELECT SUM(amount_usd) as total FROM payment_orders WHERE status = 'approved'");
  const revRow = revStmt.get() as any;
  const totalRevenueUsd = Number(revRow?.total || 0);

  const licStatsStmt = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'banned' THEN 1 ELSE 0 END) as banned,
      SUM(CASE WHEN tier = 'standard' THEN 1 ELSE 0 END) as standard,
      SUM(CASE WHEN tier = 'pro_vip' THEN 1 ELSE 0 END) as vip
    FROM licenses
  `);
  const licRow = licStatsStmt.get() as any;

  const devCountStmt = db.prepare('SELECT COUNT(*) as total FROM license_devices');
  const devRow = devCountStmt.get() as any;

  const orderStatsStmt = db.prepare(`
    SELECT 
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
    FROM payment_orders
  `);
  const orderRow = orderStatsStmt.get() as any;

  return {
    totalRevenueUsd,
    totalLicenses: licRow?.total || 0,
    activeLicenses: licRow?.active || 0,
    bannedLicenses: licRow?.banned || 0,
    standardLicenses: licRow?.standard || 0,
    vipLicenses: licRow?.vip || 0,
    totalDevices: devRow?.total || 0,
    pendingOrders: orderRow?.pending || 0,
    approvedOrders: orderRow?.approved || 0,
    rejectedOrders: orderRow?.rejected || 0,
  };
}

/**
 * Admin action: Revoke/ban a license
 */
export function adminRevokeLicense(key: string, reason?: string): { success: boolean; error?: string } {
  const db = getDatabase();
  const stmt = db.prepare("UPDATE licenses SET status = 'banned', notes = notes || ' [REVOKED: ' || ? || ']' WHERE key = ?");
  stmt.run(reason || 'Banned by admin', key);
  return { success: true };
}

/**
 * Admin action: Reinstate an active license
 */
export function adminReinstateLicense(key: string): { success: boolean; error?: string } {
  const db = getDatabase();
  const stmt = db.prepare("UPDATE licenses SET status = 'active' WHERE key = ?");
  stmt.run(key);
  return { success: true };
}

/**
 * Admin action: Delete a license and its bound devices
 */
export function adminDeleteLicense(key: string): { success: boolean; error?: string } {
  const db = getDatabase();
  db.prepare('DELETE FROM license_devices WHERE license_key = ?').run(key);
  db.prepare('DELETE FROM license_access_logs WHERE license_key = ?').run(key);
  db.prepare('DELETE FROM licenses WHERE key = ?').run(key);
  return { success: true };
}

/**
 * Admin action: Delete a payment order
 */
export function adminDeletePaymentOrder(orderId: string): { success: boolean; error?: string } {
  const db = getDatabase();
  db.prepare('DELETE FROM payment_orders WHERE order_id = ?').run(orderId);
  return { success: true };
}

/**
 * Admin action: Force disconnect a device from a license
 */
export function adminForceDisconnectDevice(licenseKey: string, hwid: string): { success: boolean; error?: string } {
  const db = getDatabase();
  db.prepare('DELETE FROM license_devices WHERE license_key = ? AND device_hwid = ?').run(licenseKey, hwid);
  return { success: true };
}


