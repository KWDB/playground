import React from 'react';
import { cn } from '@/lib/utils';

export type ChipVariant = 'neutral' | 'accent' | 'success' | 'warning' | 'error';

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  variant?: ChipVariant;
}

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, selected, variant = 'neutral', disabled, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center h-8 px-3 text-[13px] font-semibold rounded-full border outline-none transform-gpu whitespace-nowrap';

    const focus = 'focus-visible:ring-0 focus-visible:shadow-[0_0_0_2px_var(--color-accent-subtle),0_0_0_4px_var(--color-accent-primary)]';

    const variants: Record<ChipVariant, { base: string; selected: string }> = {
      neutral: {
        base: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border-light)] hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-border-default)]',
        selected:
          'bg-[var(--color-accent-subtle)] text-[var(--color-accent-primary)] border-[var(--color-accent-border)]',
      },
      accent: {
        base: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border-light)] hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-border-default)]',
        selected:
          'bg-[var(--color-accent-subtle)] text-[var(--color-accent-primary)] border-[var(--color-accent-border)]',
      },
      success: {
        base: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border-light)] hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-border-default)]',
        selected: 'bg-[var(--color-success-subtle)] text-[var(--color-success)] border-[var(--color-success-border)]',
      },
      warning: {
        base: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border-light)] hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-border-default)]',
        selected: 'bg-[var(--color-warning-subtle)] text-[var(--color-warning)] border-[var(--color-warning-border)]',
      },
      error: {
        base: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border-light)] hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-border-default)]',
        selected: 'bg-[var(--color-error-subtle)] text-[var(--color-error)] border-[var(--color-error-border)]',
      },
    };

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        className={cn(
          base,
          focus,
          'transition-[background-color,color,border-color,box-shadow,transform] duration-150 ease-out',
          'active:translate-y-[1px] disabled:active:translate-y-0',
          disabled && 'opacity-50 cursor-not-allowed',
          selected ? variants[variant].selected : variants[variant].base,
          className
        )}
        {...props}
      />
    );
  }
);

Chip.displayName = 'Chip';
