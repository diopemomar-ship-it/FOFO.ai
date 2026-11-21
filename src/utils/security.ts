/**
 * Utilitaires de sécurité côté client (anti-XSS, validation d'URLs, assainissement).
 */

export function escapeHtml(raw: unknown): string {
  const str = String(raw ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;');
}

export function sanitizeTextInput(raw: unknown, maxLength = 2000): string {
  return String(raw ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

export function isSafeClientMediaUrl(rawUrl: unknown): boolean {
  const url = String(rawUrl ?? '').trim();
  if (!url) return false;
  if (url.startsWith('/assets/') || url.startsWith('/')) {
    return !url.startsWith('//');
  }
  if (url.startsWith('blob:') || url.startsWith('data:image/') || url.startsWith('data:video/')) {
    return true;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
