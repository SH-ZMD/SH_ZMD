"use client";

import dynamic from 'next/dynamic';

const DanmakuBackground = dynamic(() => import('./DanmakuBackground'), {
  ssr: false,
  loading: () => null,
});

export default function LazyDanmakuBackground() {
  return <DanmakuBackground />;
}
