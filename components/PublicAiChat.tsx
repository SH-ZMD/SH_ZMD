"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, BrainCircuit, ImagePlus, Loader2, Send, ShieldCheck, Sparkles, Trash2, UserRound, X } from 'lucide-react';

type ChatRole = 'user' | 'assistant';
type ReasoningLevel = 'quick' | 'normal' | 'deep';

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  imageDataUrl?: string;
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_LENGTH = 4000;

const MODELS = [
  { id: 'gpt-5.4', label: '站长默认 GPT' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
  { id: 'gpt-4o', label: 'GPT-4o / 识图' },
];

const REASONING_OPTIONS: { id: ReasoningLevel; label: string; desc: string }[] = [
  { id: 'quick', label: '快速', desc: '短回答，省额度' },
  { id: 'normal', label: '标准', desc: '日常问答' },
  { id: 'deep', label: '深入', desc: '更完整分析' },
];

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export default function PublicAiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好，我是站内 AI 聊天工具。可以问问题、写代码、总结内容，也可以上传一张图让我分析。',
    },
  ]);
  const [input, setInput] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [imageName, setImageName] = useState('');
  const [model, setModel] = useState(MODELS[0].id);
  const [reasoningLevel, setReasoningLevel] = useState<ReasoningLevel>('normal');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remainingChars = MAX_TEXT_LENGTH - input.length;
  const canSend = useMemo(() => (input.trim().length > 0 || imageDataUrl) && !isSending && remainingChars >= 0, [imageDataUrl, input, isSending, remainingChars]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isSending]);

  async function handleImage(file?: File) {
    setError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('只能上传图片文件。');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`识图图片不能超过 5MB，当前是 ${formatBytes(file.size)}，请压缩后再上传。`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(String(reader.result || ''));
      setImageName(file.name);
    };
    reader.onerror = () => setError('图片读取失败，请换一张试试。');
    reader.readAsDataURL(file);
  }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    if (!canSend) return;

    const text = input.trim() || '请分析这张图片。';
    const userMessage: ChatMessage = {
      id: uid(),
      role: 'user',
      content: text,
      imageDataUrl: imageDataUrl || undefined,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setImageDataUrl('');
    setImageName('');
    setError('');
    setIsSending(true);

    try {
      const res = await fetch('/api/public-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          reasoningLevel,
          imageDataUrl: userMessage.imageDataUrl,
          messages: nextMessages
            .filter((message) => message.id !== 'welcome')
            .slice(-10)
            .map((message) => ({ role: message.role, content: message.content })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'AI 请求失败，请稍后再试。');

      setMessages((current) => [
        ...current,
        {
          id: uid(),
          role: 'assistant',
          content: data?.reply || '我这次没有生成有效回复。',
        },
      ]);
    } catch (err: any) {
      setError(err?.message || 'AI 请求失败，请稍后再试。');
      setMessages((current) => current.filter((message) => message.id !== userMessage.id));
      setInput(text === '请分析这张图片。' ? '' : text);
      if (userMessage.imageDataUrl) {
        setImageDataUrl(userMessage.imageDataUrl);
        setImageName(imageName || '已选择图片');
      }
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="mx-auto w-[94%] max-w-6xl pt-28 md:pt-32 text-slate-900 dark:text-white">
      <div className="relative overflow-hidden rounded-[34px] border border-white/40 bg-white/40 p-5 shadow-2xl shadow-slate-900/10 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/45 md:p-8">
        <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-10 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl" />

        <div className="relative grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
          <aside className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/15 px-4 py-2 text-xs font-black uppercase tracking-[0.28em] text-indigo-500 dark:text-indigo-200">
              <Sparkles className="h-4 w-4" /> AI Chat
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight md:text-6xl">站内 GPT 聊天室</h1>
              <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300 md:text-base">
                直接在网站里使用 GPT：支持连续对话、识图、模型选择和思考强度。为了不烧额度，已经加了频率限制和图片大小限制。
              </p>
            </div>

            <div className="rounded-3xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-sm text-emerald-900 dark:text-emerald-100">
              <div className="flex items-center gap-2 font-black">
                <ShieldCheck className="h-5 w-5" /> 安全与占用控制
              </div>
              <ul className="mt-3 space-y-2 text-xs leading-6 opacity-90">
                <li>• 不需要个人服务器，走站点后端 API 代理，Key 不会暴露到浏览器。</li>
                <li>• 每个 IP：10 秒冷却，10 分钟最多 20 次。</li>
                <li>• 识图图片限制 5MB，文本限制 4000 字。</li>
                <li>• “思考强度”只控制回答深度，不展示隐藏推理链。</li>
              </ul>
            </div>

            <div className="grid gap-3 rounded-3xl border border-white/45 bg-white/35 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
              <label className="text-xs font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">模型</label>
              <select
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="rounded-2xl border border-white/50 bg-white/70 px-4 py-3 text-sm font-bold outline-none transition focus:border-indigo-400 dark:border-white/10 dark:bg-slate-900/80"
              >
                {MODELS.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>

              <label className="mt-2 text-xs font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">思考强度</label>
              <div className="grid grid-cols-3 gap-2">
                {REASONING_OPTIONS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setReasoningLevel(item.id)}
                    className={`rounded-2xl border px-3 py-3 text-left transition ${reasoningLevel === item.id ? 'border-indigo-400 bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'border-white/45 bg-white/35 hover:bg-white/55 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10'}`}
                  >
                    <span className="block text-sm font-black">{item.label}</span>
                    <span className="mt-1 block text-[11px] opacity-75">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className="flex min-h-[640px] flex-col overflow-hidden rounded-[30px] border border-white/45 bg-slate-950/80 shadow-2xl shadow-slate-950/20 dark:border-white/10">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/30">
                  <BrainCircuit className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-black text-white">SH_ZMD AI</p>
                  <p className="text-xs text-slate-400">{MODELS.find((item) => item.id === model)?.label} · {REASONING_OPTIONS.find((item) => item.id === reasoningLevel)?.label}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMessages(messages.slice(0, 1));
                  setError('');
                }}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs font-black text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <Trash2 className="h-4 w-4" /> 清空
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 md:px-6">
              {messages.map((message) => {
                const isUser = message.role === 'user';
                return (
                  <div key={message.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    {!isUser && <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-indigo-500 text-white"><Bot className="h-4 w-4" /></div>}
                    <div className={`max-w-[82%] rounded-[24px] px-4 py-3 text-sm leading-7 shadow-lg ${isUser ? 'bg-indigo-500 text-white shadow-indigo-500/20' : 'bg-white/10 text-slate-100 shadow-black/10'}`}>
                      {message.imageDataUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={message.imageDataUrl} alt="上传的图片" className="mb-3 max-h-64 rounded-2xl border border-white/10 object-contain" />
                      )}
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    </div>
                    {isUser && <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-white/10 text-white"><UserRound className="h-4 w-4" /></div>}
                  </div>
                );
              })}
              {isSending && (
                <div className="flex items-center gap-3 text-sm font-bold text-slate-300">
                  <div className="grid h-9 w-9 place-items-center rounded-2xl bg-indigo-500 text-white"><Bot className="h-4 w-4" /></div>
                  <Loader2 className="h-4 w-4 animate-spin" /> 正在思考中...
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={sendMessage} className="border-t border-white/10 bg-slate-950/70 p-4">
              {error && <div className="mb-3 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-100">{error}</div>}
              {imageDataUrl && (
                <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-indigo-400/20 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-100">
                  <span className="truncate">已选择图片：{imageName || '未命名图片'}</span>
                  <button type="button" onClick={() => { setImageDataUrl(''); setImageName(''); }} className="rounded-full p-1 hover:bg-white/10"><X className="h-4 w-4" /></button>
                </div>
              )}
              <div className="flex items-end gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => handleImage(event.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/10 text-white transition hover:bg-white/15"
                  title="上传图片识别"
                >
                  <ImagePlus className="h-5 w-5" />
                </button>
                <div className="flex-1">
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value.slice(0, MAX_TEXT_LENGTH + 100))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="输入你想问的问题，Shift + Enter 换行..."
                    className="max-h-40 min-h-12 w-full resize-none rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-400"
                  />
                  <div className={`mt-1 text-right text-[11px] ${remainingChars < 0 ? 'text-rose-300' : 'text-slate-500'}`}>{remainingChars} 字</div>
                </div>
                <button
                  type="submit"
                  disabled={!canSend}
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-45"
                  title="发送"
                >
                  {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
