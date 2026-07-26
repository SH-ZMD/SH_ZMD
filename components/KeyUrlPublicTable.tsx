"use client";

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Search, ShieldCheck, Sparkles, Star } from 'lucide-react';

type ItemStatus = 'active' | 'testing' | 'paused' | 'archived';

type PublicHealth = {
  state?: 'unknown' | 'ok' | 'bad' | 'error';
  latencyMs?: number | null;
  statusCode?: number | null;
  message?: string;
};

type KeyUrlItem = {
  id: string;
  name: string;
  url: string;
  status: ItemStatus;
  score?: number;
  tags: string[];
  note: string;
  markedFields?: string[];
  health?: PublicHealth;
  updatedAt: number;
};

type KeyUrlTableData = {
  items?: KeyUrlItem[];
  updatedAt?: number;
};

const statusMeta: Record<ItemStatus, { label: string; className: string; dot: string }> = {
  active: { label: '推荐中', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20', dot: 'bg-emerald-500' },
  testing: { label: '观察中', className: 'bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/20', dot: 'bg-sky-500' },
  paused: { label: '暂停推荐', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20', dot: 'bg-amber-500' },
  archived: { label: '已归档', className: 'bg-slate-500/10 text-slate-500 dark:text-slate-300 border-slate-500/20', dot: 'bg-slate-400' },
};

function isLongNote(note: string) {
  return note.length > 90 || note.split('\n').length > 3;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? (error.message || fallback) : fallback;
}

function extractUrl(item: KeyUrlItem) {
  if (item.url?.trim()) return item.url.trim();
  const match = item.note?.match(/https?:\/\/[^\s)）]+/);
  return match?.[0] || '';
}

function getScore(item: KeyUrlItem) {
  const score = Number(item.score ?? 80);
  return Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 80;
}

export default function KeyUrlPublicTable() {
  const [items, setItems] = useState<KeyUrlItem[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setLoadError('');
      try {
        const res = await fetch(`/key-url-tables.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('没有找到公开中转站数据。');
        const data = await res.json() as KeyUrlTableData;
        if (!cancelled) {
          setItems(Array.isArray(data.items) ? data.items : []);
          setUpdatedAt(typeof data.updatedAt === 'number' ? data.updatedAt : null);
        }
      } catch (error: unknown) {
        if (!cancelled) setLoadError(getErrorMessage(error, '读取中转站数据失败。'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (!normalized) return true;
      const haystack = [item.name, item.url, item.note, item.status, ...(item.tags || [])].join(' ').toLowerCase();
      return haystack.includes(normalized);
    });
  }, [items, query, statusFilter]);

  const toggleNote = (id: string) => setExpandedNotes((prev) => ({ ...prev, [id]: !prev[id] }));

  const NoteCell = ({ item }: { item: KeyUrlItem }) => {
    if (!item.note) return <span className="text-slate-400">暂无备注</span>;
    const long = isLongNote(item.note);
    const expanded = !!expandedNotes[item.id];
    return (
      <div className="max-w-[420px]">
        <div
          onClick={long ? () => toggleNote(item.id) : undefined}
          className={`rounded-2xl border border-white/50 dark:border-white/10 bg-white/45 dark:bg-white/[0.04] px-4 py-2.5 ${long ? 'cursor-pointer hover:bg-white/65 dark:hover:bg-white/[0.08] transition-colors' : ''}`}
        >
          <p className={`whitespace-pre-wrap break-words text-[13px] leading-6 text-slate-600 dark:text-slate-300 font-medium ${expanded ? '' : 'line-clamp-3'}`}>
            {item.note}
          </p>
        </div>
        {long && (
          <button
            onClick={() => toggleNote(item.id)}
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-black text-indigo-500 dark:text-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-200 transition-colors"
          >
            {expanded ? '收起' : '展开全部'}
          </button>
        )}
      </div>
    );
  };

  return (
    <section className="w-[95%] max-w-7xl mx-auto mt-24 md:mt-28 pb-20 relative z-10">
      <div className="relative overflow-hidden rounded-[40px] border border-white/50 dark:border-white/10 bg-white/45 dark:bg-slate-950/45 backdrop-blur-2xl shadow-2xl shadow-slate-900/10">
        <div className="relative p-6 md:p-10 border-b border-white/50 dark:border-white/10">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 text-xs font-black text-indigo-600 dark:text-indigo-300 mb-4">
                <Sparkles size={15} /> Transfer Station
              </div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
                中转站
              </h1>
              <p className="mt-4 max-w-3xl text-sm md:text-base leading-7 text-slate-600 dark:text-slate-300 font-medium">
                这里整理值得尝试的中转站、镜像站和资源入口。公开页只展示推荐信息和跳转入口，不展示任何 Key。
              </p>
            </div>
            <div className="rounded-3xl bg-emerald-500/10 border border-emerald-500/25 p-4 text-xs leading-6 text-emerald-700 dark:text-emerald-200 max-w-md">
              <div className="flex items-center gap-2 font-black mb-1"><ShieldCheck size={16} /> 公开说明</div>
              后台维护的私密 Key 不会进入这个页面，也不会进入可下载的公开 JSON。
            </div>
          </div>
        </div>

        <div className="relative p-5 md:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_180px] gap-3 mb-5">
            <label className="h-12 bg-white/65 dark:bg-slate-900/65 border border-white/60 dark:border-slate-700 rounded-2xl px-4 flex items-center gap-3">
              <Search size={17} className="text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent outline-none text-sm font-bold text-slate-700 dark:text-slate-100 placeholder:text-slate-400" placeholder="搜索名称、备注或标签" />
            </label>
            <label className="h-12 bg-white/65 dark:bg-slate-900/65 border border-white/60 dark:border-slate-700 rounded-2xl px-4 flex items-center gap-3">
              <Star size={17} className="text-slate-400" />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full bg-transparent outline-none text-sm font-black text-slate-700 dark:text-slate-100">
                <option value="all">全部状态</option>
                {Object.entries(statusMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
              </select>
            </label>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3 text-xs font-black text-slate-500 dark:text-slate-400">
            <span>{filteredItems.length} / {items.length} 条记录</span>
            {updatedAt && <span>更新于：{new Date(updatedAt).toLocaleString()}</span>}
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-300"><Star size={13} /> 高亮表示站长标注内容</span>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-white/60 dark:border-slate-800/80 shadow-inner">
            <table className="w-full min-w-[900px] border-collapse bg-white/30 dark:bg-slate-950/25">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-widest text-slate-400 bg-white/60 dark:bg-slate-950/55">
                  <th className="px-5 py-4 w-[220px]">名称</th>
                  <th className="px-5 py-4 w-[150px]">状态</th>
                  <th className="px-5 py-4 w-[110px]">评分</th>
                  <th className="px-5 py-4 w-[190px]">标签</th>
                  <th className="px-5 py-4 w-[360px]">备注</th>
                  <th className="px-5 py-4 w-[120px]">入口</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="px-5 py-16 text-center text-sm font-black text-slate-400">正在加载中转站...</td></tr>
                ) : loadError ? (
                  <tr><td colSpan={6} className="px-5 py-16 text-center text-sm font-black text-rose-500">{loadError}</td></tr>
                ) : filteredItems.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-16 text-center text-sm font-black text-slate-400">暂无可展示记录。</td></tr>
                ) : filteredItems.map((item) => {
                  const status = statusMeta[item.status] || statusMeta.active;
                  const href = extractUrl(item);
                  return (
                    <tr key={item.id} className="border-t border-white/60 dark:border-slate-800/70 align-top hover:bg-white/30 dark:hover:bg-white/[0.03] transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-black text-slate-800 dark:text-white">{item.name || '未命名中转站'}</div>
                      </td>
                      <td className="px-5 py-4"><span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-2xl border px-3 py-1.5 text-xs font-black ${status.className}`}><span className={`h-2 w-2 rounded-full shrink-0 ${status.dot}`} />{status.label}</span></td>
                      <td className="px-5 py-4"><span className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl bg-amber-500/10 px-3 py-1.5 text-xs font-black text-amber-700 dark:text-amber-200"><Star size={13} />{getScore(item)} / 100</span></td>
                      <td className="px-5 py-4"><div className="flex flex-wrap gap-2 min-w-[150px]">{(item.tags || []).length ? item.tags.map((tag) => <span key={tag} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-gradient-to-r from-indigo-500/15 to-fuchsia-500/15 dark:from-indigo-400/15 dark:to-fuchsia-400/15 px-3 py-1.5 text-xs font-black text-indigo-700 dark:text-indigo-200 border border-indigo-400/25 shadow-sm"><span className="text-indigo-400">#</span>{tag}</span>) : <span className="text-slate-400">暂无标签</span>}</div></td>
                      <td className={`px-5 py-4 ${item.markedFields?.includes('note') ? 'bg-amber-100/70 dark:bg-amber-400/10' : ''}`}><NoteCell item={item} /></td>
                      <td className="px-5 py-4">
                        {href ? (
                          <a href={href} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-xs font-black text-white transition hover:-translate-y-0.5 dark:bg-white dark:text-slate-900">
                            <ExternalLink size={14} /> 打开
                          </a>
                        ) : <span className="text-slate-400 text-xs font-black">暂无入口</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
