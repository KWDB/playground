import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Terminal, Database, Server } from 'lucide-react'
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import TerminalComponent, { TerminalRef } from '../components/Terminal';
import ConfirmDialog from '../components/ConfirmDialog';
import StatusIndicator, { StatusType } from '../components/StatusIndicator';
import 'highlight.js/styles/github.css';
import '../styles/markdown.css';

// 定义接口类型
interface CodeComponentProps {
  className?: string
  children: React.ReactNode
  [key: string]: unknown
}

interface Course {
  id: string
  title: string
  description: string
  details: {
    intro: { content: string }
    steps: Array<{ title: string; content: string }>
    finish: { content: string }
  }
}

export function Learn() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const [course, setCourse] = useState<Course | null>(null)
  const [currentStep, setCurrentStep] = useState(-1)
  const [activeTab, setActiveTab] = useState<'shell' | 'sql'>('shell')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false)
  const [containerId, setContainerId] = useState<string | null>(null)
  const [containerStatus, setContainerStatus] = useState<string>('stopped')
  const [isStartingContainer, setIsStartingContainer] = useState<boolean>(false)
  // 移除未使用的状态变量
  const terminalRef = useRef<TerminalRef>(null)
  
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

  const checkContainerStatus = useCallback(async (containerId: string) => {
    try {
      console.log('检查容器状态，容器ID:', containerId)
      const response = await fetch(`/api/containers/${containerId}/status`)
      if (!response.ok) {
        console.error('容器状态检查失败，HTTP状态:', response.status)
        throw new Error(`获取容器状态失败: ${response.status}`)
      }
      const data = await response.json()
      console.log('容器状态检查结果:', data)
      setContainerStatus(data.status)
      return data
    } catch (err) {
      console.error('获取容器状态失败:', err)
      // 网络错误时不要设置容器状态为error，保持当前状态
      return null
    }
  }, [])

  // 简化的WebSocket连接处理
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
      const waitForContainerReady = async (containerId: string, maxRetries = 10, retryInterval = 2000) => {
        for (let i = 0; i < maxRetries; i++) {
          console.log(`第 ${i + 1} 次检查容器状态...`)
          
          // 等待一段时间再检查，给容器启动时间
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, retryInterval))
          }
          
          const statusData = await checkContainerStatus(containerId)
          if (statusData && statusData.status === 'running') {
            console.log('容器已完全启动，状态:', statusData.status)
            setContainerStatus('running')
            
            // 容器启动完成后连接终端
            setTimeout(() => {
              connectToTerminal(containerId)
            }, 500)
            
            return true
          } else if (statusData && (statusData.status === 'exited' || statusData.status === 'error')) {
            console.error('容器启动失败，状态:', statusData.status)
            throw new Error(`容器启动失败，状态: ${statusData.status}`)
          }
          
          console.log(`容器状态: ${statusData?.status || '未知'}，继续等待...`)
        }
        
        throw new Error('容器启动超时，请重试')
      }
      
      // 等待容器完全启动
      await waitForContainerReady(data.containerId)
      
    } catch (error) {
      console.error('启动容器失败:', error)
      setError(error instanceof Error ? error.message : '启动容器失败')
      setContainerStatus('error')
      setConnectionError('容器启动失败，无法建立连接')
    } finally {
      setIsStartingContainer(false)
    }
  }, [containerStatus, isStartingContainer, checkContainerStatus, connectToTerminal])

  const stopContainer = useCallback(async (courseId: string) => {
    console.log('停止容器请求开始，课程ID:', courseId)
    console.log('请求URL:', `/api/courses/${courseId}/stop`)
    
    try {
      // 立即设置容器状态为停止中，提供即时UI反馈
      setContainerStatus('stopping')
      
      const response = await fetch(`/api/courses/${courseId}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      console.log('停止容器响应状态:', response.status)
      console.log('停止容器响应URL:', response.url)
      
      if (!response.ok) {
        const errorText = await response.text()
        // 如果是404错误，说明容器已经不存在，这是正常情况
        if (response.status === 404) {
          console.log('容器已不存在，停止操作完成:', errorText)
          setContainerStatus('stopped')
      setIsConnected(false)
      setConnectionError(null)
          return // 正常返回，不抛出异常
        }
        console.error('停止容器失败，响应内容:', errorText)
        throw new Error(`停止容器失败: ${response.status} ${errorText}`)
      }
      
      const result = await response.json()
      console.log('停止容器成功，响应:', result)
      
      setContainerStatus('stopped')
      setIsConnected(false)
      setConnectionError(null)
      
    } catch (error) {
      console.error('停止容器异常:', error)
      setError(error instanceof Error ? error.message : '停止容器失败')
    }
  }, [])

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

  useEffect(() => {
    return () => {
      // 组件卸载时停止容器
      if (courseId && containerStatus === 'running') {
        stopContainer(courseId)
      }
    }
  }, [courseId, containerStatus, stopContainer])






















  




  





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

  // 预处理Markdown内容，处理{{exec}}标记 - 极简高效设计
  const preprocessMarkdown = (content: string) => {
    return content.replace(/`([^`]+)`{{exec}}/g, (match, command) => {
      return `<code class="inline-code-exec">${command}</code><button class="exec-btn" data-command="${command}" title="执行命令">Run</button>`
    })
  }

  // 处理执行按钮点击事件
  const handleExecButtonClick = useCallback((e: React.MouseEvent) => {
    const button = (e.target as HTMLElement).closest('.exec-btn') as HTMLElement
    if (button) {
      const command = button.getAttribute('data-command')
      if (command && containerId && containerStatus === 'running') {
        // 通过Terminal组件的ref发送命令
        if (terminalRef.current) {
          terminalRef.current.sendCommand(command)
        } else {
          console.warn('Terminal组件未准备就绪')
        }
      } else if (containerStatus !== 'running') {
        alert('请先启动容器后再执行命令')
      }
    }
  }, [containerId, containerStatus])

  const renderMarkdown = (content: string) => {
    const processedContent = preprocessMarkdown(content)
    
    return (
      <div onClick={handleExecButtonClick} className="markdown-container">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight, rehypeRaw]}
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
            code: ({ className, children, ...props }: CodeComponentProps) => {
              const match = /language-(\w+)/.exec(className || '')
              return match ? (
                // 代码块渲染
                <div className="markdown-code-block">
                  <div className="markdown-code-header">
                    <div className="flex items-center space-x-2">
                      <div className="markdown-code-dots">
                        <div className="markdown-code-dot markdown-code-dot--red"></div>
                        <div className="markdown-code-dot markdown-code-dot--yellow"></div>
                        <div className="markdown-code-dot markdown-code-dot--green"></div>
                      </div>
                      <span className="markdown-code-language">{match[1]}</span>
                    </div>
                    <div className="markdown-code-title">代码块</div>
                  </div>
                  <div className="markdown-code-content">
                    <SyntaxHighlighter
                      style={tomorrow}
                      language={match[1]}
                      PreTag="div"
                      className="markdown-syntax-highlighter"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                    <button 
                      className="markdown-copy-btn"
                      onClick={() => navigator.clipboard?.writeText(String(children))}
                      title="复制代码"
                    >
                      复制
                    </button>
                  </div>
                </div>
              ) : (
                // 内联代码渲染
                <code className={`markdown-inline-code ${className || ''}`} {...props}>
                  {children}
                </code>
              )
            }
          }}
        >
          {processedContent}
        </ReactMarkdown>
      </div>
    )
  }

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
          {/* 极简进度指示器 */}
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
            <div className="font-medium">
              {currentStep + 2} / {steps.length}
            </div>
          </div>
          
          {/* 极简进度线 */}
          <div className="flex-1 relative">
            <div className="h-0.5 bg-gray-100 rounded-full"></div>
            <div 
              className="absolute top-0 left-0 h-0.5 bg-blue-500 rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${(Math.max(0, currentStep + 1) / (steps.length - 1)) * 100}%`
              }}
            ></div>
          </div>
          
          {/* 极简步骤导航 */}
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
                  className={`group relative w-2 h-2 rounded-full transition-all duration-200 ${
                    isCompleted
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

  // 简化的退出课程函数
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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">错误: {error || '课程未找到'}</div>
          <Link to="/courses" className="text-blue-600 hover:text-blue-800">
            返回课程列表
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
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
                  <div className={`flex items-center space-x-2 ${
                    isStartingContainer ? 'animate-pulse' : ''
                  }`}>
                    <div className={`w-2 h-2 rounded-full bg-white ${
                      isStartingContainer ? 'animate-spin' : ''
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
      <div className="flex-1">
        <PanelGroup direction="horizontal">
          {/* 左侧内容面板 */}
          <Panel defaultSize={50} minSize={30}>
            <div className="h-full bg-white border-r border-gray-200 flex flex-col">
              {/* 课程进度条 - 合并到内容区域 */}
              {renderProgressBar()}
              
              {/* 内容标题 */}
              <div className="p-3 lg:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                <h2 className="text-lg lg:text-xl font-semibold text-gray-800">
                  {getCurrentTitle()}
                </h2>
              </div>

              {/* 内容区域 - 极简高效代码块显示 */}
              <div className="markdown-main-content">
                <div className="markdown-content-wrapper">
                  <div className="markdown-prose">
                    {renderMarkdown(getCurrentContent())}
                  </div>
                </div>
              </div>

              {/* 导航按钮 */}
              <div className="p-4 border-t border-gray-200 flex justify-between">
                {currentStep >= course.details.steps.length ? (
                  // 课程完成页面显示退出按钮
                  <>
                    <button
                      onClick={goToPrevious}
                      disabled={!canGoPrevious()}
                      className="group relative inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-gray-500 rounded-lg shadow-md shadow-gray-500/20 hover:bg-gray-600 hover:shadow-gray-500/30 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none transition-all duration-300 transform active:scale-95"
                    >
                      上一步
                    </button>
                    <div className="flex items-center text-gray-600 text-sm font-medium">
                      完成
                    </div>
                    <button
                      onClick={exitCourseAndNavigate}
                      className="group relative inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-red-500 to-red-600 rounded-lg shadow-lg shadow-red-500/25 hover:from-red-600 hover:to-red-700 hover:shadow-red-500/40 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-300 transform active:scale-95 space-x-2"
                    >
                      <span>退出课程</span>
                    </button>
                  </>
                ) : (
                  // 正常导航按钮
                  <>
                    <button
                      onClick={goToPrevious}
                      disabled={!canGoPrevious()}
                      className="group relative inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-gray-500 rounded-lg shadow-md shadow-gray-500/20 hover:bg-gray-600 hover:shadow-gray-500/30 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none transition-all duration-300 transform active:scale-95"
                    >
                      上一步
                    </button>
                    <div className="flex items-center text-gray-600 text-sm font-medium">
                      {currentStep === -1 ? '介绍' : 
                       `步骤 ${currentStep + 1}/${course.details.steps.length}`}
                    </div>
                    <button
                      onClick={goToNext}
                      disabled={!canGoNext()}
                      className="group relative inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700 hover:shadow-blue-500/40 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none transition-all duration-300 transform active:scale-95"
                    >
                      下一步
                    </button>
                  </>
                )}
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="w-2 bg-gray-300 hover:bg-gray-400 transition-colors cursor-col-resize" />

          {/* 右侧终端面板 */}
          <Panel defaultSize={50} minSize={30}>
            <div className="h-full text-white flex flex-col" style={{ backgroundColor: '#0d1117' }}>
              {/* 终端标签页 - 现代化设计 */}
              <div className="flex flex-wrap gap-2 p-3 border-b border-gray-700/50" style={{ backgroundColor: '#161b22' }}>
                <button
                  onClick={() => setActiveTab('shell')}
                  className={`px-3 lg:px-4 py-2 lg:py-2.5 flex items-center space-x-1.5 text-sm font-medium rounded-lg transition-all duration-300 transform hover:scale-105 active:scale-95 ${
                    activeTab === 'shell'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 border border-emerald-400/30'
                      : 'bg-gray-800/60 text-gray-300 hover:bg-gray-700/80 hover:text-white border border-gray-600/50 backdrop-blur-sm'
                  }`}
                >
                  <Terminal className="h-4 w-4" />
                  <span className="hidden sm:inline font-semibold">Shell</span>
                </button>
                <button
                  onClick={() => setActiveTab('sql')}
                  className={`px-3 lg:px-4 py-2 lg:py-2.5 flex items-center space-x-1.5 text-sm font-medium rounded-lg transition-all duration-300 transform hover:scale-105 active:scale-95 ${
                    activeTab === 'sql'
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 border border-blue-400/30'
                      : 'bg-gray-800/60 text-gray-300 hover:bg-gray-700/80 hover:text-white border border-gray-600/50 backdrop-blur-sm'
                  }`}
                >
                  <Database className="h-4 w-4" />
                  <span className="hidden sm:inline font-semibold">SQL</span>
                </button>
              </div>



              {/* 终端内容区域 - 优化滚动和布局 */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 p-4 overflow-hidden">
                  <div 
                    className="h-full max-h-[calc(100vh-200px)] overflow-y-auto terminal-scrollbar"
                  >
                    {activeTab === 'shell' && (
                      <div className="h-full">
                        {containerId && containerStatus === 'running' ? (
                          <TerminalComponent ref={terminalRef} containerId={containerId} />
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-500">
                            {containerStatus === 'starting' ? '容器启动中...' : '请先启动容器'}
                          </div>
                        )}
                      </div>
                    )}
                    {activeTab === 'sql' && (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        <div className="text-center">
                          <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p className="text-sm">SQL 终端功能开发中...</p>
                        </div>
                      </div>
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
    </div>
  )
}