import React from 'react';
import { cn } from '@/lib/utils';
import { HomeStatItem } from './types';
import { homeStyles } from './homeStyles';

interface HomeStatsSectionProps {
  items: HomeStatItem[];
}

export function HomeStatsSection({ items }: HomeStatsSectionProps) {
  return (
    <section className={cn(homeStyles.sectionSpacing)}>
      <div className={homeStyles.sectionHeaderWrap}>
        <p className={homeStyles.sectionKicker}>更少摩擦</p>
        <h2 className={homeStyles.sectionTitle}>把学习变成可重复的流程</h2>
        <p className={homeStyles.sectionDescription}>
          你看到的是课程，背后是环境、校验与可观测的闭环。像在真实系统里练习，但不会破坏任何东西。
        </p>
      </div>
      <div className={homeStyles.statsGrid}>
        {items.map((item) => (
          <div key={item.label} className={homeStyles.statCard}>
            <p className={homeStyles.statLabel}>{item.label}</p>
            <p className={homeStyles.statValue}>{item.value}</p>
            <p className={homeStyles.statDescription}>{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

