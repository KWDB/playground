import React, { useState, createContext, useContext } from 'react';
import { clsx, type ClassValue } from 'clsx';

function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

interface DropdownContextType {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DropdownContext = createContext<DropdownContextType | null>(null);

export interface DropdownProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const Dropdown: React.FC<DropdownProps> = ({ children, open: controlledOpen, onOpenChange }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  return (
    <DropdownContext.Provider value={{ open, onOpenChange: setOpen }}>
      <div className="relative inline-block">{children}</div>
    </DropdownContext.Provider>
  );
};

export const DropdownTrigger: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const context = useContext(DropdownContext);
  if (!context) throw new Error('DropdownTrigger must be used within Dropdown');
  return <div onClick={() => context.onOpenChange(!context.open)}>{children}</div>;
};

export const DropdownContent: React.FC<{ children: React.ReactNode; className?: string; align?: 'left' | 'right' }> = ({
  children,
  className,
  align = 'left',
}) => {
  const context = useContext(DropdownContext);
  if (!context) throw new Error('DropdownContent must be used within Dropdown');

  if (!context.open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={() => context.onOpenChange(false)} />
      <div className={cn(
        'absolute z-50 mt-1 min-w-[160px] bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border-default)] shadow-lg p-1',
        align === 'left' ? 'left-0' : 'right-0',
        'animate-fade-in',
        className
      )}>
        {children}
      </div>
    </>
  );
};

export interface DropdownItemProps {
  children: React.ReactNode;
  onSelect?: () => void;
  className?: string;
  disabled?: boolean;
  variant?: 'default' | 'danger';
}

export const DropdownItem: React.FC<DropdownItemProps> = ({
  children,
  onSelect,
  className,
  disabled,
  variant = 'default',
}) => {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer text-left transition-colors',
        'outline-none',
        'hover:bg-[var(--color-bg-secondary)]',
        variant === 'danger' && 'hover:bg-[var(--color-error-subtle)] text-[var(--color-error)]',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {children}
    </button>
  );
};

export const DropdownSeparator = () => (
  <div className="h-px bg-[var(--color-border-light)] my-1" />
);

export const DropdownLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn('px-3 py-1.5 text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider', className)}>
    {children}
  </div>
);
