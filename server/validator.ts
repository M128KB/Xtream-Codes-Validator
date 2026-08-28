import http from 'http';
import https from 'https';
import { URL } from 'url';

export interface ParsedLine {
  domain: string;
  username: string;
  password: string;
  originalLine: string;
  lineIndex: number;
}

export interface ParseResult {
  accounts: ParsedLine[];
  totalLines: number;
  validLines: number;
  invalidLines: number;
}

/**
 * Normalizes domain by removing trailing slashes, path suffixes like player_api.php,
 * stripping basic-auth user prefixes (e.g. user@host:80 -> host:80), and ensuring http/https scheme.
 */
export function normalizeDomain(rawDomain: string): string {
  let d = rawDomain.trim();
  // Remove wrapping quotes, brackets, or angle brackets
  d = d.replace(/^["'<\(\[\s]+|["'>\)\]\s]+$/g, '');
  // Remove trailing scripts and parameters
  d = d.replace(/\/+(?:player_api\.php|get\.php|xmltv\.php)?(?:\?.*)?$/i, '');
  d = d.replace(/\/+$/, '');
  
  // Strip URL basic auth if present, e.g. http://khalilibrahim@i.cr7.ink:80 -> http://i.cr7.ink:80
  d = d.replace(/^(https?:\/\/)(?:[^@/\s]+@)(.+)$/i, '$1$2');

  // If no scheme, default to http://
  if (!/^https?:\/\//i.test(d)) {
    d = 'http://' + d;
  }
  return d;
}

function cleanField(val: string): string {
  let v = val.trim();
  // Remove wrapping quotes or brackets
  v = v.replace(/^["'<\(\[\s]+|["'>\)\]\s]+$/g, '');
  // Remove trailing decorative stars, asterisks, dots at end if purely decorative
  v = v.replace(/[\s⋆*]+$/g, '');
  return v.trim();
}

function isLikelyDomain(str: string): boolean {
  const s = str.trim();
  if (/^https?:\/\//i.test(s)) return true;
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?::\d+)?(?:\/.*)?$/i.test(s)) return true;
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?(?:\/.*)?$/i.test(s)) return true;
  return false;
}

function isLabeledLine(line: string): boolean {
  return /(?:url|host|server|servidor|portal|real|ʜᴏsᴛ|username|user|usuário|usuario|użytkownik|ᴜsᴇʀ|password|pass|pas|senha|hasło|contraseña|ᴘᴀss|u==|p==|pa==|expire|data)/i.test(line);
}

function isSeparatorOrBanner(line: string): boolean {
  const l = line.trim();
  if (!l) return false;
  if (/^[=\-_*~#+]{3,}$/.test(l)) return true;
  if (/[🅧🅣🅡🅔🅐🅜|🅒🅞🅳🅔|xtream|m3u|💥]/i.test(l) && !extractDomain(l) && !extractUsername(l) && !extractPassword(l)) {
    return true;
  }
  return false;
}

export function extractDomain(line: string): string | null {
  const l = line.trim();
  if (!l) return null;

  // 1. Label prefix match with URL or domain (supports all emojis/symbols like 🧿, 🌐, 🔗, ✘, ❪웃❫, ⛧, etc.)
  const labelMatch = l.match(/(?:^|[^\w])(?:url|host|server|servidor|portal|real|ʜᴏsᴛ|link|stream|dns|website)\s*(?:[:=➤➛➣⫸]\s*|\s+)(https?:\/\/[^\s"'<>|]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?::\d+)?(?:\/[^\s"'<>|]*)?|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?(?:\/[^\s"'<>|]*)?)/i);
  if (labelMatch && labelMatch[1]) {
    return normalizeDomain(labelMatch[1]);
  }

  // 2. Direct URL match anywhere on the line
  const urlMatch = l.match(/(https?:\/\/[^\s"'<>|]+)/i);
  if (urlMatch && urlMatch[1]) {
    return normalizeDomain(urlMatch[1]);
  }

  // 3. Standalone domain without http (if the entire line looks like a domain and has no user/pass label)
  const cleanLine = l.replace(/^[^\w]+|[^\w]+$/g, '').trim();
  if (isLikelyDomain(cleanLine) && !isLabeledLine(l)) {
    return normalizeDomain(cleanLine);
  }

  return null;
}

export function extractUsername(line: string): { username: string; password?: string } | null {
  const l = line.trim();
  if (!l) return null;

  // Check for username label:
  // User:, Username:, User name:, Usuario:, Usuário:, Użytkownik:, ᴜsᴇʀ, U==, User=, etc.
  const userMatch = l.match(/(?:^|[^\w])(?:username|user\s*name|user|usuário|usuario|użytkownik|ᴜsᴇʀ|u==|u=)\s*(?:[:=➤➛➣⫸=]\s*|\s+)(.+)$/i);
  if (userMatch && userMatch[1]) {
    const rawVal = userMatch[1].trim();

    // Check for inline user/pass pair separated by ⋆ or | (e.g. "✦ Użytkownik: Wolfgang ⋆ 5he6ERunyN")
    if (rawVal.includes('⋆') || (rawVal.includes('|') && !rawVal.startsWith('|'))) {
      const parts = rawVal.split(/[⋆|]/).map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        return { username: cleanField(parts[0]), password: cleanField(parts[1]) };
      }
    }

    return { username: cleanField(rawVal) };
  }

  return null;
}

export function extractPassword(line: string): string | null {
  const l = line.trim();
  if (!l) return null;

  // Check for password label:
  // Password:, Pass:, Pas:, Senha:, Hasło:, Contraseña:, ᴘᴀss, P==, Pa==, Pass=, Password =, etc.
  const passMatch = l.match(/(?:^|[^\w])(?:password|pass\s*word|pass|pas|senha|hasło|contraseña|ᴘᴀss|p==|pa==|p=)\s*(?:[:=➤➛➣⫸=]\s*|\s+)(.+)$/i);
  if (passMatch && passMatch[1]) {
    return cleanField(passMatch[1]);
  }

  return null;
}

export function parseSelfContainedLine(line: string, lineIndex: number = 1): ParsedLine | null {
  line = line.trim();
  if (!line || line.startsWith('#') || line.startsWith('//')) return null;

  // A. Check for get.php or player_api.php
  if (line.includes('get.php?') || line.includes('player_api.php?')) {
    try {
      const matchUrl = line.match(/(https?:\/\/[^\s"'<>|]+)/i);
      const urlStr = matchUrl ? matchUrl[1] : line;
      const parsedUrl = new URL(urlStr.startsWith('http') ? urlStr : 'http://' + urlStr);
      const user = parsedUrl.searchParams.get('username') || parsedUrl.searchParams.get('user');
      const pass = parsedUrl.searchParams.get('password') || parsedUrl.searchParams.get('pass');
      if (user && pass) {
        const portPart = parsedUrl.port ? `:${parsedUrl.port}` : '';
        const domain = normalizeDomain(`${parsedUrl.protocol}//${parsedUrl.hostname}${portPart}`);
        return { domain, username: user.trim(), password: pass.trim(), originalLine: line, lineIndex };
      }
    } catch {}
  }

  // B. Check for M3U stream URL pattern (e.g. http://host:port/live/user/pass/1.ts or movie/series)
  const m3uMatch = line.match(/(https?:\/\/[^/\s]+)\/(?:live|movie|series)\/([^/\s]+)\/([^/\s]+)\//i);
  if (m3uMatch) {
    const domain = normalizeDomain(m3uMatch[1]);
    return { domain, username: m3uMatch[2].trim(), password: m3uMatch[3].trim(), originalLine: line, lineIndex };
  }

  // C. Delimiters: pipe '|', comma ',', semicolon ';', or tab '\t'
  for (const delim of ['|', '\t', ',', ';']) {
    if (line.includes(delim)) {
      const parts = line.split(delim).map(s => s.trim()).filter(Boolean);
      if (parts.length >= 3) {
        const dCandidate = parts[0].replace(/^(?:url|host|server|real)\s*[:=➤➛➣⫸]?\s*/i, '');
        if (isLikelyDomain(dCandidate)) {
          return {
            domain: normalizeDomain(dCandidate),
            username: cleanField(parts[1]),
            password: cleanField(parts[2]),
            originalLine: line,
            lineIndex
          };
        }
      }
    }
  }

  // D. Space separated: "http://domain:port username password"
  if (!isLabeledLine(line)) {
    const parts = line.split(/\s+/).filter(Boolean);
    if (parts.length === 3 && isLikelyDomain(parts[0])) {
      return {
        domain: normalizeDomain(parts[0]),
        username: cleanField(parts[1]),
        password: cleanField(parts[2]),
        originalLine: line,
        lineIndex
      };
    }
  }

  // E. Colon separated: "http://host:port:user:pass" or "host:port:user:pass"
  if (!isLabeledLine(line)) {
    if (line.startsWith('http://') || line.startsWith('https://')) {
      const protoEnd = line.indexOf('://') + 3;
      const rest = line.substring(protoEnd);
      const restParts = rest.split(':');
      if (restParts.length === 4) {
        const domain = normalizeDomain(`${line.substring(0, protoEnd)}${restParts[0]}:${restParts[1]}`);
        return { domain, username: cleanField(restParts[2]), password: cleanField(restParts[3]), originalLine: line, lineIndex };
      } else if (restParts.length === 3) {
        const domain = normalizeDomain(`${line.substring(0, protoEnd)}${restParts[0]}`);
        return { domain, username: cleanField(restParts[1]), password: cleanField(restParts[2]), originalLine: line, lineIndex };
      }
    } else {
      const colons = line.split(':');
      if (colons.length === 4 && isLikelyDomain(`${colons[0]}:${colons[1]}`)) {
        return {
          domain: normalizeDomain(`http://${colons[0]}:${colons[1]}`),
          username: cleanField(colons[2]),
          password: cleanField(colons[3]),
          originalLine: line,
          lineIndex
        };
      } else if (colons.length === 3 && isLikelyDomain(colons[0])) {
        return {
          domain: normalizeDomain(`http://${colons[0]}`),
          username: cleanField(colons[1]),
          password: cleanField(colons[2]),
          originalLine: line,
          lineIndex
        };
      }
    }
  }

  return null;
}

export function parseSingleLine(line: string, lineIndex: number = 1): ParsedLine | null {
  return parseSelfContainedLine(line, lineIndex);
}

/**
 * Universal Xtream Codes parser supporting:
 * - Multi-line styled blocks with decorative banners & emojis (e.g. 🧿URL ➤, 👩‍ User ➤, 🔑 Pass ➤)
 * - Multi-lingual labels (Host, Server, Servidor, User, Username, Usuario, Usuário, Użytkownik, Pass, Password, Senha, Hasło)
 * - Custom key-value pairs (username=..., password=..., U==..., P==...)
 * - Space, pipe, comma, semicolon, colon delimited single lines
 * - XMLTV / M3U / get.php / player_api.php URLs
 */
export function parseXtreamText(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const accounts: ParsedLine[] = [];
  const seen = new Set<string>();

  function addAccount(acc: ParsedLine) {
    if (!acc.domain || !acc.username || !acc.password) return;
    const key = `${acc.domain.toLowerCase()}|${acc.username}|${acc.password}`;
    if (!seen.has(key)) {
      seen.add(key);
      accounts.push({
        domain: acc.domain,
        username: acc.username,
        password: acc.password,
        originalLine: acc.originalLine || `${acc.domain} ${acc.username} ${acc.password}`,
        lineIndex: acc.lineIndex
      });
    }
  }

  let currentDomain: string | null = null;
  let currentUsername: string | null = null;
  let currentPassword: string | null = null;
  let blockStartLine = 1;

  function flushBlock() {
    if (currentDomain && currentUsername && currentPassword) {
      addAccount({
        domain: currentDomain,
        username: currentUsername,
        password: currentPassword,
        originalLine: `${currentDomain} ${currentUsername} ${currentPassword}`,
        lineIndex: blockStartLine
      });
      currentDomain = null;
      currentUsername = null;
      currentPassword = null;
      return true;
    }
    return false;
  }

  for (let i = 0; i < lines.length; i++) {
    const lineIndex = i + 1;
    const rawLine = lines[i].trim();

    if (!rawLine) {
      if (currentDomain && currentUsername && currentPassword) {
        flushBlock();
      }
      continue;
    }

    if (rawLine.startsWith('#') && !rawLine.includes('http')) {
      continue;
    }

    // Check for banner or decorative separator
    if (isSeparatorOrBanner(rawLine)) {
      flushBlock();
      continue;
    }

    // Check for self-contained single line account
    const single = parseSelfContainedLine(rawLine, lineIndex);
    if (single) {
      flushBlock();
      addAccount(single);
      continue;
    }

    // Check for metadata lines (e.g. "Expire = ...", "Data utworzenia: ...", "Data wygaśnięcia: ...")
    if (/^(?:expire|expiration|data\s*utworzenia|data\s*wygaśnięcia|created|creation\s*date)\s*[:=]/i.test(rawLine)) {
      continue;
    }

    // Try extracting field
    const userObj = extractUsername(rawLine);
    const passVal = extractPassword(rawLine);
    const domainVal = extractDomain(rawLine);

    if (userObj) {
      if (currentUsername !== null && currentPassword !== null && currentDomain !== null) {
        flushBlock();
      }
      currentUsername = userObj.username;
      if (userObj.password) {
        currentPassword = userObj.password;
      }
      if (!currentDomain && !currentPassword) blockStartLine = lineIndex;
      if (currentDomain && currentUsername && currentPassword) {
        flushBlock();
      }
      continue;
    }

    if (passVal) {
      if (currentPassword !== null && currentUsername !== null && currentDomain !== null) {
        flushBlock();
      }
      currentPassword = passVal;
      if (!currentDomain && !currentUsername) blockStartLine = lineIndex;
      if (currentDomain && currentUsername && currentPassword) {
        flushBlock();
      }
      continue;
    }

    if (domainVal) {
      if (currentDomain !== null && currentUsername !== null && currentPassword !== null) {
        flushBlock();
      } else if (currentDomain !== null && (currentUsername !== null || currentPassword !== null)) {
        flushBlock();
      }
      currentDomain = domainVal;
      if (!currentUsername && !currentPassword) blockStartLine = lineIndex;
      if (currentDomain && currentUsername && currentPassword) {
        flushBlock();
      }
      continue;
    }
  }

  // End of loop flush
  flushBlock();

  return {
    accounts,
    totalLines: lines.length,
    validLines: accounts.length,
    invalidLines: Math.max(0, lines.length - accounts.length)
  };
}

export interface ValidationResult {
  domain: string;
  username: string;
  password: string;
  status: 'Active' | 'Expired' | 'Banned' | 'Disabled' | 'Invalid' | 'Server Error' | 'Timeout' | 'Unknown';
  is_valid: boolean;
  exp_date?: string;
  max_connections?: number;
  active_cons?: number;
  is_trial?: boolean;
  server_name?: string;
  timezone?: string;
  response_time_ms: number;
  raw_data?: any;
  error?: string;
}

export async function validateXtreamAccount(
  domain: string,
  username: string,
  password: string,
  options: { timeout?: number; userAgent?: string } = {}
): Promise<ValidationResult> {
  const timeoutMs = (options.timeout || 8) * 1000;
  let normalizedDomain = domain.trim();
  if (!normalizedDomain.startsWith('http://') && !normalizedDomain.startsWith('https://')) {
    normalizedDomain = 'http://' + normalizedDomain;
  }
  normalizedDomain = normalizedDomain.replace(/\/+$/, '');

  const targetUrl = `${normalizedDomain}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
  const startTime = Date.now();

  try {
    const jsonStr = await makeHttpRequest(targetUrl, {
      timeout: timeoutMs,
      userAgent: options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 IPTV-Client/2.0'
    });

    const latency = Date.now() - startTime;
    let data: any;
    try {
      data = JSON.parse(jsonStr);
    } catch {
      return {
        domain: normalizedDomain,
        username,
        password,
        status: 'Invalid',
        is_valid: false,
        response_time_ms: latency,
        raw_data: { raw: jsonStr.substring(0, 300) },
        error: 'Non-JSON response returned by server.'
      };
    }

    const userInfo = data.user_info || {};
    const serverInfo = data.server_info || {};

    const auth = Number(userInfo.auth || 0);
    const rawStatus = String(userInfo.status || '').toLowerCase();

    if (auth === 1 && rawStatus === 'active') {
      let expDateFormatted = 'Unlimited';
      let isExpired = false;
      if (userInfo.exp_date && userInfo.exp_date !== 'null') {
        const expNum = Number(userInfo.exp_date);
        if (!isNaN(expNum) && expNum > 0) {
          const expDate = new Date(expNum * 1000);
          expDateFormatted = expDate.toISOString().substring(0, 10);
          if (expDate.getTime() < Date.now()) {
            isExpired = true;
          }
        } else {
          expDateFormatted = String(userInfo.exp_date);
        }
      }

      const status: 'Active' | 'Expired' = isExpired ? 'Expired' : 'Active';

      return {
        domain: normalizedDomain,
        username,
        password,
        status,
        is_valid: !isExpired,
        exp_date: expDateFormatted,
        max_connections: Number(userInfo.max_connections || 0),
        active_cons: Number(userInfo.active_cons || 0),
        is_trial: Boolean(Number(userInfo.is_trial || 0)),
        server_name: serverInfo.url || serverInfo.server_ip || normalizedDomain,
        timezone: serverInfo.timezone || 'UTC',
        response_time_ms: latency,
        raw_data: data
      };
    } else {
      let statusStr: 'Expired' | 'Banned' | 'Disabled' | 'Invalid' = 'Invalid';
      if (rawStatus.includes('expired')) statusStr = 'Expired';
      else if (rawStatus.includes('bann')) statusStr = 'Banned';
      else if (rawStatus.includes('disable')) statusStr = 'Disabled';

      return {
        domain: normalizedDomain,
        username,
        password,
        status: statusStr,
        is_valid: false,
        response_time_ms: latency,
        raw_data: data,
        error: userInfo.message || 'Authentication rejected'
      };
    }
  } catch (err: any) {
    const latency = Date.now() - startTime;
    const isTimeout = err.message?.includes('timeout') || err.code === 'ETIMEDOUT';
    return {
      domain: normalizedDomain,
      username,
      password,
      status: isTimeout ? 'Timeout' : 'Server Error',
      is_valid: false,
      response_time_ms: latency,
      error: err.message || 'Connection failed'
    };
  }
}

function makeHttpRequest(targetUrl: string, opts: { timeout: number; userAgent: string }): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(targetUrl);
      const isHttps = parsed.protocol === 'https:';
      const client = isHttps ? https : http;

      const req = client.get(
        targetUrl,
        {
          headers: {
            'User-Agent': opts.userAgent,
            'Accept': 'application/json, text/plain, */*'
          },
          timeout: opts.timeout
        },
        (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            body += chunk;
            // Prevent runaway huge payloads
            if (body.length > 500000) {
              req.destroy();
              resolve(body);
            }
          });
          res.on('end', () => resolve(body));
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Connection timed out'));
      });

      req.on('error', (err) => reject(err));
    } catch (e) {
      reject(e);
    }
  });
}
