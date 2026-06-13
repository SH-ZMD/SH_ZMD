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
        </div>

        <div className="mt-10 rounded-[28px] border border-white/40 dark:border-white/10 bg-white/35 dark:bg-slate-950/35 p-5 md:p-8 backdrop-blur-xl shadow-2xl shadow-slate-900/10">
          <Comments />
        </div>
      </section>
    </main>
  );
}
