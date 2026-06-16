import { readFile } from 'fs/promises';
import path from 'path';

type KeyUrlItem = {
  id?: string;
  table?: string;
  name?: string;
  key?: string;
  url?: string;
  status?: string;
  group?: string;
  note?: string;
  tags?: string[];
  model?: string;
};

type ApiPart = string | { text?: string; content?: string };
type ApiResponseData = {
  choices?: Array<{ message?: { content?: string }; text?: string }>;
  output_text?: string;
  reply?: string;
  response?: string;
  result?: string;
  data?: { content?: string };
  candidates?: Array<{ content?: { parts?: ApiPart[] } }>;
  error?: { message?: string };
  message?: string;
  detail?: string;
};

type HealthResult = {
  id?: string;
  state: 'unknown' | 'ok' | 'bad' | 'error';
  latencyMs: number | null;
  statusCode: number | null;
  message: string;
  checkedAt: number;
};

const CHECK_TIMEOUT_MS = 12000;
const MAX_CONCURRENCY = 2;
const DEFAULT_MODEL = 'gpt-4o-mini';
const FALLBACK_MODELS = ['claude-opus-4-8', 'gpt-5.5', 'gpt-5.4', 'gpt-4o-mini'];
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

function chatCompletionsUrl(baseUrl?: string) {
  const base = String(baseUrl || '').trim();
  if (!base) return '';
  if (/\/chat\/completions\/?$/i.test(base)) return base;
  if (/\/models\/?$/i.test(base)) return base.replace(/\/models\/?$/i, '/chat/completions');
  return `${base.replace(/\/+$/, '')}/chat/completions`;
}

function isUsableKey(value?: string) {
  const key = String(value || '').trim();
  if (!key) return false;
  return !key.includes('...') && !key.includes('****') && !key.includes('•••') && !key.includes('***');
}

function hasQuotaExhaustedMarker(item: KeyUrlItem) {
  const text = [item.name, item.group, item.note, ...(item.tags || [])].join(' ').toLowerCase();
  return QUOTA_EXHAUSTED_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()));
}

function extractReplyText(data: ApiResponseData) {
  const candidates = [
    data?.choices?.[0]?.message?.content,
    data?.choices?.[0]?.text,
    data?.output_text,
    data?.reply,
    data?.response,
    data?.result,
    data?.data?.content,
    data?.candidates?.[0]?.content?.parts?.[0]?.text,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (Array.isArray(value)) {
      const text = value
        .map((part: ApiPart) => typeof part === 'string' ? part : (part.text || part.content || ''))
        .join('')
        .trim();
      if (text) return text;
    }
  }
  return '';
}

function errorMessageFrom(data: ApiResponseData, fallback: string) {
  return data?.error?.message || data?.message || data?.detail || fallback;
}

function errorText(error: unknown, timeoutText: string, fallback: string) {
  if (error instanceof Error) {
    return error.name === 'TimeoutError' ? timeoutText : (error.message || fallback);
  }
  return fallback;
}

function cleanModelToken(value?: string) {
  return String(value || '').trim().replace(/^[：:;；。()（）[\]【】]+|[：:;；。()（）[\]【】]+$/g, '').slice(0, 80);
}

function looksLikeModelId(value: string) {
  const low = value.toLowerCase();
  if (['gpt', 'claude', 'gemini', 'grok', 'glm', 'dp'].includes(low)) return false;
  return /^(gpt|claude|grok|gemini|glm|deepseek|qwen|kimi|doubao|dp)[\w.-]+$/i.test(value);
}

function pickModelCandidates(item: KeyUrlItem, fallbackModel: string) {
  const candidates: string[] = [];
  const push = (value?: string) => {
    const model = cleanModelToken(value);
    if (model && !candidates.includes(model)) candidates.push(model);
  };

  push(item.model);
  for (const value of [item.group, item.note, ...(item.tags || [])]) {
    for (const raw of String(value || '').replace(/[，,\n]/g, ' ').split(/\s+/)) {
      const token = cleanModelToken(raw);
      if (looksLikeModelId(token)) push(token);
    }
  }

  const haystack = [item.name, item.group, item.note, item.url, ...(item.tags || [])].join(' ').toLowerCase();
  if (/opus|claude|sonnet|muyuan|hvoy/.test(haystack)) push('claude-opus-4-8');
  if (/gpt|openai/.test(haystack)) {
    push('gpt-5.5');
    push('gpt-5.4');
  }

  if (fallbackModel && fallbackModel !== 'auto') push(fallbackModel);
  FALLBACK_MODELS.forEach(push);
  return candidates;
}

