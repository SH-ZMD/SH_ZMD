"use client";

import dynamic from 'next/dynamic';

const BackgroundEffects = dynamic(() => import('./BackgroundEffects'), {
  ssr: false,
  loading: () => null,
});

export default function LazyBackgroundEffects() {
  return <BackgroundEffects />;
}
