import React, { useId } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'warning' | 'danger' | 'info';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title = '确认操作',
  message,
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  onCancel,
  variant = 'warning'
}) => {
  const titleId = useId();
  const messageId = useId();
  if (!isOpen) return null;

  const getVariantConfig = () => {
    switch (variant) {
      case 'danger':
        return { iconColor: 'text-[var(--color-error)]', confirmVariant: 'danger' as const };
      case 'info':
        return { iconColor: 'text-[var(--color-accent-primary)]', confirmVariant: 'primary' as const };
      default:
        return { iconColor: 'text-[var(--color-warning)]', confirmVariant: 'primary' as const };
    }
  };

  const config = getVariantConfig();

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className="relative z-10 w-full max-w-sm bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border-default)] shadow-xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-light)]">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 ${config.iconColor}`} aria-hidden="true" />
            <h3 id={titleId} className="text-sm font-medium text-[var(--color-text-primary)]">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
            aria-label="关闭确认弹窗"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <div className="p-4">
          <p id={messageId} className="text-sm text-[var(--color-text-secondary)] mb-4">{message}</p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onCancel}>{cancelText}</Button>
            <Button variant={config.confirmVariant} className="flex-1" onClick={onConfirm}>{confirmText}</Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmDialog;
