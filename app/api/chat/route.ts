import { siteConfig } from '../../../siteConfig';

export const runtime = 'edge';

type AiProvider = 'gemini' | 'openai-compatible';

const aiConfig = (siteConfig.geminiConfig || {}) as {
  provider?: AiProvider;
  modelId?: string;
  apiBaseUrl?: string;
  apiKeyEnv?: string;
  systemPrompt?: string;
  maxOutputTokens?: number;
  temperature?: number;
};

function readApiKey(envName?: string) {
  const candidates = [
    envName,
    aiConfig.provider === 'openai-compatible' ? 'OPENAI_API_KEY' : 'GEMINI_API_KEY',
    'GEMINI_API_KEY',
    'OPENAI_API_KEY',
  ].filter(Boolean) as string[];

  for (const name of candidates) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }

  return '';
}

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

async function callGemini(message: string, apiKey: string) {
  const modelId = aiConfig.modelId || 'gemini-2.5-flash-lite';
  const baseUrl = aiConfig.apiBaseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  const url = `${joinUrl(baseUrl, `models/${modelId}:generateContent`)}?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: aiConfig.systemPrompt || '' }]
      },
      contents: [{
        parts: [{ text: message }]
      }],
      generationConfig: {
        maxOutputTokens: aiConfig.maxOutputTokens || 150,
        temperature: aiConfig.temperature ?? 0.85,
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || `Gemini request failed: ${response.status}`);
  }

  return data.candidates?.[0]?.content?.parts?.[0]?.text || '我现在没有想好怎么回答。';
}

async function callOpenAICompatible(message: string, apiKey: string) {
  const modelId = aiConfig.modelId || 'gpt-4o-mini';
  const baseUrl = aiConfig.apiBaseUrl || 'https://api.openai.com/v1';
  const url = joinUrl(baseUrl, 'chat/completions');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: 'system', content: aiConfig.systemPrompt || '' },
        { role: 'user', content: message },
      ],
      max_tokens: aiConfig.maxOutputTokens || 150,
      temperature: aiConfig.temperature ?? 0.85,
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || `OpenAI-compatible request failed: ${response.status}`);
  }

  return data.choices?.[0]?.message?.content || '我现在没有想好怎么回答。';
}

export async function POST(req: Request) {
  try {
    const { message } = await req.json();
    const provider = (aiConfig.provider || 'gemini') as AiProvider;
    const apiKey = readApiKey(aiConfig.apiKeyEnv);

    if (!apiKey) {
      return new Response(JSON.stringify({
        error: `API Key missing. Please set ${aiConfig.apiKeyEnv || (provider === 'openai-compatible' ? 'OPENAI_API_KEY' : 'GEMINI_API_KEY')} in Vercel Environment Variables.`
      }), { status: 500 });
    }

    const reply = provider === 'openai-compatible'
      ? await callOpenAICompatible(message, apiKey)
      : await callGemini(message, apiKey);

    return new Response(JSON.stringify({ reply }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'AI request failed' }), { status: 500 });
  }
}

export async function GET() {
  return new Response(JSON.stringify({
    status: 'Ready',
    provider: aiConfig.provider || 'gemini',
    model: aiConfig.modelId || 'gemini-2.5-flash-lite',
  }), { status: 200 });
}
