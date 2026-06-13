"use client";

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Eye, EyeOff, Filter, KeyRound, Link2, Search, ShieldAlert, Sparkles, Star } from 'lucide-react';

type MarkField = 'key' | 'url' | 'note';
type ItemStatus = 'active' | 'testing' | 'paused' | 'archived';

type KeyUrlItem = {
  id: string;
  name: string;
  key: string;
  url: string;
  group: string;
  status: ItemStatus;
  tags: string[];
  note: string;
  markedFields: MarkField[];
  createdAt: number;
  updatedAt: number;
};

const statusMeta: Record<ItemStatus, { label: string; className: string; dot: string }> = {
  active: { label: '使用中', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20', dot: 'bg-emerald-500' },
  testing: { label: '测试', className: 'bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/20', dot: 'bg-sky-500' },
  paused: { label: '暂停', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20', dot: 'bg-amber-500' },
  archived: { label: '归档', className: 'bg-slate-500/10 text-slate-500 dark:text-slate-300 border-slate-500/20', dot: 'bg-slate-400' },
};

function maskSecret(value: string) {
  if (!value) return '—';
  if (value.length <= 10) return '•'.repeat(Math.max(value.length, 6));
  return `${value.slice(0, 5)}${'•'.repeat(10)}${value.slice(-4)}`;
}

function fieldMarked(item: KeyUrlItem, field: MarkField) {
  return Array.isArray(item.markedFields) && item.markedFields.includes(field);
}

export default function KeyUrlPublicTable() {
  const [items, setItems] = useState<KeyUrlItem[]>([]);
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setLoadError('');
      try {
        const res = await fetch(`/key-url-tables.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('没有找到公开表格数据');
        const data = await res.json();
        if (!cancelled) {
          setItems(Array.isArray(data.items) ? data.items : []);
          setUpdatedAt(typeof data.updatedAt === 'number' ? data.updatedAt : null);
        }
      } catch (error: any) {
        if (!cancelled) setLoadError(error?.message || '读取表格失败');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const groups = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.group).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      if (groupFilter !== 'all' && item.group !== groupFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (!normalized) return true;
      const haystack = [item.name, item.url, item.group, item.note, item.status, ...(item.tags || [])].join(' ').toLowerCase();
      return haystack.includes(normalized);
    });
  }, [groupFilter, items, query, statusFilter]);

  const copyText = async (id: string, value: string, label: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(`${id}-${label}`);
    window.setTimeout(() => setCopied(null), 1300);
  };

  return (
    <section className="w-[95%] max-w-7xl mx-auto mt-24 md:mt-28 pb-20 relative z-10">
      <div className="relative overflow-hidden rounded-[40px] border border-white/50 dark:border-white/10 bg-white/45 dark:bg-slate-950/45 backdrop-blur-2xl shadow-2xl shadow-slate-900/10">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-pink-500/15 blur-3xl" />

        <div className="relative p-6 md:p-10 border-b border-white/50 dark:border-white/10">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 text-xs font-black text-indigo-600 dark:text-indigo-300 mb-4">
                <Sparkles size={15} /> API / URL / 推广链接
              </div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
                Key 与链接资源表
              </h1>
              <p className="mt-4 max-w-3xl text-sm md:text-base leading-7 text-slate-600 dark:text-slate-300 font-medium">
                集中展示服务地址、推广链接和重要 Key。带星标的单元格为重点标注；Key 默认隐藏，需要手动点亮查看。
              </p>
            </div>
            <div className="rounded-3xl bg-amber-500/10 border border-amber-500/25 p-4 text-xs leading-6 text-amber-700 dark:text-amber-200 max-w-md">
              <div className="flex items-center gap-2 font-black mb-1"><ShieldAlert size={16} /> 安全提醒</div>
              网页端展示的数据会随站点公开发布；真正敏感的生产 Key 建议只保存用途说明或脱敏值。
            </div>
          </div>
        </div>

        <div className="relative p-5 md:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px_180px] gap-3 mb-5">
            <label className="h-12 bg-white/65 dark:bg-slate-900/65 border border-white/60 dark:border-slate-700 rounded-2xl px-4 flex items-center gap-3">
              <Search size={17} className="text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent outline-none text-sm font-bold text-slate-700 dark:text-slate-100 placeholder:text-slate-400" placeholder="搜索名称、URL、备注、标签" />
            </label>
            <label className="h-12 bg-white/65 dark:bg-slate-900/65 border border-white/60 dark:border-slate-700 rounded-2xl px-4 flex items-center gap-3">
              <Filter size={17} className="text-slate-400" />
              <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} className="w-full bg-transparent outline-none text-sm font-black text-slate-700 dark:text-slate-100">
                <option value="all">全部分组</option>
                {groups.map((group) => <option key={group} value={group}>{group}</option>)}
              </select>
            </label>
            <label className="h-12 bg-white/65 dark:bg-slate-900/65 border border-white/60 dark:border-slate-700 rounded-2xl px-4 flex items-center gap-3">
              <KeyRound size={17} className="text-slate-400" />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full bg-transparent outline-none text-sm font-black text-slate-700 dark:text-slate-100">
                <option value="all">全部状态</option>
                {Object.entries(statusMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
              </select>
            </label>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3 text-xs font-black text-slate-500 dark:text-slate-400">
            <span>{filteredItems.length} / {items.length} 条记录</span>
            {updatedAt && <span>更新于：{new Date(updatedAt).toLocaleString()}</span>}
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-300"><Star size={13} /> 高亮为已标注内容</span>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-white/60 dark:border-slate-800/80 shadow-inner">
            <table className="w-full min-w-[1120px] border-collapse bg-white/30 dark:bg-slate-950/25">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-widest text-slate-400 bg-white/60 dark:bg-slate-950/55">
                  <th className="px-5 py-4 w-[210px]">名称</th>
                  <th className="px-5 py-4 w-[260px]">Key</th>
                  <th className="px-5 py-4 w-[280px]">URL / 推广链接</th>
                  <th className="px-5 py-4 w-[130px]">分组</th>
                  <th className="px-5 py-4 w-[130px]">状态</th>
                  <th className="px-5 py-4 w-[180px]">标签</th>
                  <th className="px-5 py-4 w-[260px]">备注</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="px-5 py-16 text-center text-sm font-black text-slate-400">正在加载资源表...</td></tr>
                ) : loadError ? (
                  <tr><td colSpan={7} className="px-5 py-16 text-center text-sm font-black text-rose-500">{loadError}</td></tr>
                ) : filteredItems.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-16 text-center text-sm font-black text-slate-400">暂无可展示记录。</td></tr>
                ) : filteredItems.map((item) => {
                  const status = statusMeta[item.status] || statusMeta.active;
                  return (
                    <tr key={item.id} className="border-t border-white/60 dark:border-slate-800/70 align-top hover:bg-white/30 dark:hover:bg-white/[0.03] transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-black text-slate-800 dark:text-white">{item.name || '未命名资源'}</div>
                      </td>
                      <td className={`px-5 py-4 ${fieldMarked(item, 'key') ? 'bg-amber-100/70 dark:bg-amber-400/10' : ''}`}>
                        <div className="flex items-center gap-2">
                          <code className="max-w-[190px] truncate rounded-xl bg-slate-900/5 dark:bg-white/5 px-3 py-2 text-xs font-mono text-slate-700 dark:text-slate-200">
                            {visibleKeys[item.id] ? (item.key || '—') : maskSecret(item.key)}
                          </code>
                          {item.key && <button onClick={() => setVisibleKeys((prev) => ({ ...prev, [item.id]: !prev[item.id] }))} className="h-9 w-9 rounded-xl border border-white/60 dark:border-slate-700 bg-white/50 dark:bg-slate-900/60 grid place-items-center text-slate-500">{visibleKeys[item.id] ? <EyeOff size={15} /> : <Eye size={15} />}</button>}
                          {item.key && <button onClick={() => copyText(item.id, item.key, 'key')} className="h-9 w-9 rounded-xl border border-white/60 dark:border-slate-700 bg-white/50 dark:bg-slate-900/60 grid place-items-center text-slate-500">{copied === `${item.id}-key` ? <Check size={15} /> : <Copy size={15} />}</button>}
                        </div>
                      </td>
                      <td className={`px-5 py-4 ${fieldMarked(item, 'url') ? 'bg-amber-100/70 dark:bg-amber-400/10' : ''}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <Link2 size={15} className="text-indigo-500 shrink-0" />
                          {item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="truncate text-sm font-bold text-indigo-600 dark:text-indigo-300 hover:underline max-w-[205px]">{item.url}</a> : <span className="text-slate-400">—</span>}
                          {item.url && <a href={item.url} target="_blank" rel="noreferrer" className="h-8 w-8 rounded-xl bg-indigo-500/10 text-indigo-500 grid place-items-center shrink-0"><ExternalLink size={14} /></a>}
                        </div>
                      </td>
                      <td className="px-5 py-4"><span className="rounded-xl bg-slate-900/5 dark:bg-white/5 px-3 py-1.5 text-xs font-black text-slate-600 dark:text-slate-300">{item.group || '未分组'}</span></td>
                      <td className="px-5 py-4"><span className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-black ${status.className}`}><span className={`h-2 w-2 rounded-full ${status.dot}`} />{status.label}</span></td>
                      <td className="px-5 py-4"><div className="flex flex-wrap gap-1.5">{(item.tags || []).length ? item.tags.map((tag) => <span key={tag} className="rounded-lg bg-white/60 dark:bg-slate-900/60 px-2 py-1 text-[11px] font-black text-slate-500 dark:text-slate-300 border border-white/60 dark:border-slate-700">#{tag}</span>) : <span className="text-slate-400">—</span>}</div></td>
                      <td className={`px-5 py-4 ${fieldMarked(item, 'note') ? 'bg-amber-100/70 dark:bg-amber-400/10' : ''}`}><p className="whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300 font-medium">{item.note || '—'}</p></td>
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
