import React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, interactive, ...props }, ref) => {
  return <div ref={ref} className={cn('card', interactive && 'card-interactive', className)} {...props} />;
});

Card.displayName = 'Card';
