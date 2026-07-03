"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CheckCheck, MessageCircle, RefreshCw, Trash2 } from 'lucide-react';

type RecentComment = {
  id: string;
  pageId: string;
  pageUrl: string;
  author: string;
  content: string;
  createdAt: string;
  parentId?: string | null;
};

type CommentSummaryResponse = {
  comments?: RecentComment[];
  latestAt?: string | null;
  error?: string;
};

const LAST_SEEN_KEY = 'blog-comment-last-seen-at';
const PRODUCTION_COMMENT_API = 'https://sh-zmd.vercel.app/api/comments';

const getBackendApiBase = async () => {
  const configRes = await fetch(`/backend_config.json?t=${Date.now()}`);
  const config = await configRes.json();
  return `http://127.0.0.1:${config.api_port}`;
};

async function readJsonSafely(res: Response) {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? (error.message || fallback) : fallback;
}

function formatPageName(pageId: string) {
  if (!pageId || pageId === '/') return '首页';
  const clean = pageId.replace(/^\/+/, '');
  const parts = clean.split('/').filter(Boolean);
  if (parts[0] === 'posts') return `文章：${decodeURIComponent(parts[1] || '')}`;
  if (parts[0] === 'chatter') return `杂谈：${decodeURIComponent(parts[1] || '')}`;
  if (parts[0] === 'moments') return '说说';
  if (parts[0] === 'friends') return '友链';
  if (parts[0] === 'music') return '音乐';
  return `页面：/${clean}`;
}

function shortText(text: string) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  return clean.length > 56 ? `${clean.slice(0, 56)}...` : clean;
}

export default function CommentNotifier() {
  const [comments, setComments] = useState<RecentComment[]>([]);
  const [latestAt, setLatestAt] = useState<string | null>(null);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadComments = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/comments?summary=1&t=${Date.now()}`, { cache: 'no-store' });
      let data = await readJsonSafely(res) as CommentSummaryResponse;
      if (!res.ok) {
        const remoteRes = await fetch(`${PRODUCTION_COMMENT_API}?summary=1&t=${Date.now()}`, { cache: 'no-store' });
        data = await readJsonSafely(remoteRes) as CommentSummaryResponse;
        if (!remoteRes.ok) throw new Error(data.error || '留言提醒读取失败');
      }
      setComments(Array.isArray(data.comments) ? data.comments : []);
      setLatestAt(data.latestAt || null);
    } catch (err: unknown) {
      setError(getErrorMessage(err, '留言提醒读取失败'));
    } finally {
      setLoading(false);
    }
  };

  const loadReadState = async () => {
    const saved = localStorage.getItem(LAST_SEEN_KEY);
    if (saved) setLastSeenAt(saved);

    try {
      const apiBase = await getBackendApiBase();
      const res = await fetch(`${apiBase}/api/comment-state/get?t=${Date.now()}`, { cache: 'no-store' });
      const data = await readJsonSafely(res);
      if (res.ok && data.lastSeenAt) {
        localStorage.setItem(LAST_SEEN_KEY, data.lastSeenAt);
        setLastSeenAt(data.lastSeenAt);
      }
    } catch {
      // 后端不可用时保留 localStorage 兜底。
    }
  };

  useEffect(() => {
    const init = async () => {
      await loadReadState();
      await loadComments();
    };

    init();
    const timer = window.setInterval(loadComments, 180000);
    return () => window.clearInterval(timer);
  }, []);

  const unreadComments = useMemo(() => {
    if (!lastSeenAt) return comments;
    const seenTime = new Date(lastSeenAt).getTime();
    return comments.filter((comment) => new Date(comment.createdAt).getTime() > seenTime);
  }, [comments, lastSeenAt]);

  const unreadCount = unreadComments.length;

  const markRead = async () => {
    const value = latestAt || new Date().toISOString();
    localStorage.setItem(LAST_SEEN_KEY, value);
    setLastSeenAt(value);

    try {
      const apiBase = await getBackendApiBase();
      await fetch(`${apiBase}/api/comment-state/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastSeenAt: value }),
      });
    } catch {
      // localStorage 已经写入；后端失败时不打断用户操作。
    }
  };

  const handleToggle = () => {
    setOpen((value) => !value);
    if (!open) loadComments();
  };

  const deleteComment = async (comment: RecentComment) => {
    if (!window.confirm(`确定删除 ${comment.author || '访客'} 的这条留言吗？`)) return;

    setDeletingId(comment.id);
    setError('');
    try {
      const res = await fetch('/api/comments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId: comment.id }),
      });
      const data = await readJsonSafely(res) as { error?: string };
      if (!res.ok) throw new Error(data.error || '删除留言失败');
      setComments((prev) => prev.filter((item) => item.id !== comment.id && item.parentId !== comment.id));
    } catch (err: unknown) {
      setError(getErrorMessage(err, '删除留言失败'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        className="relative w-10 h-10 rounded-xl bg-white/50 dark:bg-slate-800/50 flex items-center justify-center text-slate-700 dark:text-slate-100 hover:scale-105 transition-all border border-white/20 shadow-sm cursor-pointer"
        title="留言提醒"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white border-2 border-white dark:border-slate-900">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            className="absolute right-0 mt-3 w-96 max-w-[calc(100vw-2rem)] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-4 z-50 cursor-default"
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">新留言提醒</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {unreadCount > 0 ? `${unreadCount} 条还没看` : '暂时没有新留言'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadComments}
                  disabled={loading}
                  className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-indigo-500 disabled:opacity-50"
                  title="刷新留言"
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={markRead}
                  disabled={!comments.length}
                  className="w-8 h-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center disabled:opacity-50"
                  title="全部标记已读"
                >
                  <CheckCheck size={15} />
                </button>
              </div>
            </div>

            {error && (
              <p className="mb-3 rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-500">
                {error}
              </p>
            )}

            <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-2">
              {comments.length === 0 && !loading ? (
                <div className="py-8 text-center text-sm text-slate-400">
                  还没有收到留言。
                </div>
              ) : (
                comments.map((comment) => {
                  const isUnread = !lastSeenAt || new Date(comment.createdAt).getTime() > new Date(lastSeenAt).getTime();
                  return (
                    <div
                      key={comment.id}
                      className="block rounded-xl border border-slate-100 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 p-3 hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <Link
                          href={comment.pageUrl || '/'}
                          onClick={() => setOpen(false)}
                          className="flex min-w-0 flex-1 items-center gap-2"
                        >
                          <MessageCircle size={14} className={isUnread ? 'text-rose-500' : 'text-slate-400'} />
                          <span className="truncate text-xs font-black text-slate-800 dark:text-slate-100">
                            {comment.author || '路过的朋友'}
                          </span>
                        </Link>
                        <div className="flex shrink-0 items-center gap-2">
                          <time className="text-[10px] text-slate-400">
                            {new Date(comment.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </time>
                          <button
                            type="button"
                            onClick={() => deleteComment(comment)}
                            disabled={deletingId === comment.id}
                            className="grid h-7 w-7 place-items-center rounded-lg bg-rose-500/10 text-rose-500 transition hover:bg-rose-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                            title="删除这条留言（仅本地客户端）"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <Link href={comment.pageUrl || '/'} onClick={() => setOpen(false)} className="block">
                        <p className="mt-1 text-[11px] font-bold text-indigo-500 truncate">
                          {comment.parentId ? '回复' : formatPageName(comment.pageId)}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-300">
                          {shortText(comment.content)}
                        </p>
                      </Link>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
