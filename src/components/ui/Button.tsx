import React, { createContext, useContext } from 'react';
import { clsx, type ClassValue } from 'clsx';

function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    const variants = {
      primary: 'bg-[var(--color-accent-primary)] text-white hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-active)]',
      secondary: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-border-dark)]',
      ghost: 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]',
      danger: 'bg-[var(--color-error)] text-white hover:bg-red-700',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-5 py-2.5 text-base',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors duration-150 outline-none',
          'focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]',
          variants[variant],
          sizes[size],
          (disabled || loading) && 'opacity-50 cursor-not-allowed',
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

interface DialogContextType {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = createContext<DialogContextType | null>(null);

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children }) => {
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
};

export const DialogTrigger: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const context = useContext(DialogContext);
  if (!context) throw new Error('DialogTrigger must be used within Dialog');
  return <div onClick={() => context.onOpenChange(true)}>{children}</div>;
};

export const DialogContent: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  const context = useContext(DialogContext);
  if (!context) throw new Error('DialogContent must be used within Dialog');

  if (!context.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => context.onOpenChange(false)} />
      <div className={cn(
        'relative w-full max-w-sm bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border-default)] shadow-xl p-5 animate-scale-in',
        className
      )}>
        {children}
      </div>
    </div>
  );
};

export const DialogTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <h2 className={cn('text-base font-medium text-[var(--color-text-primary)]', className)}>{children}</h2>
);

export const DialogDescription: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <p className={cn('mt-1.5 text-sm text-[var(--color-text-secondary)]', className)}>{children}</p>
);

export const DialogClose: React.FC<{ children?: React.ReactNode; onClick?: () => void }> = ({ children, onClick }) => {
  const context = useContext(DialogContext);
  if (!context) throw new Error('DialogClose must be used within Dialog');
  return (
    <button
      onClick={() => { context.onOpenChange(false); onClick?.(); }}
      className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
    >
      {children || 'Close'}
    </button>
  );
};

export interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'default';
  onConfirm?: () => void;
}

export const AlertDialog: React.FC<AlertDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  onConfirm,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
        <div className="mt-5 flex justify-end gap-2">
          <DialogClose>{cancelText}</DialogClose>
          <button
            onClick={() => { onConfirm?.(); onOpenChange(false); }}
            className={cn(
              'inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-colors',
              variant === 'danger'
                ? 'bg-[var(--color-error)] text-white hover:bg-red-700'
                : 'bg-[var(--color-accent-primary)] text-white hover:bg-[var(--color-accent-hover)]'
            )}
          >
            {confirmText}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const Spinner: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={cn('animate-spin', className)} viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);
