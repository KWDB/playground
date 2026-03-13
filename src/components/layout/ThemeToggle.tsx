import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { Theme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { navbarButtonStyles } from './navbarButtonStyles';

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
      className={cn(
        navbarButtonStyles.iconButtonBase,
        navbarButtonStyles.iconButtonDefault,
        className
      )}
      aria-label={isDark ? '切换为浅色模式' : '切换为暗色模式'}
      title={isDark ? '切换为浅色模式' : '切换为暗色模式'}
      data-testid="theme-toggle"
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
};

export default ThemeToggle;
