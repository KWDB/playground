import React, { useEffect, useRef } from 'react';
import { useTourStore } from '@/store/tourStore';
import { TourTooltip } from '@/components/ui/TourTooltip';
import { getStepsForPage, getTotalSteps } from '@/config/tourSteps';
import { HomeFeatureSection } from './home/HomeFeatureSection';
import { HomeHeroSection } from './home/HomeHeroSection';
import { homeFeatureItems } from './home/homeContent';
import { homeStyles } from './home/homeStyles';

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

  return (
    <div className={homeStyles.pageRoot}>
      <div className={homeStyles.contentContainer}>
        <HomeHeroSection ctaTourId="home-start-learning" />
        <HomeFeatureSection features={homeFeatureItems} />
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
