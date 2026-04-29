import React from 'react';
import { cn } from '@/lib/utils';
import { HomeTestimonialItem } from './types';
import { homeStyles } from './homeStyles';

interface HomeTestimonialsSectionProps {
  items: HomeTestimonialItem[];
}

export function HomeTestimonialsSection({ items }: HomeTestimonialsSectionProps) {
  return (
    <section className={cn(homeStyles.sectionSpacing)}>
      <div className={homeStyles.sectionHeaderWrap}>
        <p className={homeStyles.sectionKicker}>团队反馈</p>
        <h2 className={homeStyles.sectionTitle}>更像真实工作的学习方式</h2>
        <p className={homeStyles.sectionDescription}>
          控制台式的信息密度 + 克制的交互反馈，让练习过程保持可读、可复盘、可迁移。
        </p>
      </div>
      <div className={homeStyles.testimonialGrid}>
        {items.map((item) => (
          <div key={item.quote} className={homeStyles.testimonialCard}>
            <p className={homeStyles.testimonialQuote}>“{item.quote}”</p>
            <div className={homeStyles.testimonialMeta}>
              <div className="min-w-0">
                <p className={homeStyles.testimonialAuthor}>{item.author}</p>
                <p className={homeStyles.testimonialRole}>{item.role}</p>
              </div>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-light)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] font-semibold">
                {item.author.slice(0, 1)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

