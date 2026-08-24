"use client";

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ImagePlus, Loader2, MessageSquareText, Reply, Send, X } from 'lucide-react';
import TurnstileWidget, { turnstileEnabled } from './TurnstileWidget';

type CommentImage = {
  url: string;
  thumbnailUrl?: string;
  alt?: string;
};

type CommentItem = {
  id: string;
  pageId?: string;
  parentId?: string | null;
  nickname?: string;
  author?: string;
  content: string;
  images?: CommentImage[];
  status?: 'published' | 'deleted';
  createdAt: string;
  updatedAt?: string;
};

type CommentsProps = {
  pageId?: string;
  compact?: boolean;
  className?: string;
};

const PRODUCTION_COMMENT_API = 'https://sh-zmd.vercel.app/api/comments';
const MAX_COMMENT_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_COMMENT_IMAGES = 3;
const MAX_CONTENT_LENGTH = 2000;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const COMMENT_REQUEST_TIMEOUT_MS = 12000;

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), COMMENT_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new Error('评论服务响应超时，请稍后重试。');
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

async function readJsonSafely(res: Response) {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function fetchProductionComments(pageId: string) {
  const remoteRes = await fetchWithTimeout(`${PRODUCTION_COMMENT_API}?pageId=${encodeURIComponent(pageId)}`, { cache: 'no-store' });
  const remoteData = await readJsonSafely(remoteRes);
  if (remoteRes.ok && Array.isArray(remoteData.comments)) return remoteData.comments as CommentItem[];
  return [];
}

async function uploadCommentImage(file: File, turnstileToken: string) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('只支持 jpg、png、webp、gif 图片。');
  }
  if (file.size > MAX_COMMENT_IMAGE_SIZE) {
    throw new Error('单张图片不能超过 5MB，请压缩后再上传。');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('turnstileToken', turnstileToken);
  const res = await fetchWithTimeout('/api/comment-images', { method: 'POST', body: formData });
  const data = await readJsonSafely(res);
  if (!res.ok || !data.url) throw new Error(data.error || '图片上传失败。');
  return {
    url: String(data.url),
    thumbnailUrl: data.thumbnailUrl ? String(data.thumbnailUrl) : String(data.url),
    alt: file.name || '评论图片',
  };
}

function authorName(comment: CommentItem) {
  return comment.nickname || comment.author || '路过的朋友';
}

function avatarText(name: string) {
  return (name.trim().slice(0, 1) || '留').toUpperCase();
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function splitMarkdownImages(content: string) {
  const images: CommentImage[] = [];
  const text = String(content || '').replace(/!\[[^\]]*]\(([^)]+)\)/g, (_, url: string) => {
    images.push({ url: url.trim(), thumbnailUrl: url.trim(), alt: '评论图片' });
    return '';
  }).trim();
  return { text, images };
}

function getDisplayContent(comment: CommentItem) {
  return splitMarkdownImages(comment.content).text || comment.content;
}

function getDisplayImages(comment: CommentItem) {
  const structured = Array.isArray(comment.images) ? comment.images.filter((item) => item?.url) : [];
  if (structured.length > 0) return structured;
  return splitMarkdownImages(comment.content).images;
}

