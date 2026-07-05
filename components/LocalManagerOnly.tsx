"use client";

import type { ReactNode } from 'react';
import { useLocalManagerRuntime } from '../lib/localManagerRuntime';

export default function LocalManagerOnly({ children }: { children: ReactNode }) {
  const canManage = useLocalManagerRuntime();
  if (!canManage) return null;
  return <>{children}</>;
}
