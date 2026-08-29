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
