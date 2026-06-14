"use client";

import dynamic from 'next/dynamic';

const ClickEffect = dynamic(() => import('./ClickEffect'), {
  ssr: false,
  loading: () => null,
});

export default function LazyClickEffect() {
  return <ClickEffect />;
}
