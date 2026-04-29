import React, { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { homeStyles } from './homeStyles';

type ShowcaseTab = 'sql' | 'shell' | 'code';

const tabLabels: Record<ShowcaseTab, string> = {
  sql: 'SQL',
  shell: 'Shell',
  code: 'Code',
};

export function HomeShowcaseSection() {
  const [tab, setTab] = useState<ShowcaseTab>('sql');

  const snippet = useMemo(() => {
    if (tab === 'sql') {
      return [
        { kind: 'prompt', prefix: 'kwdb=>', text: <><span className={homeStyles.terminalKeyword}>SELECT</span> version();</> },
        { kind: 'output', prefix: '', text: <span className={homeStyles.terminalSeparator}>──────────────────────────────────────────────</span> },
        { kind: 'output', prefix: '', text: 'KaiwuDB 3.1.0 (aarch64-linux-gnu, built 2026/02/02 10:51:53, go1.21.13, gcc 11.4.0)' },
        { kind: 'output', prefix: '', text: '(1 row)' },
        { kind: 'prompt', prefix: 'kwdb=>', text: <><span className={homeStyles.terminalKeyword}>SELECT</span> count(ts) AS records, avg(speed) AS avg_speed</> },
        { kind: 'prompt', prefix: '', text: <><span className={homeStyles.terminalKeyword}>FROM</span> ts_window.vehicles <span className={homeStyles.terminalKeyword}>GROUP BY</span> COUNT_WINDOW(3);</> },
      ];
    }

    if (tab === 'shell') {
      return [
        { kind: 'prompt', prefix: '$', text: './deploy.sh status' },
        { kind: 'output', prefix: '', text: <><span className={homeStyles.terminalOkText}>[STATUS COMPLETED]</span>:KaiwuDB is runnning now.</> },
        { kind: 'output', prefix: '', text: '' },
        { kind: 'prompt', prefix: '$', text: 'kw-status' },
        { kind: 'output', prefix: '', text: '  id |     address     |   sql_address   | build |            started_at            |           updated_at            |   locality   |    start_mode     | is_available | is_live' },
        { kind: 'output', prefix: '', text: '-----+-----------------+-----------------+-------+----------------------------------+---------------------------------+--------------+-------------------+--------------+----------' },
        { kind: 'output', prefix: '', text: '   1 | 127.0.0.1:26257 | 127.0.0.1:26257 | 3.1.0 | 2026-04-29 01:05:28.936728+00:00 | 2026-04-29 01:05:33.11009+00:00 | region=NODE1 | start-single-node | true         | true' },
        { kind: 'output', prefix: '', text: '(1 row)' },
      ];
    }

    return [
      { kind: 'prompt', prefix: '>>>', text: <><span className={homeStyles.terminalKeyword}>import</span> psycopg2</> },
      { kind: 'prompt', prefix: '>>>', text: 'conn = psycopg2.connect(host="localhost", port=26257, database="defaultdb", user="root", password="")' },
      { kind: 'prompt', prefix: '>>>', text: 'cur = conn.cursor()' },
      { kind: 'prompt', prefix: '>>>', text: 'cur.execute("select count(*) from orders")' },
      { kind: 'prompt', prefix: '>>>', text: 'print(cur.fetchone()[0])' },
    ];
  }, [tab]);

  return (
    <section id="home-showcase" className={cn(homeStyles.sectionSpacing)}>
      <div className={homeStyles.sectionHeaderWrap}>
        <p className={homeStyles.sectionKicker}>从概念到实操</p>
        <h2 className={homeStyles.sectionTitle}>像在终端里学习</h2>
        <p className={cn(homeStyles.sectionDescription, 'whitespace-nowrap max-w-none')}>
          每门课程自带隔离环境，支持 SQL / Shell / Code 协同完成练习。专注于理解与排障，不被本地安装成本打断。
        </p>
      </div>

      <div className={homeStyles.showcaseGrid}>
        <div className={homeStyles.showcasePanel}>
          <div className={homeStyles.showcasePanelHeader}>
            <div className={homeStyles.showcasePanelDots}>
              <span className={homeStyles.showcaseDotRed} />
              <span className={homeStyles.showcaseDotYellow} />
              <span className={homeStyles.showcaseDotGreen} />
            </div>
            <div className={homeStyles.showcaseTabBar}>
              {(Object.keys(tabLabels) as ShowcaseTab[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cn(
                    'h-7 px-2.5 rounded-full text-xs font-semibold border transition-colors duration-150 outline-none',
                    'focus-visible:ring-0 focus-visible:shadow-[0_0_0_2px_var(--color-accent-subtle),0_0_0_4px_var(--color-accent-primary)]',
                    tab === key
                      ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent-primary)] border-[var(--color-accent-border)]'
                      : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border-light)] hover:bg-[var(--color-bg-tertiary)]'
                  )}
                >
                  {tabLabels[key]}
                </button>
              ))}
            </div>
          </div>
          <div className={homeStyles.showcaseCodeBody}>
            <div className={homeStyles.terminalBlock}>
              <div className={homeStyles.terminalInner}>
                {snippet.map((line, idx) => (
                  <div key={idx} className={homeStyles.terminalLine}>
                    {(() => {
                      const promptPrefix = tab === 'code' ? '>>>' : tab === 'shell' ? '$' : 'kwdb=>';
                      const hasPrefix = line.prefix.length > 0;
                      const shouldAlignAsPrompt = line.kind === 'prompt';
                      const prefixToMeasure = hasPrefix ? line.prefix : shouldAlignAsPrompt ? promptPrefix : '';

                      if (!prefixToMeasure) return null;

                      return (
                        <span
                          className={cn(
                            prefixToMeasure.length > 10
                              ? 'shrink-0 tabular-nums'
                              : prefixToMeasure.length <= 2
                              ? 'shrink-0 w-4 tabular-nums'
                              : prefixToMeasure.length <= 3
                              ? 'shrink-0 w-8 tabular-nums'
                              : homeStyles.terminalPrefix,
                            shouldAlignAsPrompt ? homeStyles.terminalPrefixPrompt : homeStyles.terminalPrefixMuted
                          )}
                        >
                          {hasPrefix ? line.prefix : ''}
                        </span>
                      );
                    })()}
                    <span className={cn(homeStyles.terminalText, line.kind === 'output' && homeStyles.terminalOutputText)}>
                      {line.text}
                    </span>
                  </div>
                ))}
                <div className={cn(homeStyles.terminalLine, 'mt-2')}>
                  <span
                    className={cn(
                      tab === 'shell'
                        ? 'shrink-0 w-4 tabular-nums'
                        : tab === 'code'
                        ? 'shrink-0 w-8 tabular-nums'
                        : homeStyles.terminalPrefix,
                      homeStyles.terminalPrefixPrompt
                    )}
                  >
                    {tab === 'code' ? '>>>' : tab === 'shell' ? '$' : 'kwdb=>'}
                  </span>
                  <span className={homeStyles.caret} aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={homeStyles.showcasePanel}>
          <div className={homeStyles.miniDashboard}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">功能一览</p>
                <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">打开浏览器，即刻开始学习</p>
              </div>
              <Link to="/courses" className="shrink-0">
                <Button variant="secondary" size="sm" className="gap-2">
                  浏览课程
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>

            <div className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-bg-tertiary)]/30 p-4">
              <p className="text-xs font-semibold text-[var(--color-text-secondary)]">当前能力</p>
              <div className="mt-3 space-y-2">
                {[
                  { label: '隔离容器环境', value: '每课独立' },
                  { label: '环境诊断', value: '更快定位' },
                  { label: '镜像加速', value: '国内环境友好' },
                  { label: '在线升级', value: '无需手动一键升级' },
                  { label: '进度管理', value: '支持跨会话续学' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-[var(--color-text-secondary)]">{item.label}</span>
                    <span className="text-xs font-semibold text-[var(--color-text-tertiary)]">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
