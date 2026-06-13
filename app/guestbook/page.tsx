import Link from 'next/link';
import Comments from '../../components/Comments';

export default function GuestbookPage() {
  return (
    <main className="min-h-screen px-6 py-28 text-slate-900 dark:text-white">
      <section className="mx-auto max-w-4xl">
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-indigo-500">Guestbook</p>
          <h1 className="mt-4 text-4xl md:text-6xl font-black tracking-tight">留言墙</h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm md:text-base leading-7 text-slate-600 dark:text-slate-300">
            路过的人可以直接留下几句话，不需要登录 GitHub。
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="rounded-full bg-indigo-500 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-600"
            >
              返回首页
            </Link>
            <Link
              href="/friends"
              className="rounded-full border border-white/45 bg-white/30 px-5 py-2.5 text-sm font-black text-slate-700 backdrop-blur-xl transition hover:bg-white/50 dark:border-white/10 dark:text-slate-100 dark:hover:bg-white/10"
            >
              去友链页
            </Link>
          </div>
        </div>

        <div className="mt-10 rounded-[28px] border border-white/40 dark:border-white/10 bg-white/35 dark:bg-slate-950/35 p-5 md:p-8 backdrop-blur-xl shadow-2xl shadow-slate-900/10">
          <Comments />
        </div>
      </section>
    </main>
  );
}
