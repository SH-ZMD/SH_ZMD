import { readFile } from 'fs/promises';
import path from 'path';

type KeyUrlItem = {
  id?: string;
  table?: string;
  name?: string;
  key?: string;
  url?: string;
  status?: string;
};

const HEALTHY_STATUS_CODES = new Set([200, 401, 403]);
const CHECK_TIMEOUT_MS = 4000;
const MAX_CONCURRENCY = 3;
const QUOTA_EXHAUSTED_KEYWORDS = ['没额度', '无额度', '余额不足', '没余额', '额度用完', 'no quota', 'quota', 'insufficient_quota'];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
      Pragma: 'no-cache',
    },
  });
}

function modelsUrl(baseUrl?: string) {
  const base = String(baseUrl || '').trim();
  if (!base) return '';
  if (base.endsWith('/models')) return base;
  return `${base.replace(/\/+$/, '')}/models`;
}

function isUsableKey(value?: string) {
  const key = String(value || '').trim();
  if (!key) return false;
  return !key.includes('...') && !key.includes('****') && !key.includes('••') && !key.includes('***');
}

function hasQuotaExhaustedMarker(item: KeyUrlItem) {
  const text = [item.name, (item as any).group, (item as any).note, ...(((item as any).tags || []) as string[])].join(' ').toLowerCase();
  return QUOTA_EXHAUSTED_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()));
}

async function readItems(): Promise<KeyUrlItem[]> {
  const file = path.join(process.cwd(), 'public', 'key-url-tables.json');
  const raw = await readFile(file, 'utf-8');
  const data = JSON.parse(raw);
  return Array.isArray(data?.items) ? data.items : [];
}

async function checkOne(item: KeyUrlItem) {
  const started = Date.now();
  if (hasQuotaExhaustedMarker(item)) {
    return { id: item.id, state: 'bad', latencyMs: null, statusCode: null, message: '已标记没额度，跳过可用判定', checkedAt: Date.now() };
  }
  const url = modelsUrl(item.url);
  if (!url) {
    return { id: item.id, state: 'unknown', latencyMs: null, statusCode: null, message: '缺少 URL', checkedAt: Date.now() };
  }

  try {
    const headers: Record<string, string> = { 'User-Agent': 'sh-zmd-key-health-checker/1.0' };
    if (isUsableKey(item.key)) headers.Authorization = `Bearer ${String(item.key).trim()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      cache: 'no-store',
    });

    const latencyMs = Date.now() - started;
    const ok = HEALTHY_STATUS_CODES.has(response.status);
    return {
      id: item.id,
      state: ok ? 'ok' : 'bad',
      latencyMs,
      statusCode: response.status,
      message: ok ? '接口可达（不代表有余额）' : `HTTP ${response.status}`,
      checkedAt: Date.now(),
    };
  } catch (error: any) {
    return {
      id: item.id,
      state: 'error',
      latencyMs: Date.now() - started,
      statusCode: null,
      message: error?.name === 'TimeoutError' ? '检测超时' : (error?.message || '请求失败'),
      checkedAt: Date.now(),
    };
  }
}

async function checkWithPool(items: KeyUrlItem[]) {
  const results: any[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = items[index++];
      results.push(await checkOne(current));
    }
  }

  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, items.length) }, () => worker()));
  return results;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const table = url.searchParams.get('table') || '';
    const items = (await readItems())
      .filter((item) => item.id && item.url)
      .filter((item) => !table || (item.table || 'resources') === table)
      .slice(0, 80);

    const results = await checkWithPool(items);
    return json({ success: true, checkedAt: Date.now(), results });
  } catch (error: any) {
    return json({ success: false, error: error?.message || '检测失败' }, 500);
  }
}
