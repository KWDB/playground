import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { Theme } from '@/hooks/useTheme';

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
  className?: string;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, onToggle, className }) => {
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center justify-center p-2 rounded-md text-[var(--color-text-secondary)] transition-colors duration-150 hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)] ${className ?? ''}`}
      aria-label={isDark ? '切换为浅色模式' : '切换为暗色模式'}
      title={isDark ? '切换为浅色模式' : '切换为暗色模式'}
      data-testid="theme-toggle"
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
};

export default ThemeToggle;
