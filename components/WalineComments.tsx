"use client";

import { useEffect, useRef } from 'react';
import { init } from '@waline/client';
import '@waline/client/style';

interface WalineCommentsProps {
  id: string;
  path: string;
}

export default function WalineComments({ id, path }: WalineCommentsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const walineInstance = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    walineInstance.current = init({
      el: containerRef.current,
      serverURL: process.env.NEXT_PUBLIC_WALINE_SERVER_URL || '',
      path: path,
      lang: 'zh-CN',
      locale: {
        placeholder: '说点什么吧...',
      },
      login: 'disable', // 关键：禁用登录，允许匿名评论
      avatar: 'monsterid',
      meta: ['nick', 'mail'],
      requiredMeta: ['nick'],
      pageSize: 10,
      dark: 'auto',
    });

    return () => {
      walineInstance.current?.destroy();
    };
  }, [id, path]);

  return (
    <div className="w-full relative">
      <div ref={containerRef} className="moment-waline" />

      <style jsx global>{`
        .moment-waline {
          font-size: 13px;
        }

        .moment-waline .wl-panel {
          background: rgba(0, 0, 0, 0.03) !important;
          border: 1px solid transparent !important;
          border-radius: 8px !important;
          padding: 8px 12px !important;
        }

        .dark .moment-waline .wl-panel {
          background: rgba(255, 255, 255, 0.05) !important;
        }

        .moment-waline .wl-editor {
          min-height: 40px !important;
          font-size: 13px !important;
        }

        .moment-waline .wl-btn {
          background: #6366f1 !important;
          border: none !important;
          border-radius: 6px !important;
          padding: 0.3em 1rem !important;
          font-size: 12px !important;
        }

        .moment-waline .wl-card {
          padding: 8px 0 !important;
          border-top: 1px solid rgba(0, 0, 0, 0.05) !important;
        }

        .dark .moment-waline .wl-card {
          border-top: 1px solid rgba(255, 255, 255, 0.05) !important;
        }

        .moment-waline .wl-user {
          font-size: 13px !important;
          font-weight: bold !important;
          color: #576b95 !important;
        }

        .dark .moment-waline .wl-user {
          color: #7f99cc !important;
        }
      `}</style>
    </div>
  );
}
