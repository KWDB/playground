// 端口冲突相关的 TypeScript 类型定义

// 容器信息接口
export interface ContainerInfo {
  id: string;          // 容器ID
  name: string;        // 容器名称
  courseId: string;    // 课程ID
  port: string;        // 端口号
  state: string;       // 容器状态
}

// 端口冲突检查结果接口
export interface PortConflictInfo {
  courseId: string;              // 课程ID
  port: string;                  // 检查的端口号
  isConflicted: boolean;         // 是否存在端口冲突
  conflictContainers: ContainerInfo[]; // 冲突的容器列表
}

// 容器清理结果接口
export interface CleanupResult {
  courseId: string;              // 课程ID
  success: boolean;              // 清理是否成功
  totalCleaned: number;          // 清理的容器总数
  cleanedContainers: ContainerInfo[]; // 已清理的容器列表
  errors: string[];              // 清理过程中的错误信息
}

// API 响应接口
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// 端口冲突检查 API 响应
export type PortConflictCheckResponse = ApiResponse<PortConflictInfo>;

// 容器清理 API 响应
export type ContainerCleanupResponse = ApiResponse<CleanupResult>;

// 端口冲突处理状态
export type ConflictHandlingStatus = 
  | 'idle'           // 空闲状态
  | 'checking'       // 正在检查端口冲突
  | 'cleaning'       // 正在清理容器
  | 'retrying'       // 正在重试启动
  | 'success'        // 处理成功
  | 'error';         // 处理失败

// 端口冲突处理组件的属性接口
export interface PortConflictHandlerProps {
  courseId: string;              // 课程ID
  port: number;                  // 端口号
  isVisible: boolean;            // 是否显示组件
  onClose: () => void;           // 关闭回调
  onRetry: () => void;           // 重试回调
  onSuccess?: () => void;        // 成功回调
}

// 端口冲突处理组件的状态接口
export interface PortConflictHandlerState {
  status: ConflictHandlingStatus;
  conflictInfo: PortConflictInfo | null;
  cleanupResult: CleanupResult | null;
  error: string | null;
  isProcessing: boolean;
}