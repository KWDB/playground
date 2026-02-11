import React, { useEffect, useState } from 'react';
import { Terminal, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

type CheckItem = {
  name: string;
  ok: boolean;
  message: string;
  details?: string;
};

type Summary = {
  ok: boolean;
  items: CheckItem[];
};

interface EnvCheckButtonProps {
  onClick: () => void;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export default function EnvCheckButton({ onClick }: EnvCheckButtonProps) {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch('/api/check', { signal: controller.signal });
        if (!resp.ok) throw new Error('环境检测接口返回错误');
        const json: Summary = await resp.json();
        setData(json);
      } catch (e: unknown) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, []);

  const total = data?.items?.length ?? 0;
  const passed = data?.items?.filter(i => i.ok).length ?? 0;
  const allPassed = !!data?.ok;

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-colors cursor-pointer ${
        allPassed
          ? 'border-[var(--color-border-default)] bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-secondary)]'
          : 'border-[var(--color-error)] bg-[var(--color-error-subtle)] hover:bg-[rgba(220,38,38,0.15)]'
      }`}
      aria-haspopup="dialog"
      aria-controls="env-check-modal"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-[var(--color-text-tertiary)]" />
      ) : allPassed ? (
        <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
      ) : error ? (
        <AlertTriangle className="w-4 h-4 text-[var(--color-error)]" />
      ) : (
        <Terminal className="w-4 h-4 text-[var(--color-text-secondary)]" />
      )}

      <div className="flex flex-col items-start">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">环境检测</span>
        <span className="text-xs text-[var(--color-text-tertiary)]">
          {loading && '检查中…'}
          {!loading && error && `失败：${error}`}
          {!loading && !error && (allPassed ? '全部通过' : `${passed}/${total} 项通过`)}
        </span>
      </div>

      <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${
        allPassed
          ? 'bg-[var(--color-success-subtle)] text-[var(--color-success)]'
          : 'bg-[var(--color-error-subtle)] text-[var(--color-error)]'
      }`}>
        {passed}/{total}
      </span>
    </button>
  );
}
