import React from 'react';
import { LucideIcon } from 'lucide-react';

export type StatusType = 'running' | 'stopped' | 'starting' | 'stopping' | 'paused' | 'error' | 'connected' | 'disconnected' | 'connecting';

interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
}

interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  className?: string;
}

const statusConfigs: Record<StatusType, StatusConfig> = {
  running: { label: '运行中', color: 'bg-[var(--color-success)]', bgColor: 'bg-[var(--color-success-subtle)]' },
  stopped: { label: '已停止', color: 'bg-[var(--color-text-tertiary)]', bgColor: 'bg-[var(--color-bg-tertiary)]' },
  paused: { label: '已暂停', color: 'bg-[var(--color-warning)]', bgColor: 'bg-[var(--color-warning-subtle)]' },
  starting: { label: '启动中', color: 'bg-[var(--color-accent-primary)]', bgColor: 'bg-[var(--color-accent-subtle)]' },
  stopping: { label: '停止中', color: 'bg-[var(--color-warning)]', bgColor: 'bg-[var(--color-warning-subtle)]' },
  error: { label: '错误', color: 'bg-[var(--color-error)]', bgColor: 'bg-[var(--color-error-subtle)]' },
  connected: { label: '已连接', color: 'bg-[var(--color-success)]', bgColor: 'bg-[var(--color-success-subtle)]' },
  disconnected: { label: '未连接', color: 'bg-[var(--color-text-tertiary)]', bgColor: 'bg-[var(--color-bg-tertiary)]' },
  connecting: { label: '连接中', color: 'bg-[var(--color-accent-primary)]', bgColor: 'bg-[var(--color-accent-subtle)]' },
};

const sizeConfigs = {
  sm: { dot: 'w-1.5 h-1.5', container: 'px-2 py-1', text: 'text-xs' },
  md: { dot: 'w-2 h-2', container: 'px-2.5 py-1.5', text: 'text-sm' },
  lg: { dot: 'w-2.5 h-2.5', container: 'px-3 py-2', text: 'text-base' },
};

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  size = 'md',
  icon: Icon,
  className = '',
}) => {
  const config = statusConfigs[status];
  const sizeConfig = sizeConfigs[size];

  if (!config) return null;

  return (
    <div className={`flex items-center gap-2 ${sizeConfig.container} ${config.bgColor} border border-[var(--color-border-light)] rounded-md ${className}`}>
      <div className={`${sizeConfig.dot} rounded-full ${config.color} ${status === 'starting' || status === 'stopping' || status === 'connecting' ? 'animate-pulse' : ''}`} />
      {Icon && <Icon className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />}
      <span className={`${sizeConfig.text} font-medium text-[var(--color-text-secondary)]`}>
        {label || config.label}
      </span>
    </div>
  );
};

export default StatusIndicator;
