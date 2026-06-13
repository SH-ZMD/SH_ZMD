"use client";

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

type CommentItem = {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  parentId?: string | null;
};

function withImages(content: string, imageUrls: string[]) {
  const cleanContent = content.trim();
  const cleanUrls = imageUrls.map((url) => url.trim()).filter(Boolean);
  if (cleanUrls.length === 0) return cleanContent;

  const images = cleanUrls.map((url) => `![留言图片](${url})`).join('\n\n');
  return `${cleanContent}${cleanContent ? '\n\n' : ''}${images}`;
}

async function uploadCommentImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/comment-images', {
    method: 'POST',
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error || '图片上传失败');
  return data.url as string;
}

function renderCommentContent(content: string) {
  const parts = String(content || '').split(/(!\[[^\]]*\]\([^)]+\))/g);
  return parts.map((part, index) => {
    const imageMatch = part.match(/^!\[[^\]]*\]\(([^)]+)\)$/);
    if (imageMatch) {
      return (
        <img
          key={index}
          src={imageMatch[1]}
          alt="留言图片"
          className="mt-3 max-h-80 w-auto max-w-full rounded-2xl border border-white/30 object-contain"
        />
      );
    }
    return part ? (
      <span key={index} className="whitespace-pre-wrap">
        {part}
      </span>
    ) : null;
  });
}

