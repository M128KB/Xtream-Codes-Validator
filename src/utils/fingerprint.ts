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
