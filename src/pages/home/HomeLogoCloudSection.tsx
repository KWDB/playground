import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { homeStyles } from './homeStyles';

interface HomeLogoCloudSectionProps {
  items: string[];
}

export function HomeLogoCloudSection({ items }: HomeLogoCloudSectionProps) {
  return (
    <section className={cn(homeStyles.logoCloudWrap, homeStyles.sectionSpacing)}>
      <p className={homeStyles.logoCloudTitle}>围绕真实工具链构建的学习体验</p>
      <div className={homeStyles.logoCloudGrid}>
        {items.map((item) => (
          <Badge key={item} size="xs" variant="neutral" className="bg-transparent">
            {item}
          </Badge>
        ))}
      </div>
    </section>
  );
}

