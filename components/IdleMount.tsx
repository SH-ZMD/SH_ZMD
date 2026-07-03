"use client";

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

type IdleMountProps = {
  children: ReactNode;
  delay?: number;
};

export default function IdleMount({ children, delay = 0 }: IdleMountProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let timerId = 0;
    let idleId: number | null = null;
    const requestIdle = (window as any).requestIdleCallback as
      | ((callback: () => void, options?: { timeout?: number }) => number)
      | undefined;
    const cancelIdle = (window as any).cancelIdleCallback as
      | ((id: number) => void)
      | undefined;

    const show = () => setMounted(true);
    const scheduleIdle = () => {
      if (requestIdle) {
        idleId = requestIdle(show, { timeout: 2500 });
        return;
      }
      timerId = window.setTimeout(show, 200);
    };

    timerId = window.setTimeout(scheduleIdle, delay);

    return () => {
      window.clearTimeout(timerId);
      if (idleId !== null && cancelIdle) cancelIdle(idleId);
    };
  }, [delay]);

  return mounted ? <>{children}</> : null;
}
