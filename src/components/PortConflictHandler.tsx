import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Trash2, RefreshCw, X, CheckCircle, Server } from 'lucide-react';
import {
  PortConflictInfo,
  CleanupResult,
  PortConflictHandlerProps,
  PortConflictHandlerState,
  ConflictHandlingStatus
} from '../types/port-conflict';

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
  // 组件状态管理
  const [state, setState] = useState<PortConflictHandlerState>({
    status: 'idle',
    conflictInfo: null,
    cleanupResult: null,
    error: null,
    isProcessing: false
  });

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
  const cleanupContainers = useCallback(async (): Promise<CleanupResult | null> => {
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
    setTimeout(() => {
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

      // 如果清理成功，延迟后自动重试启动（内联重试逻辑，避免依赖 handleRetryStart）
      if (cleanupResult?.success) {
        setTimeout(() => {
          setState(prev => ({ ...prev, status: 'retrying', isProcessing: true }));
          onRetry();
          setTimeout(() => {
            setState(prev => ({ ...prev, status: 'idle', isProcessing: false }));
            onClose();
            onSuccess?.();
          }, 1000);
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
  }, [cleanupContainers, onRetry, onClose, onSuccess]);

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
        return { icon: RefreshCw, text: '正在检查端口冲突...', color: 'text-blue-600' };
      case 'cleaning':
        return { icon: Trash2, text: '正在清理容器...', color: 'text-orange-600' };
      case 'retrying':
        return { icon: RefreshCw, text: '正在重试启动...', color: 'text-green-600' };
      case 'success':
        return { icon: CheckCircle, text: '处理成功！', color: 'text-green-600' };
      case 'error':
        return { icon: AlertTriangle, text: '处理失败', color: 'text-red-600' };
      default:
        return { icon: Server, text: '端口冲突处理', color: 'text-gray-600' };
    }
  };

  // 如果组件不可见，不渲染
  if (!isVisible) {
    return null;
  }

  const statusInfo = getStatusInfo(state.status);
  const StatusIcon = statusInfo.icon;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <StatusIcon 
              className={`w-6 h-6 ${statusInfo.color} ${state.isProcessing ? 'animate-spin' : ''}`} 
            />
            <h3 className="text-lg font-semibold text-gray-900">
              端口冲突处理
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={state.isProcessing}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-6">
          {/* 状态显示 */}
          <div className="mb-4">
            <p className={`text-sm font-medium ${statusInfo.color}`}>
              {statusInfo.text}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              课程: {courseId} | 端口: {port}
            </p>
          </div>

          {/* 错误信息 */}
          {state.error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{state.error}</p>
            </div>
          )}

          {/* 端口冲突信息 */}
          {state.conflictInfo && (
            <div className="mb-4">
              {state.conflictInfo.isConflicted ? (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                    <span className="text-sm font-medium text-orange-800">
                      检测到端口冲突
                    </span>
                  </div>
                  <p className="text-sm text-orange-700 mb-3">
                    端口 {state.conflictInfo.port} 被以下容器占用：
                  </p>
                  <div className="space-y-2">
                    {state.conflictInfo.conflictContainers.map((container, index) => (
                      <div key={index} className="bg-white p-2 rounded border">
                        <p className="text-xs font-medium text-gray-900">
                          {container.name}
                        </p>
                        <p className="text-xs text-gray-600">
                          ID: {container.id.substring(0, 12)}... | 状态: {container.state}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">
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
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center space-x-2 mb-2">
                  {state.cleanupResult.success ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                  )}
                  <span className={`text-sm font-medium ${
                    state.cleanupResult.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {state.cleanupResult.success ? '清理成功' : '清理失败'}
                  </span>
                </div>
                <p className={`text-sm ${
                  state.cleanupResult.success ? 'text-green-700' : 'text-red-700'
                }`}>
                  共清理了 {state.cleanupResult.totalCleaned} 个容器
                </p>
                {state.cleanupResult.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-red-600 font-medium">错误信息：</p>
                    {state.cleanupResult.errors.map((error, index) => (
                      <p key={index} className="text-xs text-red-600">• {error}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={state.isProcessing}
          >
            取消
          </button>

          {/* 根据状态显示不同的操作按钮 */}
          {state.conflictInfo?.isConflicted && state.status !== 'cleaning' && state.status !== 'success' && (
            <button
              onClick={handleCleanup}
              disabled={state.isProcessing}
              className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>智能清理</span>
            </button>
          )}

          {(state.status === 'success' || (!state.conflictInfo?.isConflicted && state.conflictInfo)) && (
            <button
              onClick={handleRetryStart}
              disabled={state.isProcessing}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>重试启动</span>
            </button>
          )}

          {state.status === 'error' && (
            <button
              onClick={handleCheckConflict}
              disabled={state.isProcessing}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>重新检查</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PortConflictHandler;