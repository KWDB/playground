import React from 'react'

type MarkdownVariables = {
  localPort?: string
}

export const extractTextFromNode = (n: React.ReactNode): string => {
  if (n == null) return ''
  if (typeof n === 'string' || typeof n === 'number') return String(n)
  if (Array.isArray(n)) return (n as React.ReactNode[]).map(extractTextFromNode).join('')
  if (React.isValidElement(n)) return extractTextFromNode((n.props as { children?: React.ReactNode }).children)
  return ''
}

export const readNodeMeta = (node: unknown): string | null => {
  const metaContainer = node as { meta?: string | null; data?: { meta?: string | null } } | undefined
  return metaContainer?.meta ?? metaContainer?.data?.meta ?? null
}

export const preprocessMarkdown = (content: string, variables: MarkdownVariables = {}) => {
  const normalizedLocalPort = String(variables.localPort || '').trim()
  const withPortVariable = content.replace(/\{\{\s*(?:LOCAL_PORT)\s*\}\}/gi, normalizedLocalPort)

  const normalizedOpeningExec = withPortVariable.replace(/```([^\n]*?)\{\{\s*exec\s*\}\}([^\n]*)\n([\s\S]*?)```/g, (match, before, after, code) => {
    const infoStr = `${String(before || '')} ${String(after || '')}`.trim()
    const [langRaw, ...restParts] = infoStr.split(/\s+/).filter(Boolean)
    const langOrDefault = langRaw || 'bash'
    const extrasFiltered = restParts.filter(p => p.toLowerCase() !== 'exec').join(' ')
    const newInfo = `${langOrDefault}-exec${extrasFiltered ? ' ' + extrasFiltered : ''}`.trim()
    return `\`\`\`${newInfo}\n${code}\`\`\``
  })

  const withExecMeta = normalizedOpeningExec.replace(/```([^\n]*)\n([\s\S]*?)```[\s\r\n]*\{\{\s*exec\s*\}\}/g, (match, info, code) => {
    const infoStr = String(info || '').trim()
    const [langRaw, ...restParts] = infoStr.split(/\s+/).filter(Boolean)
    const langOrDefault = langRaw || 'bash'
    const extrasFiltered = restParts.filter(p => p.toLowerCase() !== 'exec').join(' ')
    const newInfo = `${langOrDefault}-exec${extrasFiltered ? ' ' + extrasFiltered : ''}`.trim()
    return `\`\`\`${newInfo}\n${code}\`\`\``
  })

  const withOpenInNewWindowLink = withExecMeta.replace(/\[([^\]]+)\]\(([^)]+)\)\s*\{:\s*target\s*=\s*"_blank"\s*\}/g, (match, rawLabel, rawHref) => {
    const label = String(rawLabel)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    const href = String(rawHref)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`
  })

  const withExecButton = withOpenInNewWindowLink.replace(/`([^`]+)`\s*\{\{\s*exec\s*\}\}/g, (match, rawCmd) => {
    const cmd = String(rawCmd)
    const escapedText = cmd
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    const encoded = encodeURIComponent(cmd)
    return `<code class="inline-code-exec">${escapedText}</code><button type="button" class="exec-btn" data-command-enc="${encoded}" title="执行命令">Run</button>`
  })

  return withExecButton.replace(/`([^`]+)`\s*\{\{\s*copy\s*\}\}/g, (match, rawText) => {
    const copyText = String(rawText)
    const escapedText = copyText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    const encoded = encodeURIComponent(copyText)
    return `<code class="inline-code-copy">${escapedText}</code><button type="button" class="copy-btn" data-copy-enc="${encoded}" title="复制内容">Copy</button>`
  })
}
