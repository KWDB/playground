import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, RefreshCw, X, CheckCircle, Server } from 'lucide-react';
import {
  PortConflictInfo,
  ExtendedCleanupResult,
  PortConflictHandlerProps,
  PortConflictHandlerState,
  ConflictHandlingStatus
} from '@/types';

/**
 * 端口冲突智能处理组件
 * 
 * 功能：
 * 1. 检测端口冲突并分析占用来源
 * 2. 提供智能清理建议和一键清理功能
 * 3. 自动重试机制
 * 4. 友好的用户交互界面
 */
const PortConflictHandler: React.FC<PortConflictHandlerProps> = ({
  courseId,
  port,
  isVisible,
  onClose,
  onRetry,
  onSuccess
}) => {
  // Timeout refs for cleanup
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 组件状态管理
  const [state, setState] = useState<PortConflictHandlerState>({
    status: 'idle',
    conflictInfo: null,
    cleanupResult: null,
    error: null,
    isProcessing: false
  });

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (cleanupTimeoutRef.current) clearTimeout(cleanupTimeoutRef.current);
    };
  }, []);

  // Cleanup on close
  useEffect(() => {
    if (!isVisible) {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (cleanupTimeoutRef.current) clearTimeout(cleanupTimeoutRef.current);
    }
  }, [isVisible]);

  // 检查端口冲突
  const checkPortConflict = useCallback(async (): Promise<PortConflictInfo | null> => {
    try {
      console.log(`[PortConflictHandler] 开始检查端口冲突，课程ID: ${courseId}, 端口: ${port}`);
      
      const response = await fetch(`/api/courses/${courseId}/check-port-conflict?port=${port}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `端口冲突检查失败: ${response.status}`);
      }

      const data = await response.json();
      console.log('[PortConflictHandler] 端口冲突检查结果:', data);
      
      return {
        courseId: data.courseId,
        port: data.port,
        isConflicted: data.isConflicted,
        conflictContainers: data.conflictContainers || []
      };
    } catch (error) {
      console.error('[PortConflictHandler] 端口冲突检查失败:', error);
      throw error;
    }
  }, [courseId, port]);

  // 清理课程容器
  const cleanupContainers = useCallback(async (): Promise<ExtendedCleanupResult | null> => {
    try {
      console.log(`[PortConflictHandler] 开始清理课程容器，课程ID: ${courseId}`);
      
      const response = await fetch(`/api/courses/${courseId}/cleanup-containers`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `容器清理失败: ${response.status}`);
      }

      const data = await response.json();
      console.log('[PortConflictHandler] 容器清理结果:', data);
      
      return {
        courseId: data.courseId,
        success: data.success,
        totalCleaned: data.totalCleaned,
        cleanedContainers: data.cleanedContainers || [],
        errors: data.errors || []
      };
    } catch (error) {
      console.error('[PortConflictHandler] 容器清理失败:', error);
      throw error;
    }
  }, [courseId]);

  // 执行端口冲突检查
  const handleCheckConflict = useCallback(async () => {
    setState(prev => ({ ...prev, status: 'checking', isProcessing: true, error: null }));

    try {
      const conflictInfo = await checkPortConflict();
      
      setState(prev => ({
        ...prev,
        status: 'idle',
        conflictInfo,
        isProcessing: false
      }));

      return conflictInfo;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '端口冲突检查失败';
      setState(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage,
        isProcessing: false
      }));
      return null;
    }
  }, [checkPortConflict]);

  // 重试启动课程
  const handleRetryStart = useCallback(() => {
    setState(prev => ({ ...prev, status: 'retrying', isProcessing: true }));
    
    // 调用父组件的重试回调
    onRetry();
    
    // 延迟关闭对话框，让用户看到重试状态
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    retryTimeoutRef.current = setTimeout(() => {
      setState(prev => ({ ...prev, status: 'idle', isProcessing: false }));
      onClose();
      onSuccess?.();
    }, 1000);
  }, [onRetry, onClose, onSuccess]);

  // 执行容器清理
  const handleCleanup = useCallback(async () => {
    setState(prev => ({ ...prev, status: 'cleaning', isProcessing: true, error: null }));

    try {
      const cleanupResult = await cleanupContainers();
      
      setState(prev => ({
        ...prev,
        status: cleanupResult?.success ? 'success' : 'error',
        cleanupResult,
        isProcessing: false,
        error: cleanupResult?.success ? null : '容器清理失败'
      }));

      // 如果清理成功，延迟后自动重试启动
      if (cleanupResult?.success) {
        if (cleanupTimeoutRef.current) clearTimeout(cleanupTimeoutRef.current);
        cleanupTimeoutRef.current = setTimeout(() => {
          handleRetryStart();
        }, 1500);
      }

      return cleanupResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '容器清理失败';
      setState(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage,
        isProcessing: false
      }));
      return null;
    }
  }, [cleanupContainers, handleRetryStart]);

  // 组件显示时自动检查端口冲突
  useEffect(() => {
    if (isVisible && state.status === 'idle' && !state.conflictInfo) {
      handleCheckConflict();
    }
  }, [isVisible, state.status, state.conflictInfo, handleCheckConflict]);

  // 获取状态显示信息
  const getStatusInfo = (status: ConflictHandlingStatus) => {
    switch (status) {
      case 'checking':
        return { icon: RefreshCw, text: '正在检查端口冲突...', color: 'text-[var(--color-accent-primary)]' };
      case 'cleaning':
        return { icon: Trash2, text: '正在清理容器...', color: 'text-[var(--color-warning)]' };
      case 'retrying':
        return { icon: RefreshCw, text: '正在重试启动...', color: 'text-[var(--color-success)]' };
      case 'success':
        return { icon: CheckCircle, text: '处理成功！', color: 'text-[var(--color-success)]' };
      case 'error':
        return { icon: AlertTriangle, text: '处理失败', color: 'text-[var(--color-error)]' };
      default:
        return { icon: Server, text: '端口冲突处理', color: 'text-[var(--color-text-secondary)]' };
    }
  };

  // 如果组件不可见，不渲染
  if (!isVisible) {
    return null;
  }
  if (typeof document === 'undefined') {
    return null;
  }

  const statusInfo = getStatusInfo(state.status);
  const StatusIcon = statusInfo.icon;

  return createPortal(
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="presentation"
    >
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="port-conflict-title"
        className="bg-[var(--color-bg-primary)] rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto"
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <StatusIcon 
              className={`w-6 h-6 ${statusInfo.color} ${state.isProcessing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <h3 id="port-conflict-title" className="text-lg font-semibold text-[var(--color-text-primary)]">
              端口冲突处理
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
            disabled={state.isProcessing}
            aria-label="关闭"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-6">
          {/* 状态显示 */}
          <div className="mb-4">
            <p className={`text-sm font-medium ${statusInfo.color}`}>
              {statusInfo.text}
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
              课程: {courseId} | 端口: {port}
            </p>
          </div>

          {/* 错误信息 */}
          {state.error && (
            <div className="mb-4 p-3 bg-[var(--color-error-subtle)] border border-[var(--color-error)] rounded-lg">
              <p className="text-sm text-[var(--color-error)]">{state.error}</p>
            </div>
          )}

          {/* 端口冲突信息 */}
          {state.conflictInfo && (
            <div className="mb-4">
              {state.conflictInfo.isConflicted ? (
                <div className="p-4 bg-[var(--color-warning-subtle)] border border-[var(--color-warning)] rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-[var(--color-warning)]" />
                    <span className="text-sm font-medium text-[var(--color-warning)]">
                      检测到端口冲突
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                    端口 {state.conflictInfo.port} 被以下容器占用：
                  </p>
                  <div className="space-y-2">
                    {state.conflictInfo.conflictContainers.map((container, index) => (
                      <div key={index} className="bg-[var(--color-bg-primary)] p-2 rounded border border-[var(--color-border-light)]">
                        <p className="text-xs font-medium text-[var(--color-text-primary)]">
                          {container.name}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          ID: {container.id.substring(0, 12)}... | 状态: {container.state}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-[var(--color-success-subtle)] border border-[var(--color-success)] rounded-lg">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
                    <span className="text-sm font-medium text-[var(--color-success)]">
                      端口 {state.conflictInfo.port} 可用
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 清理结果 */}
          {state.cleanupResult && (
            <div className="mb-4">
              <div className={`p-4 rounded-lg border ${
                state.cleanupResult.success 
                  ? 'bg-[var(--color-success-subtle)] border-[var(--color-success)]' 
                  : 'bg-[var(--color-error-subtle)] border-[var(--color-error)]'
              }`}>
                <div className="flex items-center space-x-2 mb-2">
                  {state.cleanupResult.success ? (
                    <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-[var(--color-error)]" />
                  )}
                  <span className={`text-sm font-medium ${
                    state.cleanupResult.success ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'
                  }`}>
                    {state.cleanupResult.success ? '清理成功' : '清理失败'}
                  </span>
                </div>
                <p className={`text-sm ${
                  state.cleanupResult.success ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'
                }`}>
                  共清理了 {state.cleanupResult.totalCleaned} 个容器
                </p>
                {state.cleanupResult.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-[var(--color-error)] font-medium">错误信息：</p>
                    {state.cleanupResult.errors.map((error, index) => (
                      <p key={index} className="text-xs text-[var(--color-error)]">• {error}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end space-x-3 p-6 border-t border-[var(--color-border-light)] bg-[var(--color-bg-secondary)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
            disabled={state.isProcessing}
          >
            取消
          </button>

          {/* 根据状态显示不同的操作按钮 */}
          {state.conflictInfo?.isConflicted && state.status !== 'cleaning' && state.status !== 'success' && (
            <button
              type="button"
              onClick={handleCleanup}
              disabled={state.isProcessing}
              className="px-4 py-2 text-sm font-medium text-[var(--color-warning-on-accent)] bg-[var(--color-warning)] rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              <span>智能清理</span>
            </button>
          )}

          {(state.status === 'success' || (!state.conflictInfo?.isConflicted && state.conflictInfo)) && (
            <button
              type="button"
              onClick={handleRetryStart}
              disabled={state.isProcessing}
              className="px-4 py-2 text-sm font-medium text-[var(--color-success-on-accent)] bg-[var(--color-success)] rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              <span>重试启动</span>
            </button>
          )}

          {state.status === 'error' && (
            <button
              type="button"
              onClick={handleCheckConflict}
              disabled={state.isProcessing}
              className="px-4 py-2 text-sm font-medium text-[var(--color-on-accent)] bg-[var(--color-accent-primary)] rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              <span>重新检查</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PortConflictHandler;