export default function Comments() {
  const pathname = usePathname();
  const pageId = useMemo(() => pathname.replace(/\/$/, '') || '/', [pathname]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [author, setAuthor] = useState('');
  const [content, setContent] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [message, setMessage] = useState('');
  const [replyTarget, setReplyTarget] = useState<CommentItem | null>(null);
  const [replyContent, setReplyContent] = useState('');

  const rootComments = useMemo(() => comments.filter((comment) => !comment.parentId), [comments]);
  const repliesByParent = useMemo(() => {
    const groups: Record<string, CommentItem[]> = {};
    for (const comment of comments) {
      if (!comment.parentId) continue;
      groups[comment.parentId] = groups[comment.parentId] || [];
      groups[comment.parentId].push(comment);
    }
    return groups;
  }, [comments]);

  const loadComments = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`/api/comments?pageId=${encodeURIComponent(pageId)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '留言读取失败');
      setComments(data.comments || []);
    } catch (error: any) {
      setMessage(error.message || '留言读取失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [pageId]);

  const submitComment = async (parentId?: string) => {
    const cleanAuthor = author.trim() || '路过的朋友';
    const cleanContent = parentId ? replyContent.trim() : withImages(content, imageUrls);
    if (!cleanContent) {
      setMessage('先写点内容再发送吧。');
      return;
    }

    setSubmitting(true);
    setMessage('');
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, author: cleanAuthor, content: cleanContent, parentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '发送失败');
      setContent('');
      setImageUrls([]);
      setReplyContent('');
      setReplyTarget(null);
      setAuthor('');
      setComments((prev) => [data.comment, ...prev].filter(Boolean));
      setMessage('留言已送达。');
    } catch (error: any) {
      setMessage(error.message || '发送失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageFiles = async (files?: FileList | File[]) => {
    const selectedFiles = Array.from(files || []).filter((file) => file.type.startsWith('image/'));
    if (selectedFiles.length === 0) return;

    setUploadingImage(true);
    setMessage('正在上传图片...');
    try {
      const urls = await Promise.all(selectedFiles.map((file) => uploadCommentImage(file)));
      setImageUrls((prev) => [...prev, ...urls]);
      setMessage(`已插入 ${urls.length} 张图片，发送留言后会一起显示。`);
    } catch (error: any) {
      setMessage(error.message || '图片上传失败');
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
    await handleImageFiles([file]);
  };

  return (
    <div className="w-full mt-12 relative">
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-indigo-500/10 dark:bg-indigo-500/20 blur-3xl rounded-full pointer-events-none z-0"></div>

      <div className="relative z-10 pt-6 border-t border-slate-200/50 dark:border-slate-700/50">
        <div className="grid grid-cols-1 gap-4">
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="昵称（可不填）"
            className="w-full bg-white/40 dark:bg-slate-950/40 border border-white/50 dark:border-slate-700/60 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onPaste={handlePasteImage}
            placeholder="不用登录 GitHub，直接写留言就行。"
            rows={4}
            className="w-full bg-white/40 dark:bg-slate-950/40 border border-white/50 dark:border-slate-700/60 rounded-2xl px-4 py-3 text-sm outline-none resize-y focus:ring-2 focus:ring-indigo-500/50"
          />
          <div className="flex flex-col gap-3 rounded-2xl border border-white/35 bg-white/20 p-3 dark:border-slate-700/60 dark:bg-slate-950/20">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-indigo-500 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-600">
                {uploadingImage ? '上传中...' : '插入图片'}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    handleImageFiles(event.target.files || undefined);
                    event.currentTarget.value = '';
                  }}
                />
              </label>
              {imageUrls.length > 0 && (
                <button
                  onClick={() => setImageUrls([])}
                  className="rounded-2xl border border-white/40 px-4 py-2.5 text-xs font-bold text-slate-500 transition hover:text-slate-800 dark:text-slate-300 dark:hover:text-white"
                >
                  移除全部图片
                </button>
              )}
            </div>
            {imageUrls.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {imageUrls.map((url, index) => (
                  <div key={`${url}-${index}`} className="relative">
                    <img src={url} alt="待发送图片" className="h-32 w-full rounded-2xl border border-white/30 object-cover" />
                    <button
                      type="button"
                      onClick={() => setImageUrls((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                      className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-black text-white backdrop-blur"
                    >
                      移除
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <input
                onChange={(e) => setImageUrls(e.target.value.trim() ? [e.target.value.trim()] : [])}
                placeholder="也可以粘贴图片链接"
                className="w-full bg-white/40 dark:bg-slate-950/40 border border-white/50 dark:border-slate-700/60 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {message || '支持 Markdown；留言会先保存到站点留言箱。'}
            </p>
            <button
              onClick={() => submitComment()}
              disabled={submitting || uploadingImage}
              className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white rounded-2xl text-sm font-black shadow-lg shadow-indigo-500/30 transition-all"
            >
              {uploadingImage ? '图片上传中...' : submitting ? '发送中...' : '发送留言'}
            </button>
          </div>
        </div>

        {replyTarget && (
          <div className="mt-6 rounded-2xl border border-indigo-400/40 bg-indigo-500/10 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-bold text-indigo-500">回复 {replyTarget.author}</p>
              <button onClick={() => { setReplyTarget(null); setReplyContent(''); }} className="text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-white">
                取消
              </button>
            </div>
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="写下你的回复..."
              rows={3}
              className="w-full bg-white/40 dark:bg-slate-950/40 border border-white/50 dark:border-slate-700/60 rounded-2xl px-4 py-3 text-sm outline-none resize-y focus:ring-2 focus:ring-indigo-500/50"
            />
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => submitComment(replyTarget.id)}
                disabled={submitting}
                className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white rounded-2xl text-sm font-black shadow-lg shadow-indigo-500/30 transition-all"
              >
                {submitting ? '发送中...' : '发送回复'}
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 space-y-4">
          {loading && <p className="text-center text-sm text-slate-500">正在读取留言...</p>}
          {!loading && rootComments.length === 0 && (
            <p className="text-center text-sm text-slate-500">还没有留言，来当第一个吧。</p>
          )}
          {rootComments.map((comment) => (
            <article
              key={comment.id}
              className="rounded-2xl bg-white/35 dark:bg-slate-950/35 border border-white/45 dark:border-slate-700/60 p-4 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between gap-4 mb-2">
                <span className="text-sm font-black text-slate-800 dark:text-slate-100">{comment.author}</span>
                <time className="text-[11px] text-slate-400">
                  {new Date(comment.createdAt).toLocaleString('zh-CN')}
                </time>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                {renderCommentContent(comment.content)}
              </p>
              <button
                onClick={() => setReplyTarget(comment)}
                className="mt-3 text-xs font-black text-indigo-500 hover:text-indigo-600"
              >
                回复
              </button>
              {repliesByParent[comment.id]?.length > 0 && (
                <div className="mt-4 space-y-3 border-l-2 border-indigo-400/40 pl-4">
                  {repliesByParent[comment.id].map((reply) => (
                    <div key={reply.id} className="rounded-2xl bg-white/25 dark:bg-slate-900/45 p-3">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <span className="text-xs font-black text-indigo-500">{reply.author}</span>
                        <time className="text-[10px] text-slate-400">
                          {new Date(reply.createdAt).toLocaleString('zh-CN')}
                        </time>
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                        {renderCommentContent(reply.content)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
