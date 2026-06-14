import { readFile } from 'fs/promises';
import path from 'path';
import { siteConfig } from '../../../siteConfig';

export const runtime = 'nodejs';

type ChatRole = 'user' | 'assistant';
type ReasoningLevel = 'quick' | 'normal' | 'deep';

type PublicChatMessage = { role: ChatRole; content: string };
type KeyUrlItem = {
  id?: string;
  table?: string;
  name?: string;
  key?: string;
  url?: string;
  status?: string;
  health?: { state?: string; latencyMs?: number | null };
};
type AiEndpoint = { id: string; name: string; baseUrl: string; apiKey: string; source: 'resource' | 'env'; latencyMs?: number | null };

const aiConfig = (siteConfig.geminiConfig || {}) as {
  provider?: 'gemini' | 'openai-compatible';
  modelId?: string;
  apiBaseUrl?: string;
  apiKeyEnv?: string;
  temperature?: number;
};

const MAX_TEXT_LENGTH = 200000;
const MAX_HISTORY_MESSAGES = 50;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const SERVER_SIDE_RATE_LIMIT_ENABLED = false;
const REQUEST_COOLDOWN_MS = 0;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = Number.MAX_SAFE_INTEGER;
const requestWindows = new Map<string, { windowStart: number; count: number; lastAt: number }>();

const MODEL_ALLOWLIST = [
  { id: aiConfig.modelId || 'gpt-5.4', label: '站长默认 GPT' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
  { id: 'gpt-4o', label: 'GPT-4o / 识图' },
];

const REASONING_PROMPTS: Record<ReasoningLevel, string> = {
  quick: '回答要简短直接，优先给结论。',
  normal: '回答要清楚、有步骤，但不要啰嗦。',
  deep: '回答要更深入，先梳理关键因素，再给可执行建议。',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
      'Pragma': 'no-cache',
    },
  });
}

function getClientKey(req: Request) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip')?.trim() || 'anonymous';
}

function checkRateLimit(clientKey: string) {
  if (!SERVER_SIDE_RATE_LIMIT_ENABLED) return '';
  const now = Date.now();
  const current = requestWindows.get(clientKey);
  if (current && now - current.lastAt < REQUEST_COOLDOWN_MS) {
    const waitSeconds = Math.ceil((REQUEST_COOLDOWN_MS - (now - current.lastAt)) / 1000);
    return `发送太快啦，请等待 ${waitSeconds}s 后再试。`;
  }
  if (!current || now - current.windowStart > WINDOW_MS) {
    requestWindows.set(clientKey, { windowStart: now, count: 1, lastAt: now });
    return '';
  }
  if (current.count >= MAX_REQUESTS_PER_WINDOW) return '这个 IP 10 分钟内的 AI 聊天次数已达上限，请稍后再试。';
  current.count += 1;
  current.lastAt = now;
  requestWindows.set(clientKey, current);
  return '';
}

function readEnvApiKey(envName?: string) {
  const candidates = [envName, 'SH_GPT', 'OPENAI_API_KEY', 'GEMINI_API_KEY'].filter(Boolean) as string[];
  for (const name of candidates) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return '';
}

function joinUrl(baseUrl: string, part: string) {
  return `${baseUrl.replace(/\/+$/, '')}/${part.replace(/^\/+/, '')}`;
}

function isUsableKey(value?: string) {
  const key = String(value || '').trim();
  if (!key) return false;
  return !key.includes('...') && !key.includes('****') && !key.includes('••') && !key.includes('***');
}

async function readResourceEndpoints(): Promise<AiEndpoint[]> {
  try {
    const file = path.join(process.cwd(), 'public', 'key-url-tables.json');
    const raw = await readFile(file, 'utf-8');
    const data = JSON.parse(raw);
    const items: KeyUrlItem[] = Array.isArray(data?.items) ? data.items : [];
    return items
      .filter((item) => (item.table || 'resources') === 'resources')
      .filter((item) => ['active', 'testing'].includes(String(item.status || '')))
      .filter((item) => item.url && isUsableKey(item.key))
      .sort((a, b) => {
        const ah = a.health?.state === 'ok' ? 0 : 1;
        const bh = b.health?.state === 'ok' ? 0 : 1;
        if (ah !== bh) return ah - bh;
        return (a.health?.latencyMs ?? 999999) - (b.health?.latencyMs ?? 999999);
      })
      .slice(0, 8)
      .map((item) => ({
        id: item.id || item.name || item.url || 'resource',
        name: item.name || item.group || '资源库 Key',
        baseUrl: String(item.url || '').trim(),
        apiKey: String(item.key || '').trim(),
        source: 'resource' as const,
        latencyMs: item.health?.latencyMs ?? null,
      }));
  } catch {
    return [];
  }
}

