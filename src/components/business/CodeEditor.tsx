import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { EditorView, placeholder as cmPlaceholder, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, highlightActiveLine } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { python } from '@codemirror/lang-python'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, indentOnInput } from '@codemirror/language'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'

export interface CodeEditorRef {
  getValue: () => string
}

export interface CodeEditorProps {
  value: string
  onChange?: (v: string) => void
  placeholder?: string
  readOnly?: boolean
  className?: string
  onFocus?: () => void
  onBlur?: () => void
  language?: string
}

const CodeEditor = forwardRef<CodeEditorRef, CodeEditorProps>(({
  value,
  onChange,
  placeholder,
  readOnly = false,
  className,
  onFocus,
  onBlur,
  language = 'python',
}, ref) => {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const readOnlyCompartment = useRef(new Compartment())
  const languageExtension = language === 'python' ? python() : python()

  useImperativeHandle(ref, () => ({
    getValue: () => viewRef.current?.state.doc.toString() || ''
  }), [])

  // Python 风格浅色主题
  const pythonTheme = EditorView.theme({
    '&': {
      backgroundColor: 'transparent',
      color: 'var(--color-text-primary)',
      height: '100%',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
    },


    '&.cm-focused': {
      outline: 'none !important',
      border: 'none !important',
    },

    '.cm-editor': {
      outline: 'none !important',
      border: 'none !important',
    },

    '.cm-content': {
      fontFamily: 'var(--font-mono)',
      fontSize: '14px',
      lineHeight: '1.6',
      color: 'var(--color-text-primary)',
      padding: '12px',
      caretColor: 'var(--color-accent-primary)',
      outline: 'none !important',
      border: 'none !important',
    },

    '.cm-line': {
      padding: '2px 0',
    },

    '.cm-scroller': {
      overflow: 'auto',
      scrollbarWidth: 'thin',
      scrollbarColor: 'var(--color-border-default) transparent',
    },


    '.cm-scroller::-webkit-scrollbar': {
      width: '6px',
      height: '6px',
    },
    '.cm-scroller::-webkit-scrollbar-track': {
      background: 'transparent',
    },
    '.cm-scroller::-webkit-scrollbar-thumb': {
      background: 'var(--color-border-default)',
      borderRadius: '3px',
    },
    '.cm-scroller::-webkit-scrollbar-thumb:hover': {
      background: 'var(--color-border-dark)',
    },

    '.cm-gutters': {
      backgroundColor: 'var(--color-bg-secondary)',
      border: 'none',
      color: 'var(--color-text-tertiary)',
      borderRadius: 'var(--radius-md) 0 0 var(--radius-md)',
      paddingRight: '8px',
    },

    '.cm-lineNumbers .cm-gutterElement': {
      paddingLeft: '8px',
      paddingRight: '8px',
      minWidth: '40px',
    },

    '.cm-foldGutter .cm-gutterElement': {
      padding: '0 4px',
      cursor: 'pointer',
    },

    '.cm-activeLineGutter': {
      backgroundColor: 'var(--color-bg-tertiary)',
    },

    '.cm-activeLine': {
      backgroundColor: 'var(--color-bg-secondary)',
    },

    '.cm-selectionBackground': {
      backgroundColor: 'var(--color-accent-subtle)',
      borderRadius: '2px',
    },

    '.cm-cursor': {
      borderLeftColor: 'var(--color-accent-primary)',
      borderLeftWidth: '2px',
    },

    '.cm-placeholder': {
      color: 'var(--color-text-tertiary)',
      fontStyle: 'italic',
    },

    // Python 语法高亮
    '.cm-keyword': {
      color: '#7c3aed',
      fontWeight: '600',
    },
    '.cm-string': {
      color: '#059669',
    },
    '.cm-number': {
      color: '#d97706',
      fontWeight: '500',
    },
    '.cm-comment': {
      color: 'var(--color-text-tertiary)',
      fontStyle: 'italic',
    },
    '.cm-operator': {
      color: '#dc2626',
    },
    '.cm-punctuation': {
      color: 'var(--color-text-secondary)',
    },
    '.cm-variableName': {
      color: 'var(--color-accent-primary)',
    },
    '.cm-definition': {
      color: '#0891b2',
    },
    '.cm-typeName': {
      color: '#db2777',
    },
    '.cm-propertyName': {
      color: '#7c3aed',
    },
    '.cm-function': {
      color: '#2563eb',
    },
    '.cm-call': {
      color: '#2563eb',
    },
    '.cm-atom': {
      color: '#db2777',
    },
    '.cm-bool': {
      color: '#db2777',
    },
    '.cm-builtin': {
      color: '#7c3aed',
    },
    '.cm-meta': {
      color: 'var(--color-text-tertiary)',
    },
    '.cm-tag': {
      color: '#dc2626',
    },
    '.cm-attribute': {
      color: '#059669',
    },

    // 代码折叠
    '.cm-foldPlaceholder': {
      backgroundColor: 'var(--color-bg-tertiary)',
      border: '1px solid var(--color-border-default)',
      borderRadius: '4px',
      padding: '0 4px',
      color: 'var(--color-text-tertiary)',
      fontSize: '12px',
    },
  })

  useEffect(() => {
    if (!hostRef.current || viewRef.current) return

    const extensions = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter({
        openText: '▼',
        closedText: '▶',
      }),
      drawSelection(),
      indentOnInput(),
      bracketMatching(),
      highlightActiveLine(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      languageExtension,
      pythonTheme,
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
      ]),
      cmPlaceholder(placeholder || ''),
      readOnlyCompartment.current.of(EditorView.editable.of(!readOnly)),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const doc = update.state.doc.toString()
          if (doc !== value && onChange) {
            onChange(doc)
          }
        }
        if (update.focusChanged) {
          const view = update.view
          if (view.hasFocus) {
            onFocus?.()
          } else {
            onBlur?.()
          }
        }
      }),
    ]

    viewRef.current = new EditorView({
      state: EditorState.create({ doc: value, extensions }),
      parent: hostRef.current,
    })

    return () => {
      viewRef.current?.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current === value) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    })
  }, [value])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: readOnlyCompartment.current.reconfigure(EditorView.editable.of(!readOnly)),
    })
  }, [readOnly])

  return (
    <div
      ref={hostRef}
      className={`
        relative w-full 
        bg-[var(--color-bg-primary)]
        rounded-md
        border border-[var(--color-border-default)]
        transition-all duration-200
        focus-within:border-[var(--color-accent-primary)]
        focus-within:ring-1
        focus-within:ring-[var(--color-accent-subtle)]
        ${readOnly ? 'opacity-80' : 'cursor-text'}
        ${className || ''}
      `}
      style={{
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
      }}
    />
  )
})

export default CodeEditor
