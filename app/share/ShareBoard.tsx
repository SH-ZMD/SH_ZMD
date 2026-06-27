"use client";

import { useState } from 'react';
import { Sparkles, BookOpen } from 'lucide-react';

type RecommendType = 'course' | 'software' | 'skill' | 'tool' | 'site' | 'book' | 'other';

type RecommendationItem = {
  id: string;
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  type: RecommendType;
  tags: string[];
  rating: number;
  note: string;
};

type RecommendationGroup = {
  id: string;
  name: string;
  description: string;
  items: RecommendationItem[];
};

const typeLabels: Record<RecommendType, string> = {
  course: '课程',
  software: '软件',
  skill: 'Skill',
  tool: '工具',
  site: '网站',
  book: '书籍',
  other: '其他',
};

export default function ShareBoard({
  keyUrlTable,
  recommendationGroups,
}: {
  keyUrlTable: React.ReactNode;
  recommendationGroups: RecommendationGroup[];
}) {
  const [activeTab, setActiveTab] = useState<'recommendations' | 'keyurls'>('recommendations');

  return (
    <main className="w-[95%] max-w-7xl mx-auto mt-24 md:mt-28 pb-20 relative z-10">
      {/* 页面头部 */}
      <section className="rounded-[40px] border border-white/50 dark:border-white/10 bg-white/45 dark:bg-slate-950/45 backdrop-blur-2xl shadow-2xl shadow-slate-900/10 overflow-hidden">
        <div className="relative p-6 md:p-10 border-b border-white/50 dark:border-white/10">
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-pink-500/15 blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500/10 to-fuchsia-500/10 border border-indigo-500/20 px-4 py-2 text-xs font-black text-indigo-600 dark:text-indigo-300 mb-4">
              <Sparkles size={15} /> Share
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
              分享表
            </h1>
            <p className="mt-3 text-sm md:text-base text-slate-600 dark:text-slate-300">
              值得推荐的课程、软件、工具和网站，以及 Key 与链接资源。
            </p>
          </div>
        </div>

        {/* Tab 切换 */}
        <div className="relative p-5 md:p-8 pt-0">
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl bg-white/45 dark:bg-slate-950/30 border border-white/50 dark:border-slate-800/70 p-2">
            <button
              onClick={() => setActiveTab('recommendations')}
              className={`h-10 px-5 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${activeTab === 'recommendations' ? 'bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/25' : 'text-slate-500 hover:bg-white/60 dark:hover:bg-slate-900/60'}`}
            >
              <BookOpen size={16} /> 推荐列表
            </button>
            <button
              onClick={() => setActiveTab('keyurls')}
              className={`h-10 px-5 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${activeTab === 'keyurls' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-500 hover:bg-white/60 dark:hover:bg-slate-900/60'}`}
            >
              <Sparkles size={16} /> Key 与链接
            </button>
          </div>

          {/* 推荐列表 Tab */}
          {activeTab === 'recommendations' && (
            <div className="grid gap-8">
              {recommendationGroups.length === 0 ? (
                <div className="py-20 text-center text-slate-400 font-black">还没有公开推荐。</div>
              ) : recommendationGroups.map((group) => (
                <section key={group.id} className="grid gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">{group.name || '未命名分组'}</h2>
                    {group.description && <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{group.description}</p>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {(group.items || []).length === 0 ? (
                      <div className="rounded-3xl border border-dashed border-slate-300/70 dark:border-slate-700 p-8 text-center text-slate-400 font-black">这个分组暂时为空。</div>
                    ) : group.items.map((item) => (
                      <article key={item.id} className="rounded-3xl border border-white/60 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 p-5 flex flex-col">
                        {item.imageUrl && <img src={item.imageUrl} alt={item.title || '推荐图片'} className="mb-4 aspect-[16/9] w-full rounded-2xl object-cover border border-white/60 dark:border-slate-800" />}
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-lg font-black text-slate-900 dark:text-white">{item.title || '未命名推荐'}</h3>
                          <span className="shrink-0 rounded-full bg-fuchsia-500/10 px-3 py-1 text-[11px] font-black text-fuchsia-600 dark:text-fuchsia-300">{typeLabels[item.type] || typeLabels.other}</span>
                        </div>
                        {item.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600 dark:text-slate-300">{item.description}</p>}
                        {item.note && <p className="mt-3 rounded-2xl bg-slate-900/5 dark:bg-white/5 px-3 py-2 text-xs leading-6 text-slate-500 dark:text-slate-400">{item.note}</p>}
                        <div className="mt-4 flex flex-wrap gap-2 text-xs font-black">
                          <span className="rounded-full bg-amber-500/10 px-3 py-1.5 text-amber-600 dark:text-amber-300">{'★'.repeat(Math.max(1, Math.min(5, item.rating || 5)))}</span>
                          {(item.tags || []).map((tag) => <span key={tag} className="rounded-full bg-indigo-500/10 px-3 py-1.5 text-indigo-600 dark:text-indigo-300">#{tag}</span>)}
                        </div>
                        {item.url && <a href={item.url} target="_blank" rel="noreferrer" className="mt-5 inline-flex h-10 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-black text-white transition hover:-translate-y-0.5 dark:bg-white dark:text-slate-900">打开链接</a>}
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {/* Key 与链接 Tab */}
          {activeTab === 'keyurls' && (
            <div>
              {keyUrlTable}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
