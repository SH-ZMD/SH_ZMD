import fs from 'fs';
import path from 'path';
import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';
import { siteConfig } from '../../siteConfig';

type PlanStatus = 'todo' | 'doing' | 'done' | 'paused';
type PlanPriority = 'low' | 'medium' | 'high';
type PlanItem = {
  id: string;
  title: string;
  detail: string;
  targetDate: string;
  status: PlanStatus;
  priority: PlanPriority;
  tags: string[];
  link: string;
};

const statusMeta: Record<PlanStatus, { label: string; className: string }> = {
  todo: { label: '待办', className: 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20' },
  doing: { label: '进行中', className: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/20' },
  done: { label: '已完成', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20' },
  paused: { label: '暂停', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20' },
};

const priorityMeta: Record<PlanPriority, string> = {
  high: '高优先级',
  medium: '中优先级',
  low: '低优先级',
};

export const metadata = {
  title: `计划表 | ${siteConfig.title}`,
  description: '未来计划、学习路线与待办目标',
};

function readPlans(): PlanItem[] {
  try {
    const file = path.join(process.cwd(), 'public', 'life-modules.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return Array.isArray(data?.plans) ? data.plans : [];
  } catch {
    return [];
  }
}

export default function PlansPage() {
  const plans = readPlans();

  return (
    <div className="min-h-screen relative pb-10">
      <Navbar />
      <PageTransition>
        <main className="w-[95%] max-w-6xl mx-auto mt-24 md:mt-28 pb-20 relative z-10">
          <section className="rounded-[32px] border border-white/50 dark:border-white/10 bg-white/55 dark:bg-slate-950/45 backdrop-blur-2xl shadow-2xl overflow-hidden">
            <div className="p-6 md:p-10 border-b border-white/50 dark:border-white/10">
              <div className="inline-flex rounded-full bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 text-xs font-black text-indigo-600 dark:text-indigo-300">Future Plans</div>
              <h1 className="mt-4 text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">计划表</h1>
              <p className="mt-3 text-sm md:text-base text-slate-600 dark:text-slate-300">这里放我接下来想学习、想完成、想慢慢推进的事情。</p>
            </div>

            <div className="p-5 md:p-8 grid gap-4">
              {plans.length === 0 ? (
                <div className="py-20 text-center text-slate-400 font-black">还没有公开计划。</div>
              ) : plans.map((plan) => {
                const status = statusMeta[plan.status] || statusMeta.todo;
                return (
                  <article key={plan.id} className="rounded-3xl border border-white/60 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white">{plan.title || '未命名计划'}</h2>
                        {plan.detail && <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600 dark:text-slate-300">{plan.detail}</p>}
                      </div>
                      <span className={`shrink-0 inline-flex rounded-2xl border px-3 py-1.5 text-xs font-black ${status.className}`}>{status.label}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-black">
                      <span className="rounded-full bg-slate-900/5 dark:bg-white/5 px-3 py-1.5 text-slate-600 dark:text-slate-300">{priorityMeta[plan.priority] || priorityMeta.medium}</span>
                      {plan.targetDate && <span className="rounded-full bg-indigo-500/10 px-3 py-1.5 text-indigo-600 dark:text-indigo-300">{plan.targetDate}</span>}
                      {(plan.tags || []).map((tag) => <span key={tag} className="rounded-full bg-fuchsia-500/10 px-3 py-1.5 text-fuchsia-600 dark:text-fuchsia-300">#{tag}</span>)}
                      {plan.link && <a href={plan.link} target="_blank" rel="noreferrer" className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-emerald-600 dark:text-emerald-300 hover:underline">相关链接</a>}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </main>
      </PageTransition>
    </div>
  );
}
