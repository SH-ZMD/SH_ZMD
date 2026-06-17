import fs from 'fs';
import path from 'path';
import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';
import { siteConfig } from '../../siteConfig';

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

export const metadata = {
  title: `推荐表 | ${siteConfig.title}`,
  description: '推荐课程、软件、Skill 和工具清单',
};

function readRecommendationGroups(): RecommendationGroup[] {
  try {
    const file = path.join(process.cwd(), 'public', 'life-modules.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return Array.isArray(data?.recommendationGroups) ? data.recommendationGroups : [];
  } catch {
    return [];
  }
}

export default function RecommendationsPage() {
  const groups = readRecommendationGroups();

  return (
    <div className="min-h-screen relative pb-10">
      <Navbar />
      <PageTransition>
        <main className="w-[95%] max-w-7xl mx-auto mt-24 md:mt-28 pb-20 relative z-10">
          <section className="rounded-[32px] border border-white/50 dark:border-white/10 bg-white/55 dark:bg-slate-950/45 backdrop-blur-2xl shadow-2xl overflow-hidden">
            <div className="p-6 md:p-10 border-b border-white/50 dark:border-white/10">
              <div className="inline-flex rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 px-4 py-2 text-xs font-black text-fuchsia-600 dark:text-fuchsia-300">Recommendations</div>
              <h1 className="mt-4 text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">推荐表</h1>
              <p className="mt-3 text-sm md:text-base text-slate-600 dark:text-slate-300">这里放我觉得值得推荐的课程、软件、Skill、工具和网站。</p>
            </div>

            <div className="p-5 md:p-8 grid gap-8">
              {groups.length === 0 ? (
                <div className="py-20 text-center text-slate-400 font-black">还没有公开推荐。</div>
              ) : groups.map((group) => (
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
          </section>
        </main>
      </PageTransition>
    </div>
  );
}
