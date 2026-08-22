import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-slate-50 dark:bg-slate-950 font-serif">
      <div className="text-center max-w-md">
        <p className="text-7xl md:text-8xl font-black text-slate-200 dark:text-slate-800 select-none">404</p>
        <h1 className="mt-4 text-2xl md:text-3xl font-black text-slate-800 dark:text-white">
          这颗星星还没有名字
        </h1>
        <p className="mt-3 text-sm md:text-base text-slate-500 dark:text-slate-400 leading-relaxed">
          你访问的页面不存在，可能已被移动或删除。<br />
          去星图上找找其他内容吧。
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center px-6 rounded-2xl bg-indigo-500 text-white text-sm font-black shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400 active:scale-95"
          >
            返回首页
          </Link>
          <Link
            href="/starmap"
            className="inline-flex h-11 items-center px-6 rounded-2xl border border-slate-300/60 dark:border-white/10 text-slate-600 dark:text-slate-300 text-sm font-black transition hover:border-indigo-300 active:scale-95"
          >
            逛逛星图
          </Link>
        </div>
      </div>
    </div>
  );
}
