"use client";

import { useEffect, useState } from 'react';

type CommentItem = {
  id: string;
  author: string;
  content: string;
  createdAt: string;
};

interface MomentCommentsSimpleProps {
  id: string;
  path: string;
}

export default function MomentCommentsSimple({ id, path }: MomentCommentsSimpleProps) {
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
      const res = await fetch(`/api/comments?pageId=${encodeURIComponent(path)}`, { cache: 'no-store' });
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
  }, [path]);

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
        body: JSON.stringify({ pageId: path, author: cleanAuthor, content: cleanContent }),
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
    <div className="w-full relative">
      <div className="grid grid-cols-1 gap-3">
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="昵称（可不填）"
          className="w-full bg-white/40 dark:bg-slate-950/40 border border-white/50 dark:border-slate-700/60 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="不用登录 GitHub，直接写留言就行。"
          rows={3}
          className="w-full bg-white/40 dark:bg-slate-950/40 border border-white/50 dark:border-slate-700/60 rounded-xl px-3 py-2 text-sm outline-none resize-y focus:ring-2 focus:ring-indigo-500/50"
        />
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {message || '支持 Markdown；留言会先保存到站点留言箱。'}
          </p>
          <button
            onClick={submitComment}
            disabled={submitting}
            className="px-5 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/30 transition-all"
          >
            {submitting ? '发送中...' : '发送留言'}
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {loading && <p className="text-center text-xs text-slate-500">正在读取留言...</p>}
        {!loading && comments.length === 0 && (
          <p className="text-center text-xs text-slate-500">还没有留言，来当第一个吧。</p>
        )}
        {comments.map((comment) => (
          <article
            key={comment.id}
            className="rounded-xl bg-white/30 dark:bg-slate-950/30 border border-white/40 dark:border-slate-700/50 p-3 backdrop-blur-lg"
          >
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <span className="text-sm font-bold text-[#576b95] dark:text-[#7f99cc]">{comment.author}</span>
              <time className="text-[10px] text-slate-400">
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
  );
}
