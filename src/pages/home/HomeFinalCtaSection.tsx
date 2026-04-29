import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { homeStyles } from './homeStyles';

export function HomeFinalCtaSection() {
  return (
    <section className={cn(homeStyles.finalCtaWrap)}>
      <div className={homeStyles.finalCtaBackdrop} aria-hidden="true" />
      <div className={homeStyles.finalCtaInner}>
        <div>
          <h2 className={homeStyles.finalCtaTitle}>开始你的 KWDB 实操之旅</h2>
          <p className={homeStyles.finalCtaDesc}>
            从第一门课程开始，在隔离环境里练习 SQL / Shell / Code。每一步都有目标与反馈，学习更像工作流。
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Link to="/courses" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto gap-2">
              进入课程列表
              <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
          <Button
            variant="secondary"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => {
              const el = document.getElementById('home-showcase');
              el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            了解学习方式
          </Button>
        </div>
      </div>
    </section>
  );
}
