/**
 * Browser-side device fingerprinting for trust verification
 * Collects non-PII browser characteristics to generate a unique device hash
 */

export interface DeviceFingerprint {
  browser: string;
  os: string;
  screenResolution: string;
  timezone: string;
  language: string;
  gpu: string;
  userAgent: string;
}

/**
 * Collect device fingerprint from the browser
 */
export async function collectDeviceFingerprint(): Promise<DeviceFingerprint> {
  const ua = navigator.userAgent;

  // Screen resolution
  const screenResolution = `${screen.width}x${screen.height}x${screen.colorDepth}`;

  // Timezone
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Language
  const language = navigator.language;

  // GPU info via WebGL
  let gpu = 'unknown';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl && gl instanceof WebGLRenderingContext) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        gpu = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unknown';
      }
    }
  } catch {
    // WebGL not available
  }

  // Parse browser name
  let browser = 'Unknown';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';

  // Parse OS
  let os = 'Unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return {
    browser,
    os,
    screenResolution,
    timezone,
    language,
    gpu,
    userAgent: ua,
  };
}

/**
 * Generate a SHA-256 hash of the device fingerprint (client-side)
 */
export async function generateDeviceHash(fp: DeviceFingerprint): Promise<string> {
  const raw = [fp.browser, fp.os, fp.screenResolution, fp.timezone, fp.language, fp.gpu].join('|');
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
