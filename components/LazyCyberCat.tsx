"use client";

import dynamic from 'next/dynamic';

const CyberCat = dynamic(() => import('./CyberCat'), {
  ssr: false,
  loading: () => null,
});

export default function LazyCyberCat() {
  return <CyberCat />;
}
