import http from 'http';
import https from 'https';
import { URL } from 'url';
import { normalizeDomain } from './validator.js';

interface RequestOptions {
  timeout?: number;
  userAgent?: string;
  headers?: Record<string, string>;
}

const DEFAULT_IPTV_USER_AGENT = 'IPTVSmartersPro/3.1.5.1 (Linux; Android 12) Exoplayer/2.18.2';
const VLC_USER_AGENT = 'VLC/3.0.18 LibVLC/3.0.18';

/**
 * Perform an HTTP/HTTPS GET request with timeout and custom headers
 */
export function fetchXtreamJson<T = any>(urlStr: string, options: RequestOptions = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(urlStr);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const timeoutMs = (options.timeout || 12) * 1000;
      const headers: Record<string, string> = {
        'User-Agent': options.userAgent || DEFAULT_IPTV_USER_AGENT,
        'Accept': '*/*',
        ...(options.headers || {})
      };

      const req = client.get(
        parsedUrl,
        {
          headers,
          timeout: timeoutMs,
          rejectUnauthorized: false
        },
        (res) => {
          // Follow redirect
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            let redirectUrl = res.headers.location;
            if (!/^https?:\/\//i.test(redirectUrl)) {
              redirectUrl = new URL(redirectUrl, parsedUrl.origin).toString();
            }
            return resolve(fetchXtreamJson(redirectUrl, options));
          }

          if (res.statusCode && res.statusCode >= 400) {
            return reject(new Error(`Server returned HTTP status ${res.statusCode}`));
          }

          let data = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              if (!data.trim()) {
                return resolve([] as any);
              }
              const json = JSON.parse(data);
              resolve(json);
            } catch (err: any) {
              reject(new Error(`Invalid JSON response: ${err.message}`));
            }
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timed out after ${options.timeout || 12}s`));
      });

      req.on('error', (err) => {
        reject(err);
      });
    } catch (e: any) {
      reject(e);
    }
  });
}

/**
 * Rewrite all URLs inside an M3U8 manifest to route through our proxy
 */
function rewriteM3U8Content(manifestBody: string, baseUrl: URL): string {
  const lines = manifestBody.split(/\r?\n/);
  const rewritten: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      rewritten.push(line);
      continue;
    }

    if (trimmed.startsWith('#')) {
      // Tags that contain URI="..." attributes like #EXT-X-KEY, #EXT-X-MAP, #EXT-X-MEDIA
      if (trimmed.includes('URI="')) {
        const rewrittenTag = trimmed.replace(/URI="([^"]+)"/g, (_, uriVal) => {
          let abs = uriVal;
          if (!/^https?:\/\//i.test(uriVal)) {
            abs = new URL(uriVal, baseUrl).toString();
          }
          return `URI="/api/stream/proxy?url=${encodeURIComponent(abs)}"`;
        });
        rewritten.push(rewrittenTag);
      } else {
        rewritten.push(line);
      }
    } else {
      // Segment or child playlist URL
      let absoluteSegmentUrl = trimmed;
      if (!/^https?:\/\//i.test(trimmed)) {
        absoluteSegmentUrl = new URL(trimmed, baseUrl).toString();
      }
      rewritten.push(`/api/stream/proxy?url=${encodeURIComponent(absoluteSegmentUrl)}`);
    }
  }

  return rewritten.join('\n');
}

/**
 * Proxy video/audio media chunks or HLS manifests
 */
export function pipeStream(
  targetUrl: string,
  reqHeaders: http.IncomingHttpHeaders,
  clientRes: http.ServerResponse,
  userAgent?: string,
  redirectCount = 0
): void {
  if (redirectCount > 5) {
    if (!clientRes.headersSent) {
      clientRes.writeHead(508, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
      clientRes.end('Too many redirects on upstream server');
    }
    return;
  }

  try {
    const parsedUrl = new URL(targetUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const forwardedHeaders: Record<string, string> = {
      'User-Agent': userAgent || DEFAULT_IPTV_USER_AGENT,
      'Accept': '*/*'
    };

    if (reqHeaders['range']) {
      forwardedHeaders['Range'] = reqHeaders['range'];
    }

    const proxyReq = client.get(
      parsedUrl,
      {
        headers: forwardedHeaders,
        timeout: 25000,
        rejectUnauthorized: false
      },
      (proxyRes) => {
        // Handle redirects
        if (proxyRes.statusCode && proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
          let redirectUrl = proxyRes.headers.location;
          if (!/^https?:\/\//i.test(redirectUrl)) {
            redirectUrl = new URL(redirectUrl, parsedUrl.origin).toString();
          }
          return pipeStream(redirectUrl, reqHeaders, clientRes, userAgent, redirectCount + 1);
        }

        const rawContentType = (proxyRes.headers['content-type'] || '').toLowerCase();
        const isM3u8ByName = parsedUrl.pathname.toLowerCase().endsWith('.m3u8');

        // Check if this is an M3U8 manifest by content-type or URL
        if (
          rawContentType.includes('mpegurl') ||
          rawContentType.includes('m3u8') ||
          isM3u8ByName
        ) {
          let manifestBody = '';
          proxyRes.setEncoding('utf8');
          proxyRes.on('data', (chunk) => {
            manifestBody += chunk;
          });
          proxyRes.on('end', () => {
            try {
              if (manifestBody.includes('#EXTM3U') || isM3u8ByName) {
                const rewritten = rewriteM3U8Content(manifestBody, parsedUrl);
                clientRes.statusCode = proxyRes.statusCode || 200;
                clientRes.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
                clientRes.setHeader('Access-Control-Allow-Origin', '*');
                clientRes.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
                clientRes.setHeader('Access-Control-Allow-Headers', 'Range, Accept, Origin, Content-Type');
                clientRes.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                clientRes.setHeader('Content-Length', Buffer.byteLength(rewritten, 'utf8'));
                clientRes.end(rewritten);
                return;
              }
            } catch (_) {}

            // Fallback if parsing failed
            if (!clientRes.headersSent) {
              clientRes.statusCode = proxyRes.statusCode || 200;
              clientRes.setHeader('Content-Type', rawContentType || 'text/plain');
              clientRes.setHeader('Access-Control-Allow-Origin', '*');
              clientRes.end(manifestBody);
            }
          });
          return;
        }

        // Direct binary stream or media segment (.ts, .mp4, audio, key)
        clientRes.statusCode = proxyRes.statusCode || 200;
        clientRes.statusMessage = proxyRes.statusMessage || 'OK';

        let finalContentType = proxyRes.headers['content-type'];
        if (!finalContentType || finalContentType === 'text/plain' || finalContentType === 'application/octet-stream') {
          if (parsedUrl.pathname.toLowerCase().endsWith('.ts')) {
            finalContentType = 'video/mp2t';
          } else if (parsedUrl.pathname.toLowerCase().endsWith('.mp4')) {
            finalContentType = 'video/mp4';
          } else {
            finalContentType = 'video/mp2t';
          }
        }

        clientRes.setHeader('Content-Type', finalContentType);
        clientRes.setHeader('Access-Control-Allow-Origin', '*');
        clientRes.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        clientRes.setHeader('Access-Control-Allow-Headers', 'Range, Accept, Origin, Content-Type');

        if (proxyRes.headers['content-length']) {
          clientRes.setHeader('Content-Length', proxyRes.headers['content-length']);
        }
        if (proxyRes.headers['content-range']) {
          clientRes.setHeader('Content-Range', proxyRes.headers['content-range']);
        }
        if (proxyRes.headers['accept-ranges']) {
          clientRes.setHeader('Accept-Ranges', proxyRes.headers['accept-ranges']);
        }

        proxyRes.pipe(clientRes);

        // Cancel upstream stream if client disconnects
        clientRes.on('close', () => {
          proxyReq.destroy();
        });
      }
    );

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      if (!clientRes.headersSent) {
        clientRes.writeHead(504, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
        clientRes.end('Stream Gateway Timeout');
      }
    });

    proxyReq.on('error', (err) => {
      if (!clientRes.headersSent) {
        clientRes.writeHead(502, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
        clientRes.end(`Stream Proxy Error: ${err.message}`);
      }
    });
  } catch (e: any) {
    if (!clientRes.headersSent) {
      clientRes.writeHead(500, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
      clientRes.end(`Stream Exception: ${e.message}`);
    }
  }
}

/**
 * Robust Live Xtream Stream Proxy with candidate fallback
 * Matches Xtream URL standards:
 * - Direct: http://domain:port/username/password/channelId
 * - Live TS: http://domain:port/live/username/password/channelId.ts
 * - Live HLS: http://domain:port/live/username/password/channelId.m3u8
 */
export function pipeLiveXtreamStream(
  host: string,
  user: string,
  pass: string,
  streamId: string | number,
  reqHeaders: http.IncomingHttpHeaders,
  clientRes: http.ServerResponse,
  explicitExtension?: string
): void {
  const cleanHost = normalizeDomain(host);
  const rawUser = String(user).trim();
  const rawPass = String(pass).trim();
  const s = String(streamId).trim();

  const encUser = encodeURIComponent(rawUser);
  const encPass = encodeURIComponent(rawPass);
  const encS = encodeURIComponent(s);

  // Build candidate URLs in prioritized order
  const candidates: string[] = [];

  if (explicitExtension === 'm3u8') {
    candidates.push(
      `${cleanHost}/live/${rawUser}/${rawPass}/${s}.m3u8`,
      `${cleanHost}/live/${encUser}/${encPass}/${encS}.m3u8`,
      `${cleanHost}/${rawUser}/${rawPass}/${s}.m3u8`,
      `${cleanHost}/${rawUser}/${rawPass}/${s}`,
      `${cleanHost}/live/${rawUser}/${rawPass}/${s}.ts`
    );
  } else if (explicitExtension === 'ts') {
    candidates.push(
      `${cleanHost}/live/${rawUser}/${rawPass}/${s}.ts`,
      `${cleanHost}/live/${encUser}/${encPass}/${encS}.ts`,
      `${cleanHost}/${rawUser}/${rawPass}/${s}`,
      `${cleanHost}/${rawUser}/${rawPass}/${s}.ts`,
      `${cleanHost}/live/${rawUser}/${rawPass}/${s}.m3u8`
    );
  } else {
    // Universal Live candidate order
    candidates.push(
      `${cleanHost}/live/${rawUser}/${rawPass}/${s}.ts`,
      `${cleanHost}/${rawUser}/${rawPass}/${s}`,
      `${cleanHost}/live/${rawUser}/${rawPass}/${s}.m3u8`,
      `${cleanHost}/live/${encUser}/${encPass}/${encS}.ts`,
      `${cleanHost}/${encUser}/${encPass}/${encS}`,
      `${cleanHost}/live/${encUser}/${encPass}/${encS}.m3u8`,
      `${cleanHost}/${rawUser}/${rawPass}/${s}.ts`,
      `${cleanHost}/live/${rawUser}/${rawPass}/${s}`
    );
  }

  tryCandidate(0);

  function tryCandidate(index: number) {
    if (index >= candidates.length) {
      if (!clientRes.headersSent) {
        clientRes.writeHead(404, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
        clientRes.end('Live stream offline or not found across candidate paths');
      }
      return;
    }

    const currentUrl = candidates[index];
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(currentUrl);
    } catch {
      return tryCandidate(index + 1);
    }

    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const forwardedHeaders: Record<string, string> = {
      'User-Agent': DEFAULT_IPTV_USER_AGENT,
      'Accept': '*/*'
    };

    if (reqHeaders['range']) {
      forwardedHeaders['Range'] = reqHeaders['range'];
    }

    let hasResponded = false;

    const proxyReq = client.get(
      parsedUrl,
      {
        headers: forwardedHeaders,
        timeout: 12000,
        rejectUnauthorized: false
      },
      (proxyRes) => {
        hasResponded = true;

        // Handle redirects (e.g., load-balancer node)
        if (proxyRes.statusCode && proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
          let redirectUrl = proxyRes.headers.location;
          if (!/^https?:\/\//i.test(redirectUrl)) {
            redirectUrl = new URL(redirectUrl, parsedUrl.origin).toString();
          }
          return pipeStream(redirectUrl, reqHeaders, clientRes, DEFAULT_IPTV_USER_AGENT);
        }

        // If authentication failed (401 or 403), return explicit notification
        if (proxyRes.statusCode === 401 || proxyRes.statusCode === 403) {
          if (!clientRes.headersSent) {
            clientRes.writeHead(proxyRes.statusCode, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
            clientRes.end(`Upstream Xtream Authentication Failed (${proxyRes.statusCode}): Account expired, max connections reached, or invalid credentials`);
          }
          return;
        }

        // If candidate returned 404 or other 4xx/5xx, try next candidate URL
        if (proxyRes.statusCode && proxyRes.statusCode >= 400 && index < candidates.length - 1) {
          proxyReq.destroy();
          return tryCandidate(index + 1);
        }

        const rawContentType = (proxyRes.headers['content-type'] || '').toLowerCase();
        const isM3u8 = rawContentType.includes('mpegurl') || rawContentType.includes('m3u8') || currentUrl.endsWith('.m3u8');

        // Check if response is M3U8 manifest
        if (isM3u8) {
          let manifestBody = '';
          proxyRes.setEncoding('utf8');
          proxyRes.on('data', (chunk) => {
            manifestBody += chunk;
          });
          proxyRes.on('end', () => {
            try {
              if (manifestBody.includes('#EXTM3U') || isM3u8) {
                const rewritten = rewriteM3U8Content(manifestBody, parsedUrl);
                clientRes.statusCode = proxyRes.statusCode || 200;
                clientRes.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
                clientRes.setHeader('Access-Control-Allow-Origin', '*');
                clientRes.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
                clientRes.setHeader('Access-Control-Allow-Headers', 'Range, Accept, Origin, Content-Type');
                clientRes.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                clientRes.setHeader('Content-Length', Buffer.byteLength(rewritten, 'utf8'));
                clientRes.end(rewritten);
                return;
              }
            } catch (_) {}

            if (!clientRes.headersSent) {
              clientRes.statusCode = proxyRes.statusCode || 200;
              clientRes.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
              clientRes.setHeader('Access-Control-Allow-Origin', '*');
              clientRes.end(manifestBody);
            }
          });
          return;
        }

        // Continuous binary media stream (MPEG-TS live feed)
        clientRes.statusCode = proxyRes.statusCode || 200;
        clientRes.statusMessage = proxyRes.statusMessage || 'OK';

        let finalContentType = proxyRes.headers['content-type'];
        if (!finalContentType || finalContentType === 'text/plain' || finalContentType === 'application/octet-stream') {
          finalContentType = 'video/mp2t';
        }

        clientRes.setHeader('Content-Type', finalContentType);
        clientRes.setHeader('Access-Control-Allow-Origin', '*');
        clientRes.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        clientRes.setHeader('Access-Control-Allow-Headers', 'Range, Accept, Origin, Content-Type');
        clientRes.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

        if (proxyRes.headers['content-length']) {
          clientRes.setHeader('Content-Length', proxyRes.headers['content-length']);
        }
        if (proxyRes.headers['content-range']) {
          clientRes.setHeader('Content-Range', proxyRes.headers['content-range']);
        }
        if (proxyRes.headers['accept-ranges']) {
          clientRes.setHeader('Accept-Ranges', proxyRes.headers['accept-ranges']);
        }

        proxyRes.pipe(clientRes);

        // Terminate upstream connection if browser disconnects
        clientRes.on('close', () => {
          proxyReq.destroy();
        });
      }
    );

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      if (!hasResponded && index < candidates.length - 1) {
        return tryCandidate(index + 1);
      }
      if (!clientRes.headersSent) {
        clientRes.writeHead(504, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
        clientRes.end('Stream Gateway Timeout');
      }
    });

    proxyReq.on('error', (err) => {
      if (!hasResponded && index < candidates.length - 1) {
        return tryCandidate(index + 1);
      }
      if (!clientRes.headersSent) {
        clientRes.writeHead(502, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
        clientRes.end(`Stream Proxy Error: ${err.message}`);
      }
    });
  }
}

