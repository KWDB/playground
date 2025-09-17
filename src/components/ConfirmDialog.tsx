import React from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  variant?: 'warning' | 'danger' | 'info'
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
  if (!isOpen) return null

  // 根据变体类型设置不同的颜色主题
  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          iconColor: 'text-red-500',
          confirmButton: 'bg-red-500 hover:bg-red-600 focus:ring-red-500',
          titleColor: 'text-red-600'
        }
      case 'info':
        return {
          iconColor: 'text-blue-500',
          confirmButton: 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500',
          titleColor: 'text-blue-600'
        }
      default: // warning
        return {
          iconColor: 'text-amber-500',
          confirmButton: 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-500',
          titleColor: 'text-amber-600'
        }
    }
  }

  const styles = getVariantStyles()

  return (
    <>
      {/* CSS动画定义 */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
      
      {/* 背景遮罩层 */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-200"
        onClick={onCancel}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      >
        {/* 对话框容器 */}
        <div 
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-auto transform transition-all duration-300"
          onClick={(e) => e.stopPropagation()}
          style={{ animation: 'slideInUp 0.3s ease-out' }}
        >
          {/* 对话框头部 */}
          <div className="relative p-6 pb-4">
            {/* 关闭按钮 */}
            <button
              onClick={onCancel}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
            
            {/* 图标和标题 */}
            <div className="flex items-center space-x-3">
              <div className={`p-3 rounded-full bg-gray-50 ${styles.iconColor}`}>
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className={`text-lg font-semibold ${styles.titleColor}`}>
                {title}
              </h3>
            </div>
          </div>

          {/* 对话框内容 */}
          <div className="px-6 pb-6">
            <p className="text-gray-600 leading-relaxed text-sm">
              {message}
            </p>
          </div>

          {/* 对话框底部按钮 */}
          <div className="px-6 pb-6 flex space-x-3 justify-end">
            {/* 取消按钮 */}
            <button
              onClick={onCancel}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
            >
              {cancelText}
            </button>
            
            {/* 确认按钮 */}
            <button
              onClick={onConfirm}
              className={`px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${styles.confirmButton}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default ConfirmDialog