import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Server } from 'lucide-react'
import SqlTerminal, { SqlTerminalRef } from '../components/SqlTerminal'
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import TerminalComponent, { TerminalRef } from '../components/Terminal';
import ConfirmDialog from '../components/ConfirmDialog';
import StatusIndicator, { StatusType } from '../components/StatusIndicator';
import CourseContentPanel from '../components/CourseContentPanel';
import PortConflictHandler from '../components/PortConflictHandler';
import '../styles/markdown.css';

interface Course {
  id: string
  title: string
  description: string
  details: {
    intro: { content: string }
    steps: Array<{ title: string; content: string }>
    finish: { content: string }
  }
  sqlTerminal?: boolean
  backend?: { port?: number }
}

export function Learn() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const [course, setCourse] = useState<Course | null>(null)
  const [currentStep, setCurrentStep] = useState(-1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false)
  const [containerId, setContainerId] = useState<string | null>(null)
  const [containerStatus, setContainerStatus] = useState<string>('stopped')
  const [isStartingContainer, setIsStartingContainer] = useState<boolean>(false)
  const terminalRef = useRef<TerminalRef>(null)
  const sqlTerminalRef = useRef<SqlTerminalRef>(null)

  // 端口冲突处理相关状态
  const [showPortConflictHandler, setShowPortConflictHandler] = useState<boolean>(false)

  // 定期状态检查的引用
  const statusCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // 简化状态管理
  const [, setIsConnected] = useState(false)
  const [, setConnectionError] = useState<string | null>(null)

  // 监听容器状态变化，当容器停止时清除连接错误
  useEffect(() => {
    if (containerStatus === 'stopped' || containerStatus === 'exited') {
      // 容器停止时清除连接错误状态，避免显示误导性错误信息
      setConnectionError(null)
      console.log('容器已停止，清除连接错误状态')
    }
  }, [containerStatus])

  const checkContainerStatus = useCallback(async (containerId: string, shouldUpdateState = true) => {
    try {
      console.log(`开始检查容器状态，容器ID: ${containerId}`);
      const response = await fetch(`/api/containers/${containerId}/status`)
      if (!response.ok) {
        console.error('容器状态检查失败，HTTP状态:', response.status)
        throw new Error(`获取容器状态失败: ${response.status}`)
      }
      const data = await response.json()
      console.log('容器状态检查结果:', data)

      // 状态验证和同步逻辑
      if (shouldUpdateState) {
        const currentStatus = containerStatus;
        const newStatus = data.status;

        // 记录状态变化
        if (currentStatus !== newStatus) {
          console.log(`容器状态发生变化: ${currentStatus} -> ${newStatus}`);
        }

        // 状态一致性验证
        if (newStatus === 'running' && currentStatus === 'starting') {
          console.log('容器启动完成，状态同步为running');
        } else if (newStatus === 'exited' && (currentStatus === 'running' || currentStatus === 'starting')) {
          console.warn('检测到容器意外退出，状态不一致');
        }

        setContainerStatus(newStatus);
      }

      return data
    } catch (err) {
      console.error('获取容器状态失败:', err)
      // 网络错误时不要设置容器状态为error，保持当前状态
      return null
    }
  }, [containerStatus])

  // WebSocket 连接处理
  const connectToTerminal = useCallback((containerId: string) => {
    if (!containerId) {
      setConnectionError('容器ID为空')
      return
    }

    if (containerStatus !== 'running') {
      setConnectionError('容器未运行')
      return
    }

    setIsConnected(true)
    setConnectionError(null)
  }, [containerStatus, setConnectionError, setIsConnected])



  const startCourseContainer = useCallback(async (courseId: string) => {
    // 防重复调用：检查当前状态，避免重复启动
    if (isStartingContainer || containerStatus === 'running' || containerStatus === 'starting') {
      console.log('容器已在启动中或运行中，跳过重复启动请求')
      return
    }

    setIsStartingContainer(true)
    setContainerStatus('starting')
    setError(null) // 清除之前的错误信息
    setConnectionError(null) // 清除连接错误

    try {
      const response = await fetch(`/api/courses/${courseId}/start`, {
        method: 'POST'
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || '启动容器失败')
      }

      const data = await response.json()
      console.log('容器启动成功，响应数据:', data)

      setContainerId(data.containerId)

      // 等待容器完全启动的函数
      const waitForContainerReady = async (containerId: string, maxRetries = 15, retryInterval = 1500) => {
        console.log(`开始等待容器启动，最大重试次数: ${maxRetries}，检查间隔: ${retryInterval}ms`);

        for (let i = 0; i < maxRetries; i++) {
          console.log(`第 ${i + 1}/${maxRetries} 次检查容器状态...`)

          // 等待一段时间再检查，给容器启动时间
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, retryInterval))
          }

          const statusData = await checkContainerStatus(containerId, true)

          if (statusData && statusData.status === 'running') {
            console.log('✅ 容器已完全启动，状态验证通过:', statusData.status)

            // 额外验证：再次确认容器确实在运行
            await new Promise(resolve => setTimeout(resolve, 1000));
            const finalCheck = await checkContainerStatus(containerId, false);

            if (finalCheck && finalCheck.status === 'running') {
              console.log('✅ 容器状态最终验证通过，准备连接终端');
              setContainerStatus('running');

              // 启动状态监控
              startStatusMonitoring(containerId);

              // 容器启动完成后连接终端
              setTimeout(() => {
                connectToTerminal(containerId)
              }, 500)

              return true
            } else {
              console.warn('⚠️ 容器状态最终验证失败，继续等待...');
              continue;
            }
          } else if (statusData && statusData.status === 'starting') {
            console.log(`⏳ 容器正在启动中，状态: ${statusData.status}，继续等待... (${i + 1}/${maxRetries})`);
            continue;
          } else if (statusData && (statusData.status === 'exited' || statusData.status === 'error')) {
            console.error('❌ 容器启动失败，状态:', statusData.status)

            // 如果是一次性执行容器正常退出，不视为错误
            if (statusData.status === 'exited' && statusData.exitCode === 0) {
              console.log('✅ 一次性执行容器正常完成，退出码: 0');
              setContainerStatus('completed');
              return true;
            }

            throw new Error(`容器启动失败，状态: ${statusData.status}${statusData.exitCode ? `, 退出码: ${statusData.exitCode}` : ''}`)
          }

          console.log(`⏳ 容器状态: ${statusData?.status || '未知'}，继续等待... (${i + 1}/${maxRetries})`)
        }

        console.error('❌ 容器启动超时，已达到最大重试次数');
        throw new Error('容器启动超时，请重试')
      }

      // 等待容器完全启动
      await waitForContainerReady(data.containerId)

    } catch (error) {
      console.error('启动容器失败:', error)
      const errorMessage = error instanceof Error ? error.message : '启动容器失败'
      
      // 检测是否为端口冲突错误
      const isPortConflictError = errorMessage.toLowerCase().includes('port') && 
        (errorMessage.toLowerCase().includes('already') || 
         errorMessage.toLowerCase().includes('in use') ||
         errorMessage.toLowerCase().includes('bind') ||
         errorMessage.toLowerCase().includes('occupied'))
      
      if (isPortConflictError) {
        console.log('检测到端口冲突错误，显示智能处理组件')
        setShowPortConflictHandler(true)
        setContainerStatus('error')
      } else {
        setError(errorMessage)
        setContainerStatus('error')
        setConnectionError('容器启动失败，无法建立连接')
      }
    } finally {
      setIsStartingContainer(false)
    }
  }, [containerStatus, isStartingContainer, checkContainerStatus, connectToTerminal])

  // 端口冲突处理回调函数
  const handlePortConflictClose = useCallback(() => {
    setShowPortConflictHandler(false)
  }, [])

  const handlePortConflictRetry = useCallback(() => {
    if (course?.id) {
      console.log('端口冲突处理完成，重试启动容器')
      startCourseContainer(course.id)
    }
  }, [course?.id, startCourseContainer])

  const handlePortConflictSuccess = useCallback(() => {
    console.log('端口冲突处理成功')
    setError(null)
    setConnectionError(null)
  }, [setConnectionError])

  // 使用useRef保存最新的状态值，避免闭包问题
  const courseIdRef = useRef(courseId)
  const containerStatusRef = useRef(containerStatus)
  // 保存最新容器ID，避免卸载时读到过期值
  const containerIdRef = useRef(containerId)

  // 更新ref值
  useEffect(() => {
    courseIdRef.current = courseId
  }, [courseId])

  useEffect(() => {
    containerStatusRef.current = containerStatus
  }, [containerStatus])

  // 同步最新容器ID
  useEffect(() => {
    containerIdRef.current = containerId
  }, [containerId])

  const stopContainer = useCallback(async (courseId: string) => {
    console.log('停止容器请求开始，课程ID:', courseId)
    console.log('当前页面容器ID:', containerId)

    try {
      // 立即设置容器状态为停止中，提供即时UI反馈
      setContainerStatus('stopping')

      // 优先按容器ID停止，确保仅影响当前页面实例
      if (containerId) {
        const url = `/api/containers/${containerId}/stop`
        console.log('按容器ID停止，URL:', url)
        const response = await fetch(url, { method: 'POST' })

        if (!response.ok) {
          const errorText = await response.text()
          // 404 表示容器已不存在，视为正常
          if (response.status === 404) {
            console.log('容器已不存在，视为成功停止:', errorText)
          } else {
            throw new Error(`按容器ID停止失败: ${response.status} ${errorText}`)
          }
        }
      } else {
        // 回退：没有 containerId 时按课程ID停止（可能会停止同课程的其他页面容器，尽量避免）
        const fallbackUrl = `/api/courses/${courseId}/stop`
        console.log('缺少容器ID，回退按课程ID停止，URL:', fallbackUrl)
        const response = await fetch(fallbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
        if (!response.ok) {
          const errorText = await response.text()
          if (response.status !== 404) {
            throw new Error(`按课程ID停止失败: ${response.status} ${errorText}`)
          }
        }
      }

      // 成功后的状态更新
      setContainerStatus('stopped')
      setIsConnected(false)
      setConnectionError(null)
      setContainerId(null)

      // 停止状态监控
      if (statusCheckIntervalRef.current) {
        console.log('停止定期状态监控')
        clearInterval(statusCheckIntervalRef.current)
        statusCheckIntervalRef.current = null
      }

    } catch (error) {
      console.error('停止容器异常:', error)
      setError(error instanceof Error ? error.message : '停止容器失败')
    }
  }, [containerId])

  const fetchCourse = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/courses/${id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch course')
      }
      const data = await response.json()
      setCourse(data.course)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (courseId) {
      fetchCourse(courseId)
    }
  }, [courseId, fetchCourse])

  // 定期状态检查机制
  const startStatusMonitoring = useCallback((containerId: string) => {
    // 清除之前的定时器
    if (statusCheckIntervalRef.current) {
      clearInterval(statusCheckIntervalRef.current);
    }

    console.log('开始定期状态监控，容器ID:', containerId);

    // 每30秒检查一次容器状态
    statusCheckIntervalRef.current = setInterval(async () => {
      try {
        const statusData = await checkContainerStatus(containerId, false);
        if (statusData) {
          const currentStatus = containerStatus;
          const actualStatus = statusData.status;

          // 检测状态不一致
          if (currentStatus !== actualStatus) {
            console.warn(`检测到状态不一致: 前端状态=${currentStatus}, 实际状态=${actualStatus}`);

            // 自动修复状态不一致
            if (actualStatus === 'exited' && currentStatus === 'running') {
              console.log('容器意外退出，更新前端状态');
              setContainerStatus('stopped');
              setIsConnected(false);
              setConnectionError('容器已停止运行');
            } else if (actualStatus === 'running' && currentStatus === 'stopped') {
              console.log('检测到容器已启动，更新前端状态');
              setContainerStatus('running');
              setIsConnected(true);
              setConnectionError(null);
            } else {
              // 其他状态不一致情况，直接同步
              setContainerStatus(actualStatus);
            }
          }
        }
      } catch (error) {
        console.error('定期状态检查失败:', error);
      }
    }, 30000); // 30秒检查一次
  }, [containerStatus, checkContainerStatus, setIsConnected, setConnectionError]);

  useEffect(() => {
    return () => {
      // 组件卸载时优先按容器ID停止（使用ref避免闭包问题）
      const id = containerIdRef.current
      if (id) {
        console.log('组件卸载：按容器ID停止容器，containerId:', id)
        fetch(`/api/containers/${id}/stop`, { method: 'POST' }).catch(error => {
          console.error('组件卸载时按容器ID停止容器失败:', error)
        })
      } else if (courseIdRef.current) {
        // 回退逻辑：缺少容器ID时按课程ID停止
        console.log('组件卸载：按课程ID停止容器，课程ID:', courseIdRef.current)
        fetch(`/api/courses/${courseIdRef.current}/stop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }).catch(error => {
          console.error('组件卸载时按课程ID停止容器失败:', error)
        })
      }
      // 清空容器ID，避免卸载后残留导致重连
      setContainerId(null)
    }
  }, [])

  // Helper functions for navigation
  const getCurrentTitle = () => {
    if (currentStep === -1) return '课程介绍'
    if (currentStep >= course?.details.steps.length) return '课程完成'
    return course?.details.steps[currentStep]?.title || ''
  }

  const getCurrentContent = () => {
    if (currentStep === -1) return course?.details.intro.content || ''
    if (currentStep >= course?.details.steps.length) return course?.details.finish.content || ''
    return course?.details.steps[currentStep]?.content || ''
  }

  // 使用 useMemo 缓存当前标题与内容，避免无关渲染
  const currentTitle = useMemo(() => getCurrentTitle(), [course, currentStep])
  const currentContent = useMemo(() => getCurrentContent(), [course, currentStep])

  // 将 ReactNode 提取为纯文本（用于从 <code> children 中获取命令字符串）
  const extractTextFromNode = useCallback((n: React.ReactNode): string => {
    if (n == null) return ''
    if (typeof n === 'string' || typeof n === 'number') return String(n)
    if (Array.isArray(n)) return (n as React.ReactNode[]).map(extractTextFromNode).join('')
    if (React.isValidElement(n)) return extractTextFromNode((n as React.ReactElement).props?.children)
    return ''
  }, [])

  // 从 ReactMarkdown AST 节点读取 meta 字段（用于识别是否带有 exec 标记）
  const readNodeMeta = useCallback((node: unknown): string | null => {
    const metaContainer = node as { meta?: string | null; data?: { meta?: string | null } } | undefined
    return metaContainer?.meta ?? metaContainer?.data?.meta ?? null
  }, [])

  // =============================
  // 预处理 Markdown：支持 {{exec}} 语法
  // =============================
  const preprocessMarkdown = (content: string) => {
    // 0) 处理“开头围栏（info string）中包含 {{exec}}”的情况，例如 ```bash {{exec}} 或 ```{{exec}}
    const normalizedOpeningExec = content.replace(/```([^\n]*?)\{\{\s*exec\s*\}\}([^\n]*)\n([\s\S]*?)```/g, (match, before, after, code) => {
      const infoStr = `${String(before || '')} ${String(after || '')}`.trim()
      const [langRaw, ...restParts] = infoStr.split(/\s+/).filter(Boolean)
      const langOrDefault = langRaw || 'bash'
      const extrasFiltered = restParts.filter(p => p.toLowerCase() !== 'exec').join(' ')
      const newInfo = `${langOrDefault}-exec${extrasFiltered ? ' ' + extrasFiltered : ''}`.trim()
      return `\`\`\`${newInfo}\n${code}\`\`\``
    })

    // 1) 处理“围栏代码块 + {{exec}}”，允许在代码块结束后存在空白或换行，再跟随 {{exec}} 标记
    const withExecMeta = normalizedOpeningExec.replace(/```([^\n]*)\n([\s\S]*?)```[\s\r\n]*\{\{\s*exec\s*\}\}/g, (match, info, code) => {
      const infoStr = String(info || '').trim()
      const [langRaw, ...restParts] = infoStr.split(/\s+/).filter(Boolean)
      const langOrDefault = langRaw || 'bash' // 无语言时默认 bash
      // 过滤掉已有 extras 中的 exec 标记，避免重复
      const extrasFiltered = restParts.filter(p => p.toLowerCase() !== 'exec').join(' ')
      // 将 exec 信息编码进语言后缀，以确保在 ReactMarkdown->hast 流程中仍可检测到
      const newInfo = `${langOrDefault}-exec${extrasFiltered ? ' ' + extrasFiltered : ''}`.trim()
      return `\`\`\`${newInfo}\n${code}\`\`\``
    })

    // 2) 处理行内代码 `cmd`{{exec}}，允许存在空白
    return withExecMeta.replace(/`([^`]+)`\s*\{\{\s*exec\s*\}\}/g, (match, command) => {
      return `<code class="inline-code-exec">${command}</code><button class="exec-btn" data-command="${command}" title="执行命令">Run</button>`
    })
  }

  // 处理执行按钮点击事件
  const handleExecButtonClick = useCallback((e: React.MouseEvent) => {
    const button = (e.target as HTMLElement).closest('.exec-btn') as HTMLElement
    if (button) {
      const command = button.getAttribute('data-command')
      if (command && containerId && containerStatus === 'running') {
        // 根据课程类型选择不同的处理方式
        if (course?.sqlTerminal) {
          // SQL 终端类型：将命令填充到 textarea
          if (sqlTerminalRef.current) {
            sqlTerminalRef.current.sendCommand(command)
          } else {
            console.warn('SQL Terminal组件未准备就绪')
          }
        } else {
          // Shell 终端类型：发送命令到终端执行
          if (terminalRef.current) {
            terminalRef.current.sendCommand(command)
          } else {
            console.warn('Terminal组件未准备就绪')
          }
        }
      } else if (containerStatus !== 'running') {
        alert('请先启动容器后再执行命令')
      }
    }
  }, [containerId, containerStatus, course?.sqlTerminal])

  // =============================
  // Markdown 渲染：基于 ReactMarkdown + 代码高亮
  // 使用 useCallback 保持稳定引用，减少子组件不必要更新
  // =============================
  const renderMarkdown = useCallback((content: string) => {
    const processedContent = preprocessMarkdown(content)

    return (
      <div onClick={handleExecButtonClick} className="markdown-container">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            // 标题组件
            h1: ({ children, ...props }) => (
              <h1 className="markdown-h1" {...props}>{children}</h1>
            ),
            h2: ({ children, ...props }) => (
              <h2 className="markdown-h2" {...props}>{children}</h2>
            ),
            h3: ({ children, ...props }) => (
              <h3 className="markdown-h3" {...props}>{children}</h3>
            ),
            // 段落组件
            p: ({ children, ...props }) => (
              <p className="markdown-paragraph" {...props}>{children}</p>
            ),
            // 列表组件
            ul: ({ children, ...props }) => (
              <ul className="markdown-list markdown-unordered-list" {...props}>{children}</ul>
            ),
            ol: ({ children, ...props }) => (
              <ol className="markdown-list markdown-ordered-list" {...props}>{children}</ol>
            ),
            li: ({ children, ...props }) => (
              <li className="markdown-list-item" {...props}>{children}</li>
            ),
            // 链接组件
            a: ({ children, ...props }) => (
              <a className="markdown-link" {...props}>{children}</a>
            ),
            // 引用块组件
            blockquote: ({ children, ...props }) => (
              <blockquote className="markdown-blockquote" {...props}>{children}</blockquote>
            ),
            // 表格组件
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
            // 代码组件 - 区分代码块和内联代码
            code: ({ className, children, node, ...props }) => {
              // 支持语言 className 中包含连字符，例如 language-bash-exec
              const match = /language-([\w-]+)/.exec(className || '')
              const langToken = match ? match[1] : ''

              // 使用顶层工具函数提取文本
              const codeText = extractTextFromNode(children ?? '').replace(/\n$/, '')

              // 通过 AST 节点的 meta 检测是否存在 exec 标记（围栏语言后的额外信息）
              const metaValue = readNodeMeta(node)
              const hasExecMeta = !!(metaValue && String(metaValue).includes('exec'))

              // 兼容通过语言后缀携带 exec（例如 language-bash-exec）
              const hasExecInClass = langToken.includes('-exec')
              const language = langToken.replace(/-exec$/, '')

              return match ? (
                <div className="markdown-code-block">
                  <div className="markdown-code-header">
                    <div className="flex items-center space-x-2">
                      <div className="markdown-code-dots">
                        <div className="markdown-code-dot markdown-code-dot--red"></div>
                        <div className="markdown-code-dot markdown-code-dot--yellow"></div>
                        <div className="markdown-code-dot markdown-code-dot--green"></div>
                      </div>
                      <span className="markdown-code-language">{language}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="markdown-code-title">{(hasExecMeta || hasExecInClass) ? '可执行代码' : '代码块'}</div>
                      {(hasExecMeta || hasExecInClass) && (
                        <button
                          className="exec-btn"
                          data-command={codeText}
                          title="执行命令"
                          aria-label="执行当前代码块命令"
                        >
                          Run
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="markdown-code-content">
                    <SyntaxHighlighter
                      style={highlighterStyle}
                      language={language}
                      PreTag="pre"
                      className="markdown-syntax-highlighter"
                    >
                      {codeText}
                    </SyntaxHighlighter>
                  </div>
                </div>
              ) : (
                <code className="markdown-inline-code" {...props}>
                  {codeText}
                </code>
              )
            }
          }}
        >
          {processedContent}
        </ReactMarkdown>
      </div>
    )
  }, [handleExecButtonClick])

  const canGoPrevious = () => currentStep > -1
  const canGoNext = () => course && currentStep < course.details.steps.length

  const goToPrevious = () => {
    if (canGoPrevious()) {
      setCurrentStep(currentStep - 1)
    }
  }

  const goToNext = () => {
    if (canGoNext()) {
      setCurrentStep(currentStep + 1)
    }
  }

  // 跳转到指定步骤
  const goToStep = (step: number) => {
    if (course) {
      // 限制跳转范围：-1(intro) 到 steps.length(finish)
      const minStep = -1
      const maxStep = course.details.steps.length
      if (step >= minStep && step <= maxStep) {
        setCurrentStep(step)
      }
    }
  }

  // 获取进度条步骤列表 - 使用配置文件中的标题
  const getProgressSteps = () => {
    if (!course) return []

    const steps = [
      { id: -1, title: '介绍', type: 'intro' },
      ...course.details.steps.map((step, index) => ({
        id: index,
        title: step.title, // 使用配置文件中的实际标题
        type: 'step'
      })),
      { id: course.details.steps.length, title: '完成', type: 'finish' }
    ]

    return steps
  }

  // 渲染极简进度条
  const renderProgressBar = () => {
    const steps = getProgressSteps()
    if (steps.length === 0) return null

    return (
      <div className="bg-white border-b border-gray-100 px-6 py-3">
        <div className="flex items-center space-x-4 max-w-4xl mx-auto">
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
            <div className="font-medium">
              {currentStep + 2} / {steps.length}
            </div>
          </div>

          <div className="flex-1 relative">
            <div className="h-0.5 bg-gray-100 rounded-full"></div>
            <div
              className="absolute top-0 left-0 h-0.5 bg-blue-500 rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${(Math.max(0, currentStep + 1) / (steps.length - 1)) * 100}%`
              }}
            ></div>
          </div>

          <div className="flex items-center space-x-1">
            {steps.map((step) => {
              const isCompleted = currentStep > step.id
              const isCurrent = currentStep === step.id
              const isClickable = step.id <= currentStep || step.id === currentStep + 1

              return (
                <button
                  key={step.id}
                  onClick={() => isClickable && goToStep(step.id)}
                  disabled={!isClickable}
                  className={`group relative w-2 h-2 rounded-full transition-all duration-200 ${isCompleted
                    ? 'bg-blue-500 hover:bg-blue-600'
                    : isCurrent
                      ? 'bg-blue-500 ring-2 ring-blue-200'
                      : isClickable
                        ? 'bg-gray-300 hover:bg-gray-400'
                        : 'bg-gray-200 cursor-not-allowed'
                    }`}
                  title={step.title}
                >
                  {/* 悬浮提示 */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-10">
                    {step.title}
                  </div>
                </button>
              )
            })}
          </div>

          {/* 当前步骤标题 */}
          <div className="text-sm font-medium text-gray-700 min-w-0">
            {steps.find(step => step.id === currentStep)?.title || '介绍'}
          </div>
        </div>
      </div>
    )
  }

  // 退出课程函数
  const exitCourse = async () => {
    if (containerStatus === 'running' && course?.id) {
      await stopContainer(course.id)
    }
  }

  // 退出课程并跳转到课程列表
  const exitCourseAndNavigate = async () => {
    await exitCourse()
    navigate('/courses')
  }

  // 处理返回按钮点击事件，显示确认对话框
  const handleBackClick = () => {
    setShowConfirmDialog(true)
  }

  // 处理确认对话框的确认操作
  const handleConfirmExit = () => {
    setShowConfirmDialog(false)
    // 立即跳转到课程列表页面
    navigate('/courses')
    // 异步执行资源清理，不阻塞页面跳转
    // 使用setTimeout确保在页面跳转后执行，避免状态冲突
    setTimeout(async () => {
      try {
        await exitCourse()
      } catch {
        // 静默处理清理过程中的错误，不影响用户体验
        console.log('资源清理完成，部分操作可能已被其他进程处理')
      }
    }, 100) // 稍微延迟确保页面跳转完成
  }

  // 处理确认对话框的取消操作
  const handleCancelExit = () => {
    setShowConfirmDialog(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">加载课程中...</div>
      </div>
    )
  }

  if (error || !course) {
    // 分析错误类型并提供相应的解决方案
    const getErrorInfo = (errorMessage: string) => {
      const lowerError = errorMessage.toLowerCase()

      if (lowerError.includes('/bin/bash') && lowerError.includes('no such file')) {
        return {
          title: '镜像兼容性问题',
          description: '当前镜像不包含所需的 shell 环境',
          reason: '某些最小化镜像不包含完整的 shell 环境或特定命令',
          solutions: [
            '系统正在尝试自动适配镜像类型，请稍等片刻',
            '如果问题持续，请切换到包含完整环境的镜像',
            '联系管理员检查课程配置和镜像兼容性',
            '查看课程文档了解推荐的镜像类型'
          ],
          icon: '🔧'
        }
      }

      if (lowerError.includes('container failed to start') && lowerError.includes('exitcode')) {
        const exitCodeMatch = lowerError.match(/exitcode[=:]?(\d+)/)
        const exitCode = exitCodeMatch ? exitCodeMatch[1] : 'unknown'
        return {
          title: '容器启动异常',
          description: `容器启动后异常退出 (退出码: ${exitCode})`,
          reason: '容器内部程序执行失败或配置错误',
          solutions: [
            '检查容器镜像是否支持当前的启动配置',
            '查看容器日志获取详细错误信息',
            '确认镜像版本和课程要求是否匹配',
            '联系管理员检查容器配置和启动参数'
          ],
          icon: '🚫'
        }
      }

      if (lowerError.includes('no such image') || lowerError.includes('pull access denied')) {
        return {
          title: '镜像拉取失败',
          description: '无法获取指定的容器镜像',
          reason: '镜像不存在、网络连接问题或权限不足',
          solutions: [
            '检查网络连接是否正常',
            '确认镜像名称是否正确',
            '检查 Docker Hub 或镜像仓库的访问权限',
            '尝试使用其他镜像源或联系管理员'
          ],
          icon: '📦'
        }
      }

      if (lowerError.includes('image') && lowerError.includes('not found')) {
        return {
          title: '镜像拉取失败',
          description: '无法找到指定的 Docker 镜像',
          reason: '镜像名称错误、镜像不存在或网络连接问题',
          solutions: [
            '检查镜像名称和标签是否正确',
            '确认网络连接正常，可能需要配置代理',
            '尝试使用其他镜像源或联系管理员',
            '检查 Docker Hub 或私有仓库的访问权限'
          ],
          icon: '📦'
        }
      }

      if (lowerError.includes('permission denied') || lowerError.includes('access denied')) {
        return {
          title: '权限访问错误',
          description: '容器操作权限不足',
          reason: 'Docker 服务权限配置问题或用户权限不足',
          solutions: [
            '检查 Docker 服务是否正常运行',
            '确认当前用户是否有 Docker 操作权限',
            '联系系统管理员检查权限配置',
            '尝试重启 Docker 服务'
          ],
          icon: '🔒'
        }
      }

      if (lowerError.includes('no space left') || lowerError.includes('disk space')) {
        return {
          title: '存储空间不足',
          description: '系统磁盘空间不足，无法创建容器',
          reason: '服务器存储空间已满或接近满载',
          solutions: [
            '清理不必要的文件和容器',
            '联系管理员扩展存储空间',
            '删除未使用的 Docker 镜像和容器',
            '检查系统磁盘使用情况'
          ],
          icon: '💾'
        }
      }

      if (lowerError.includes('network') || lowerError.includes('connection')) {
        return {
          title: '网络连接问题',
          description: '容器网络配置或连接异常',
          reason: '网络配置错误、防火墙阻拦或网络服务异常',
          solutions: [
            '检查网络连接是否正常',
            '确认防火墙设置允许相关端口',
            '检查 Docker 网络配置',
            '联系网络管理员检查网络策略'
          ],
          icon: '🌐'
        }
      }

      if (lowerError.includes('timeout') && !lowerError.includes('network')) {
        return {
          title: '操作超时',
          description: '容器启动或操作超时',
          reason: '服务器响应缓慢、负载过高或配置问题',
          solutions: [
            '稍后重试，服务器可能正在处理其他任务',
            '检查网络连接稳定性',
            '联系管理员检查服务器负载状态',
            '尝试使用更轻量级的镜像'
          ],
          icon: '⏱️'
        }
      }

      if (lowerError.includes('port') && (lowerError.includes('already') || lowerError.includes('in use'))) {
        return {
          title: '端口冲突',
          description: '所需端口已被其他服务占用',
          reason: '多个容器或服务尝试使用相同端口',
          solutions: [
            '停止占用端口的其他容器或服务',
            '等待片刻后重试，系统会自动分配可用端口',
            '联系管理员检查端口使用情况',
            '检查是否有重复的容器实例'
          ],
          icon: '🔌'
        }
      }

      // 默认错误信息 - 提供更友好的通用错误处理
      return {
        title: '容器启动异常',
        description: '遇到了预期之外的问题',
        reason: `系统错误: ${errorMessage}`,
        solutions: [
          '请稍后重试，问题可能是临时的',
          '刷新页面重新加载课程',
          '如果问题持续存在，请联系技术支持',
          '可以尝试切换到其他课程后再回来'
        ],
        icon: '🔧'
      }
    }

    const errorInfo = error ? getErrorInfo(error) : {
      title: '课程未找到',
      description: '请求的课程不存在或已被删除',
      reason: '课程ID无效或课程配置文件缺失',
      solutions: [
        '检查课程ID是否正确',
        '返回课程列表选择其他课程',
        '联系管理员确认课程状态'
      ],
      icon: '📚'
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
          {/* 错误标题区域 */}
          <div className="bg-gradient-to-r from-red-50 to-orange-50 px-8 py-6 border-b border-gray-200">
            <div className="text-center">
              <div className="text-5xl mb-4 animate-bounce">{errorInfo.icon}</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{errorInfo.title}</h1>
              <p className="text-gray-600 text-lg">{errorInfo.description}</p>
            </div>
          </div>

          <div className="p-8">
            {/* 错误详情 */}
            <div className="bg-gradient-to-r from-red-50 to-red-100 border-l-4 border-red-400 rounded-r-lg p-5 mb-6">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="font-semibold text-red-800 mb-2">错误原因</h3>
                  <p className="text-red-700 text-sm leading-relaxed">{errorInfo.reason}</p>
                  {error && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-red-600 hover:text-red-800 font-medium text-sm transition-colors duration-200 select-none">
                        🔍 查看详细错误信息
                      </summary>
                      <div className="mt-3 p-4 bg-red-200/50 rounded-lg border border-red-300">
                        <pre className="font-mono text-xs text-red-800 whitespace-pre-wrap break-all leading-relaxed">
                          {error}
                        </pre>
                      </div>
                    </details>
                  )}
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              <button
                onClick={() => window.location.reload()}
                className="group relative px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium shadow-lg shadow-gray-500/25 hover:shadow-gray-500/40 hover:from-gray-700 hover:to-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105 active:scale-95"
              >
                <span className="flex items-center justify-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  重试启动
                </span>
              </button>
              <Link
                to="/courses"
                className="group relative px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg font-medium shadow-lg shadow-gray-500/25 hover:shadow-gray-500/40 hover:from-gray-700 hover:to-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105 active:scale-95 text-center"
              >
                <span className="flex items-center justify-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  返回课程列表
                </span>
              </Link>
            </div>

            {/* 帮助信息 */}
            <div className="pt-6 border-t border-gray-200 text-center">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-600 text-sm leading-relaxed">
                  <span className="font-medium">💬 需要帮助？</span><br />
                  如果问题持续存在，请在 项目 Github 上
                  <a href="https://github.com/kwdb/playground/issues" className="text-blue-600 hover:text-blue-800 font-medium ml-1 underline decoration-dotted underline-offset-2 transition-colors duration-200">
                    提交 Issue
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBackClick}
              className="group relative inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-lg shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700 hover:shadow-blue-500/40 hover:shadow-xl hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white transition-all duration-300 transform active:scale-95 active:translate-y-0 border border-blue-400/20 backdrop-blur-sm"
              title="返回课程列表"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">返回</span>
            </button>
            <h1 className="text-lg font-semibold text-gray-900">{course.title}</h1>
          </div>

          {/* 容器状态栏 */}
          <div className="flex items-center space-x-3">
            {/* 容器状态 */}
            <StatusIndicator
              status={containerStatus as StatusType}
              label={`容器: ${containerStatus === 'running' ? '运行中' :
                containerStatus === 'starting' ? '启动中' :
                  containerStatus === 'stopping' ? '停止中' :
                    containerStatus === 'error' ? '错误' :
                      '已停止'}`}
              icon={Server}
              size="sm"
            />

            {/* 操作按钮组 */}
            <div className="flex items-center space-x-3">
              {containerStatus === 'stopped' || containerStatus === 'error' ? (
                <button
                  onClick={() => course?.id && startCourseContainer(course.id)}
                  disabled={isStartingContainer}
                  className="group relative inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-300 transform hover:scale-105 active:scale-95"
                >
                  <div className={`flex items-center space-x-2 ${isStartingContainer ? 'animate-pulse' : ''
                    }`}>
                    <div className={`w-2 h-2 rounded-full bg-white ${isStartingContainer ? 'animate-spin' : ''
                      }`}></div>
                    <span>{isStartingContainer ? '启动中...' : '启动容器'}</span>
                  </div>
                  {!isStartingContainer && (
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-400 to-blue-500 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                  )}
                </button>
              ) : containerStatus === 'running' ? (
                <button
                  onClick={() => course?.id && stopContainer(course.id)}
                  className="group relative inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-red-500 to-red-600 rounded-lg shadow-lg shadow-red-500/25 hover:shadow-red-500/40 hover:from-red-600 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105 active:scale-95"
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-sm bg-white"></div>
                    <span>停止容器</span>
                  </div>
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-red-400 to-red-500 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {/* 主要内容区域 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <PanelGroup direction="horizontal">
          {/* 左侧内容面板 */}
          <Panel defaultSize={50} minSize={30}>
            <CourseContentPanel
              renderProgressBar={renderProgressBar}
              title={currentTitle}
              content={currentContent}
              renderMarkdown={renderMarkdown}
              currentStep={currentStep}
              stepsLength={course?.details.steps.length ?? 0}
              onPrev={goToPrevious}
              onNext={goToNext}
              canPrev={canGoPrevious()}
              canNext={canGoNext()}
              onExit={exitCourseAndNavigate}
            />
          </Panel>

          <PanelResizeHandle className="w-2 bg-gray-300 hover:bg-gray-400 transition-colors cursor-col-resize" />

          {/* 右侧终端面板 */}
          <Panel defaultSize={50} minSize={30}>
            <div className="h-full text-white flex flex-col" style={{ backgroundColor: '#0d1117' }}>
              {/* 终端内容区域 - 移除内边距，确保完全填充可用空间 */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-hidden">
                  <div
                    className="h-full overflow-y-auto terminal-scrollbar"
                  >
                    {!(course?.sqlTerminal) && (
                      <div className="h-full">
                        {(containerStatus === 'running' || containerStatus === 'starting' || isStartingContainer) ? (
                          <TerminalComponent
                            ref={terminalRef}
                            containerId={containerId}
                            containerStatus={containerStatus}
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-500">
                            请先启动容器
                          </div>
                        )}
                      </div>
                    )}
                    {course?.sqlTerminal && course?.backend?.port && course?.id && (
                      // 将容器状态传入 SQL 终端，驱动其自动连接/停止逻辑
                      <SqlTerminal ref={sqlTerminalRef} courseId={course.id} port={course.backend.port} containerStatus={containerStatus} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>

      {/* 确认对话框 */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        title="确认退出课程"
        message="返回课程列表将停止课程容器并丢失所有课程进度，确定要继续吗？"
        confirmText="确定退出"
        cancelText="取消"
        onConfirm={handleConfirmExit}
        onCancel={handleCancelExit}
        variant="warning"
      />

      {/* 端口冲突处理组件 */}
      {course?.id && course?.backend?.port && (
        <PortConflictHandler
          courseId={course.id}
          port={course.backend.port}
          isVisible={showPortConflictHandler}
          onClose={handlePortConflictClose}
          onRetry={handlePortConflictRetry}
          onSuccess={handlePortConflictSuccess}
        />
      )}
    </div>
  )
}

// 统一代码块渲染：提高对比度、简化视觉效果
const highlighterStyle: { [selector: string]: React.CSSProperties } = {
  ...(vs as unknown as { [selector: string]: React.CSSProperties }),
  'pre[class*="language-"]': {
    ...((vs as unknown as { [selector: string]: React.CSSProperties })['pre[class*="language-"]'] || {}),
    background: '#0b1020', // 更深背景以提升对比度
  },
  'code[class*="language-"]': {
    ...((vs as unknown as { [selector: string]: React.CSSProperties })['code[class*="language-"]'] || {}),
    textShadow: 'none', // 去除冗余阴影
  },
  '.token.comment,.token.prolog,.token.doctype,.token.cdata': {
    color: '#94a3b8', // 提升可读性
  },
  '.token.punctuation': {
    color: '#e5e7eb',
  },
  '.token.property,.token.tag,.token.constant,.token.symbol,.token.deleted': {
    color: '#93c5fd',
  },
  '.token.boolean,.token.number': {
    color: '#fdba74',
  },
  '.token.selector,.token.attr-name,.token.string,.token.char,.token.builtin,.token.inserted': {
    color: '#86efac',
  },
  '.token.operator,.token.entity,.token.url': {
    color: '#fca5a5',
  },
  '.token.atrule,.token.attr-value,.token.keyword': {
    color: '#60a5fa',
  },
  '.token.function,.token.class-name': {
    color: '#f9a8d4',
  },
}
