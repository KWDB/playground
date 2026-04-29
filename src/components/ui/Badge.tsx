import React from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant =
  | 'neutral'
  | 'accent'
  | 'success'
  | 'warning'
  | 'error'
  | 'sql'
  | 'code'
  | 'shell';

export type BadgeSize = 'xs' | 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'neutral', size = 'sm', ...props }, ref) => {
    const sizes: Record<BadgeSize, string> = {
      xs: 'h-5 px-1.5 text-[10px]',
      sm: 'h-5 px-2 text-[11px]',
      md: 'h-6 px-2.5 text-[12px]',
    };

    const variants: Record<BadgeVariant, string> = {
      neutral:
        'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border-[var(--color-border-light)]',
      accent:
        'bg-[var(--color-accent-subtle)] text-[var(--color-accent-primary)] border-[var(--color-accent-border)]',
      success:
        'bg-[var(--color-success-subtle)] text-[var(--color-success)] border-[var(--color-success-border)]',
      warning:
        'bg-[var(--color-warning-subtle)] text-[var(--color-warning)] border-[var(--color-warning-border)]',
      error:
        'bg-[var(--color-error-subtle)] text-[var(--color-error)] border-[var(--color-error-border)]',
      sql:
        'bg-[var(--color-course-sql-bg)] text-[var(--color-course-sql)] border-[var(--color-course-sql-border)]',
      code:
        'bg-[var(--color-course-code-bg)] text-[var(--color-course-code)] border-[var(--color-course-code-border)]',
      shell:
        'bg-[var(--color-course-shell-bg)] text-[var(--color-course-shell)] border-[var(--color-course-shell-border)]',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border font-semibold leading-none whitespace-nowrap',
          sizes[size],
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';