async function getAiEndpoints(): Promise<AiEndpoint[]> {
  const fromResources = await readResourceEndpoints();
  const envKey = readEnvApiKey(aiConfig.apiKeyEnv);
  const fallback = envKey ? [{ id: 'env-default', name: '站点默认 Key', baseUrl: aiConfig.apiBaseUrl || 'https://api.openai.com/v1', apiKey: envKey, source: 'env' as const }] : [];
  const seen = new Set<string>();
  return [...fromResources, ...fallback].filter((endpoint) => {
    const key = `${endpoint.baseUrl}|${endpoint.apiKey.slice(0, 16)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function estimateDataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.split(',')[1] || '';
  return Math.floor((base64.length * 3) / 4);
}

function sanitizeMessages(raw: unknown): PublicChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(-MAX_HISTORY_MESSAGES).map((item) => ({
    role: item?.role === 'assistant' ? 'assistant' as const : 'user' as const,
    content: String(item?.content || '').slice(0, MAX_TEXT_LENGTH),
  })).filter((item) => item.content.trim().length > 0);
}

function extractReplyText(data: any) {
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
    if (typeof value === 'string' && value.trim()) return value;
    if (Array.isArray(value)) {
      const text = value
        .map((part) => typeof part === 'string' ? part : (part?.text || part?.content || ''))
        .join('')
        .trim();
      if (text) return text;
    }
  }

  const toolCalls = data?.choices?.[0]?.message?.tool_calls;
  if (Array.isArray(toolCalls) && toolCalls.length) return '模型返回了工具调用请求，但站内聊天暂不执行工具调用。请换一种问法直接要求它用文字回答。';
  return '';
}

function pickModel(rawModel: unknown) {
  const requested = String(rawModel || '');
  return MODEL_ALLOWLIST.find((model) => model.id === requested)?.id || MODEL_ALLOWLIST[0].id;
}

function pickReasoning(rawLevel: unknown): ReasoningLevel {
  return rawLevel === 'quick' || rawLevel === 'deep' ? rawLevel : 'normal';
}

function buildSystemPrompt(reasoningLevel: ReasoningLevel) {
  return [
    '你是 SH_ZMD 分享站内置的公开 AI 助手。',
    '请用中文优先回答，除非用户明确要求其他语言。',
    REASONING_PROMPTS[reasoningLevel],
    '可以解释思路概要和依据，但不要输出隐藏推理链或逐字 chain-of-thought。',
    '如果用户请求危险、违法、泄露隐私的内容，要拒绝并给安全替代方案。',
  ].join('\n');
}

function buildPayloadMessages(messages: PublicChatMessage[], reasoningLevel: ReasoningLevel, imageDataUrl?: string) {
  const payloadMessages: any[] = [
    { role: 'system', content: buildSystemPrompt(reasoningLevel) },
    ...messages.slice(0, -1).map((message) => ({ role: message.role, content: message.content })),
  ];
  const latest = messages[messages.length - 1];
  if (imageDataUrl) {
    payloadMessages.push({
      role: latest.role,
      content: [
        { type: 'text', text: latest.content || '请分析这张图片。' },
        { type: 'image_url', image_url: { url: imageDataUrl } },
      ],
    });
  } else {
    payloadMessages.push({ role: latest.role, content: latest.content });
  }
  return payloadMessages;
}

async function callEndpoint(endpoint: AiEndpoint, model: string, messages: PublicChatMessage[], reasoningLevel: ReasoningLevel, imageDataUrl?: string) {
  const started = Date.now();
  const response = await fetch(joinUrl(endpoint.baseUrl, 'chat/completions'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${endpoint.apiKey}` },
    body: JSON.stringify({
      model,
      messages: buildPayloadMessages(messages, reasoningLevel, imageDataUrl),
      temperature: aiConfig.temperature ?? 0.7,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || data?.message || `HTTP ${response.status}`);
  const reply = extractReplyText(data);
  if (!reply) {
    const finishReason = data?.choices?.[0]?.finish_reason;
    throw new Error(finishReason ? `模型没有返回正文（finish_reason: ${finishReason}）` : '模型没有返回正文，已自动切换下一个 Key');
  }
  return { reply, latencyMs: Date.now() - started };
}

async function checkEndpoint(endpoint: AiEndpoint) {
  const started = Date.now();
  try {
    const response = await fetch(joinUrl(endpoint.baseUrl, 'models'), {
      method: 'GET',
      headers: { Authorization: `Bearer ${endpoint.apiKey}`, 'User-Agent': 'sh-zmd-ai-endpoint-checker/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    const latencyMs = Date.now() - started;
    const reachable = [200, 401, 403].includes(response.status);
    return {
      name: endpoint.name,
      source: endpoint.source,
      ok: reachable,
      latencyMs,
      statusCode: response.status,
      message: reachable ? '接口可达' : `HTTP ${response.status}`,
    };
  } catch (error: any) {
    return {
      name: endpoint.name,
      source: endpoint.source,
      ok: false,
      latencyMs: Date.now() - started,
      statusCode: null,
      message: error?.message || '检测失败',
    };
  }
}

export async function POST(req: Request) {
  try {
    const limited = checkRateLimit(getClientKey(req));
    if (limited) return json({ error: limited }, 429);

    const body = await req.json();
    const messages = sanitizeMessages(body?.messages);
    const imageDataUrl = typeof body?.imageDataUrl === 'string' ? body.imageDataUrl : '';
    const model = pickModel(body?.model);
    const reasoningLevel = pickReasoning(body?.reasoningLevel);

    if (messages.length === 0) return json({ error: '请输入要发送的内容。' }, 400);
    if (imageDataUrl && (!imageDataUrl.startsWith('data:image/') || estimateDataUrlBytes(imageDataUrl) > MAX_IMAGE_BYTES)) return json({ error: '识图图片过大或格式不正确。浏览器/平台请求体有上限，请压缩后再上传。' }, 413);
    if ((aiConfig.provider || 'openai-compatible') !== 'openai-compatible') return json({ error: '公开 AI 聊天目前使用 OpenAI-compatible 接口。' }, 500);

    const endpoints = await getAiEndpoints();
    if (!endpoints.length) return json({ error: `没有可用 AI Key：资源库没有完整 Key，且环境变量 ${aiConfig.apiKeyEnv || 'SH_GPT'} 未配置。` }, 500);

    const failures: string[] = [];
    for (const endpoint of endpoints) {
      try {
        const result = await callEndpoint(endpoint, model, messages, reasoningLevel, imageDataUrl);
        return json({ reply: result.reply, model, reasoningLevel, usedEndpoint: { name: endpoint.name, source: endpoint.source, latencyMs: result.latencyMs } });
      } catch (error: any) {
        failures.push(`${endpoint.name}: ${error?.message || '调用失败'}`);
      }
    }
    return json({ error: `资源库里的 Key 都调用失败了：${failures.slice(0, 4).join('；')}` }, 502);
  } catch (error: any) {
    return json({ error: error?.message || 'AI 聊天请求失败。' }, 500);
  }
}

export async function GET(req: Request) {
  const endpoints = await getAiEndpoints();
  const url = new URL(req.url);
  const shouldCheck = url.searchParams.get('check') === '1';
  const checkedEndpoints = shouldCheck
    ? await Promise.all(endpoints.map((endpoint) => checkEndpoint(endpoint)))
    : endpoints.map((item) => ({ name: item.name, source: item.source, ok: item.source === 'resource' ? item.latencyMs !== null : true, latencyMs: item.latencyMs ?? null, statusCode: null, message: '待检测' }));
  return json({
    status: 'ready',
    models: MODEL_ALLOWLIST,
    endpointCount: endpoints.length,
    usableEndpointCount: checkedEndpoints.filter((item) => item.ok).length,
    endpoints: checkedEndpoints,
    limits: { rateLimitEnabled: SERVER_SIDE_RATE_LIMIT_ENABLED, cooldownSeconds: 0, maxRequestsPer10Minutes: null, maxImageMB: MAX_IMAGE_BYTES / 1024 / 1024, maxTextLength: MAX_TEXT_LENGTH, serverStorage: false },
  });
}
