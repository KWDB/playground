import React, { useEffect, useRef } from 'react'
import { EditorView, placeholder as cmPlaceholder, showTooltip, tooltips, keymap } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { sql } from '@codemirror/lang-sql'
import { autocompletion, CompletionContext, Completion } from '@codemirror/autocomplete'
import { syntaxTree } from '@codemirror/language'
import { lintGutter } from '@codemirror/lint'

export default function SqlCodeEditor({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  onFocus,
  onBlur,
  onEnterExecute,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  onFocus?: () => void
  onBlur?: () => void
  onEnterExecute?: (text: string) => void
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const editableCompartment = useRef(new Compartment())
  const signatureCompartment = useRef(new Compartment())

  // Linear 风格浅色主题
  const linearLightTheme = EditorView.theme({
    '&': { 
      backgroundColor: 'var(--cm-bg)', 
      color: 'var(--cm-foreground)', 
      height: 'auto',
      borderRadius: '6px',
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
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
      fontSize: '14px',
      lineHeight: '1.6',
      color: 'var(--cm-foreground)',
      padding: '12px',
      caretColor: 'var(--cm-accent)',
      outline: 'none !important',
      border: 'none !important',
    },

    '.cm-line': { 
      padding: '2px 0',
    },

    '.cm-scroller': { 
      overflow: 'auto', 
      maxHeight: '12rem', 
      minHeight: '6rem',
      scrollbarWidth: 'thin',
      scrollbarColor: 'var(--cm-scrollbar) transparent',
    },

    '.cm-scroller::-webkit-scrollbar': {
      width: '6px',
      height: '6px',
    },
    '.cm-scroller::-webkit-scrollbar-track': {
      background: 'transparent',
    },
    '.cm-scroller::-webkit-scrollbar-thumb': {
      background: 'var(--cm-scrollbar)',
      borderRadius: '3px',
    },
    '.cm-scroller::-webkit-scrollbar-thumb:hover': {
      background: 'var(--cm-scrollbar-hover)',
    },

    '.cm-gutters': {
      backgroundColor: 'var(--cm-gutter-bg)',
      border: 'none',
      color: 'var(--cm-gutter-text)',
      borderRadius: '6px 0 0 6px',
      paddingRight: '8px',
    },

    '.cm-selectionBackground': { 
      backgroundColor: 'var(--cm-selection)',
      borderRadius: '2px',
    },

    '.cm-cursor': { 
      borderLeftColor: 'var(--cm-accent)',
      borderLeftWidth: '2px',
    },

    '.cm-placeholder': { 
      color: 'var(--cm-placeholder)',
      fontStyle: 'italic',
    },

    // 语法高亮 - 使用更柔和的颜色
    '.cm-keyword': { 
      color: 'var(--cm-keyword)', 
      fontWeight: '600',
    },
    '.cm-string': { 
      color: 'var(--cm-string)',
    },
    '.cm-number': { 
      color: 'var(--cm-number)',
      fontWeight: '500',
    },
    '.cm-comment': { 
      color: 'var(--cm-comment)',
      fontStyle: 'italic',
    },
    '.cm-operator': { 
      color: 'var(--cm-operator)',
    },
    '.cm-punctuation': { 
      color: 'var(--cm-punctuation)',
    },
    '.cm-variableName': { 
      color: 'var(--cm-variable)',
    },

    // 工具提示
    '.cm-tooltip': {
      backgroundColor: 'var(--cm-tooltip-bg)',
      border: '1px solid var(--cm-tooltip-border)',
      borderRadius: '6px',
      boxShadow: 'var(--cm-tooltip-shadow)',
      zIndex: '9999',
    },

    '.cm-tooltip-autocomplete': { 
      overflow: 'hidden',
      zIndex: '2147483647',
    },

    '.cm-tooltip-signature': {
      backgroundColor: 'var(--cm-tooltip-bg)',
      color: 'var(--cm-foreground)',
      border: '1px solid var(--cm-tooltip-border)',
      borderRadius: '6px',
      padding: '6px 10px',
      fontSize: '13px',
      boxShadow: 'var(--cm-tooltip-shadow)',
    },

    // 补全列表
    '.cm-tooltip-autocomplete .cm-completionList': {
      padding: '4px',
      margin: 0,
      maxHeight: '280px',
      overflow: 'auto',
    },

    '.cm-completionItem': {
      padding: '6px 10px',
      borderRadius: '4px',
      margin: '2px 0',
      color: 'var(--cm-foreground)',
      cursor: 'pointer',
    },

    '.cm-completionItem:hover': {
      backgroundColor: 'var(--cm-list-hover-bg)',
    },

    '.cm-completionSelected': {
      backgroundColor: 'var(--cm-list-selected-bg)',
    },

    '.cm-completionLabel': {
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
    },

    '.cm-completionDetail': { 
      color: 'var(--cm-muted)',
      fontSize: '12px',
      marginLeft: '8px',
    },

    '.cm-completionMatchedText': { 
      color: 'var(--cm-accent)', 
      fontWeight: '600',
    },

    '.cm-completionIcon': { 
      width: '14px', 
      height: '14px', 
      marginRight: '8px', 
      borderRadius: '2px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '9px',
      fontWeight: 'bold',
    },

    '.cm-completionIcon-keyword': { 
      color: '#ffffff',
      backgroundColor: '#7c3aed',
    },
    '.cm-completionIcon-function': { 
      color: '#ffffff',
      backgroundColor: 'var(--cm-accent)',
    },
    '.cm-completionIcon-variable': { 
      color: '#ffffff',
      backgroundColor: '#ea580c',
    },
    '.cm-completionIcon-property': { 
      color: '#ffffff',
      backgroundColor: '#0891b2',
    },
  })

  useEffect(() => {
    if (!hostRef.current || viewRef.current) return

    const extensions = [
      sql(),
      EditorView.lineWrapping,
      keymap.of([{
        key: 'Enter',
        run: (view) => {
          if (!view.hasFocus || disabled) return false
          if (!onEnterExecute) return false
          const docText = view.state.doc.toString()
          if (!docText.trim()) return false
          const sel = view.state.selection.main
          if (!sel.empty) return false
          const pos = sel.head
          const line = view.state.doc.lineAt(pos)
          const isLastLine = line.number === view.state.doc.lines
          const isAtLineEnd = pos === line.to
          if (isLastLine && isAtLineEnd) {
            onEnterExecute(docText)
            return true
          }
          return false
        },
      }]),
      autocompletion({ 
        override: [sqlCompletionSource],
        tooltipClass: () => 'cm-tooltip-autocomplete-top-level',
      }), 
      tooltips({
        parent: document.body,
        position: 'fixed',
      }), 
      signatureCompartment.current.of(showTooltip.of(null)),
      lintGutter(),
      linearLightTheme,
      cmPlaceholder(placeholder || ''),
      editableCompartment.current.of(EditorView.editable.of(!disabled)),
      EditorView.updateListener.of((update) => {
        const view = update.view
        if (update.docChanged) {
          const doc = update.state.doc.toString()
          if (doc !== value) onChange(doc)
        }
        if (update.docChanged || update.selectionSet) {
          const tip = createSignatureTooltip(update.state)
          view.dispatch({ effects: signatureCompartment.current.reconfigure(showTooltip.of(tip)) })
        }
        if (update.focusChanged) {
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
      effects: editableCompartment.current.reconfigure(EditorView.editable.of(!disabled)),
    })
  }, [disabled])

  // 设置 Linear 浅色主题 CSS 变量
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    
    host.style.setProperty('--cm-bg', '#ffffff')
    host.style.setProperty('--cm-foreground', '#1a1a1a')
    host.style.setProperty('--cm-muted', '#737373')
    host.style.setProperty('--cm-accent', '#2563eb')
    host.style.setProperty('--cm-keyword', '#7c3aed')
    host.style.setProperty('--cm-string', '#059669')
    host.style.setProperty('--cm-number', '#d97706')
    host.style.setProperty('--cm-comment', '#737373')
    host.style.setProperty('--cm-operator', '#dc2626')
    host.style.setProperty('--cm-punctuation', '#525252')
    host.style.setProperty('--cm-variable', '#2563eb')
    host.style.setProperty('--cm-placeholder', '#a3a3a3')
    host.style.setProperty('--cm-selection', 'rgba(37, 99, 235, 0.15)')
    host.style.setProperty('--cm-gutter-bg', '#fafafa')
    host.style.setProperty('--cm-gutter-text', '#737373')
    host.style.setProperty('--cm-scrollbar', 'rgba(0, 0, 0, 0.15)')
    host.style.setProperty('--cm-scrollbar-hover', 'rgba(0, 0, 0, 0.25)')
    host.style.setProperty('--cm-tooltip-bg', '#ffffff')
    host.style.setProperty('--cm-tooltip-border', '#e5e5e5')
    host.style.setProperty('--cm-tooltip-shadow', '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)')
    host.style.setProperty('--cm-list-hover-bg', 'rgba(0, 0, 0, 0.04)')
    host.style.setProperty('--cm-list-selected-bg', 'rgba(37, 99, 235, 0.08)')
  }, [])

  return (
    <div
      ref={hostRef}
      className={`
        relative w-full 
        bg-white
        rounded-md
        border border-[var(--color-border-default)]
        transition-all duration-200
        focus-within:border-[var(--color-accent-primary)]
        focus-within:ring-1
        focus-within:ring-[var(--color-accent-subtle)]
        ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-text'}
        ${className || ''}
      `}
      style={{
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
      }}
    />
  )
}

const KEYWORDS = [
  'SELECT','FROM','WHERE','GROUP BY','ORDER BY','JOIN','LEFT JOIN','RIGHT JOIN','INNER JOIN','OUTER JOIN',
  'INSERT INTO','UPDATE','DELETE FROM','CREATE TABLE','PRIMARY KEY','NOT NULL','NULL','AND','OR','AS','ON',
  'LIMIT','OFFSET','VALUES','SET','TAGS','PRIMARY TAGS'
]

const SCHEMA = {
  tables: ['sensor_data.readings', 'devices', 'locations'],
  columns: {
    'sensor_data.readings': ['ts','temperature','humidity','device_id','location'],
    devices: ['device_id','device_name'],
    locations: ['location','country','city']
  }
} as const

const FUNCTIONS: Record<string, { label: string; params: string[]; detail?: string }> = {
  COUNT: { label: 'COUNT(expr)', params: ['expr'], detail: 'Aggregate count' },
  AVG: { label: 'AVG(expr)', params: ['expr'], detail: 'Average value' },
  SUM: { label: 'SUM(expr)', params: ['expr'], detail: 'Sum of values' },
  MIN: { label: 'MIN(expr)', params: ['expr'], detail: 'Minimum value' },
  MAX: { label: 'MAX(expr)', params: ['expr'], detail: 'Maximum value' },
  NOW: { label: 'NOW()', params: [], detail: 'Current timestamp' },
  CURRENT_DATE: { label: 'CURRENT_DATE()', params: [], detail: 'Current date' },
  ROUND: { label: 'ROUND(number, decimals)', params: ['number','decimals'], detail: 'Round number' },
  SUBSTRING: { label: 'SUBSTRING(string, from, length)', params: ['string','from','length'], detail: 'Substring' },
}

function tableItems() {
  return SCHEMA.tables.map((t) => ({ label: t, type: 'variable', boost: 90 }))
}

function columnItems(table?: string) {
  const cols = table && SCHEMA.columns[table as keyof typeof SCHEMA.columns]
  const all = cols ?? Object.values(SCHEMA.columns).flat()
  return all.map((c) => ({ label: c, type: 'property', boost: 80 }))
}

function keywordItems() {
  return KEYWORDS.map((k) => ({ label: k, type: 'keyword', boost: 70 }))
}

function functionItems() {
  return Object.keys(FUNCTIONS).map((name) => ({
    label: name,
    type: 'function',
    boost: 95,
    apply(view: EditorView, _completion: Completion, from: number, to: number) {
      view.dispatch({
        changes: { from, to, insert: `${name}()` },
        selection: { anchor: from + name.length + 1 },
      })
      return true
    },
    detail: FUNCTIONS[name].label,
    info: FUNCTIONS[name].detail || FUNCTIONS[name].label,
  }))
}

function resolveTableAlias(state: EditorState, aliasOrTable: string): string | null {
  const lower = state.doc.toString().toLowerCase()
  const alias = aliasOrTable.toLowerCase()
  if (SCHEMA.tables.some((t) => t.toLowerCase() === alias)) return aliasOrTable
  const patterns = [
    new RegExp(`from\\s+([a-z0-9_.]+)\\s+as\\s+${alias}`),
    new RegExp(`from\\s+([a-z0-9_.]+)\\s+${alias}`),
    new RegExp(`join\\s+([a-z0-9_.]+)\\s+as\\s+${alias}`),
    new RegExp(`join\\s+([a-z0-9_.]+)\\s+${alias}`),
  ]
  for (const re of patterns) {
    const m = lower.match(re)
    if (m && m[1]) return m[1]
  }
  return null
}

function sqlCompletionSource(context: CompletionContext) {
  const word = context.matchBefore(/[\w.]*$/)
  if (!word) return null
  if (word.from === word.to && !context.explicit) return null

  const fromForDot = word.text.includes('.') ? word.from + word.text.indexOf('.') + 1 : word.from
  const before = context.state.sliceDoc(Math.max(0, word.from - 200), word.from).toUpperCase()

  const node = syntaxTree(context.state).resolveInner(context.pos, -1)
  const nodeName = node.name
  if (/\b(FROM|JOIN|UPDATE|INTO|TABLE|DELETE\s+FROM)\s+$/.test(before)) {
    return { from: word.from, options: tableItems() }
  }

  if (word.text.includes('.')) {
    const [maybeAlias] = word.text.split('.')
    const table = resolveTableAlias(context.state, maybeAlias) || maybeAlias
    return { from: fromForDot, options: columnItems(table) }
  }

  if (/\b(SELECT|WHERE|GROUP\s+BY|ORDER\s+BY|HAVING|SET)\b[\s\w,()]*$/.test(before) || nodeName === 'Identifier') {
    return { from: word.from, options: [...columnItems(), ...functionItems(), ...keywordItems()] }
  }

  return { from: word.from, options: [...keywordItems(), ...functionItems(), ...columnItems()] }
}

function findSignatureInfo(state: EditorState) {
  const pos = state.selection.main.head
  const doc = state.doc
  let start = -1
  let depth = 0
  for (let i = pos - 1; i >= 0; i--) {
    const ch = doc.sliceString(i, i + 1)
    if (ch === ')') depth++
    else if (ch === '(') {
      if (depth === 0) { start = i; break }
      else depth--
    }
  }
  if (start < 0) return null
  let j = start - 1
  while (j >= 0 && /\s/.test(doc.sliceString(j, j + 1))) j--
  const endWord = j
  while (j >= 0 && /[A-Za-z0-9_]/.test(doc.sliceString(j, j + 1))) j--
  const name = doc.sliceString(j + 1, endWord + 1)
  const meta = FUNCTIONS[name.toUpperCase()]
  if (!meta) return null
  let idx = 0
  depth = 0
  for (let k = start + 1; k < pos; k++) {
    const c = doc.sliceString(k, k + 1)
    if (c === '(') depth++
    else if (c === ')') { if (depth > 0) depth-- } 
    else if (c === ',' && depth === 0) idx++
  }
  return { name, params: meta.params, index: Math.min(idx, Math.max(0, meta.params.length - 1)) }
}

function createSignatureTooltip(state: EditorState) {
  const info = findSignatureInfo(state)
  if (!info) return null
  const pos = state.selection.main.head
  return {
    pos,
    above: true,
    strictSide: true,
    create: () => {
      const dom = document.createElement('div')
      dom.className = 'cm-tooltip cm-tooltip-signature'
      const fn = document.createElement('span')
      fn.textContent = info.name + '('
      dom.appendChild(fn)
      info.params.forEach((p, i) => {
        const span = document.createElement('span')
        span.textContent = p + (i < info.params.length - 1 ? ', ' : '')
        if (i === info.index) span.style.color = '#2563eb'
        dom.appendChild(span)
      })
      const end = document.createElement('span')
      end.textContent = ')'
      dom.appendChild(end)
      return { dom }
    }
  }
}