export default function Comments({ pageId: explicitPageId, compact = false, className = '' }: CommentsProps = {}) {
  const pathname = usePathname();
  const routePageId = useMemo(() => pathname.replace(/\/$/, '') || '/', [pathname]);
  const pageId = useMemo(() => (explicitPageId || routePageId).replace(/\/$/, '') || '/', [explicitPageId, routePageId]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [content, setContent] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [imageUrls, setImageUrls] = useState<CommentImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [message, setMessage] = useState('');
  const [replyTarget, setReplyTarget] = useState<CommentItem | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [previewImage, setPreviewImage] = useState<CommentImage | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  const publishedComments = useMemo(() => comments.filter((comment) => comment.status !== 'deleted'), [comments]);
  const rootComments = useMemo(() => publishedComments.filter((comment) => !comment.parentId), [publishedComments]);
  const repliesByParent = useMemo(() => {
    const groups: Record<string, CommentItem[]> = {};
    for (const comment of publishedComments) {
      if (!comment.parentId) continue;
      groups[comment.parentId] = groups[comment.parentId] || [];
      groups[comment.parentId].push(comment);
    }
    return groups;
  }, [publishedComments]);

  const loadComments = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetchWithTimeout(`/api/comments?pageId=${encodeURIComponent(pageId)}`, { cache: 'no-store' });
      const data = await readJsonSafely(res);
      if (!res.ok) throw new Error(data.error || '评论读取失败。');
      if (Array.isArray(data.comments)) {
        setComments(data.comments);
        return;
      }
      setComments(await fetchProductionComments(pageId));
    } catch {
      try {
        setComments(await fetchProductionComments(pageId));
      } catch {
        setMessage('评论读取失败。');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [pageId]);

  const removeImage = (index: number) => {
    setImageUrls((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleImageFiles = async (files?: FileList | File[]) => {
    const selectedFiles = Array.from(files || []).filter((file) => file.type.startsWith('image/'));
    if (selectedFiles.length === 0) return;
    if (turnstileEnabled && !turnstileToken) {
      setMessage('请先完成人机验证，再上传图片。');
      return;
    }
    if (turnstileEnabled && selectedFiles.length > 1) {
      setMessage('启用人机验证后请一次上传一张图片。');
      return;
    }
    if (imageUrls.length + selectedFiles.length > MAX_COMMENT_IMAGES) {
      setMessage(`单条评论最多 ${MAX_COMMENT_IMAGES} 张图。`);
      return;
    }

    const invalid = selectedFiles.find((file) => !ALLOWED_IMAGE_TYPES.has(file.type));
    if (invalid) {
      setMessage(`${invalid.name} 格式不支持，只支持 jpg、png、webp、gif。`);
      return;
    }

    const oversized = selectedFiles.find((file) => file.size > MAX_COMMENT_IMAGE_SIZE);
    if (oversized) {
      setMessage(`${oversized.name} 超过 5MB，请压缩后再上传。`);
      return;
    }

    setUploadingImage(true);
    setMessage('正在上传图片...');
    try {
      const uploaded = await Promise.all(selectedFiles.map((file) => uploadCommentImage(file, turnstileToken)));
      setImageUrls((prev) => [...prev, ...uploaded].slice(0, MAX_COMMENT_IMAGES));
      if (turnstileEnabled) {
        setTurnstileResetKey((value) => value + 1);
        setMessage('图片已加入，请再次完成人机验证后发表评论。');
      } else {
        setMessage(`已加入 ${uploaded.length} 张图片，发布后会一起显示。`);
      }
    } catch (error: any) {
      setMessage(error.message || '图片上传失败。');
    } finally {
      setUploadingImage(false);
    }
  };

  const handlePasteImage = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const imageItem = Array.from(event.clipboardData?.items || []).find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (!file) return;
    event.preventDefault();
    handleImageFiles([file]);
  };

  const submitComment = async (parentId?: string) => {
    const cleanNickname = nickname.trim();
    const cleanContent = parentId ? replyContent.trim() : content.trim();

    if (!cleanNickname) {
      setMessage('请先填写昵称。');
      return;
    }
    if (!cleanContent) {
      setMessage(parentId ? '回复内容不能为空。' : '评论内容不能为空。');
      return;
    }
    if (turnstileEnabled && !turnstileToken) {
      setMessage('请先完成人机验证。');
      return;
    }

    setSubmitting(true);
    setMessage('');
    try {
      const payload = {
        pageId,
        parentId: parentId || null,
        nickname: cleanNickname,
        email,
        website,
        content: cleanContent,
        images: parentId ? [] : imageUrls,
        company: honeypot,
        turnstileToken,
      };
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      let data = await readJsonSafely(res);
      if (!res.ok) {
        const remoteRes = await fetchWithTimeout(PRODUCTION_COMMENT_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        data = await readJsonSafely(remoteRes);
        if (!remoteRes.ok) throw new Error(data.error || '发送失败。');
      }

      if (data.comment) {
        setComments((prev) => [data.comment, ...prev].filter(Boolean));
      } else {
        await loadComments();
      }
      if (parentId) {
        setReplyContent('');
        setReplyTarget(null);
      } else {
        setContent('');
        setImageUrls([]);
      }
      setMessage(data.message || '评论已发布。');
      setTurnstileResetKey((value) => value + 1);
    } catch (error: any) {
      setMessage(error.message || '发送失败。');
    } finally {
      setSubmitting(false);
    }
  };

  const renderImages = (images: CommentImage[], small = false) => {
    if (!images.length) return null;
    return (
      <div className={`mt-3 grid min-w-0 gap-2 ${small ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3'}`}>
        {images.map((image, index) => (
          <button
            type="button"
            key={`${image.url}-${index}`}
            onClick={() => setPreviewImage(image)}
            className={`${small ? 'h-20' : 'h-28 sm:h-32'} min-w-0 overflow-hidden rounded-2xl border border-white/15 bg-white/5 transition hover:-translate-y-0.5 hover:border-indigo-300/60`}
          >
            <img src={image.thumbnailUrl || image.url} alt={image.alt || '评论图片'} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    );
  };

  const renderReplyEditor = (target: CommentItem) => (
    <div className="mt-4 w-full min-w-0 max-w-full overflow-hidden rounded-[20px] border border-indigo-300/25 bg-indigo-500/10 p-3 sm:rounded-[22px] sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-black text-indigo-200">回复 {authorName(target)}</p>
        <button
          type="button"
          onClick={() => {
            setReplyTarget(null);
            setReplyContent('');
          }}
          className="text-xs font-bold text-slate-400 transition hover:text-white"
        >
          取消
        </button>
      </div>
      <textarea
        value={replyContent}
        onChange={(event) => setReplyContent(event.target.value)}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') submitComment(target.id);
        }}
        maxLength={MAX_CONTENT_LENGTH}
        placeholder="写下你的回复..."
        rows={3}
        className="box-border min-h-24 w-full min-w-0 resize-y rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm leading-7 text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/15"
      />
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => submitComment(target.id)}
          disabled={submitting}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-4 text-xs font-black text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-600 disabled:opacity-50 sm:w-auto"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          发送回复
        </button>
      </div>
    </div>
  );

  return (
    <section className={`w-full min-w-0 max-w-full overflow-x-clip ${compact ? 'mt-4' : 'mt-10 md:mt-12'} ${className}`}>
      <div className="w-full min-w-0 max-w-full overflow-hidden rounded-[24px] border border-white/15 bg-[oklch(25.7%_0.054_259.7/0.72)] text-white shadow-2xl shadow-slate-950/30 backdrop-blur-2xl sm:rounded-[28px]">
        <div className="border-b border-white/10 bg-white/[0.04] px-4 py-4 sm:px-5 md:px-7 md:py-5">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">MESSAGE BOARD</p>
              <h2 className={`${compact ? 'text-2xl' : 'text-3xl md:text-4xl'} mt-2 break-words font-black tracking-tight`}>评论区</h2>
              {!compact && <p className="mt-2 text-sm leading-6 text-slate-300">不用登录，填昵称就能评论；图片会作为附件保存，邮箱和网站不会公开展示。</p>}
            </div>
            <div className="inline-flex w-fit shrink-0 items-center gap-2 self-start rounded-full border border-white/10 bg-slate-950/25 px-4 py-2 text-xs font-bold text-slate-300 sm:self-auto">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.85)]" />
              {publishedComments.length} 条评论
            </div>
          </div>
        </div>

        <div className={`grid min-w-0 ${compact ? 'gap-3 p-3 sm:p-4' : 'gap-5 p-3 sm:p-4 md:p-6'}`}>
          <div className="w-full min-w-0 max-w-full overflow-hidden rounded-[20px] border border-indigo-400/25 bg-slate-950/35 p-3 shadow-inner shadow-indigo-950/20 sm:rounded-[24px] sm:p-4">
            <div className="mb-3 grid min-w-0 grid-cols-1 gap-3">
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                maxLength={32}
                placeholder="昵称 *"
                className="box-border h-12 w-full min-w-0 truncate rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/15"
              />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="邮箱（可选，不公开）"
                className="box-border h-12 w-full min-w-0 truncate rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/15"
              />
              <input
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                placeholder="网站（可选，不公开）"
                className="box-border h-12 w-full min-w-0 truncate rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/15"
              />
              <input
                value={honeypot}
                onChange={(event) => setHoneypot(event.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="pointer-events-none absolute left-[-10000px] top-auto h-0 w-0 opacity-0"
              />
            </div>

            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              onPaste={handlePasteImage}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') submitComment();
              }}
              maxLength={MAX_CONTENT_LENGTH}
              placeholder="把想说的话留在这里..."
              rows={4}
              className="box-border min-h-32 w-full min-w-0 resize-y rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm leading-7 text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/15"
            />

            {imageUrls.length > 0 && (
              <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-3">
                {imageUrls.map((image, index) => (
                  <div key={`${image.url}-${index}`} className="relative h-28 min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                    <img src={image.thumbnailUrl || image.url} alt={image.alt || '待发布图片'} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-slate-950/70 text-white backdrop-blur transition hover:bg-rose-500"
                      aria-label="移除图片"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-3">
              <TurnstileWidget onToken={setTurnstileToken} resetKey={turnstileResetKey} />
              <div className="flex min-w-0 flex-wrap items-center gap-3 text-xs text-slate-400">
                <span>{content.length} / {MAX_CONTENT_LENGTH}</span>
                <span>图片 {imageUrls.length} / {MAX_COMMENT_IMAGES}</span>
                <span>Ctrl + Enter 发送</span>
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-2">
                <label className="inline-flex h-11 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-slate-200 transition hover:bg-white/10 sm:px-4">
                  {uploadingImage ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                  <span className="truncate">{uploadingImage ? '上传中' : '添加图片'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      handleImageFiles(event.target.files || undefined);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => submitComment()}
                  disabled={submitting || uploadingImage}
                  className="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-indigo-400 to-indigo-600 px-3 text-sm font-black text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50 sm:px-5"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  <span className="truncate">{submitting ? '发送中' : '发表评论'}</span>
                </button>
              </div>
            </div>

            {message && <p className="mt-3 min-w-0 break-words rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-bold text-slate-300">{message}</p>}
          </div>

          <div className="grid gap-4">
            {loading && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-8 text-center text-sm font-bold text-slate-400">
                正在读取评论...
              </div>
            )}
            {!loading && rootComments.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-8 text-center text-sm font-bold text-slate-400">
                还没有评论，先写第一条。
              </div>
            )}
            {rootComments.map((comment) => {
              const name = authorName(comment);
              const replies = repliesByParent[comment.id] || [];
              return (
                <article key={comment.id} className="w-full min-w-0 max-w-full overflow-hidden rounded-[20px] border border-white/10 bg-slate-950/40 p-3 shadow-xl shadow-slate-950/20 sm:rounded-[24px] sm:p-4">
                  <div className="grid min-w-0 grid-cols-[36px_minmax(0,1fr)] gap-2 sm:grid-cols-[42px_minmax(0,1fr)] sm:gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-gradient-to-br from-indigo-400/35 to-sky-400/20 text-sm font-black text-white sm:h-11 sm:w-11 sm:rounded-2xl sm:text-base">
                      {avatarText(name)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                        <h3 className="min-w-0 break-words font-black text-white">{name}</h3>
                        <time className="shrink-0 font-mono text-[11px] text-slate-500">{formatDate(comment.createdAt)}</time>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-200">{getDisplayContent(comment)}</p>
                      {renderImages(getDisplayImages(comment))}
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setReplyTarget((current) => (current?.id === comment.id ? null : comment));
                            setReplyContent('');
                          }}
                          className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-black text-slate-300 transition hover:bg-white/10 hover:text-white"
                        >
                          <Reply size={14} /> 回复
                        </button>
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500">
                          <MessageSquareText size={13} /> {replies.length} 条回复
                        </span>
                      </div>

                      {replyTarget?.id === comment.id && renderReplyEditor(comment)}

                      {replies.length > 0 && (
                        <div className="relative mt-4 grid min-w-0 gap-3 border-l border-white/15 pl-3 sm:pl-4">
                          {replies.map((reply) => {
                            const replyName = authorName(reply);
                            return (
                              <div key={reply.id} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-3 sm:px-4">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                                  <span className="text-sm font-black text-indigo-100">{replyName}</span>
                                  <time className="font-mono text-[10px] text-slate-500">{formatDate(reply.createdAt)}</time>
                                </div>
                                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">{getDisplayContent(reply)}</p>
                                {renderImages(getDisplayImages(reply), true)}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      {previewImage && (
        <div className="fixed inset-0 z-[1200] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-md" onClick={() => setPreviewImage(null)}>
          <button type="button" className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="关闭预览">
            <X size={20} />
          </button>
          <img src={previewImage.url} alt={previewImage.alt || '评论图片'} className="max-h-[88vh] max-w-[94vw] rounded-3xl border border-white/15 object-contain shadow-2xl" />
        </div>
      )}
    </section>
  );
}
