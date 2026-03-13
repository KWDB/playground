import React from 'react';
import { cn } from '@/lib/utils';
import { homeStyles } from './homeStyles';
import { HomeFeatureItem } from './types';

interface HomeFeatureSectionProps {
  features: HomeFeatureItem[];
}

export function HomeFeatureSection({ features }: HomeFeatureSectionProps) {
  return (
    <section className={cn(homeStyles.featureGrid, homeStyles.sectionSpacing)}>
      {features.map((feature) => (
        <div
          key={feature.title}
          className={cn(homeStyles.featureCard, 'flex flex-col')}
        >
          <div className={homeStyles.featureIconWrap}>
            <feature.icon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <h3 className={homeStyles.featureTitle}>
            {feature.title}
          </h3>
          <p className={homeStyles.featureDescription}>
            {feature.description}
          </p>
        </div>
      ))}
    </section>
  );
}
