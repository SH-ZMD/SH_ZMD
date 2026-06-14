import { siteConfig } from '../../../siteConfig';

export const runtime = 'nodejs';

type ChatRole = 'user' | 'assistant';
type ReasoningLevel = 'quick' | 'normal' | 'deep';

type PublicChatMessage = {
  role: ChatRole;
  content: string;
};

const aiConfig = (siteConfig.geminiConfig || {}) as {
  provider?: 'gemini' | 'openai-compatible';
  modelId?: string;
  apiBaseUrl?: string;
  apiKeyEnv?: string;
  temperature?: number;
};

const MAX_TEXT_LENGTH = 4000;
const MAX_HISTORY_MESSAGES = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const REQUEST_COOLDOWN_MS = 10 * 1000;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;
const MAX_OUTPUT_TOKENS = 1200;

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
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function getClientKey(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = req.headers.get('x-real-ip')?.trim();
  return forwarded || realIp || 'anonymous';
}

function checkRateLimit(clientKey: string) {
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

  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    return '这个 IP 10 分钟内的 AI 聊天次数已达上限，请稍后再试。';
  }

  current.count += 1;
  current.lastAt = now;
  requestWindows.set(clientKey, current);
  return '';
}

function readApiKey(envName?: string) {
  const candidates = [envName, 'SH_GPT', 'OPENAI_API_KEY', 'GEMINI_API_KEY'].filter(Boolean) as string[];
  for (const name of candidates) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return '';
}

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function estimateDataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.split(',')[1] || '';
  return Math.floor((base64.length * 3) / 4);
}

function sanitizeMessages(raw: unknown): PublicChatMessage[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => ({
      role: item?.role === 'assistant' ? 'assistant' as const : 'user' as const,
      content: String(item?.content || '').slice(0, MAX_TEXT_LENGTH),
    }))
    .filter((item) => item.content.trim().length > 0);
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
    '如果用户请求危险、违法、泄露密钥或隐私的内容，要拒绝并给安全替代方案。',
  ].join('\n');
}

async function callOpenAICompatible({
  messages,
  model,
  reasoningLevel,
  imageDataUrl,
  apiKey,
}: {
  messages: PublicChatMessage[];
  model: string;
  reasoningLevel: ReasoningLevel;
  imageDataUrl?: string;
  apiKey: string;
}) {
  const baseUrl = aiConfig.apiBaseUrl || 'https://api.openai.com/v1';
  const url = joinUrl(baseUrl, 'chat/completions');
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

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: payloadMessages,
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: aiConfig.temperature ?? 0.7,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `AI 接口请求失败：${response.status}`);
  }

  return data?.choices?.[0]?.message?.content || '我这次没有生成有效回复。';
}

export async function POST(req: Request) {
  try {
    const clientKey = getClientKey(req);
    const limited = checkRateLimit(clientKey);
    if (limited) return json({ error: limited }, 429);

    const body = await req.json();
    const messages = sanitizeMessages(body?.messages);
    const imageDataUrl = typeof body?.imageDataUrl === 'string' ? body.imageDataUrl : '';
    const model = pickModel(body?.model);
    const reasoningLevel = pickReasoning(body?.reasoningLevel);

    if (messages.length === 0) {
      return json({ error: '请输入要发送的内容。' }, 400);
    }

    const totalTextLength = messages.reduce((sum, message) => sum + message.content.length, 0);
    if (totalTextLength > MAX_TEXT_LENGTH * 2) {
      return json({ error: '本次对话内容太长，请缩短后再发送。' }, 413);
    }

    if (imageDataUrl) {
      if (!imageDataUrl.startsWith('data:image/')) {
        return json({ error: '只能上传图片文件。' }, 400);
      }
      if (estimateDataUrlBytes(imageDataUrl) > MAX_IMAGE_BYTES) {
        return json({ error: '识图图片不能超过 5MB，请压缩后再上传。' }, 413);
      }
    }

    const apiKey = readApiKey(aiConfig.apiKeyEnv);
    if (!apiKey) {
      return json({ error: `AI Key 未配置：请在 Vercel 环境变量里设置 ${aiConfig.apiKeyEnv || 'SH_GPT'}。` }, 500);
    }

    if ((aiConfig.provider || 'openai-compatible') !== 'openai-compatible') {
      return json({ error: '公开 AI 聊天目前使用 OpenAI-compatible 接口，请先把站点 AI provider 配置为 openai-compatible。' }, 500);
    }

    const reply = await callOpenAICompatible({ messages, model, reasoningLevel, imageDataUrl, apiKey });
    return json({ reply, model, reasoningLevel });
  } catch (error: any) {
    return json({ error: error?.message || 'AI 聊天请求失败。' }, 500);
  }
}

export async function GET() {
  return json({
    status: 'ready',
    models: MODEL_ALLOWLIST,
    limits: {
      cooldownSeconds: REQUEST_COOLDOWN_MS / 1000,
      maxRequestsPer10Minutes: MAX_REQUESTS_PER_WINDOW,
      maxImageMB: MAX_IMAGE_BYTES / 1024 / 1024,
      maxTextLength: MAX_TEXT_LENGTH,
    },
  });
}
