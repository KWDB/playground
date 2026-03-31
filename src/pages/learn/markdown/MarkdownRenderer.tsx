import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { preprocessMarkdown } from '../utils/markdown'
import { MarkdownCodeBlock } from './MarkdownCodeBlock'

type Props = {
  content: string
  localPort?: string
  onExecClick: (event: React.MouseEvent) => void
}

export const MarkdownRenderer = ({ content, localPort, onExecClick }: Props) => {
  const processedContent = preprocessMarkdown(content, { localPort })

  return (
    <div onClick={onExecClick} className="markdown-container">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          h1: ({ children, ...props }) => (
            <h1 className="markdown-h1" {...props}>{children}</h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 className="markdown-h2" {...props}>{children}</h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 className="markdown-h3" {...props}>{children}</h3>
          ),
          p: ({ children, ...props }) => (
            <p className="markdown-paragraph" {...props}>{children}</p>
          ),
          ul: ({ children, ...props }) => (
            <ul className="markdown-list markdown-unordered-list" {...props}>{children}</ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="markdown-list markdown-ordered-list" {...props}>{children}</ol>
          ),
          li: ({ children, ...props }) => (
            <li className="markdown-list-item" {...props}>{children}</li>
          ),
          a: ({ children, className, href, target, rel, ...props }) => {
            const hrefValue = typeof href === 'string' ? href : ''
            const isJavascript = /^javascript:/i.test(hrefValue)
            if (isJavascript) {
              return <span className={[className, 'markdown-link'].filter(Boolean).join(' ')}>{children}</span>
            }
            const isExternal = /^https?:\/\//i.test(hrefValue)
            const mergedClassName = [className, 'markdown-link'].filter(Boolean).join(' ')
            return (
              <a
                className={mergedClassName}
                href={href}
                target={target || (isExternal ? '_blank' : undefined)}
                rel={rel || (isExternal ? 'noopener noreferrer' : undefined)}
                {...props}
              >
                {children}
              </a>
            )
          },
          blockquote: ({ children, ...props }) => (
            <blockquote className="markdown-blockquote" {...props}>{children}</blockquote>
          ),
          table: ({ children, ...props }) => (
            <table className="markdown-table" {...props}>{children}</table>
          ),
          thead: ({ children, ...props }) => (
            <thead className="markdown-table-header" {...props}>{children}</thead>
          ),
          tr: ({ children, ...props }) => (
            <tr className="markdown-table-row" {...props}>{children}</tr>
          ),
          td: ({ children, ...props }) => (
            <td className="markdown-table-cell" {...props}>{children}</td>
          ),
          th: ({ children, ...props }) => (
            <th className="markdown-table-cell" {...props}>{children}</th>
          ),
          code: (props) => <MarkdownCodeBlock {...props} />,
          span: ({ className, children, ...props }) => {
            const classValue = typeof className === 'string' ? className : ''
            return (
              <span className={classValue} {...props}>
                {children}
              </span>
            )
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  )
}
