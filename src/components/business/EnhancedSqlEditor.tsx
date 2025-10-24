import React, { useState, useRef } from 'react'
import SqlCodeEditor from './SqlCodeEditor'
import SqlHighlighter from './SqlHighlighter'

interface EnhancedSqlEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  showPreview?: boolean
}

/**
 * 增强版 SQL 编辑器
 * 结合了 CodeMirror 的编辑功能和 react-syntax-highlighter 的语法高亮
 * 提供更好的暗色主题支持和视觉效果
 */
export default function EnhancedSqlEditor({
  value,
  onChange,
  placeholder = "输入 SQL，按下方按钮执行",
  disabled = false,
  className = "",
  showPreview = true
}: EnhancedSqlEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)

  // 当值为空或正在编辑时显示编辑器，否则显示高亮预览
  const shouldShowEditor = isEditing || isFocused || !value.trim() || !showPreview

  const handleFocus = () => {
    setIsFocused(true)
    setIsEditing(true)
  }

  const handleBlur = () => {
    setIsFocused(false)
    // 延迟隐藏编辑器，给用户时间看到变化
    setTimeout(() => {
      if (!isFocused) {
        setIsEditing(false)
      }
    }, 150)
  }

  const handleClick = () => {
    if (!shouldShowEditor) {
      setIsEditing(true)
    }
  }

  return (
    <div className={`enhanced-sql-editor relative ${className}`}>
      {/* 编辑器容器 */}
      <div 
        className={`transition-all duration-200 ${
          shouldShowEditor ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'
        }`}
        ref={editorRef}
      >
        <div className="rounded-lg border border-gray-600/50 bg-gray-800/80 overflow-hidden focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20">
          <SqlCodeEditor
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full min-h-[120px] bg-transparent"
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        </div>
      </div>

      {/* 语法高亮预览 */}
      {!shouldShowEditor && value.trim() && (
        <div 
          className="cursor-text rounded-lg border border-gray-600/50 bg-gray-800/80 hover:border-gray-500/50 transition-colors"
          onClick={handleClick}
        >
          <div className="min-h-[120px] relative">
            <SqlHighlighter 
              code={value}
              className="w-full"
            />
            {/* 编辑提示覆盖层 */}
            <div className="absolute inset-0 bg-gray-900/0 hover:bg-gray-900/10 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
              <div className="bg-gray-800/90 text-gray-300 px-3 py-1.5 rounded-md text-sm border border-gray-600/50">
                点击编辑 SQL
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 状态指示器 */}
      {!shouldShowEditor && value.trim() && (
        <div className="absolute top-2 right-2 flex items-center gap-2">
          <div className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded text-xs border border-blue-500/30">
            SQL 预览
          </div>
        </div>
      )}
    </div>
  )
}

// 扩展 SqlCodeEditor 的 props 以支持 focus/blur 事件
declare module './SqlCodeEditor' {
  interface SqlCodeEditorProps {
    onFocus?: () => void
    onBlur?: () => void
  }
}