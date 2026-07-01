"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, CalendarCheck, Check, Edit3, FileText, Grid3X3, Image as ImageIcon, Layers3, Link2, Plus, Save, Search, Sparkles, Trash2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useOptionalOperations } from '../context/OperationContext';
import { useToast } from './ToastProvider';

type ArchiveItemType = 'chatter' | 'photo' | 'share' | 'plan';

type ArchiveItem = {
  id: string;
  type: ArchiveItemType;
  title: string;
  description: string;
  url: string;
  image: string;
  date: string;
  sourceLabel: string;
};

type ArchiveCollection = {
  id: string;
  title: string;
  summary: string;
  cover: string;
  tags: string[];
  items: ArchiveItem[];
  createdAt: number;
  updatedAt: number;
};

type ArchiveSources = {
  chatters: ArchiveItem[];
  photos: ArchiveItem[];
  shares: ArchiveItem[];
  plans: ArchiveItem[];
};

const emptySources: ArchiveSources = { chatters: [], photos: [], shares: [], plans: [] };

const typeMeta: Record<ArchiveItemType, { label: string; icon: LucideIcon; color: string; sourceKey: keyof ArchiveSources }> = {
  chatter: { label: '杂谈', icon: FileText, color: 'bg-amber-500 text-white', sourceKey: 'chatters' },
  photo: { label: '照片', icon: ImageIcon, color: 'bg-pink-500 text-white', sourceKey: 'photos' },
  share: { label: '分享', icon: Link2, color: 'bg-indigo-500 text-white', sourceKey: 'shares' },
  plan: { label: '计划', icon: CalendarCheck, color: 'bg-emerald-500 text-white', sourceKey: 'plans' },
};

