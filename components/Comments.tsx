"use client";

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

type CommentItem = {
  id: string;
  author: string;
  content: string;
  createdAt: string;
};

export default function Comments() {
  const pathname = usePathname();
  const pageId = useMemo(() => pathname.replace(/\/$/, '') || '/', [pathname]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [author, setAuthor] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

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

  const submitComment = async () => {
    const cleanAuthor = author.trim() || '路过的朋友';
    const cleanContent = content.trim();
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
        body: JSON.stringify({ pageId, author: cleanAuthor, content: cleanContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '发送失败');
      setContent('');
      setAuthor('');
      setComments((prev) => [data.comment, ...prev].filter(Boolean));
      setMessage('留言已送达。');
    } catch (error: any) {
      setMessage(error.message || '发送失败');
    } finally {
      setSubmitting(false);
    }
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
            placeholder="不用登录 GitHub，直接写留言就行。"
            rows={4}
            className="w-full bg-white/40 dark:bg-slate-950/40 border border-white/50 dark:border-slate-700/60 rounded-2xl px-4 py-3 text-sm outline-none resize-y focus:ring-2 focus:ring-indigo-500/50"
          />
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {message || '支持 Markdown；留言会先保存到站点留言箱。'}
            </p>
            <button
              onClick={submitComment}
              disabled={submitting}
              className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white rounded-2xl text-sm font-black shadow-lg shadow-indigo-500/30 transition-all"
            >
              {submitting ? '发送中...' : '发送留言'}
            </button>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          {loading && <p className="text-center text-sm text-slate-500">正在读取留言...</p>}
          {!loading && comments.length === 0 && (
            <p className="text-center text-sm text-slate-500">还没有留言，来当第一个吧。</p>
          )}
          {comments.map((comment) => (
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
                {comment.content}
              </p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
