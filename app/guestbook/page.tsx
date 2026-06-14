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
        <main className="w-[94%] max-w-5xl mx-auto pt-28 md:pt-32 text-slate-900 dark:text-white">
          <section className="relative overflow-hidden rounded-[36px] border border-white/40 dark:border-white/10 bg-white/40 dark:bg-slate-950/40 p-6 md:p-10 backdrop-blur-2xl shadow-2xl shadow-slate-900/10">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -left-24 bottom-12 h-64 w-64 rounded-full bg-fuchsia-500/15 blur-3xl" />

            <div className="relative text-center">
              <p className="text-xs font-black uppercase tracking-[0.35em] text-indigo-500">Guestbook</p>
              <h1 className="mt-4 text-4xl md:text-6xl font-black tracking-tight">留言墙</h1>
              <p className="mx-auto mt-5 max-w-2xl text-sm md:text-base leading-7 text-slate-600 dark:text-slate-300">
                路过的人可以直接留下几句话，不需要登录 GitHub。顶部导航会像其它页面一样保留。
              </p>
            </div>

            <div className="relative mt-10 rounded-[28px] border border-white/40 dark:border-white/10 bg-white/35 dark:bg-slate-950/35 p-5 md:p-8 backdrop-blur-xl shadow-2xl shadow-slate-900/10">
              <Comments />
            </div>
          </section>
        </main>
      </PageTransition>
    </div>
  );
}
