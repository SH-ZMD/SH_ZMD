"use client";

import { useState } from 'react';
import { useOperations } from '../context/OperationContext';
import { useToast } from './ToastProvider';

export default function PendingOperationsInbox() {
  const { operations, removeOperation, clearOperations } = useOperations();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const syncOperations = async () => {
    if (operations.length === 0 || isSyncing) return;
    setIsSyncing(true);
    try {
      const configRes = await fetch(`/backend_config.json?t=${Date.now()}`);
      const config = await configRes.json();
      const res = await fetch(`http://127.0.0.1:${config.api_port}/api/drafts/sync_local`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || '更新本地失败');
      clearOperations();
      setIsOpen(false);
      showToast(data.message || '✅ 已更新本地', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : '更新本地失败，请确认后端正在运行';
      showToast(message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className={`relative grid h-10 w-10 place-items-center rounded-2xl border text-lg transition-all ${operations.length > 0 ? 'border-indigo-400/40 bg-indigo-500/15 text-indigo-600 shadow-lg shadow-indigo-500/15 dark:text-indigo-200' : 'border-white/45 bg-white/35 text-slate-500 hover:bg-white/60 dark:border-white/10 dark:bg-slate-950/35 dark:text-slate-300 dark:hover:bg-white/10'}`}
        title="待处理操作"
      >
        📥
        {operations.length > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white ring-2 ring-white dark:ring-slate-950">
            {operations.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-3 w-80 rounded-[28px] border border-white/50 bg-white/92 p-3 shadow-2xl shadow-slate-900/15 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/92">
          <div className="mb-3 flex items-center justify-between px-2">
            <div>
              <p className="text-sm font-black text-slate-800 dark:text-white">待处理</p>
              <p className="text-[11px] font-bold text-slate-400">确认后才会真实写入本地文件</p>
            </div>
            {operations.length > 0 && (
              <button onClick={clearOperations} className="text-[11px] font-black text-slate-400 transition hover:text-rose-500">
                清空
              </button>
            )}
          </div>

          {operations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200/80 px-4 py-8 text-center text-xs font-bold text-slate-400 dark:border-slate-800">
              暂无待处理操作
            </div>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {operations.map((op) => (
                <div key={op.id} className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-slate-700 dark:text-slate-200">{op.label}</p>
                    <p className="mt-0.5 text-[10px] font-bold text-slate-400">{op.timestamp}</p>
                  </div>
                  <button onClick={() => removeOperation(op.id)} className="grid h-7 w-7 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-rose-500 hover:text-white">
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={syncOperations}
            disabled={operations.length === 0 || isSyncing}
            className="mt-3 w-full rounded-2xl bg-indigo-500 px-4 py-3 text-xs font-black text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSyncing ? '正在更新本地…' : '更新本地'}
          </button>
        </div>
      )}
    </div>
  );
}
