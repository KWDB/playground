import { useEffect, useMemo, useState } from 'react';

export type TransitionStage = 'enter' | 'exit';

export function useSwitchTransition<T>(activeKey: string, activeValue: T, duration = 160) {
  const [renderedKey, setRenderedKey] = useState(activeKey);
  const [renderedValue, setRenderedValue] = useState<T>(activeValue);
  const [stage, setStage] = useState<TransitionStage>('enter');

  const effectiveDuration = useMemo(() => {
    if (typeof window === 'undefined') {
      return duration;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : duration;
  }, [duration]);

  useEffect(() => {
    if (activeKey === renderedKey) {
      return;
    }
    setStage('exit');
  }, [activeKey, renderedKey]);

  useEffect(() => {
    if (stage !== 'exit') {
      return;
    }
    const timer = window.setTimeout(() => {
      setRenderedKey(activeKey);
      setRenderedValue(activeValue);
      setStage('enter');
    }, effectiveDuration);
    return () => window.clearTimeout(timer);
  }, [stage, activeKey, activeValue, effectiveDuration]);

  return { renderedValue, stage };
}
