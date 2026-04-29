import React from 'react';
import { cn } from '@/lib/utils';

export interface IconToggleGroupOption {
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface IconToggleGroupProps {
  value: string;
  onValueChange: (value: string) => void;
  options: IconToggleGroupOption[];
  className?: string;
}

export const IconToggleGroup: React.FC<IconToggleGroupProps> = ({ value, onValueChange, options, className }) => {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-0.5',
        className
      )}
      role="group"
    >
      {options.map((option) => {
        const selected = option.value === value;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onValueChange(option.value)}
            aria-label={option.label}
            aria-pressed={selected}
            className={cn(
              'h-8 w-8 rounded-md inline-flex items-center justify-center outline-none transform-gpu',
              'transition-[background-color,color,box-shadow,transform] duration-150 ease-out',
              'active:translate-y-[1px]',
              'focus-visible:ring-0 focus-visible:shadow-[0_0_0_2px_var(--color-accent-subtle),0_0_0_4px_var(--color-accent-primary)]',
              selected
                ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] shadow-[inset_0_0_0_1px_var(--color-border-light)]'
                : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]'
            )}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
};
