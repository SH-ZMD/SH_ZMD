import { createHash } from 'node:crypto';

type RateRule = { name: string; identity: string; limit: number; windowSeconds: number };
type ProtectionResult = { ok: true } | { ok: false; status: 429 | 503; error: string; retryAfter?: number };
const localWindows = new Map<string, number[]>();

function hashKey(value: string) {
  return createHash('sha256').update(`${process.env.COMMENT_HASH_SALT || 'blog-abuse'}:${value}`).digest('hex');
}
export function getRequestIp(req: Request) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip')?.trim() || 'unknown';
}
async function verifyTurnstile(token: string, remoteIp: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY || '';
  if (!secret) return true;
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token, remoteip: remoteIp });
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body, cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (!response.ok) return false;
  return (await response.json().catch(() => ({}))).success === true;
}
function localRateLimit(rule: RateRule) {
  const key = `${rule.name}:${hashKey(rule.identity)}`;
  const now = Date.now();
  const windowMs = rule.windowSeconds * 1000;
  const active = (localWindows.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
  if (active.length >= rule.limit) return Math.max(1, Math.ceil((windowMs - (now - active[0])) / 1000));
  active.push(now); localWindows.set(key, active);
  if (localWindows.size > 5000) {
    const maxWindow = 24 * 60 * 60 * 1000;
    for (const [mapKey, timestamps] of localWindows) {
      if (timestamps.every((timestamp) => now - timestamp >= maxWindow)) localWindows.delete(mapKey);
    }
  }
  return 0;
}

// 供 GET 类只读接口使用的轻量限流：不做人机验证，返回需等待的秒数（0 表示放行）
export function checkLocalRateLimit(name: string, identity: string, limit: number, windowSeconds: number) {
  return localRateLimit({ name, identity, limit, windowSeconds });
}
async function durableRateLimit(rule: RateRule) {
  const url = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '').replace(/\/$/, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
  if (!url || !token) return localRateLimit(rule);
  const bucket = Math.floor(Date.now() / (rule.windowSeconds * 1000));
  const key = `blog:${rule.name}:${bucket}:${hashKey(rule.identity)}`;
  const response = await fetch(`${url}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify([['INCR', key], ['EXPIRE', key, rule.windowSeconds + 5, 'NX']]), cache: 'no-store', signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Rate limit storage unavailable');
  return Number((await response.json())?.[0]?.result || 0) > rule.limit ? rule.windowSeconds : 0;
}
export async function protectPublicMutation(req: Request, options: { turnstileToken?: string; rules: RateRule[] }): Promise<ProtectionResult> {
  const ip = getRequestIp(req);
  try {
    if (!(await verifyTurnstile(String(options.turnstileToken || ''), ip))) return { ok: false, status: 429, error: '人机验证失败，请刷新后重试。' };
    for (const rule of options.rules) { const retryAfter = await durableRateLimit(rule); if (retryAfter > 0) return { ok: false, status: 429, error: '操作过于频繁，请稍后再试。', retryAfter }; }
    return { ok: true };
  } catch { return { ok: false, status: 503, error: '防滥用服务暂时不可用，请稍后再试。' }; }
}
