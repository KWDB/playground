import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

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

function parseMirrorAvailabilityMessage(message: string): { available: string[]; unavailable: string[] } | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  const availableMatch = trimmed.match(/可用：([^；]+)(?:；|$)/);
  const unavailableMatch = trimmed.match(/不可用：(.+)$/);
  if (!availableMatch && !unavailableMatch) return null;

  const splitList = (value: string | undefined) => {
    if (!value) return [];
    return value.split(/[，,]/g).map(s => s.trim()).filter(Boolean);
  };

  return {
    available: splitList(availableMatch?.[1]),
    unavailable: splitList(unavailableMatch?.[1]),
  };
}

export default function EnvCheckPanel({ alwaysExpanded = false }: { alwaysExpanded?: boolean }) {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/check');
      if (!resp.ok) throw new Error('环境检测接口返回错误');
      const json: Summary = await resp.json();
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '环境检测失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const total = data?.items?.length ?? 0;
  const passed = data?.items?.filter(i => i.ok).length ?? 0;

  return (
    <div className="w-full">
      <div className={`transition-all duration-300 overflow-hidden ${alwaysExpanded ? 'max-h-[1500px] opacity-100' : 'max-h-0 opacity-0'}`}>
        {error && (
          <div className="mb-4 p-4 rounded-lg border border-[var(--color-error)] bg-[var(--color-error-subtle)]">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[var(--color-error)] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[var(--color-error)]">检测失败</p>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border-light)]">
                <div className="w-5 h-5 rounded-full skeleton" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 skeleton rounded" />
                  <div className="h-2 w-48 skeleton rounded" />
                </div>
                <div className="w-14 h-6 skeleton rounded-full" />
              </div>
            ))}
          </div>
        ) : (
            <div className="space-y-1">
              {data?.items.map((item, index) => {
                const isMirror = item.name === '镜像源可用性';
                const parsed = isMirror ? parseMirrorAvailabilityMessage(item.message) : null;
                const shouldSplit = !!parsed && parsed.unavailable.length > 0 && parsed.available.length > 0;

                return (
                <div
                  key={item.name}
                  className={`p-4 rounded-lg border transition-colors ${
                    item.ok
                      ? 'border-[var(--color-border-light)] hover:border-[var(--color-success)]'
                      : 'border-[var(--color-error)] bg-[var(--color-error-subtle)]'
                  } ${index !== 0 ? 'border-t-0 rounded-t-none' : ''} ${index !== (data.items.length - 1) ? 'rounded-b-none' : ''}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`flex-shrink-0 p-1 rounded-full ${
                        item.ok ? 'bg-[var(--color-success-subtle)]' : 'bg-[var(--color-error-subtle)]'
                      }`}>
                        {item.ok ? (
                          <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
                        ) : (
                          <XCircle className="w-4 h-4 text-[var(--color-error)]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                          {item.name}
                        </p>
                        {!shouldSplit ? (
                          <p className={`text-sm mt-1 ${item.ok ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-error)]'}`}>
                            {item.message}
                          </p>
                        ) : (
                          <div className="mt-1 space-y-2">
                            {parsed.available.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-success-subtle)] text-[var(--color-success)]">
                                  可用
                                </span>
                                {parsed.available.map(label => (
                                  <span
                                    key={`avail-${label}`}
                                    className="text-xs px-2 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
                                  >
                                    {label}
                                  </span>
                                ))}
                              </div>
                            )}
                            {parsed.unavailable.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-error-subtle)] text-[var(--color-error)]">
                                  不可用
                                </span>
                                {parsed.unavailable.map(label => (
                                  <span
                                    key={`unavail-${label}`}
                                    className="text-xs px-2 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]"
                                  >
                                    {label}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className={`flex-shrink-0 px-2 py-1 rounded-full text-xs font-medium ${
                      item.ok
                        ? 'bg-[var(--color-success-subtle)] text-[var(--color-success)]'
                        : 'bg-[var(--color-error-subtle)] text-[var(--color-error)]'
                    }`}>
                      {item.ok ? '通过' : '失败'}
                    </span>
                  </div>
                  {item.details && (
                    <div className="mt-3 p-3 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border-light)]">
                      <pre className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap font-mono overflow-x-auto">
                        {item.details}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {data && !loading && (
          <div className="mt-4 flex items-center justify-between p-4 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)]">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                data.ok ? 'bg-[var(--color-success-subtle)]' : 'bg-[var(--color-error-subtle)]'
              }`}>
                {data.ok ? (
                  <CheckCircle className="w-5 h-5 text-[var(--color-success)]" />
                ) : (
                  <XCircle className="w-5 h-5 text-[var(--color-error)]" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {data.ok ? '所有检测项目通过' : '存在检测项目未通过'}
                </p>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  {passed}/{total} 项通过
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={load} className="gap-1.5">
              <RefreshCw className="w-4 h-4" />
              重新检测
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
