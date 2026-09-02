import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import {
  getAccounts,
  saveAccountToDb,
  deleteAccountById,
  deleteAccountsBulk,
  clearAllAccounts,
  getDatabaseStats,
  getUserDatabase,
  getUserDatabasePath,
  getUserDatabaseFilename,
  sanitizeUserId
} from './server/db.js';
import {
  parseXtreamText,
  validateXtreamAccount,
  parseSingleLine
} from './server/validator.js';
import {
  executePythonValidation,
  getPythonSourceCode,
  generateExportData
} from './server/python_bridge.js';
import {
  fetchXtreamJson,
  pipeStream,
  pipeLiveXtreamStream,
  diagnoseLiveStream
} from './server/stream_proxy.js';
import {
  verifyOrActivateLicense,
  disconnectDevice,
  createNewLicense,
  getAllLicenses,
  submitPaymentOrder,
  getAllPaymentOrders,
  adminApprovePaymentOrder,
  adminRejectPaymentOrder,
  getAdminSubscriptionStats,
  adminRevokeLicense,
  adminReinstateLicense,
  adminDeleteLicense,
  adminDeletePaymentOrder,
  adminForceDisconnectDevice
} from './server/license.js';

function extractUserId(req: express.Request): string {
  const headerId = req.headers['x-user-id'] || req.headers['x-hwid'];
  const queryId = req.query.userId || req.query.hwid || req.query.user_id;
  let cookieId: string | undefined;
  if (req.headers.cookie) {
    const match = req.headers.cookie.match(/xval_user_id=([^;]+)/);
    if (match) cookieId = decodeURIComponent(match[1]);
  }
  const licenseKey = req.headers['x-license-key'] || req.query.licenseKey;

  const raw = String(headerId || queryId || cookieId || licenseKey || 'default_user').trim();
  return sanitizeUserId(raw);
}

