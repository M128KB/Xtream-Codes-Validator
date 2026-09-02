/**
 * Client-Side Hardware & Browser Fingerprint Generator (HWID)
 * Deterministically hashes device hardware attributes, screen specs, canvas and audio metrics.
 */

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
}

export function getOrCreateDeviceFingerprint(): string {
  const cached = localStorage.getItem('xval_device_hwid');
  if (cached && cached.startsWith('HWID-') && cached.length >= 16) {
    return cached;
  }

  // 1. Gather browser and hardware signals
  const signals: string[] = [];

  signals.push(navigator.userAgent || '');
  signals.push(navigator.language || '');
  signals.push(String(navigator.hardwareConcurrency || 4));
  signals.push(String((navigator as any).deviceMemory || 8));
  signals.push(`${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`);
  signals.push(Intl.DateTimeFormat().resolvedOptions().timeZone || '');

  // 2. Canvas 2D fingerprint
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = "14px 'Arial'";
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('Xtream-Validator-HWID, 2026', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('Xtream-Validator-HWID, 2026', 4, 17);
      signals.push(canvas.toDataURL());
    }
  } catch (e) {
    // Ignore canvas errors in strict sandbox
  }

  // 3. WebGL Renderer fingerprint
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const vendor = (gl as any).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
        const renderer = (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
        signals.push(`${vendor}~~~${renderer}`);
      }
    }
  } catch (e) {
    // Ignore webgl errors
  }

  // 4. Stable local salt to preserve device identity across browser sessions
  let deviceSalt = localStorage.getItem('xval_hwid_salt');
  if (!deviceSalt) {
    deviceSalt = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem('xval_hwid_salt', deviceSalt);
  }
  signals.push(deviceSalt);

  // Hash everything together
  const rawString = signals.join('###');
  const part1 = simpleHash(rawString.substring(0, Math.floor(rawString.length / 2)));
  const part2 = simpleHash(rawString.substring(Math.floor(rawString.length / 2)));
  const part3 = simpleHash(signals[0] + deviceSalt);

  const hwid = `HWID-${part1}-${part2}-${part3}`;
  localStorage.setItem('xval_device_hwid', hwid);
  return hwid;
}

export function getFriendlyDeviceName(): string {
  const ua = navigator.userAgent;
  let os = 'Unknown OS';
  if (ua.includes('Win')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  let browser = 'Browser';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';

  return `${os} ${browser}`;
}

export function getOrCreateUserDatabaseId(): string {
  if (typeof window === 'undefined') return 'default_user';

  let userId = localStorage.getItem('xval_user_db_id');
  if (!userId || !userId.startsWith('USR-')) {
    const hwid = getOrCreateDeviceFingerprint();
    const randPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    userId = `${hwid.replace(/^HWID-/, 'USR-')}-${randPart}`;
    try {
      localStorage.setItem('xval_user_db_id', userId);
    } catch (_) {}
  }

  // Set cookie for direct API requests, downloads, and media streaming requests
  try {
    document.cookie = `xval_user_id=${encodeURIComponent(userId)}; path=/; max-age=31536000; SameSite=Lax`;
    const hwid = getOrCreateDeviceFingerprint();
    document.cookie = `xval_hwid=${encodeURIComponent(hwid)}; path=/; max-age=31536000; SameSite=Lax`;
  } catch (_) {}

  return userId;
}

let isInterceptorInitialized = false;

export function setupGlobalFetchInterceptor(): void {
  if (isInterceptorInitialized || typeof window === 'undefined') return;
  isInterceptorInitialized = true;

  // Initialize cookies immediately so standard requests send identity headers automatically
  try {
    getOrCreateUserDatabaseId();
  } catch (_) {}

  try {
    const originalFetch = window.fetch;
    if (typeof originalFetch !== 'function') return;

    const wrappedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      try {
        const userId = getOrCreateUserDatabaseId();
        const hwid = getOrCreateDeviceFingerprint();
        const licenseKey = typeof localStorage !== 'undefined' ? localStorage.getItem('xval_license_key') : null;

        let headers: Headers;
        if (init?.headers instanceof Headers) {
          headers = init.headers;
        } else if (Array.isArray(init?.headers)) {
          headers = new Headers(init.headers);
        } else if (init?.headers && typeof init.headers === 'object') {
          headers = new Headers(init.headers as Record<string, string>);
        } else if (input instanceof Request) {
          headers = new Headers(input.headers);
        } else {
          headers = new Headers();
        }

        if (!headers.has('x-user-id')) {
          headers.set('x-user-id', userId);
        }
        if (!headers.has('x-hwid')) {
          headers.set('x-hwid', hwid);
        }
        if (licenseKey && !headers.has('x-license-key')) {
          headers.set('x-license-key', licenseKey);
        }

        const modifiedInit: RequestInit = {
          ...init,
          headers,
        };

        return originalFetch.call(window, input, modifiedInit);
      } catch (err) {
        return originalFetch.call(window, input, init);
      }
    };

    // Safely attempt assignment or defineProperty without throwing if read-only
    try {
      window.fetch = wrappedFetch;
    } catch (_) {
      try {
        Object.defineProperty(window, 'fetch', {
          value: wrappedFetch,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } catch (_) {
        // If window.fetch is completely locked by the container/browser, cookies handle identity seamlessly
      }
    }
  } catch (_) {
    // Graceful fallback
  }
}

