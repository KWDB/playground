import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Terminal, Zap, ChevronRight } from 'lucide-react';
import { useTourStore } from '@/store/tourStore';
import { TourTooltip } from '@/components/ui/TourTooltip';
import { getStepsForPage, getTotalSteps } from '@/config/tourSteps';
import { Button } from '@/components/ui/Button';

export function Home() {
  const { seenPages, startTour, nextStep, prevStep, skipTour, currentStep, isActive, hasHydrated } = useTourStore();
  const hasCheckedTour = useRef(false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (hasCheckedTour.current) return;
    hasCheckedTour.current = true;

    const timer = setTimeout(() => {
      const hasSeenHome = seenPages?.home === true;
      if (!hasSeenHome && !isActive) {
        startTour('home');
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [seenPages?.home, isActive, hasHydrated, startTour]);

  const steps = getStepsForPage('home');
  const totalSteps = getTotalSteps('home');
  const step = steps[currentStep];

  const features = [
    {
      icon: BookOpen,
      title: '精心设计的课程',
      description: '从入门到进阶的系统化学习路径',
    },
    {
      icon: Terminal,
      title: '交互式终端',
      description: 'Shell 、SQL 和 Code 三终端实时交互',
    },
    {
      icon: Zap,
      title: '容器化环境',
      description: '隔离的安全学习环境，即开即用',
    },
  ];

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center bg-[var(--color-bg-primary)]">
      <div className="max-w-5xl w-full mx-auto px-6 py-12">
        <header className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent-primary)] text-sm font-medium mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent-primary)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-accent-primary)]"></span>
            </span>
            KWDB 官方学习平台
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-[var(--color-text-primary)] mb-4 text-balance tracking-tight">
            交互式数据库学习
          </h1>
          <p className="text-lg text-[var(--color-text-secondary)] max-w-2xl mx-auto mb-8 text-pretty">
            通过容器化环境实时练习命令，在安全的隔离环境中掌握 KWDB 数据库操作。
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/courses">
              <Button size="lg" className="gap-2" data-tour-id="home-start-learning">
                开始学习
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group p-6 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] hover:border-[var(--color-border-default)] transition-colors duration-200"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] mb-4 group-hover:bg-[var(--color-accent-subtle)] group-hover:text-[var(--color-accent-primary)] transition-colors duration-200">
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-base font-medium text-[var(--color-text-primary)] mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {feature.description}
              </p>
            </div>
          ))}
        </section>
      </div>

      {step && (
        <TourTooltip
          isOpen={isActive}
          step={step}
          currentStep={currentStep}
          totalSteps={totalSteps}
          onNext={nextStep}
          onPrev={prevStep}
          onSkip={skipTour}
        />
      )}
    </div>
  );
}

export default Home;
