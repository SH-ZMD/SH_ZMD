import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';
import Comments from '../../components/Comments';
import { siteConfig } from '../../siteConfig';

export const metadata = {
  title: `留言墙 | ${siteConfig.title}`,
  description: '路过的人可以直接留下几句话，不需要登录 GitHub。',
};

export default function GuestbookPage() {
  return (
    <div className="min-h-screen relative pb-10">
      <Navbar />
      <PageTransition>
        <main className="w-[94%] max-w-6xl mx-auto mt-24 sm:mt-28 px-4 sm:px-6 lg:px-10 relative z-10 text-slate-900 dark:text-white">
          <section className="rounded-3xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl overflow-hidden transition-all duration-700 relative p-5 sm:p-8">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -left-24 bottom-12 h-64 w-64 rounded-full bg-fuchsia-500/15 blur-3xl" />

            <div className="relative text-center md:text-left">
              <p className="text-xs font-black uppercase tracking-[0.35em] text-indigo-500">Guestbook</p>
              <h1 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-black tracking-tight">留言墙</h1>
              <p className="mt-4 max-w-2xl text-sm md:text-base leading-7 text-slate-600 dark:text-slate-300">
                路过的人可以直接留下几句话，不需要登录 GitHub。页面布局已和其它栏目保持一致，顶部目录会一直保留。
              </p>
            </div>

            <div className="relative mt-8 rounded-3xl border border-white/40 dark:border-white/10 bg-white/35 dark:bg-slate-950/35 p-4 md:p-6 backdrop-blur-xl shadow-xl shadow-slate-900/10">
              <Comments />
            </div>
          </section>
        </main>
      </PageTransition>
    </div>
  );
}
