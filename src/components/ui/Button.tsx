import React, { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, type = 'button', ...props }, ref) => {
    const variants = {
      primary: 'bg-[var(--color-accent-primary)] text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-active)]',
      secondary: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] hover:border-[var(--color-accent-primary)]',
      ghost: 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]',
      danger: 'bg-[var(--color-error)] text-[var(--color-on-accent)] hover:bg-[var(--color-error-hover)]',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-9 px-3.5 text-[13px]',
      lg: 'h-10 px-4 text-sm',
    };

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-semibold rounded-md outline-none transform-gpu',
          'transition-[background-color,color,border-color,box-shadow,transform] duration-150 ease-out',
          'active:translate-y-[1px] disabled:active:translate-y-0',
          'focus-visible:ring-0 focus-visible:shadow-[0_0_0_2px_var(--color-accent-subtle),0_0_0_4px_var(--color-accent-primary)]',
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
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 animate-fade-in" onClick={() => context.onOpenChange(false)} />
      <div className={cn(
        'relative w-full max-w-sm bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border-default)] shadow-[var(--shadow-lg)] p-5 animate-scale-in',
        className
      )}>
        {children}
      </div>
    </div>,
    document.body
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
      type="button"
      onClick={() => { context.onOpenChange(false); onClick?.(); }}
      className={cn(
        'inline-flex items-center justify-center h-9 px-3.5 text-[13px] font-semibold rounded-md outline-none transform-gpu',
        'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]',
        'transition-[background-color,color,border-color,box-shadow,transform] duration-150 ease-out',
        'focus-visible:ring-0 focus-visible:shadow-[0_0_0_2px_var(--color-accent-subtle),0_0_0_4px_var(--color-accent-primary)]'
      )}
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
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={() => { onConfirm?.(); onOpenChange(false); }}
          >
            {confirmText}
          </Button>
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
