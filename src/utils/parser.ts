export interface ParsedAccount {
  domain: string;
  username: string;
  password: string;
  originalLine?: string;
  lineIndex: number;
}

export interface ParseResult {
  accounts: ParsedAccount[];
  totalLines: number;
  validLines: number;
  invalidLines: number;
}

export function normalizeDomain(rawDomain: string): string {
  let d = rawDomain.trim();
  d = d.replace(/^["'<\(\[\s]+|["'>\)\]\s]+$/g, '');
  d = d.replace(/\/+(?:player_api\.php|get\.php|xmltv\.php)?(?:\?.*)?$/i, '');
  d = d.replace(/\/+$/, '');
  d = d.replace(/^(https?:\/\/)(?:[^@/\s]+@)(.+)$/i, '$1$2');

  if (!/^https?:\/\//i.test(d)) {
    d = 'http://' + d;
  }
  return d;
}

function cleanField(val: string): string {
  let v = val.trim();
  v = v.replace(/^["'<\(\[\s]+|["'>\)\]\s]+$/g, '');
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

  const labelMatch = l.match(/(?:^|[^\w])(?:url|host|server|servidor|portal|real|ʜᴏsᴛ|link|stream|dns|website)\s*(?:[:=➤➛➣⫸]\s*|\s+)(https?:\/\/[^\s"'<>|]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?::\d+)?(?:\/[^\s"'<>|]*)?|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?(?:\/[^\s"'<>|]*)?)/i);
  if (labelMatch && labelMatch[1]) {
    return normalizeDomain(labelMatch[1]);
  }

  const urlMatch = l.match(/(https?:\/\/[^\s"'<>|]+)/i);
  if (urlMatch && urlMatch[1]) {
    return normalizeDomain(urlMatch[1]);
  }

  const cleanLine = l.replace(/^[^\w]+|[^\w]+$/g, '').trim();
  if (isLikelyDomain(cleanLine) && !isLabeledLine(l)) {
    return normalizeDomain(cleanLine);
  }

  return null;
}

export function extractUsername(line: string): { username: string; password?: string } | null {
  const l = line.trim();
  if (!l) return null;

  const userMatch = l.match(/(?:^|[^\w])(?:username|user\s*name|user|usuário|usuario|użytkownik|ᴜsᴇʀ|u==|u=)\s*(?:[:=➤➛➣⫸=]\s*|\s+)(.+)$/i);
  if (userMatch && userMatch[1]) {
    const rawVal = userMatch[1].trim();

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

  const passMatch = l.match(/(?:^|[^\w])(?:password|pass\s*word|pass|pas|senha|hasło|contraseña|ᴘᴀss|p==|pa==|p=)\s*(?:[:=➤➛➣⫸=]\s*|\s+)(.+)$/i);
  if (passMatch && passMatch[1]) {
    return cleanField(passMatch[1]);
  }

  return null;
}

export function parseSelfContainedLine(line: string, lineIndex: number = 1): ParsedAccount | null {
  line = line.trim();
  if (!line || line.startsWith('#') || line.startsWith('//')) return null;

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

  const m3uMatch = line.match(/(https?:\/\/[^/\s]+)\/(?:live|movie|series)\/([^/\s]+)\/([^/\s]+)\//i);
  if (m3uMatch) {
    const domain = normalizeDomain(m3uMatch[1]);
    return { domain, username: m3uMatch[2].trim(), password: m3uMatch[3].trim(), originalLine: line, lineIndex };
  }

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

export function parseXtreamTextClient(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const accounts: ParsedAccount[] = [];
  const seen = new Set<string>();

  function addAccount(acc: ParsedAccount) {
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

    if (isSeparatorOrBanner(rawLine)) {
      flushBlock();
      continue;
    }

    const single = parseSelfContainedLine(rawLine, lineIndex);
    if (single) {
      flushBlock();
      addAccount(single);
      continue;
    }

    if (/^(?:expire|expiration|data\s*utworzenia|data\s*wygaśnięcia|created|creation\s*date)\s*[:=]/i.test(rawLine)) {
      continue;
    }

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

  flushBlock();

  return {
    accounts,
    totalLines: lines.length,
    validLines: accounts.length,
    invalidLines: Math.max(0, lines.length - accounts.length)
  };
}
