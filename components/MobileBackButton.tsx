// src/components/MobileBackButton.tsx
"use client";

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

export default function MobileBackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      // 放在右下角稍微靠上的位置，防止挡住底部的导航转轴
      className="fixed bottom-5 left-4 z-[60] w-11 h-11 flex items-center justify-center bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-xl rounded-full text-slate-700 dark:text-slate-200 active:scale-90 transition-all"
      title="返回上一页"
      aria-label="返回上一页"
    >
      <ChevronLeft size={24} />
    </button>
  );
}
