import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { EditorView, placeholder as cmPlaceholder, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, highlightActiveLine } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { python } from '@codemirror/lang-python'
import { java } from '@codemirror/lang-java'
import { HighlightStyle, syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, indentOnInput } from '@codemirror/language'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { tags } from '@lezer/highlight'



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
  isDark?: boolean
}

const getLanguageExtension = (lang: string) => {
  switch (lang) {
    case 'java': return java()
    default: return python()
  }
}

const darkHighlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier, tags.controlKeyword, tags.operatorKeyword], color: '#c084fc', fontWeight: '600' },
  { tag: [tags.string, tags.special(tags.string)], color: '#86efac' },
  { tag: [tags.number, tags.integer, tags.float], color: '#fdba74' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: '#94a3b8', fontStyle: 'italic' },
  { tag: [tags.variableName, tags.self], color: '#93c5fd' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: '#7dd3fc' },
  { tag: [tags.definition(tags.variableName), tags.definition(tags.propertyName)], color: '#67e8f9' },
  { tag: [tags.className, tags.typeName], color: '#f9a8d4' },
  { tag: [tags.propertyName, tags.attributeName], color: '#f0abfc' },
  { tag: [tags.bool, tags.null, tags.atom], color: '#fda4af' },
  { tag: [tags.operator, tags.compareOperator, tags.logicOperator, tags.arithmeticOperator], color: '#fda4af' },
  { tag: [tags.punctuation, tags.separator, tags.bracket], color: '#cbd5e1' },
  { tag: [tags.meta, tags.annotation], color: '#94a3b8' },
])

const lightHighlightExtension = syntaxHighlighting(defaultHighlightStyle, { fallback: true })
const darkHighlightExtension = syntaxHighlighting(darkHighlightStyle)

const editorLightTheme = EditorView.theme({
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

  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--color-bg-tertiary)',
    border: '1px solid var(--color-border-default)',
    borderRadius: '4px',
    padding: '0 4px',
    color: 'var(--color-text-tertiary)',
    fontSize: '12px',
  },
})

const editorDarkTheme = EditorView.theme({
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
    scrollbarColor: 'rgba(148, 163, 184, 0.45) transparent',
  },

  '.cm-scroller::-webkit-scrollbar': {
    width: '6px',
    height: '6px',
  },
  '.cm-scroller::-webkit-scrollbar-track': {
    background: 'transparent',
  },
  '.cm-scroller::-webkit-scrollbar-thumb': {
    background: 'rgba(148, 163, 184, 0.45)',
    borderRadius: '3px',
  },
  '.cm-scroller::-webkit-scrollbar-thumb:hover': {
    background: 'rgba(148, 163, 184, 0.6)',
  },

  '.cm-gutters': {
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    border: 'none',
    color: 'rgba(148, 163, 184, 0.9)',
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
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
  },

  '.cm-activeLine': {
    backgroundColor: 'rgba(30, 41, 59, 0.55)',
  },

  '.cm-selectionBackground': {
    backgroundColor: 'rgba(59, 130, 246, 0.22)',
    borderRadius: '2px',
  },

  '.cm-cursor': {
    borderLeftColor: 'var(--color-accent-primary)',
    borderLeftWidth: '2px',
  },

  '.cm-placeholder': {
    color: 'rgba(148, 163, 184, 0.75)',
    fontStyle: 'italic',
  },

  '.cm-foldPlaceholder': {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    border: '1px solid rgba(148, 163, 184, 0.28)',
    borderRadius: '4px',
    padding: '0 4px',
    color: 'rgba(226, 232, 240, 0.88)',
    fontSize: '12px',
  },
}, { dark: true })

const CodeEditor = forwardRef<CodeEditorRef, CodeEditorProps>(({
  value,
  onChange,
  placeholder,
  readOnly = false,
  className,
  onFocus,
  onBlur,
  language = 'python',
  isDark = false,
}, ref) => {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const readOnlyCompartment = useRef(new Compartment())
  const languageCompartment = useRef(new Compartment())
  const themeCompartment = useRef(new Compartment())
  const highlightCompartment = useRef(new Compartment())

  useImperativeHandle(ref, () => ({
    getValue: () => viewRef.current?.state.doc.toString() || ''
  }), [])

  const themeExtension = isDark ? editorDarkTheme : editorLightTheme
  const highlightExtension = isDark ? darkHighlightExtension : lightHighlightExtension

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
      languageCompartment.current.of(getLanguageExtension(language)),
      themeCompartment.current.of(themeExtension),
      highlightCompartment.current.of(highlightExtension),
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

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: languageCompartment.current.reconfigure(getLanguageExtension(language)),
    })
  }, [language])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: themeCompartment.current.reconfigure(themeExtension),
    })
  }, [themeExtension])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: highlightCompartment.current.reconfigure(highlightExtension),
    })
  }, [highlightExtension])

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