function shouldTryNextModel(message: string) {
  return /model|channel|not support|unsupported|模型|通道|渠道|No available channel/i.test(message);
}

async function readItems(): Promise<KeyUrlItem[]> {
  const file = path.join(process.cwd(), 'public', 'key-url-tables.json');
  const raw = await readFile(file, 'utf-8');
  const data = JSON.parse(raw);
  return Array.isArray(data?.items) ? data.items : [];
}

async function checkOneModel(item: KeyUrlItem, model: string, url: string, started: number): Promise<HealthResult> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${String(item.key).trim()}`,
      'User-Agent': 'sh-zmd-key-health-checker/2.1',
    },
    signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    cache: 'no-store',
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Reply only OK. This is an API key health check.' }],
      temperature: 0,
      max_tokens: 8,
    }),
  });

  const latencyMs = Date.now() - started;
  const data = await response.json().catch(() => ({})) as ApiResponseData;
  if (!response.ok) {
    return {
      id: item.id,
      state: 'bad',
      latencyMs,
      statusCode: response.status,
      message: `对话失败(${model}): ${errorMessageFrom(data, `HTTP ${response.status}`)}`,
      checkedAt: Date.now(),
    };
  }

  const reply = extractReplyText(data);
  return {
    id: item.id,
    state: reply ? 'ok' : 'bad',
    latencyMs,
    statusCode: response.status,
    message: reply ? `实际对话成功：${model}` : `接口返回成功，但没有模型正文(${model})`,
    checkedAt: Date.now(),
  };
}

async function checkOne(item: KeyUrlItem, fallbackModel: string): Promise<HealthResult> {
  const started = Date.now();
  if (hasQuotaExhaustedMarker(item)) {
    return { id: item.id, state: 'bad', latencyMs: null, statusCode: null, message: '已标注没额度，跳过检测', checkedAt: Date.now() };
  }
  if (!isUsableKey(item.key)) {
    return { id: item.id, state: 'bad', latencyMs: null, statusCode: null, message: 'Key 为空或是隐藏占位符', checkedAt: Date.now() };
  }

  const url = chatCompletionsUrl(item.url);
  if (!url) {
    return { id: item.id, state: 'unknown', latencyMs: null, statusCode: null, message: '缺少 URL', checkedAt: Date.now() };
  }

  try {
    let lastResult: HealthResult | null = null;
    for (const model of pickModelCandidates(item, fallbackModel)) {
      const result = await checkOneModel(item, model, url, started);
      if (result.state === 'ok') return result;
      lastResult = result;
      if (!shouldTryNextModel(result.message)) return result;
    }
    return lastResult || { id: item.id, state: 'bad', latencyMs: Date.now() - started, statusCode: null, message: '没有可测试的模型', checkedAt: Date.now() };
  } catch (error: unknown) {
    return {
      id: item.id,
      state: 'error',
      latencyMs: Date.now() - started,
      statusCode: null,
      message: errorText(error, '检测超时', '请求失败'),
      checkedAt: Date.now(),
    };
  }
}

async function checkWithPool(items: KeyUrlItem[], model: string) {
  const results: HealthResult[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = items[index++];
      results.push(await checkOne(current, model));
    }
  }

  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, items.length) }, () => worker()));
  return results;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const table = url.searchParams.get('table') || '';
    const model = url.searchParams.get('model') || DEFAULT_MODEL;
    const items = (await readItems())
      .filter((item) => item.id && item.url)
      .filter((item) => !table || (item.table || 'resources') === table)
      .slice(0, 80);

    const results = await checkWithPool(items, model);
    return json({ success: true, checkedAt: Date.now(), model, results });
  } catch (error: unknown) {
    return json({ success: false, error: errorText(error, '检测超时', '检测失败') }, 500);
  }
}
