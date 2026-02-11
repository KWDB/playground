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
  onEnterExecute?: (text: string) => void
}

export default function EnhancedSqlEditor({
  value,
  onChange,
  placeholder = "输入 SQL",
  disabled = false,
  className = "",
  showPreview = true,
  onEnterExecute,
}: EnhancedSqlEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)

  const shouldShowEditor = isEditing || isFocused || !value.trim() || !showPreview

  const handleFocus = () => {
    setIsFocused(true)
    setIsEditing(true)
  }

  const handleBlur = () => {
    setIsFocused(false)
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
      <div
        className={`transition-all duration-150 ${
          shouldShowEditor ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'
        }`}
        ref={editorRef}
      >
        <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] overflow-hidden focus-within:border-[var(--color-accent-primary)] focus-within:ring-1 focus-within:ring-[var(--color-accent-subtle)]">
          <SqlCodeEditor
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full min-h-[100px] bg-transparent"
            onFocus={handleFocus}
            onBlur={handleBlur}
            onEnterExecute={onEnterExecute}
          />
        </div>
      </div>

      {!shouldShowEditor && value.trim() && (
        <div
          className="cursor-text rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] overflow-hidden hover:border-[var(--color-border-default)] transition-colors"
          onClick={handleClick}
        >
          <div className="min-h-[100px] max-h-[200px] overflow-auto relative p-3">
            <SqlHighlighter
              code={value}
              className="w-full"
            />
            <div className="absolute inset-0 bg-transparent hover:bg-[var(--color-bg-tertiary)]/50 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
              <div className="bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] px-3 py-1.5 rounded-md text-xs border border-[var(--color-border-default)]">
                点击编辑
              </div>
            </div>
          </div>
        </div>
      )}

      {!shouldShowEditor && value.trim() && (
        <div className="absolute top-2 right-2">
          <span className="px-2 py-1 rounded text-xs font-medium bg-[var(--color-accent-subtle)] text-[var(--color-accent-primary)] border border-[var(--color-accent-primary)/20]">
            SQL
          </span>
        </div>
      )}
    </div>
  )
}

declare module './SqlCodeEditor' {
  interface SqlCodeEditorProps {
    onFocus?: () => void
    onBlur?: () => void
    onEnterExecute?: (text: string) => void
  }
}
