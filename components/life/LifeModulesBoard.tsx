"use client";

import { useEffect, useMemo, useState } from 'react';
import { Clock3, Filter, Plus, Save, Star, Trash2 } from 'lucide-react';

type PlanStatus = 'todo' | 'doing' | 'done' | 'paused';
type PlanPriority = 'low' | 'medium' | 'high';
type RecommendType = 'course' | 'software' | 'skill' | 'tool' | 'site' | 'book' | 'other';

type PlanItem = {
  id: string;
  title: string;
  detail: string;
  targetDate: string;
  status: PlanStatus;
  priority: PlanPriority;
  tags: string[];
  link: string;
  createdAt: number;
  updatedAt: number;
};

type RecommendationItem = {
  id: string;
  title: string;
  description: string;
  url: string;
  type: RecommendType;
  tags: string[];
  rating: number;
  note: string;
  createdAt: number;
  updatedAt: number;
};

type RecommendationGroup = {
  id: string;
  name: string;
  description: string;
  items: RecommendationItem[];
  createdAt: number;
  updatedAt: number;
};

type LifeData = {
  plans: PlanItem[];
  recommendationGroups: RecommendationGroup[];
  updatedAt?: number;
};

const planMeta: Record<PlanStatus, { label: string; color: string }> = {
  todo: { label: '待办', color: 'bg-slate-500' },
  doing: { label: '进行中', color: 'bg-indigo-500' },
  done: { label: '已完成', color: 'bg-emerald-500' },
  paused: { label: '暂停', color: 'bg-amber-500' },
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

const emptyPlan = (): PlanItem => ({
  id: `plan_${Date.now()}`,
  title: '',
  detail: '',
  targetDate: '',
  status: 'todo',
  priority: 'medium',
  tags: [],
  link: '',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const emptyRecommend = (): RecommendationItem => ({
  id: `rec_${Date.now()}`,
  title: '',
  description: '',
  url: '',
  type: 'course',
  tags: [],
  rating: 5,
  note: '',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const emptyGroup = (): RecommendationGroup => ({
  id: `group_${Date.now()}`,
  name: '',
  description: '',
  items: [emptyRecommend()],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

function normalizeLifeData(data: LifeData): LifeData {
  return {
    plans: Array.isArray(data.plans) ? data.plans : [],
    recommendationGroups: Array.isArray(data.recommendationGroups) ? data.recommendationGroups : [],
    updatedAt: data.updatedAt,
  };
}

export default function LifeModulesBoard() {
  const [data, setData] = useState<LifeData>({ plans: [], recommendationGroups: [] });
  const [activeTab, setActiveTab] = useState<'plans' | 'recommendations'>('plans');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/local-life-modules?action=list', { cache: 'no-store' });
        const result = await res.json();
        if (result.success && result.data) setData(normalizeLifeData(result.data));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/local-life-modules?action=save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success && result.data) setData(normalizeLifeData(result.data));
    } finally {
      setSaving(false);
    }
  };

  const filteredPlans = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.plans.filter((plan) => !q || [plan.title, plan.detail, plan.targetDate, plan.tags.join(' ')].join(' ').toLowerCase().includes(q));
  }, [data.plans, query]);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.recommendationGroups.filter((group) => !q || [group.name, group.description, group.items.map((item) => [item.title, item.description, item.tags.join(' ')].join(' ')).join(' ')].join(' ').toLowerCase().includes(q));
  }, [data.recommendationGroups, query]);

  return (
    <section className="w-[95%] max-w-7xl mx-auto mt-24 md:mt-28 pb-20">
      <div className="rounded-[32px] border border-white/50 dark:border-white/10 bg-white/55 dark:bg-slate-950/45 backdrop-blur-2xl shadow-2xl overflow-hidden">
        <div className="p-6 md:p-8 border-b border-white/50 dark:border-white/10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 text-xs font-black text-indigo-600 dark:text-indigo-300">
                <Star size={14} /> 计划表 / 推荐表
              </div>
              <h1 className="mt-4 text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">我的成长和收藏</h1>
              <p className="mt-3 text-sm md:text-base text-slate-600 dark:text-slate-300">计划表放你未来要做的事，推荐表放课程、软件、Skill 和其他值得分享的东西。</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setActiveTab('plans')} className={`h-11 px-4 rounded-2xl text-sm font-black ${activeTab === 'plans' ? 'bg-indigo-500 text-white' : 'bg-white/70 dark:bg-slate-900/70 text-slate-600 dark:text-slate-300'}`}>计划表</button>
              <button onClick={() => setActiveTab('recommendations')} className={`h-11 px-4 rounded-2xl text-sm font-black ${activeTab === 'recommendations' ? 'bg-fuchsia-500 text-white' : 'bg-white/70 dark:bg-slate-900/70 text-slate-600 dark:text-slate-300'}`}>推荐表</button>
              <button onClick={save} disabled={saving} className="h-11 px-4 rounded-2xl text-sm font-black bg-emerald-500 text-white disabled:opacity-60 inline-flex items-center gap-2"><Save size={14} />{saving ? '保存中' : '保存'}</button>
            </div>
          </div>
          <div className="mt-5 flex flex-col md:flex-row gap-3">
            <label className="flex-1 h-12 rounded-2xl border border-white/60 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 px-4 flex items-center gap-3">
              <Filter size={16} className="text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-transparent outline-none text-sm font-medium text-slate-700 dark:text-slate-100" placeholder="搜索标题、说明、标签" />
            </label>
            <button onClick={() => activeTab === 'plans' ? setData((prev) => ({ ...prev, plans: [...prev.plans, emptyPlan()] })) : setData((prev) => ({ ...prev, recommendationGroups: [...prev.recommendationGroups, emptyGroup()] }))} className="h-12 px-4 rounded-2xl bg-slate-900 text-white font-black inline-flex items-center gap-2"><Plus size={16} />新增</button>
          </div>
        </div>

        <div className="p-5 md:p-8">
          {loading ? (
            <div className="py-20 text-center text-slate-400 font-black">加载中...</div>
          ) : activeTab === 'plans' ? (
            <div className="grid gap-4">
              {filteredPlans.length === 0 ? (
                <div className="py-16 text-center text-slate-400 font-black">还没有计划</div>
              ) : filteredPlans.map((plan, index) => (
                <div key={plan.id} className="rounded-3xl border border-white/60 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 p-4 md:p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1">
                      <input value={plan.title} onChange={(e) => setData((prev) => ({ ...prev, plans: prev.plans.map((item, i) => i === index ? { ...item, title: e.target.value, updatedAt: Date.now() } : item) }))} className="w-full bg-transparent outline-none text-lg font-black text-slate-900 dark:text-white" placeholder="计划标题" />
                      <textarea value={plan.detail} onChange={(e) => setData((prev) => ({ ...prev, plans: prev.plans.map((item, i) => i === index ? { ...item, detail: e.target.value, updatedAt: Date.now() } : item) }))} className="mt-2 w-full min-h-24 bg-transparent outline-none text-sm text-slate-600 dark:text-slate-300 resize-none" placeholder="计划内容" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <select value={plan.status} onChange={(e) => setData((prev) => ({ ...prev, plans: prev.plans.map((item, i) => i === index ? { ...item, status: e.target.value as PlanStatus, updatedAt: Date.now() } : item) }))} className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-slate-900/80">
                        {Object.entries(planMeta).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}
                      </select>
                      <select value={plan.priority} onChange={(e) => setData((prev) => ({ ...prev, plans: prev.plans.map((item, i) => i === index ? { ...item, priority: e.target.value as PlanPriority, updatedAt: Date.now() } : item) }))} className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-slate-900/80">
                        <option value="high">高</option>
                        <option value="medium">中</option>
                        <option value="low">低</option>
                      </select>
                      <input value={plan.targetDate} onChange={(e) => setData((prev) => ({ ...prev, plans: prev.plans.map((item, i) => i === index ? { ...item, targetDate: e.target.value, updatedAt: Date.now() } : item) }))} className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-slate-900/80" placeholder="目标日期" />
                      <button onClick={() => setData((prev) => ({ ...prev, plans: prev.plans.filter((_, i) => i !== index) }))} className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-600 grid place-items-center"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-white ${planMeta[plan.status].color}`}><Clock3 size={12} />{planMeta[plan.status].label}</span>
                    <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1.5">{plan.priority}</span>
                    {plan.tags.map((tag) => <span key={tag} className="rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 px-3 py-1.5">#{tag}</span>)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-6">
              {filteredGroups.length === 0 ? (
                <div className="py-16 text-center text-slate-400 font-black">还没有推荐分组</div>
              ) : filteredGroups.map((group, groupIndex) => (
                <div key={group.id} className="rounded-3xl border border-white/60 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 p-4 md:p-5">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1">
                      <input value={group.name} onChange={(e) => setData((prev) => ({ ...prev, recommendationGroups: prev.recommendationGroups.map((item, i) => i === groupIndex ? { ...item, name: e.target.value, updatedAt: Date.now() } : item) }))} className="w-full bg-transparent outline-none text-xl font-black text-slate-900 dark:text-white" placeholder="分组名称" />
                      <textarea value={group.description} onChange={(e) => setData((prev) => ({ ...prev, recommendationGroups: prev.recommendationGroups.map((item, i) => i === groupIndex ? { ...item, description: e.target.value, updatedAt: Date.now() } : item) }))} className="mt-2 w-full min-h-20 bg-transparent outline-none text-sm text-slate-600 dark:text-slate-300 resize-none" placeholder="分组说明" />
                    </div>
                    <button onClick={() => setData((prev) => ({ ...prev, recommendationGroups: prev.recommendationGroups.filter((_, i) => i !== groupIndex) }))} className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-600 grid place-items-center"><Trash2 size={14} /></button>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {group.items.map((item, itemIndex) => (
                      <div key={item.id} className="rounded-2xl border border-slate-200/70 dark:border-slate-800 p-4 bg-white/80 dark:bg-slate-950/40">
                        <div className="grid gap-3 md:grid-cols-[1fr_160px]">
                          <div>
                            <input value={item.title} onChange={(e) => setData((prev) => ({ ...prev, recommendationGroups: prev.recommendationGroups.map((g, gi) => gi === groupIndex ? { ...g, items: g.items.map((x, ii) => ii === itemIndex ? { ...x, title: e.target.value, updatedAt: Date.now() } : x) } : g) }))} className="w-full bg-transparent outline-none font-black text-slate-900 dark:text-white" placeholder="推荐标题" />
                            <textarea value={item.description} onChange={(e) => setData((prev) => ({ ...prev, recommendationGroups: prev.recommendationGroups.map((g, gi) => gi === groupIndex ? { ...g, items: g.items.map((x, ii) => ii === itemIndex ? { ...x, description: e.target.value, updatedAt: Date.now() } : x) } : g) }))} className="mt-2 w-full min-h-20 bg-transparent outline-none text-sm text-slate-600 dark:text-slate-300 resize-none" placeholder="推荐说明" />
                          </div>
                          <div className="space-y-2">
                            <select value={item.type} onChange={(e) => setData((prev) => ({ ...prev, recommendationGroups: prev.recommendationGroups.map((g, gi) => gi === groupIndex ? { ...g, items: g.items.map((x, ii) => ii === itemIndex ? { ...x, type: e.target.value as RecommendType, updatedAt: Date.now() } : x) } : g) }))} className="h-10 w-full rounded-xl border px-3 bg-white/80 dark:bg-slate-900/80">
                              {Object.entries(typeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                            </select>
                            <input value={item.url} onChange={(e) => setData((prev) => ({ ...prev, recommendationGroups: prev.recommendationGroups.map((g, gi) => gi === groupIndex ? { ...g, items: g.items.map((x, ii) => ii === itemIndex ? { ...x, url: e.target.value, updatedAt: Date.now() } : x) } : g) }))} className="h-10 w-full rounded-xl border px-3 bg-white/80 dark:bg-slate-900/80" placeholder="链接" />
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <input value={item.note} onChange={(e) => setData((prev) => ({ ...prev, recommendationGroups: prev.recommendationGroups.map((g, gi) => gi === groupIndex ? { ...g, items: g.items.map((x, ii) => ii === itemIndex ? { ...x, note: e.target.value, updatedAt: Date.now() } : x) } : g) }))} className="flex-1 min-w-[220px] h-10 rounded-xl border px-3 bg-white/80 dark:bg-slate-900/80" placeholder="备注" />
                          <input value={item.tags.join(', ')} onChange={(e) => setData((prev) => ({ ...prev, recommendationGroups: prev.recommendationGroups.map((g, gi) => gi === groupIndex ? { ...g, items: g.items.map((x, ii) => ii === itemIndex ? { ...x, tags: e.target.value.split(',').map((v) => v.trim()).filter(Boolean), updatedAt: Date.now() } : x) } : g) }))} className="flex-1 min-w-[220px] h-10 rounded-xl border px-3 bg-white/80 dark:bg-slate-900/80" placeholder="标签，逗号分隔" />
                          <select value={item.rating} onChange={(e) => setData((prev) => ({ ...prev, recommendationGroups: prev.recommendationGroups.map((g, gi) => gi === groupIndex ? { ...g, items: g.items.map((x, ii) => ii === itemIndex ? { ...x, rating: Number(e.target.value), updatedAt: Date.now() } : x) } : g) }))} className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-slate-900/80">
                            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} 星</option>)}
                          </select>
                          <button onClick={() => setData((prev) => ({ ...prev, recommendationGroups: prev.recommendationGroups.map((g, gi) => gi === groupIndex ? { ...g, items: g.items.filter((_, ii) => ii !== itemIndex) } : g) }))} className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-600 grid place-items-center"><Trash2 size={14} /></button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300 px-3 py-1.5">{typeLabels[item.type]}</span>
                          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1.5">{'★'.repeat(item.rating)}</span>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => setData((prev) => ({ ...prev, recommendationGroups: prev.recommendationGroups.map((g, gi) => gi === groupIndex ? { ...g, items: [...g.items, emptyRecommend()] } : g) }))} className="h-11 rounded-2xl border border-dashed border-indigo-300 text-indigo-600 font-black inline-flex items-center justify-center gap-2"><Plus size={14} />新增推荐</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
