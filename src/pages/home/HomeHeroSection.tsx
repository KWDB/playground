import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { homeStyles } from './homeStyles';

interface HomeHeroSectionProps {
  ctaTourId: string;
}

export function HomeHeroSection({ ctaTourId }: HomeHeroSectionProps) {
  return (
    <header className={cn(homeStyles.heroHeader, homeStyles.sectionSpacing)}>
      <div className={homeStyles.heroBadge}>
        <span className="relative flex h-2 w-2">
          <span className={homeStyles.heroBadgePing}></span>
          <span className={homeStyles.heroBadgeDot}></span>
        </span>
        KWDB 官方学习平台
      </div>
      <h1 className={homeStyles.heroTitle}>
        交互式数据库学习
      </h1>
      <p className={homeStyles.heroDescription}>
        通过容器化环境实时练习命令，在安全的隔离环境中掌握 KWDB 数据库操作。
      </p>
      <div className={homeStyles.heroActions}>
        <Link to="/courses" className="w-full sm:w-auto">
          <Button size="lg" className={homeStyles.heroCtaButton} data-tour-id={ctaTourId}>
            开始学习
            <ChevronRight className={homeStyles.heroCtaIcon} />
          </Button>
        </Link>
      </div>
    </header>
  );
}
