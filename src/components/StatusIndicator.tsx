import React from 'react';
import { LucideIcon } from 'lucide-react';

// 状态类型定义
export type StatusType = 'running' | 'stopped' | 'starting' | 'stopping' | 'error' | 'connected' | 'disconnected' | 'connecting';

// 状态配置接口
interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  shadowColor: string;
  animation?: string;
}

// 组件属性接口
interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  icon?: LucideIcon;
  className?: string;
}

// 状态配置映射
const statusConfigs: Record<StatusType, StatusConfig> = {
  running: {
    label: '运行中',
    color: 'bg-emerald-500',
    bgColor: 'bg-emerald-50/80',
    borderColor: 'border-emerald-200',
    shadowColor: 'shadow-emerald-200/50',
  },
  stopped: {
    label: '已停止',
    color: 'bg-slate-500',
    bgColor: 'bg-slate-50/80',
    borderColor: 'border-slate-200',
    shadowColor: 'shadow-slate-200/50',
  },
  starting: {
    label: '启动中',
    color: 'bg-amber-500',
    bgColor: 'bg-amber-50/80',
    borderColor: 'border-amber-200',
    shadowColor: 'shadow-amber-200/50',
    animation: 'animate-pulse',
  },
  stopping: {
    label: '停止中',
    color: 'bg-orange-500',
    bgColor: 'bg-orange-50/80',
    borderColor: 'border-orange-200',
    shadowColor: 'shadow-orange-200/50',
    animation: 'animate-pulse',
  },
  error: {
    label: '错误',
    color: 'bg-red-500',
    bgColor: 'bg-red-50/80',
    borderColor: 'border-red-200',
    shadowColor: 'shadow-red-200/50',
  },
  connected: {
    label: '已连接',
    color: 'bg-emerald-500',
    bgColor: 'bg-emerald-50/80',
    borderColor: 'border-emerald-200',
    shadowColor: 'shadow-emerald-200/50',
  },
  disconnected: {
    label: '未连接',
    color: 'bg-slate-500',
    bgColor: 'bg-slate-50/80',
    borderColor: 'border-slate-200',
    shadowColor: 'shadow-slate-200/50',
  },
  connecting: {
    label: '连接中',
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50/80',
    borderColor: 'border-blue-200',
    shadowColor: 'shadow-blue-200/50',
    animation: 'animate-pulse',
  },
};

// 尺寸配置
const sizeConfigs = {
  sm: {
    dot: 'w-1.5 h-1.5 lg:w-2 lg:h-2',
    container: 'px-2 lg:px-3 py-1.5 lg:py-2',
    text: 'text-xs lg:text-sm',
    icon: 'w-3 h-3 lg:w-3 lg:h-3',
  },
  md: {
    dot: 'w-2 h-2 lg:w-2.5 lg:h-2.5',
    container: 'px-3 lg:px-4 py-2 lg:py-2.5',
    text: 'text-sm lg:text-base',
    icon: 'w-3 h-3 lg:w-4 lg:h-4',
  },
  lg: {
    dot: 'w-2.5 h-2.5 lg:w-3 lg:h-3',
    container: 'px-4 lg:px-5 py-2.5 lg:py-3',
    text: 'text-base lg:text-lg',
    icon: 'w-4 h-4 lg:w-5 lg:h-5',
  },
};

/**
 * 统一的状态指示器组件
 * 用于显示容器状态、连接状态等各种状态信息
 */
const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  size = 'md',
  showLabel = true,
  icon: Icon,
  className = '',
}) => {
  const config = statusConfigs[status];
  const sizeConfig = sizeConfigs[size];
  
  if (!config) {
    console.warn(`Unknown status: ${status}`);
    return null;
  }

  const displayLabel = label || config.label;

  return (
    <div className={`
      flex items-center space-x-1 lg:space-x-2 
      ${sizeConfig.container} 
      ${config.bgColor} 
      backdrop-blur-sm 
      border border-dashed 
      ${config.borderColor} 
      rounded-lg 
      shadow-inner 
      transition-all duration-200 
      hover:shadow-md 
      ${className}
    `}>
      {/* 状态指示点 */}
      <div className={`
        ${sizeConfig.dot} 
        rounded-full 
        ring-1 ring-white/50 
        ${config.color} 
        ${config.shadowColor} 
        shadow-sm 
        ${config.animation || ''}
      `} />
      
      {/* 图标 */}
      {Icon && (
        <Icon className={`${sizeConfig.icon} text-gray-600`} />
      )}
      
      {/* 状态标签 */}
      {showLabel && (
        <span className={`
          ${sizeConfig.text} 
          font-medium 
          text-gray-700 
          tracking-wide
          hidden sm:inline lg:inline
        `}>
          {displayLabel}
        </span>
      )}
      
      {/* 移动端简化标签 */}
      {showLabel && (
        <span className={`
          font-medium 
          text-xs 
          text-gray-700 
          tracking-wide
          sm:hidden
        `}>
          {status === 'running' ? '运行' :
           status === 'starting' ? '启动' :
           status === 'stopping' ? '停止' :
           status === 'stopped' ? '停止' :
           status === 'error' ? '错误' :
           status === 'connected' ? '连接' :
           status === 'connecting' ? '连接中' :
           '断开'}
        </span>
      )}
    </div>
  );
};

export default StatusIndicator;