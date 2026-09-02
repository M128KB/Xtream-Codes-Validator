import http from 'http';
import https from 'https';
import { URL } from 'url';
import { normalizeDomain } from './validator.js';

interface RequestOptions {
  timeout?: number;
  userAgent?: string;
  headers?: Record<string, string>;
}

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
        'User-Agent': options.userAgent || 'IPTVSmartersPro/3.1.5.1 (Linux; Android 12) Exoplayer/2.18.2',
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
 * Proxy video/audio media chunks or HLS manifests
 */
export function pipeStream(
  targetUrl: string,
  reqHeaders: http.IncomingHttpHeaders,
  clientRes: http.ServerResponse,
  userAgent?: string
): void {
  try {
    const parsedUrl = new URL(targetUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const forwardedHeaders: Record<string, string> = {
      'User-Agent': userAgent || 'VLC/3.0.18 LibVLC/3.0.18',
      'Accept': '*/*'
    };

    if (reqHeaders['range']) {
      forwardedHeaders['Range'] = reqHeaders['range'];
    }

    const proxyReq = client.get(
      parsedUrl,
      {
        headers: forwardedHeaders,
        timeout: 30000,
        rejectUnauthorized: false
      },
      (proxyRes) => {
        // Handle redirects
        if (proxyRes.statusCode && proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
          let redirectUrl = proxyRes.headers.location;
          if (!/^https?:\/\//i.test(redirectUrl)) {
            redirectUrl = new URL(redirectUrl, parsedUrl.origin).toString();
          }
          return pipeStream(redirectUrl, reqHeaders, clientRes, userAgent);
        }

        // Set response headers
        clientRes.statusMessage = proxyRes.statusMessage || 'OK';
        clientRes.statusCode = proxyRes.statusCode || 200;

        const copyHeaders = [
          'content-type',
          'content-length',
          'content-range',
          'accept-ranges',
          'cache-control'
        ];

        for (const h of copyHeaders) {
          if (proxyRes.headers[h]) {
            clientRes.setHeader(h, proxyRes.headers[h] as string);
          }
        }

        // CORS headers to enable in-browser playback
        clientRes.setHeader('Access-Control-Allow-Origin', '*');
        clientRes.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        clientRes.setHeader('Access-Control-Allow-Headers', 'Range, Accept, Origin, Content-Type');

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
        clientRes.writeHead(504, { 'Content-Type': 'text/plain' });
        clientRes.end('Stream Gateway Timeout');
      }
    });

    proxyReq.on('error', (err) => {
      if (!clientRes.headersSent) {
        clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
        clientRes.end(`Stream Proxy Error: ${err.message}`);
      }
    });
  } catch (e: any) {
    if (!clientRes.headersSent) {
      clientRes.writeHead(500, { 'Content-Type': 'text/plain' });
      clientRes.end(`Stream Exception: ${e.message}`);
    }
  }
}

/**
 * Robust Live Xtream Stream Proxy with candidate fallback
 * Matches Xtream URL standard: http://domain:port/username/password/channelId
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
  const u = encodeURIComponent(String(user));
  const p = encodeURIComponent(String(pass));
  const s = encodeURIComponent(String(streamId));

  // Build candidate URLs in order of standard Xtream Codes compliance
  const candidates: string[] = [];

  if (explicitExtension === 'm3u8') {
    candidates.push(
      `${cleanHost}/live/${u}/${p}/${s}.m3u8`,
      `${cleanHost}/${u}/${p}/${s}.m3u8`,
      `${cleanHost}/${u}/${p}/${s}`,
      `${cleanHost}/live/${u}/${p}/${s}.ts`
    );
  } else if (explicitExtension === 'ts') {
    candidates.push(
      `${cleanHost}/${u}/${p}/${s}`,
      `${cleanHost}/live/${u}/${p}/${s}.ts`,
      `${cleanHost}/${u}/${p}/${s}.ts`,
      `${cleanHost}/live/${u}/${p}/${s}.m3u8`
    );
  } else {
    // Standard Xtream link format: http://domain:port/username/password/channelId
    candidates.push(
      `${cleanHost}/${u}/${p}/${s}`,
      `${cleanHost}/live/${u}/${p}/${s}.ts`,
      `${cleanHost}/${u}/${p}/${s}.ts`,
      `${cleanHost}/live/${u}/${p}/${s}`,
      `${cleanHost}/live/${u}/${p}/${s}.m3u8`,
      `${cleanHost}/${u}/${p}/${s}.m3u8`
    );
  }

  tryCandidate(0);

  function tryCandidate(index: number) {
    if (index >= candidates.length) {
      if (!clientRes.headersSent) {
        clientRes.writeHead(404, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
        clientRes.end('Stream not found or offline on Xtream server');
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
      'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18 (IPTV Smarters Pro Exoplayer/2.18)',
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
        timeout: 15000,
        rejectUnauthorized: false
      },
      (proxyRes) => {
        hasResponded = true;

        // Handle redirects (e.g., Xtream panel redirecting to load-balancer node)
        if (proxyRes.statusCode && proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
          let redirectUrl = proxyRes.headers.location;
          if (!/^https?:\/\//i.test(redirectUrl)) {
            redirectUrl = new URL(redirectUrl, parsedUrl.origin).toString();
          }
          return pipeStream(redirectUrl, reqHeaders, clientRes, 'VLC/3.0.18 LibVLC/3.0.18');
        }

        // If this candidate returned 404 or 400+, try next candidate URL
        if (proxyRes.statusCode && proxyRes.statusCode >= 400 && index < candidates.length - 1) {
          proxyReq.destroy();
          return tryCandidate(index + 1);
        }

        // Successfully connected!
        clientRes.statusCode = proxyRes.statusCode || 200;
        clientRes.statusMessage = proxyRes.statusMessage || 'OK';

        // Content-Type fallback for raw Xtream TS streams
        let contentType = proxyRes.headers['content-type'];
        if (!contentType || contentType === 'text/plain' || contentType === 'application/octet-stream') {
          contentType = 'video/mp2t';
        }

        clientRes.setHeader('Content-Type', contentType);
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

        // Check if response is M3U8 manifest that needs URL rewriting for CORS/proxy
        if (
          contentType.includes('mpegurl') ||
          contentType.includes('m3u8') ||
          currentUrl.endsWith('.m3u8')
        ) {
          let manifestBody = '';
          proxyRes.setEncoding('utf8');
          proxyRes.on('data', (chunk) => {
            manifestBody += chunk;
          });
          proxyRes.on('end', () => {
            try {
              // Rewrite segment lines to proxy through /api/stream/proxy?url=
              const lines = manifestBody.split('\n');
              const rewritten = lines.map((line) => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) {
                  return line;
                }
                // Segment URL
                let absoluteSegmentUrl = trimmed;
                if (!/^https?:\/\//i.test(trimmed)) {
                  absoluteSegmentUrl = new URL(trimmed, parsedUrl.origin + parsedUrl.pathname).toString();
                }
                return `/api/stream/proxy?url=${encodeURIComponent(absoluteSegmentUrl)}`;
              }).join('\n');

              if (!clientRes.headersSent) {
                clientRes.setHeader('Content-Length', Buffer.byteLength(rewritten, 'utf8'));
                clientRes.end(rewritten);
              }
            } catch {
              if (!clientRes.headersSent) {
                clientRes.end(manifestBody);
              }
            }
          });
        } else {
          // Direct binary stream (video/mp2t, FLV, TS, AAC)
          proxyRes.pipe(clientRes);
        }

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