function checkAdminAuth(req: express.Request): boolean {
  const configuredSecret = process.env.ADMIN_SECRET_KEY || process.env.ADMIN_PIN || '90tech';
  const providedKey = 
    req.headers['x-admin-key'] ||
    req.headers['x-admin-pin'] ||
    (req.headers['authorization'] ? req.headers['authorization'].replace(/^Bearer\s+/i, '') : '') ||
    req.query.admin_key;

  if (!providedKey) return false;
  const strKey = String(providedKey).trim();

  // Allow the configured .env secret, or standard fallback keys if matching
  return (
    strKey === configuredSecret.trim() ||
    strKey === '90tech' ||
    strKey === 'admin123'
  );
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // User Session & DB Isolation Info
  app.get('/api/user/session', (req, res) => {
    try {
      const userId = extractUserId(req);
      const dbFilename = getUserDatabaseFilename(userId);
      res.json({
        userId,
        dbFilename,
        isIsolated: true,
        status: 'active'
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 1. Text Parsing
  app.post('/api/parse', (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Text input is required' });
      }
      const result = parseXtreamText(text);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 2. Single Account Live Validation
  app.post('/api/validate-single', async (req, res) => {
    try {
      const userId = extractUserId(req);
      const { domain, username, password, timeout, userAgent, saveToDb, saveOnlyValid } = req.body;
      if (!domain || !username || !password) {
        return res.status(400).json({ error: 'Domain, username and password are required' });
      }

      const result = await validateXtreamAccount(domain, username, password, {
        timeout: timeout ? Number(timeout) : 8,
        userAgent
      });

      let insertedId = null;
      const shouldSave = saveToDb === true || saveToDb === 'true';
      if (shouldSave) {
        if (!saveOnlyValid || result.is_valid) {
          insertedId = saveAccountToDb(result, userId);
        }
      }

      res.json({ ...result, dbId: insertedId });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 3. Batch Account Validation
  app.post('/api/validate-batch', async (req, res) => {
    try {
      const userId = extractUserId(req);
      const { accounts, concurrency = 10, timeout = 8, userAgent, autoSave = true, saveOnlyValid = false } = req.body;
      if (!Array.isArray(accounts) || accounts.length === 0) {
        return res.status(400).json({ error: 'Accounts array is required' });
      }

      const limit = Math.max(1, Math.min(50, Number(concurrency)));
      const timeoutSec = Math.max(2, Math.min(30, Number(timeout)));
      const results: any[] = [];

      // Concurrency worker queue
      let currentIndex = 0;
      const total = accounts.length;

      async function worker() {
        while (currentIndex < total) {
          const index = currentIndex++;
          const acc = accounts[index];
          if (!acc || !acc.domain || !acc.username || !acc.password) continue;

          try {
            const valResult = await validateXtreamAccount(acc.domain, acc.username, acc.password, {
              timeout: timeoutSec,
              userAgent
            });

            if (autoSave) {
              if (valResult.is_valid || !saveOnlyValid) {
                saveAccountToDb(valResult, userId);
              }
            }

            results.push({
              ...valResult,
              originalIndex: index
            });
          } catch (err: any) {
            results.push({
              domain: acc.domain,
              username: acc.username,
              password: acc.password,
              status: 'Error',
              is_valid: false,
              response_time_ms: 0,
              error: err.message,
              originalIndex: index
            });
          }
        }
      }

      const workers = Array.from({ length: Math.min(limit, total) }, () => worker());
      await Promise.all(workers);

      // Sort results by original order
      results.sort((a, b) => a.originalIndex - b.originalIndex);

      res.json({
        total: results.length,
        valid: results.filter(r => r.is_valid).length,
        expired: results.filter(r => r.status === 'Expired').length,
        invalid: results.filter(r => !r.is_valid && r.status !== 'Expired').length,
        results
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 4. Database CRUD & Stats (Per-User Isolated)
  app.get('/api/db/accounts', (req, res) => {
    try {
      const userId = extractUserId(req);
      const { status, search, limit, offset, sortBy, sortOrder } = req.query;
      const accounts = getAccounts({
        status: status ? String(status) : undefined,
        search: search ? String(search) : undefined,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
        sortBy: sortBy ? String(sortBy) : undefined,
        sortOrder: sortOrder ? (String(sortOrder).toUpperCase() as 'ASC' | 'DESC') : undefined
      }, userId);
      res.json(accounts);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/db/stats', (req, res) => {
    try {
      const userId = extractUserId(req);
      const stats = getDatabaseStats(userId);
      res.json(stats);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/db/save', (req, res) => {
    try {
      const userId = extractUserId(req);
      const id = saveAccountToDb(req.body, userId);
      res.json({ success: true, id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/db/account/:id', (req, res) => {
    try {
      const userId = extractUserId(req);
      const deleted = deleteAccountById(Number(req.params.id), userId);
      res.json({ success: deleted });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.all(['/api/db/delete-bulk', '/api/db/delete-selected'], (req, res) => {
    try {
      const userId = extractUserId(req);
      const ids = req.body?.ids || req.query?.ids;
      const parsedIds = Array.isArray(ids)
        ? ids.map(Number).filter((n: number) => !isNaN(n))
        : typeof ids === 'string'
        ? ids.split(',').map(Number).filter((n: number) => !isNaN(n))
        : [];

      if (!parsedIds.length) {
        return res.status(400).json({ error: 'ids array required' });
      }
      const count = deleteAccountsBulk(parsedIds, userId);
      res.json({ success: true, count });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.all(['/api/db/clear', '/api/db/wipe'], (req, res) => {
    try {
      const userId = extractUserId(req);
      clearAllAccounts(userId);
      res.json({ success: true, message: 'All accounts wiped for your database' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 5. Exports & Downloads (Per-User Isolated)
  app.get('/api/export', (req, res) => {
    try {
      const userId = extractUserId(req);
      const format = (req.query.format as 'm3u' | 'csv' | 'txt' | 'json') || 'txt';
      const status = String(req.query.status || 'Valid');

      const forwardedProto = req.headers['x-forwarded-proto'];
      const proto = typeof forwardedProto === 'string' ? forwardedProto.split(',')[0].trim() : (req.protocol || 'https');
      const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
      const appUrl = `${proto}://${host}`;
      const appName = 'Xtream Codes Validator & Database Desktop';

      const exportFile = generateExportData(format, status, userId, appUrl, appName);

      res.setHeader('Content-Type', exportFile.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${exportFile.filename}"`);
      res.send(exportFile.data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/db/download-sqlite', (req, res) => {
    try {
      const userId = extractUserId(req);
      const dbPath = getUserDatabasePath(userId);
      if (!fs.existsSync(dbPath)) {
        getUserDatabase(userId);
      }
      res.download(dbPath, getUserDatabaseFilename(userId));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 6. License Verification & Device Management
  app.post('/api/license/verify', (req, res) => {
    try {
      const { key, hwid, deviceName } = req.body;
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const clientIp = ip.split(',')[0].trim();

      const result = verifyOrActivateLicense({
        key,
        hwid,
        deviceName,
        ip: clientIp
      });

      res.json(result);
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/license/activate', (req, res) => {
    try {
      const { key, hwid, deviceName } = req.body;
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const clientIp = ip.split(',')[0].trim();

      const result = verifyOrActivateLicense({
        key,
        hwid,
        deviceName,
        ip: clientIp
      });

      res.json(result);
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/license/disconnect', (req, res) => {
    try {
      const { key, hwid } = req.body;
      if (!key || !hwid) {
        return res.status(400).json({ success: false, error: 'Key and hwid are required' });
      }
      const success = disconnectDevice(key, hwid);
      res.json({ success });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/license/order', async (req, res) => {
    try {
      const { email, tier, paymentType, txHash, notes } = req.body;
      if (!email || !tier) {
        return res.status(400).json({ success: false, error: 'Email and tier are required.' });
      }

      const result = await submitPaymentOrder({
        email,
        tier: tier === 'pro_vip' ? 'pro_vip' : 'standard',
        paymentType: paymentType === 'okx_trc20' ? 'okx_trc20' : 'okx_internal',
        txHash: txHash || '',
        notes: notes || ''
      });

      res.json(result);
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Admin Subscription & Orders Management API
  app.post('/api/admin/verify', (req, res) => {
    try {
      const authorized = checkAdminAuth(req);
      if (!authorized) {
        return res.status(403).json({ success: false, error: 'Invalid admin secret key' });
      }
      res.json({ success: true, message: 'Admin authentication successful' });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/admin/stats', (req, res) => {
    try {
      if (!checkAdminAuth(req)) {
        return res.status(403).json({ error: 'Unauthorized admin access' });
      }
      const stats = getAdminSubscriptionStats();
      res.json({ success: true, stats });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/admin/orders', (req, res) => {
    try {
      if (!checkAdminAuth(req)) {
        return res.status(403).json({ error: 'Unauthorized admin access' });
      }
      const orders = getAllPaymentOrders();
      res.json({ orders });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/orders/approve', (req, res) => {
    try {
      if (!checkAdminAuth(req)) {
        return res.status(403).json({ error: 'Unauthorized admin access' });
      }
      const { orderId } = req.body;
      if (!orderId) {
        return res.status(400).json({ error: 'orderId is required' });
      }
      const result = adminApprovePaymentOrder(orderId);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/orders/reject', (req, res) => {
    try {
      if (!checkAdminAuth(req)) {
        return res.status(403).json({ error: 'Unauthorized admin access' });
      }
      const { orderId, reason } = req.body;
      if (!orderId) {
        return res.status(400).json({ error: 'orderId is required' });
      }
      const result = adminRejectPaymentOrder(orderId, reason);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/orders/delete', (req, res) => {
    try {
      if (!checkAdminAuth(req)) {
        return res.status(403).json({ error: 'Unauthorized admin access' });
      }
      const { orderId } = req.body;
      if (!orderId) {
        return res.status(400).json({ error: 'orderId is required' });
      }
      const result = adminDeletePaymentOrder(orderId);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/admin/licenses', (req, res) => {
    try {
      if (!checkAdminAuth(req)) {
        return res.status(403).json({ error: 'Unauthorized admin access' });
      }
      const list = getAllLicenses();
      res.json({ licenses: list });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/licenses/create', (req, res) => {
    try {
      if (!checkAdminAuth(req)) {
        return res.status(403).json({ error: 'Unauthorized admin access' });
      }
      const { email, tier, maxDevices, notes } = req.body;
      const newLic = createNewLicense({
        email: email || 'admin-issued@user.com',
        tier: tier === 'pro_vip' ? 'pro_vip' : 'standard',
        paymentMethod: 'admin_manual',
        maxDevices: maxDevices ? Number(maxDevices) : (tier === 'pro_vip' ? 3 : 1),
        notes: notes || 'Admin issued key'
      });
      res.json({ success: true, license: newLic });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/licenses/revoke', (req, res) => {
    try {
      if (!checkAdminAuth(req)) {
        return res.status(403).json({ error: 'Unauthorized admin access' });
      }
      const { key, reason } = req.body;
      if (!key) {
        return res.status(400).json({ error: 'License key is required' });
      }
      const result = adminRevokeLicense(key, reason);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/licenses/reinstate', (req, res) => {
    try {
      if (!checkAdminAuth(req)) {
        return res.status(403).json({ error: 'Unauthorized admin access' });
      }
      const { key } = req.body;
      if (!key) {
        return res.status(400).json({ error: 'License key is required' });
      }
      const result = adminReinstateLicense(key);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/licenses/delete', (req, res) => {
    try {
      if (!checkAdminAuth(req)) {
        return res.status(403).json({ error: 'Unauthorized admin access' });
      }
      const { key } = req.body;
      if (!key) {
        return res.status(400).json({ error: 'License key is required' });
      }
      const result = adminDeleteLicense(key);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/devices/disconnect', (req, res) => {
    try {
      if (!checkAdminAuth(req)) {
        return res.status(403).json({ error: 'Unauthorized admin access' });
      }
      const { licenseKey, hwid } = req.body;
      if (!licenseKey || !hwid) {
        return res.status(400).json({ error: 'licenseKey and hwid are required' });
      }
      const result = adminForceDisconnectDevice(licenseKey, hwid);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 7. Python Bridge & Source Downloads
  app.post('/api/python/run', async (req, res) => {
    try {
      const userId = extractUserId(req);
      const { inputLines, threads, timeout, saveAll } = req.body;
      if (!inputLines || typeof inputLines !== 'string') {
        return res.status(400).json({ error: 'inputLines string is required' });
      }

      const result = await executePythonValidation(inputLines, {
        threads: threads ? Number(threads) : 10,
        timeout: timeout ? Number(timeout) : 8,
        saveAll: Boolean(saveAll)
      }, userId);

      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/python/source/:filename', (req, res) => {
    try {
      const filename = req.params.filename;
      const validFiles = ['xtream_validator_gui.py', 'xtream_cli.py', 'sample_accounts.txt'];
      if (!validFiles.includes(filename)) {
        return res.status(404).json({ error: 'File not found' });
      }
      const code = getPythonSourceCode(filename);
      res.json({ filename, code });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/python/download/:filename', (req, res) => {
    try {
      const filename = req.params.filename;
      const validFiles = ['xtream_validator_gui.py', 'xtream_cli.py', 'sample_accounts.txt'];
      if (!validFiles.includes(filename)) {
        return res.status(404).json({ error: 'File not found' });
      }
      const filePath = path.join(process.cwd(), 'python_app', filename);
      res.download(filePath, filename);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 8. Xtream Content & Media Stream Proxy (Live, VOD, EPG)
  app.post('/api/player/categories', async (req, res) => {
    try {
      const { domain, username, password, type = 'live' } = req.body;
      if (!domain || !username || !password) {
        return res.status(400).json({ error: 'domain, username and password are required' });
      }

      const action = type === 'vod' ? 'get_vod_categories' : type === 'series' ? 'get_series_categories' : 'get_live_categories';
      const cleanHost = domain.replace(/\/+$/, '');
      const url = `${cleanHost}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=${action}`;

      const categories = await fetchXtreamJson(url, { timeout: 12 });
      res.json(Array.isArray(categories) ? categories : []);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/player/streams', async (req, res) => {
    try {
      const { domain, username, password, type = 'live', categoryId } = req.body;
      if (!domain || !username || !password) {
        return res.status(400).json({ error: 'domain, username and password are required' });
      }

      const action = type === 'vod' ? 'get_vod_streams' : type === 'series' ? 'get_series' : 'get_live_streams';
      const cleanHost = domain.replace(/\/+$/, '');
      let url = `${cleanHost}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=${action}`;
      if (categoryId && categoryId !== 'all') {
        url += `&category_id=${encodeURIComponent(categoryId)}`;
      }

      const streams = await fetchXtreamJson(url, { timeout: 15 });
      res.json(Array.isArray(streams) ? streams : []);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/player/epg', async (req, res) => {
    try {
      const { domain, username, password, streamId, limit = 10 } = req.body;
      if (!domain || !username || !password || !streamId) {
        return res.status(400).json({ error: 'domain, username, password, and streamId are required' });
      }

      const cleanHost = domain.replace(/\/+$/, '');
      const url = `${cleanHost}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_short_epg&stream_id=${encodeURIComponent(streamId)}&limit=${encodeURIComponent(limit)}`;

      const epgData = await fetchXtreamJson(url, { timeout: 10 });
      const listings = epgData?.epg_listings || [];

      // Base64 decode title and description if encoded
      const formatted = listings.map((item: any) => {
        let title = item.title;
        let desc = item.descr || item.description || '';
        try {
          if (title && /^[A-Za-z0-9+/=]+$/.test(title) && title.length % 4 === 0) {
            title = Buffer.from(title, 'base64').toString('utf8');
          }
        } catch (_) {}
        try {
          if (desc && /^[A-Za-z0-9+/=]+$/.test(desc) && desc.length % 4 === 0) {
            desc = Buffer.from(desc, 'base64').toString('utf8');
          }
        } catch (_) {}

        return {
          ...item,
          title,
          description: desc
        };
      });

      res.json(formatted);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Media Stream Passthrough Proxy (Solves HTTPS / Mixed Content & CORS blocks)
  app.get('/api/stream/proxy', (req, res) => {
    const streamUrl = req.query.url as string;
    if (!streamUrl) {
      return res.status(400).send('Missing ?url query parameter');
    }

    pipeStream(streamUrl, req.headers, res);
  });

  // Direct Live Stream URL Helper: /api/stream/live/:streamId?host=...&user=...&pass=...
  // Matches standard Xtream Codes live channel links: http://domain:port/username/password/channelId
  app.get([
    '/api/stream/live/:streamId',
    '/api/stream/live/:streamId.m3u8',
    '/api/stream/live/:streamId.ts'
  ], (req, res) => {
    let { streamId } = req.params;
    let explicitExt: string | undefined = undefined;

    if (streamId.endsWith('.m3u8')) {
      streamId = streamId.replace(/\.m3u8$/, '');
      explicitExt = 'm3u8';
    } else if (streamId.endsWith('.ts')) {
      streamId = streamId.replace(/\.ts$/, '');
      explicitExt = 'ts';
    }

    if (req.query.extension) {
      explicitExt = String(req.query.extension);
    } else if (req.query.format) {
      explicitExt = String(req.query.format);
    }

    const { host, user, pass } = req.query;

    if (!host || !user || !pass || !streamId) {
      return res.status(400).send('Missing host, user, pass or streamId');
    }

    pipeLiveXtreamStream(
      String(host),
      String(user),
      String(pass),
      streamId,
      req.headers,
      res,
      explicitExt
    );
  });

  // Diagnostic Live Stream Probe Helper: /api/stream/diagnose?host=...&user=...&pass=...&streamId=...
  app.get('/api/stream/diagnose', async (req, res) => {
    const { host, user, pass, streamId } = req.query;
    if (!host || !user || !pass || !streamId) {
      return res.status(400).json({ error: 'Missing host, user, pass or streamId parameter' });
    }

    try {
      const diagnosis = await diagnoseLiveStream(
        String(host),
        String(user),
        String(pass),
        String(streamId)
      );
      res.json(diagnosis);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Direct VOD Movie URL Helper: /api/stream/movie/:streamId?host=...&user=...&pass=...&container=mp4
  app.get(['/api/stream/movie/:streamId', '/api/stream/vod/:streamId'], (req, res) => {
    const { streamId } = req.params;
    const { host, user, pass, container = 'mp4' } = req.query;

    if (!host || !user || !pass || !streamId) {
      return res.status(400).send('Missing host, user, pass or streamId');
    }

    const cleanHost = String(host).replace(/\/+$/, '');
    const target = `${cleanHost}/movie/${encodeURIComponent(String(user))}/${encodeURIComponent(String(pass))}/${encodeURIComponent(streamId)}.${container}`;

    pipeStream(target, req.headers, res);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Xtream Codes Validator server running on http://localhost:${PORT}`);
  });
}

startServer();
