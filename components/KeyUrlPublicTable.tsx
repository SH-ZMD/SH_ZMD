"use client";

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Eye, EyeOff, Filter, KeyRound, Link2, RefreshCw, Search, ShieldAlert, Sparkles, Star } from 'lucide-react';

type MarkField = 'key' | 'url' | 'note';
type ItemStatus = 'active' | 'testing' | 'paused' | 'archived';
type TableType = 'resources' | 'lowend';

type KeyHealth = {
  state: 'unknown' | 'ok' | 'bad' | 'error';
  checkedAt?: number | null;
  latencyMs?: number | null;
  statusCode?: number | null;
  message?: string;
};

type KeyUrlItem = {
  id: string;
  table?: TableType;
  name: string;
  key: string;
  url: string;
  group: string;
  status: ItemStatus;
  tags: string[];
  note: string;
  markedFields: MarkField[];
  health?: KeyHealth;
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

function latencyText(health?: KeyHealth, isChecking = false) {
  if (typeof health?.latencyMs === 'number') return `${health.latencyMs}ms`;
  return isChecking ? '检测中…' : '延迟未测';
}

function healthTitle(health?: KeyHealth) {
  if (!health?.checkedAt) return '尚未检测';
  const parts = [new Date(health.checkedAt).toLocaleString()];
  if (typeof health.latencyMs === 'number') parts.push(`延迟 ${health.latencyMs}ms`);
  if (typeof health.statusCode === 'number') parts.push(`HTTP ${health.statusCode}`);
  if (health.message) parts.push(health.message);
  return parts.join(' · ');
}

export default function KeyUrlPublicTable() {
  const [items, setItems] = useState<KeyUrlItem[]>([]);
  const [activeTable, setActiveTable] = useState<TableType>('resources');
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [healthCheckedAt, setHealthCheckedAt] = useState<number | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

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
          setItems(Array.isArray(data.items) ? data.items.map((item: KeyUrlItem) => ({ ...item, table: item.table || 'resources' })) : []);
          setUpdatedAt(typeof data.updatedAt === 'number' ? data.updatedAt : null);
          window.setTimeout(() => checkHealth(), 350);
        }
      } catch (error: any) {
        if (!cancelled) setLoadError(error?.message || '读取表格失败');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const checkHealth = async (table?: TableType) => {
    if (isCheckingHealth) return;
    setIsCheckingHealth(true);
    try {
      const query = table ? `?table=${table}&t=${Date.now()}` : `?t=${Date.now()}`;
      const res = await fetch(`/api/key-url-health${query}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || '实时检测失败');
      const healthById = new Map((data.results || []).map((result: any) => [result.id, result]));
      setItems((prev) => prev.map((item) => {
        const health = healthById.get(item.id) as KeyHealth | undefined;
        if (!health) return item;
        const nextStatus: ItemStatus = health.state === 'ok'
          ? 'active'
          : (health.state === 'bad' || health.state === 'error' ? 'paused' : item.status);
        return { ...item, status: nextStatus, health };
      }));
      setHealthCheckedAt(typeof data.checkedAt === 'number' ? data.checkedAt : Date.now());
    } catch (error: any) {
      setLoadError(error?.message || '实时检测失败');
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const groups = useMemo(() => {
    return Array.from(new Set(items.filter((item) => (item.table || 'resources') === activeTable).map((item) => item.group).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [activeTable, items]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      const itemTable = item.table || 'resources';
      if (itemTable !== activeTable) return false;
      if (groupFilter !== 'all' && item.group !== groupFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (!normalized) return true;
      const haystack = [item.name, item.url, item.group, item.note, item.status, ...(item.tags || [])].join(' ').toLowerCase();
      return haystack.includes(normalized);
    });
  }, [activeTable, groupFilter, items, query, statusFilter]);

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
                集中展示服务地址、推广链接和模型 Key。检测会实际发起一次对话；能回复才算可用，响应时间越短越好。
              </p>
            </div>
            <div className="rounded-3xl bg-amber-500/10 border border-amber-500/25 p-4 text-xs leading-6 text-amber-700 dark:text-amber-200 max-w-md">
              <div className="flex items-center gap-2 font-black mb-1"><ShieldAlert size={16} /> 安全提醒</div>
              网页端展示的数据会随站点公开发布；真正敏感的生产 Key 建议只保存用途说明或脱敏值。
            </div>
          </div>
        </div>

        <div className="relative p-5 md:p-8">
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl bg-white/45 dark:bg-slate-950/30 border border-white/50 dark:border-slate-800/70 p-2">
            <button
              onClick={() => setActiveTable('resources')}
              className={`h-10 px-4 rounded-xl text-sm font-black transition-all ${activeTable === 'resources' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-500 hover:bg-white/60 dark:hover:bg-slate-900/60'}`}
            >
              资源表
            </button>
            <button
              onClick={() => setActiveTable('lowend')}
              className={`h-10 px-4 rounded-xl text-sm font-black transition-all ${activeTable === 'lowend' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'text-slate-500 hover:bg-white/60 dark:hover:bg-slate-900/60'}`}
            >
              低端模型表
            </button>
            <button
              onClick={() => checkHealth(activeTable)}
              disabled={isCheckingHealth}
              className="ml-auto inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 text-sm font-black text-emerald-600 transition hover:bg-emerald-500/15 disabled:opacity-60 dark:text-emerald-300"
            >
              <RefreshCw size={15} className={isCheckingHealth ? 'animate-spin' : ''} /> {isCheckingHealth ? '对话测速中' : '实际对话测速'}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px_180px] gap-3 mb-5">
            <label className="h-12 bg-white/65 dark:bg-slate-900/65 border border-white/60 dark:border-slate-700 rounded-2xl px-4 flex items-center gap-3">
              <Search size={17} className="text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent outline-none text-sm font-bold text-slate-700 dark:text-slate-100 placeholder:text-slate-400" placeholder={activeTable === 'lowend' ? '搜索 URL、Key、分组、备注、标签' : '搜索名称、URL、备注、标签'} />
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
            {healthCheckedAt && <span className="text-emerald-600 dark:text-emerald-300">实时延迟检测：{new Date(healthCheckedAt).toLocaleTimeString()}</span>}
            {activeTable === 'resources' ? (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-300"><Star size={13} /> 高亮为已标注内容</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-rose-500">低端模型表只保留 URL、Key、状态；状态里会显示检测延迟</span>
            )}
          </div>

          <div className="overflow-x-auto rounded-3xl border border-white/60 dark:border-slate-800/80 shadow-inner">
            {activeTable === 'lowend' ? (
            <table className="w-full min-w-[1120px] border-collapse bg-white/30 dark:bg-slate-950/25">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-widest text-slate-400 bg-white/60 dark:bg-slate-950/55">
                  <th className="px-5 py-4 w-[260px]">Key</th>
                  <th className="px-5 py-4 w-[280px]">URL</th>
                  <th className="px-5 py-4 w-[170px]">分组</th>
                  <th className="px-5 py-4 w-[150px]">状态</th>
                  <th className="px-5 py-4 w-[180px]">标签</th>
                  <th className="px-5 py-4 w-[260px]">备注</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="px-5 py-16 text-center text-sm font-black text-slate-400">正在加载低端模型表...</td></tr>
                ) : loadError ? (
                  <tr><td colSpan={6} className="px-5 py-16 text-center text-sm font-black text-rose-500">{loadError}</td></tr>
                ) : filteredItems.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-16 text-center text-sm font-black text-slate-400">暂无低端模型记录。</td></tr>
                ) : filteredItems.map((item) => (
                  <tr key={item.id} className="border-t border-white/60 dark:border-slate-800/70 align-top hover:bg-white/30 dark:hover:bg-white/[0.03] transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <code className="max-w-[250px] truncate rounded-xl bg-slate-900/5 dark:bg-white/5 px-3 py-2 text-xs font-mono text-slate-700 dark:text-slate-200">
                          {visibleKeys[item.id] ? (item.key || '—') : maskSecret(item.key)}
                        </code>
                        {item.key && <button onClick={() => setVisibleKeys((prev) => ({ ...prev, [item.id]: !prev[item.id] }))} className="h-9 w-9 rounded-xl border border-white/60 dark:border-slate-700 bg-white/50 dark:bg-slate-900/60 grid place-items-center text-slate-500">{visibleKeys[item.id] ? <EyeOff size={15} /> : <Eye size={15} />}</button>}
                        {item.key && <button onClick={() => copyText(item.id, item.key, 'key')} className="h-9 w-9 rounded-xl border border-white/60 dark:border-slate-700 bg-white/50 dark:bg-slate-900/60 grid place-items-center text-slate-500">{copied === `${item.id}-key` ? <Check size={15} /> : <Copy size={15} />}</button>}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <Link2 size={15} className="text-rose-500 shrink-0" />
                        {item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="truncate text-sm font-bold text-rose-600 dark:text-rose-300 hover:underline max-w-[205px]">{item.url}</a> : <span className="text-slate-400">—</span>}
                        {item.url && <a href={item.url} target="_blank" rel="noreferrer" className="h-8 w-8 rounded-xl bg-rose-500/10 text-rose-500 grid place-items-center shrink-0"><ExternalLink size={14} /></a>}
                      </div>
                    </td>
                    <td className="px-5 py-4"><span className="inline-flex max-w-[160px] whitespace-nowrap rounded-xl bg-slate-900/5 dark:bg-white/5 px-3 py-1.5 text-xs font-black text-slate-600 dark:text-slate-300">{item.group || '未分组'}</span></td>
                    <td className="px-5 py-4">
                      {(() => {
                        const status = statusMeta[item.status] || statusMeta.active;
                        return <span title={healthTitle(item.health)} className={`inline-flex flex-col items-start gap-0.5 whitespace-nowrap rounded-2xl border px-3 py-1.5 text-xs font-black ${status.className}`}><span className="inline-flex items-center gap-2"><span className={`h-2 w-2 rounded-full shrink-0 ${status.dot}`} />{status.label}</span><span className="text-[10px] opacity-75">{latencyText(item.health, isCheckingHealth)}</span></span>;
                      })()}
                    </td>
                    <td className="px-5 py-4"><div className="flex flex-wrap gap-2 min-w-[150px]">{(item.tags || []).length ? item.tags.map((tag) => <span key={tag} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-gradient-to-r from-rose-500/15 to-fuchsia-500/15 dark:from-rose-400/15 dark:to-fuchsia-400/15 px-3 py-1.5 text-xs font-black text-rose-700 dark:text-rose-200 border border-rose-400/25 shadow-sm"><span className="text-rose-400">#</span>{tag}</span>) : <span className="text-slate-400">—</span>}</div></td>
                    <td className={`px-5 py-4 ${fieldMarked(item, 'note') ? 'bg-amber-100/70 dark:bg-amber-400/10' : ''}`}><p className="whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300 font-medium">{item.note || '—'}</p></td>
                  </tr>
                ))}
              </tbody>
            </table>
            ) : (
            <table className="w-full min-w-[1120px] border-collapse bg-white/30 dark:bg-slate-950/25">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-widest text-slate-400 bg-white/60 dark:bg-slate-950/55">
                  <th className="px-5 py-4 w-[210px]">名称</th>
                  <th className="px-5 py-4 w-[260px]">Key</th>
                  <th className="px-5 py-4 w-[280px]">URL / 推广链接</th>
                  <th className="px-5 py-4 w-[170px]">分组</th>
                  <th className="px-5 py-4 w-[150px]">状态</th>
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
                        <div className="whitespace-nowrap font-black text-slate-800 dark:text-white">{item.name || '未命名资源'}</div>
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
                      <td className="px-5 py-4"><span className="inline-flex max-w-[160px] whitespace-nowrap rounded-xl bg-slate-900/5 dark:bg-white/5 px-3 py-1.5 text-xs font-black text-slate-600 dark:text-slate-300">{item.group || '未分组'}</span></td>
                      <td className="px-5 py-4"><span title={healthTitle(item.health)} className={`inline-flex flex-col items-start gap-0.5 whitespace-nowrap rounded-2xl border px-3 py-1.5 text-xs font-black ${status.className}`}><span className="inline-flex items-center gap-2"><span className={`h-2 w-2 rounded-full shrink-0 ${status.dot}`} />{status.label}</span><span className="text-[10px] opacity-75">{latencyText(item.health, isCheckingHealth)}</span></span></td>
                      <td className="px-5 py-4"><div className="flex flex-wrap gap-2 min-w-[150px]">{(item.tags || []).length ? item.tags.map((tag) => <span key={tag} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-gradient-to-r from-indigo-500/15 to-fuchsia-500/15 dark:from-indigo-400/15 dark:to-fuchsia-400/15 px-3 py-1.5 text-xs font-black text-indigo-700 dark:text-indigo-200 border border-indigo-400/25 shadow-sm"><span className="text-indigo-400">#</span>{tag}</span>) : <span className="text-slate-400">—</span>}</div></td>
                      <td className={`px-5 py-4 ${fieldMarked(item, 'note') ? 'bg-amber-100/70 dark:bg-amber-400/10' : ''}`}><p className="whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300 font-medium">{item.note || '—'}</p></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            )}
          </div>
        </div>

        {/* ======================== 低端模型表格 ======================== */}
        <div className="relative p-5 md:p-8 border-t border-white/50 dark:border-white/10 bg-white/20 dark:bg-slate-950/20">
          <div className="mb-4 flex items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-rose-500/10 border border-rose-500/20 px-4 py-1.5 text-xs font-black text-rose-600 dark:text-rose-300">
              <ShieldAlert size={14} /> 低端模型
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">仅供参考，质量较差或已失效的站点</div>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-white/60 dark:border-slate-800/80 shadow-inner">
            <table className="w-full min-w-[860px] border-collapse bg-white/30 dark:bg-slate-950/25">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-widest text-slate-400 bg-white/60 dark:bg-slate-950/55">
                  <th className="px-5 py-4 w-[380px]">URL</th>
                  <th className="px-5 py-4 w-[280px]">Key</th>
                  <th className="px-5 py-4 w-[120px]">状态</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const lowItems = items.filter(i => (i.table || 'resources') === 'lowend');
                  if (lowItems.length === 0) {
                    return <tr><td colSpan={3} className="px-5 py-12 text-center text-sm font-black text-slate-400">暂无低端模型记录</td></tr>;
                  }
                  return lowItems.map((item) => {
                    const status = statusMeta[item.status] || statusMeta.active;
                    return (
                      <tr key={item.id} className="border-t border-white/60 dark:border-slate-800/70 hover:bg-white/30 dark:hover:bg-white/[0.03] transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 min-w-0">
                            <Link2 size={15} className="text-rose-500 shrink-0" />
                            {item.url ? (
                              <a href={item.url} target="_blank" rel="noreferrer" className="truncate text-sm font-bold text-rose-600 dark:text-rose-300 hover:underline">{item.url}</a>
                            ) : <span className="text-slate-400">—</span>}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <code className="max-w-[240px] truncate rounded-xl bg-slate-900/5 dark:bg-white/5 px-3 py-2 text-xs font-mono text-slate-700 dark:text-slate-200">
                              {visibleKeys[item.id] ? (item.key || '—') : maskSecret(item.key)}
                            </code>
                            {item.key && (
                              <>
                                <button onClick={() => setVisibleKeys((prev) => ({ ...prev, [item.id]: !prev[item.id] }))} className="h-8 w-8 rounded-xl border border-white/60 dark:border-slate-700 bg-white/50 dark:bg-slate-900/60 grid place-items-center text-slate-500">
                                  {visibleKeys[item.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                                <button onClick={() => copyText(item.id, item.key, 'low-key')} className="h-8 w-8 rounded-xl border border-white/60 dark:border-slate-700 bg-white/50 dark:bg-slate-900/60 grid place-items-center text-slate-500">
                                  {copied === `${item.id}-low-key` ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span title={healthTitle(item.health)} className={`inline-flex flex-col items-start gap-0.5 whitespace-nowrap rounded-2xl border px-3 py-1 text-xs font-black ${status.className}`}>
                            <span className="inline-flex items-center gap-2"><span className={`h-2 w-2 rounded-full shrink-0 ${status.dot}`} />{status.label}</span>
                            <span className="text-[10px] opacity-75">{latencyText(item.health, isCheckingHealth)}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
