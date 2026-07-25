"use client";

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

declare global { interface Window { turnstile?: { render: (element: HTMLElement, options: Record<string, unknown>) => string; reset: (widgetId: string) => void; remove: (widgetId: string) => void } } }
export const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
export default function TurnstileWidget({ onToken, resetKey = 0 }: { onToken: (token: string) => void; resetKey?: number }) {
  const containerRef = useRef<HTMLDivElement>(null); const widgetIdRef = useRef<string | null>(null); const [ready, setReady] = useState(false); const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
  useEffect(() => { if (!ready || !siteKey || !containerRef.current || !window.turnstile || widgetIdRef.current) return; widgetIdRef.current = window.turnstile.render(containerRef.current, { sitekey: siteKey, theme: 'auto', size: 'flexible', callback: (token: string) => onToken(token), 'expired-callback': () => onToken(''), 'error-callback': () => onToken('') }); return () => { if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current); widgetIdRef.current = null; }; }, [onToken, ready, siteKey]);
  useEffect(() => { if (resetKey > 0 && widgetIdRef.current && window.turnstile) { window.turnstile.reset(widgetIdRef.current); onToken(''); } }, [onToken, resetKey]);
  if (!siteKey) return null;
  return <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={() => setReady(true)} /><div ref={containerRef} className="min-h-[65px] w-full overflow-hidden" aria-label="人机验证" /></>;
}