function createCollection(): ArchiveCollection {
  const now = Date.now();
  return {
    id: `archive_${now}`,
    title: '',
    summary: '',
    cover: '',
    tags: [],
    items: [],
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeCollections(value: ArchiveCollection[]): ArchiveCollection[] {
  return Array.isArray(value) ? value.map((item) => ({
    ...createCollection(),
    ...item,
    tags: Array.isArray(item.tags) ? item.tags : [],
    items: Array.isArray(item.items) ? item.items : [],
  })) : [];
}

function formatTags(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export default function ArchiveCollectionsClient({ initialCollections }: { initialCollections: ArchiveCollection[] }) {
  const [collections, setCollections] = useState<ArchiveCollection[]>(normalizeCollections(initialCollections));
  const [sources, setSources] = useState<ArchiveSources>(emptySources);
  const [activeId, setActiveId] = useState<string | null>(initialCollections[0]?.id || null);
  const [editing, setEditing] = useState<ArchiveCollection | null>(null);
  const [query, setQuery] = useState('');
  const [sourceQuery, setSourceQuery] = useState('');
  const [sourceTab, setSourceTab] = useState<ArchiveItemType>('chatter');
  const [loadingSources, setLoadingSources] = useState(false);
  const [saving, setSaving] = useState(false);
  const operations = useOptionalOperations();
  const { showToast } = useToast();

  useEffect(() => {
    const load = async () => {
      setLoadingSources(true);
      try {
        const [listRes, sourceRes] = await Promise.all([
          fetch('/api/local-archive-collections?action=list', { cache: 'no-store' }),
          fetch('/api/local-archive-collections?action=sources', { cache: 'no-store' }),
        ]);
        const listData = await listRes.json();
        const sourceData = await sourceRes.json();
        if (listData.success && listData.data?.collections) {
          const next = normalizeCollections(listData.data.collections);
          setCollections(next);
          setActiveId((current) => current || next[0]?.id || null);
        }
        if (sourceData.success && sourceData.sources) setSources({ ...emptySources, ...sourceData.sources });
      } catch {
        console.error('Failed to load archive collection data');
      } finally {
        setLoadingSources(false);
      }
    };
    load();
  }, []);

  const filteredCollections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return collections;
    return collections.filter((item) => [item.title, item.summary, item.tags.join(' '), item.items.map((x) => x.title).join(' ')].join(' ').toLowerCase().includes(q));
  }, [collections, query]);

  const activeCollection = useMemo(() => collections.find((item) => item.id === activeId) || collections[0] || null, [collections, activeId]);

  const sourceItems = useMemo(() => {
    const key = typeMeta[sourceTab].sourceKey;
    const q = sourceQuery.trim().toLowerCase();
    return (sources[key] || []).filter((item) => !q || [item.title, item.description, item.sourceLabel, item.date].join(' ').toLowerCase().includes(q));
  }, [sources, sourceTab, sourceQuery]);

  const saveCollections = async (nextCollections: ArchiveCollection[]) => {
    setSaving(true);
    try {
      const res = await fetch('/api/local-archive-collections?action=save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collections: nextCollections }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message || '保存失败');
      const normalized = normalizeCollections(result.data.collections);
      setCollections(normalized);
      operations?.addOperation({
          id: `sync_archive_collections_${Date.now()}`,
          type: 'sync_archive_collections',
          label: '同步归档栏目',
          payload: {
            updatedAt: result.updatedAt || Date.now(),
            collectionsCount: normalized.length,
          },
          timestamp: new Date().toLocaleString(),
        });
      showToast(operations ? '归档栏目已保存，记得更新本地' : '归档栏目已保存', 'success');
      setEditing(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '归档栏目保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const commitEdit = () => {
    if (!editing) return;
    const cleanTitle = editing.title.trim();
    if (!cleanTitle) {
      showToast('栏目需要一个标题', 'warning');
      return;
    }
    const nextEditing = { ...editing, title: cleanTitle, updatedAt: Date.now() };
    const exists = collections.some((item) => item.id === nextEditing.id);
    const next = exists
      ? collections.map((item) => item.id === nextEditing.id ? nextEditing : item)
      : [nextEditing, ...collections];
    setActiveId(nextEditing.id);
    saveCollections(next);
  };

  const deleteCollection = (id: string) => {
    const next = collections.filter((item) => item.id !== id);
    setActiveId(next[0]?.id || null);
    saveCollections(next);
  };

  const addSourceItem = (item: ArchiveItem) => {
    if (!editing) return;
    if (editing.items.some((x) => x.type === item.type && x.id === item.id)) {
      showToast('这个内容已经在栏目里了', 'info');
      return;
    }
    setEditing({ ...editing, items: [...editing.items, item], cover: editing.cover || item.image, updatedAt: Date.now() });
  };

  const removeEditingItem = (index: number) => {
    if (!editing) return;
    setEditing({ ...editing, items: editing.items.filter((_, i) => i !== index), updatedAt: Date.now() });
  };

  const renderItem = (item: ArchiveItem, compact = false) => {
    const meta = typeMeta[item.type];
    const Icon = meta.icon;
    const content = (
      <article className={`group h-full overflow-hidden rounded-3xl border border-white/60 bg-white/70 shadow-lg shadow-slate-900/5 transition hover:-translate-y-1 hover:bg-white dark:border-white/10 dark:bg-slate-900/65 dark:hover:bg-slate-900 ${compact ? 'p-3' : 'p-4'}`}>
        {item.image && <img src={item.image} alt={item.title} className={`${compact ? 'h-24' : 'h-40'} mb-4 w-full rounded-2xl object-cover`} />}
        <div className="flex items-start justify-between gap-3">
          <h3 className={`${compact ? 'text-sm' : 'text-lg'} font-black text-slate-900 line-clamp-2 dark:text-white`}>{item.title || '未命名内容'}</h3>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ${meta.color}`}>
            <Icon size={12} /> {meta.label}
          </span>
        </div>
        {item.description && <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-xs leading-6 text-slate-600 dark:text-slate-300">{item.description}</p>}
        <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black text-slate-400">
          {item.sourceLabel && <span className="rounded-full bg-slate-900/5 px-2.5 py-1 dark:bg-white/5">{item.sourceLabel}</span>}
          {item.date && <span className="rounded-full bg-slate-900/5 px-2.5 py-1 dark:bg-white/5">{item.date}</span>}
        </div>
      </article>
    );
    if (item.type === 'photo') return <button type="button" onClick={() => window.open(item.url, '_blank')} className="block h-full text-left">{content}</button>;
    if (item.url) return <Link href={item.url} className="block h-full">{content}</Link>;
    return content;
  };

  return (
    <main className="w-[95%] max-w-7xl mx-auto mt-24 md:mt-28 pb-20 relative z-10">
      <section className="mb-8 text-center">
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-2 text-xs font-black text-indigo-600 dark:text-indigo-300">
          <Layers3 size={15} /> Archive Collections
        </div>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 dark:text-white">归档栏目</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
          把杂谈、照片、分享和计划收进独立栏目，再写下属于这个主题的总结。
        </p>
      </section>

      <section className="rounded-[32px] border border-white/50 bg-white/45 p-4 shadow-2xl shadow-slate-900/10 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/45 md:p-6">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <label className="flex h-12 flex-1 items-center gap-3 rounded-2xl border border-white/60 bg-white/70 px-4 dark:border-slate-800 dark:bg-slate-900/70">
            <Search size={16} className="text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none dark:text-slate-100" placeholder="搜索栏目、总结或收录内容" />
          </label>
          {operations && (
            <button onClick={() => setEditing(createCollection())} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-5 text-sm font-black text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-600">
              <Plus size={16} /> 新建栏目
            </button>
          )}
        </div>

        {collections.length === 0 ? (
          <button onClick={() => operations && setEditing(createCollection())} className="w-full rounded-[28px] border-2 border-dashed border-indigo-300/70 bg-indigo-500/5 px-6 py-20 text-center transition hover:bg-indigo-500/10">
            <Plus className="mx-auto mb-4 text-indigo-500" size={36} />
            <span className="text-sm font-black text-indigo-600 dark:text-indigo-300">{operations ? '创建第一个归档栏目' : '还没有公开归档栏目'}</span>
          </button>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <div className="grid max-h-[78vh] gap-3 overflow-y-auto pr-1">
              {filteredCollections.map((collection) => (
                <button key={collection.id} onClick={() => setActiveId(collection.id)} className={`overflow-hidden rounded-3xl border p-3 text-left transition ${activeCollection?.id === collection.id ? 'border-indigo-400 bg-indigo-500/10 shadow-lg shadow-indigo-500/10' : 'border-white/50 bg-white/55 hover:bg-white/80 dark:border-white/10 dark:bg-slate-900/55'}`}>
                  <div className="flex gap-3">
                    <div className="h-20 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-200 dark:bg-slate-800">
                      {collection.cover ? <img src={collection.cover} alt={collection.title} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-slate-400"><Grid3X3 size={24} /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-base font-black text-slate-900 dark:text-white">{collection.title}</h2>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{collection.summary || '还没有总结'}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-black text-slate-400">
                        <span>{collection.items.length} 项内容</span>
                        {collection.tags.slice(0, 2).map((tag) => <span key={tag}>#{tag}</span>)}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {activeCollection && (
              <div className="overflow-hidden rounded-[28px] border border-white/60 bg-white/65 dark:border-white/10 dark:bg-slate-900/55">
                <div className="relative min-h-64 p-6 md:p-8">
                  {activeCollection.cover && <img src={activeCollection.cover} alt={activeCollection.title} className="absolute inset-0 h-full w-full object-cover opacity-20" />}
                  <div className="absolute inset-0 bg-gradient-to-br from-white via-white/85 to-white/55 dark:from-slate-950 dark:via-slate-950/88 dark:to-slate-950/60" />
                  <div className="relative">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1.5 text-xs font-black text-indigo-600 dark:text-indigo-300">
                        <Sparkles size={14} /> {activeCollection.items.length} 项归档
                      </div>
                      {operations && (
                        <div className="flex gap-2">
                          <button onClick={() => setEditing(activeCollection)} className="inline-flex h-10 items-center gap-2 rounded-2xl bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900"><Edit3 size={14} /> 编辑</button>
                          <button onClick={() => deleteCollection(activeCollection.id)} className="grid h-10 w-10 place-items-center rounded-2xl bg-rose-500/10 text-rose-600 transition hover:bg-rose-500 hover:text-white"><Trash2 size={14} /></button>
                        </div>
                      )}
                    </div>
                    <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">{activeCollection.title}</h2>
                    {activeCollection.summary && <p className="mt-4 whitespace-pre-wrap text-sm leading-8 text-slate-600 dark:text-slate-300">{activeCollection.summary}</p>}
                    <div className="mt-5 flex flex-wrap gap-2">
                      {activeCollection.tags.map((tag) => <span key={tag} className="rounded-full bg-indigo-500/10 px-3 py-1.5 text-xs font-black text-indigo-600 dark:text-indigo-300">#{tag}</span>)}
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                  {activeCollection.items.length === 0 ? (
                    <div className="col-span-full rounded-3xl border border-dashed border-slate-300 p-12 text-center text-sm font-black text-slate-400 dark:border-slate-700">这个栏目还没有收录内容</div>
                  ) : activeCollection.items.map((item) => <div key={`${item.type}-${item.id}`}>{renderItem(item)}</div>)}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <AnimatePresence>
        {editing && (
          <div className="fixed inset-0 z-[180] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-950/55 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.97 }} className="relative grid max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/30 bg-white/95 shadow-2xl dark:border-white/10 dark:bg-slate-950/95 lg:grid-cols-[1fr_420px]">
              <div className="overflow-y-auto p-5 md:p-7">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white">编辑归档栏目</h2>
                  <button onClick={() => setEditing(null)} className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300"><X size={18} /></button>
                </div>
                <div className="grid gap-4">
                  <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-lg font-black outline-none focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-900 dark:text-white" placeholder="栏目名称" />
                  <textarea value={editing.summary} onChange={(e) => setEditing({ ...editing, summary: e.target.value })} className="min-h-36 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 outline-none resize-none focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-900 dark:text-white" placeholder="写下这个栏目的总结、主题或你想保留的理解" />
                  <input value={editing.cover} onChange={(e) => setEditing({ ...editing, cover: e.target.value })} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-900 dark:text-white" placeholder="封面 URL，可留空自动使用第一个图片内容" />
                  <input value={editing.tags.join(', ')} onChange={(e) => setEditing({ ...editing, tags: formatTags(e.target.value) })} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-900 dark:text-white" placeholder="标签，用逗号分隔" />
                </div>

                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-700 dark:text-slate-200">已收录内容</h3>
                    <span className="text-xs font-black text-slate-400">{editing.items.length} 项</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {editing.items.length === 0 ? (
                      <div className="col-span-full rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs font-black text-slate-400 dark:border-slate-700">从右侧选择内容放进栏目</div>
                    ) : editing.items.map((item, index) => (
                      <div key={`${item.type}-${item.id}-${index}`} className="relative">
                        {renderItem(item, true)}
                        <button onClick={() => removeEditingItem(index)} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-xl bg-rose-500 text-white shadow-lg"><Trash2 size={13} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <aside className="flex min-h-0 flex-col border-t border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/80 lg:border-l lg:border-t-0">
                <h3 className="mb-3 text-sm font-black text-slate-700 dark:text-slate-200">选择内容</h3>
                <div className="mb-3 grid grid-cols-4 gap-2">
                  {(Object.keys(typeMeta) as ArchiveItemType[]).map((key) => {
                    const meta = typeMeta[key];
                    const Icon = meta.icon;
                    return (
                      <button key={key} onClick={() => setSourceTab(key)} className={`h-10 rounded-2xl text-xs font-black transition ${sourceTab === key ? meta.color : 'bg-white text-slate-500 dark:bg-slate-950 dark:text-slate-300'}`}>
                        <Icon size={14} className="mx-auto" />
                      </button>
                    );
                  })}
                </div>
                <label className="mb-3 flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
                  <Search size={15} className="text-slate-400" />
                  <input value={sourceQuery} onChange={(e) => setSourceQuery(e.target.value)} className="w-full bg-transparent text-sm outline-none dark:text-white" placeholder={`搜索${typeMeta[sourceTab].label}`} />
                </label>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                  {loadingSources ? (
                    <div className="py-16 text-center text-xs font-black text-slate-400">加载可选内容中...</div>
                  ) : sourceItems.length === 0 ? (
                    <div className="py-16 text-center text-xs font-black text-slate-400">没有可选内容</div>
                  ) : sourceItems.map((item) => {
                    const selected = editing.items.some((x) => x.type === item.type && x.id === item.id);
                    return (
                      <button key={`${item.type}-${item.id}`} onClick={() => addSourceItem(item)} className={`flex w-full gap-3 rounded-2xl border p-2 text-left transition ${selected ? 'border-emerald-300 bg-emerald-500/10' : 'border-slate-200 bg-white hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-950'}`}>
                        <div className="h-14 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-800">
                          {item.image ? <img src={item.image} alt={item.title} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-slate-400"><BookOpen size={18} /></div>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-xs font-black text-slate-800 dark:text-white">{item.title}</p>
                          <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">{item.description || item.sourceLabel}</p>
                        </div>
                        {selected && <Check size={16} className="mt-1 shrink-0 text-emerald-500" />}
                      </button>
                    );
                  })}
                </div>
                <button onClick={commitEdit} disabled={saving} className="mt-4 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-indigo-500 text-sm font-black text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-600 disabled:opacity-60">
                  <Save size={16} /> {saving ? '保存中...' : '保存栏目'}
                </button>
              </aside>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
