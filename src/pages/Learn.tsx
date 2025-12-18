import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Server, ImageIcon } from 'lucide-react'
import SqlTerminal, { SqlTerminalRef } from '../components/business/SqlTerminal'
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import TerminalComponent, { TerminalRef } from '../components/business/Terminal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import StatusIndicator, { StatusType } from '../components/ui/StatusIndicator';
import CourseContentPanel from '../components/business/CourseContentPanel';
import PortConflictHandler from '../components/business/PortConflictHandler';
import { ImageSelector } from '../components/business/ImageSelector';
import '../styles/markdown.css';
import { ContainerInfo } from '../types/container';

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
  backend?: { 
    port?: number
    imageid?: string
  }
}

// 更严格的容器状态类型
type ContainerStatus = 'stopped' | 'starting' | 'running' | 'exited' | 'error' | 'completed' | 'stopping'

// 接口响应类型
interface ContainerStatusResponse { status: ContainerStatus; exitCode?: number }
// interface StartCourseResponse { containerId: string } // 暂未使用，移除以避免未使用警告

import { fetchJson } from '../lib/http'
 
 export function Learn() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const [course, setCourse] = useState<Course | null>(null)
  const [currentStep, setCurrentStep] = useState(-1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false)
  const [containerId, setContainerId] = useState<string | null>(null)
  const [containerStatus, setContainerStatus] = useState<ContainerStatus>('stopped')
  const [isStartingContainer, setIsStartingContainer] = useState<boolean>(false)
  const terminalRef = useRef<TerminalRef>(null)
  const sqlTerminalRef = useRef<SqlTerminalRef>(null)

  // 端口冲突处理相关状态
  const [showPortConflictHandler, setShowPortConflictHandler] = useState<boolean>(false)

  // 镜像选择器相关状态
  const [showImageSelector, setShowImageSelector] = useState<boolean>(false)
  const [selectedImage, setSelectedImage] = useState<string>('')
  const [selectedImageSourceId, setSelectedImageSourceId] = useState<string>('')

  useEffect(() => {
    const savedSourceId = localStorage.getItem('imageSourceId')?.trim()
    if (savedSourceId) {
      setSelectedImageSourceId(savedSourceId)
    }

    const savedImage = localStorage.getItem('selectedImageFullName')?.trim()
    if (savedImage) {
      setSelectedImage(savedImage)
    }
  }, [])

  const effectiveImage = useMemo(() => {
    const v = selectedImage.trim()
    if (v) return v
    return course?.backend?.imageid || 'kwdb/kwdb:latest'
  }, [course?.backend?.imageid, selectedImage])

  const imageSourceLabel = useMemo(() => {
    const id = selectedImageSourceId.trim()
    if (id === 'ghcr') return 'ghcr.io'
    if (id === 'aliyun') return 'Aliyun ACR'
    if (id === 'custom') return 'Custom'
    if (id === 'docker-hub') return 'Docker Hub'

    const img = effectiveImage.trim()
    const first = img.split('/')[0] || ''
    const hasRegistry = first === 'localhost' || first.includes('.') || first.includes(':')
    if (first === 'ghcr.io') return 'ghcr.io'
    if (first === 'registry.cn-hangzhou.aliyuncs.com') return 'Aliyun ACR'
    if (hasRegistry) return 'Custom'
    return 'Docker Hub'
  }, [effectiveImage, selectedImageSourceId])

  // 确认弹窗模式：区分来源以动态文案
  const [confirmDialogMode, setConfirmDialogMode] = useState<'back' | 'exit'>('back')
  const statusCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const statusAbortControllerRef = useRef<AbortController | null>(null)
  const startAbortControllerRef = useRef<AbortController | null>(null)

  // 简化状态管理（使用 ref 避免不必要的渲染）
  const isConnectedRef = useRef(false)
  const connectionErrorRef = useRef<string | null>(null)
  // 终端生命周期动作守卫：用于避免停止后被异步状态错误回滚为 running
  const lastActionRef = useRef<'idle' | 'start' | 'stop'>('idle')
  const isStoppingRef = useRef<boolean>(false)

  // 监听容器状态变化，当容器停止时清除连接错误
  useEffect(() => {
    if (containerStatus === 'stopped' || containerStatus === 'exited') {
      connectionErrorRef.current = null
      console.log('容器已停止，清除连接错误状态')
    }
  }, [containerStatus])

  const checkContainerStatus = useCallback(async (id: string, shouldUpdateState = true, signal?: AbortSignal) => {
    try {
      console.log(`开始检查容器状态，容器ID: ${id}`)
      const data = await fetchJson<ContainerStatusResponse>(`/api/containers/${id}/status`, { signal })
      console.log('容器状态检查结果:', data)

      if (shouldUpdateState) {
        // 使用 Ref 获取最新状态，避免闭包问题
        const currentStatus = containerStatusRef.current
        const newStatus = data.status
        if (currentStatus !== newStatus) {
          console.log(`容器状态发生变化: ${currentStatus} -> ${newStatus}`)
        }
        if (newStatus === 'running' && currentStatus === 'starting') {
          console.log('容器启动完成，状态同步为running')
        } else if (newStatus === 'exited' && (currentStatus === 'running' || currentStatus === 'starting')) {
          console.warn('检测到容器意外退出，状态不一致')
        }
        setContainerStatus(newStatus)
      }
      return data
    } catch (err) {
      console.error('获取容器状态失败:', err)
      return null
    }
  }, [])

  // WebSocket 连接处理
  const connectToTerminal = useCallback((id: string) => {
    if (!id) {
      connectionErrorRef.current = '容器ID为空'
      return
    }
    if (containerStatus !== 'running') {
      connectionErrorRef.current = '容器未运行'
      return
    }
    isConnectedRef.current = true
    connectionErrorRef.current = null
  }, [containerStatus])

  // 定期状态检查机制
  const startStatusMonitoring = useCallback((id: string) => {
    if (statusCheckIntervalRef.current) {
      clearInterval(statusCheckIntervalRef.current)
    }
    console.log('开始定期状态监控，容器ID:', id)
    statusCheckIntervalRef.current = setInterval(async () => {
      try {
        // 取消上一轮未完成的请求，避免堆积
        statusAbortControllerRef.current?.abort()

        const controller = new AbortController()
        statusAbortControllerRef.current = controller
        const statusData = await checkContainerStatus(id, false, controller.signal)
        if (statusData) {
           // 使用 Ref 获取最新状态，避免闭包问题
           const currentStatus = containerStatusRef.current
           const actualStatus = statusData.status
           if (currentStatus !== actualStatus) {
             console.warn(`检测到状态不一致: 前端状态=${currentStatus}, 实际状态=${actualStatus}`)
              // 停止流程中的竞态守卫：在 stop 过程中忽略后端短暂返回的 running/starting，避免 UI 被误回滚
              const inStopPhase = lastActionRef.current === 'stop' || isStoppingRef.current
              if (inStopPhase && (actualStatus === 'running' || actualStatus === 'starting')) {
                console.log('处于停止流程，忽略后端短暂返回的运行中/启动中状态')
                return
              }
              if (actualStatus === 'exited' && currentStatus === 'running') {
                console.log('容器意外退出，更新前端状态')
                setContainerStatus('stopped')
                isConnectedRef.current = false
                connectionErrorRef.current = '容器已停止运行'
              } else if (actualStatus === 'running' && currentStatus === 'stopped') {
                // 仅当最近动作为 start 时，才提升为 running，防止 stop 后被误提升
                if (lastActionRef.current === 'start') {
                  console.log('检测到容器已启动（start流程），更新前端状态为 running')
                  setContainerStatus('running')
                  isConnectedRef.current = true
                  connectionErrorRef.current = null
                } else {
                  console.log('最近动作为 stop，忽略提升为 running')
                }
              } else {
                setContainerStatus(actualStatus)
              }
           }
         }
      } catch (error) {
        console.error('定期状态检查失败:', error)
      }
    }, STATUS_CHECK_INTERVAL_MS)
  }, [checkContainerStatus])

  const startCourseContainer = useCallback(async (courseId: string) => {
    // 防重复调用：检查当前状态，避免重复启动
    if (isStartingContainer || containerStatus === 'running' || containerStatus === 'starting') {
      console.log('容器已在启动中或运行中，跳过重复启动请求')
      return
    }
    // 标记最近动作为 start，清除停止标记，避免监控误回滚
    lastActionRef.current = 'start'
    isStoppingRef.current = false

    setIsStartingContainer(true)
    setContainerStatus('starting')
    setError(null) // 清除之前的错误信息
    connectionErrorRef.current = null // 清除连接错误

    try {
      startAbortControllerRef.current?.abort()
      const controller = new AbortController()
      startAbortControllerRef.current = controller
      
      // 准备请求体，包含可选的镜像参数
      const requestBody = selectedImage ? { image: selectedImage } : {}
      
      const data = await fetchJson<{ containerId: string }>(
        `/api/courses/${courseId}/start`, 
        { 
          method: 'POST', 
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
          },
          body: Object.keys(requestBody).length > 0 ? JSON.stringify(requestBody) : undefined,
        }
      )
      console.log('容器启动成功，响应数据:', data)

      setContainerId(data.containerId)

      // 等待容器完全启动的函数
      const waitForContainerReady = async (
        containerId: string,
        maxRetries = WAIT_RETRY_MAX,
        retryInterval = WAIT_RETRY_INTERVAL_MS,
        signal?: AbortSignal
      ) => {
        console.log(`开始等待容器启动，最大重试次数: ${maxRetries}，检查间隔: ${retryInterval}ms`);

        for (let i = 0; i < maxRetries; i++) {
          console.log(`第 ${i + 1}/${maxRetries} 次检查容器状态...`)

          // 等待一段时间再检查，给容器启动时间
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, retryInterval))
          }

          const statusData = await checkContainerStatus(containerId, true, signal)

          if (statusData && statusData.status === 'running') {
            console.log('✅ 容器已完全启动，状态验证通过:', statusData.status)

            // 额外验证：再次确认容器确实在运行
            await new Promise(resolve => setTimeout(resolve, 1000));
            const finalCheck = await checkContainerStatus(containerId, false, signal);

      if (finalCheck && finalCheck.status === 'running') {
              // 关键守卫：如果在启动完成前用户已点击“停止”，避免将状态回滚为 running
              if (lastActionRef.current === 'stop' || isStoppingRef.current) {
                console.warn('已进入停止流程，忽略启动完成后的状态提升与连接动作');
                return false
              }
              console.log('✅ 容器状态最终验证通过，准备连接终端');
              setContainerStatus('running');

              // 启动状态监控（仅在未处于停止流程时）
              startStatusMonitoring(containerId);

              // 容器启动完成后连接终端（增加守卫，避免竞态）
              setTimeout(() => {
                if (lastActionRef.current !== 'stop' && !isStoppingRef.current) {
                  connectToTerminal(containerId)
                } else {
                  console.log('停止流程已触发，跳过终端连接')
                }
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
      await waitForContainerReady(data.containerId, undefined, undefined, startAbortControllerRef.current?.signal)

    } catch (error) {
      const maybeAbort = error as { name?: string }
      if (maybeAbort?.name === 'AbortError') {
        console.log('启动流程已取消')
        return
      }
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
        connectionErrorRef.current = '容器启动失败，无法建立连接'
      }
    } finally {
      setIsStartingContainer(false)
    }
  }, [containerStatus, isStartingContainer, checkContainerStatus, connectToTerminal, startStatusMonitoring, selectedImage])

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
    connectionErrorRef.current = null
  }, [])

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
      // 标记最近动作为 stop，并进入停止守卫阶段
      lastActionRef.current = 'stop'
      isStoppingRef.current = true
      // 若仍处于“启动中”视觉状态，立即复位，避免 UI 继续显示终端
      setIsStartingContainer(false)
      // 立即设置容器状态为停止中，提供即时UI反馈
      setContainerStatus('stopping')

      // 立即停止状态监控，防止在停止过程中轮询导致的状态竞争
      if (statusCheckIntervalRef.current) {
        console.log('停止流程开始，暂停定期状态监控')
        clearInterval(statusCheckIntervalRef.current)
        statusCheckIntervalRef.current = null
      }
      // 同时也取消正在进行的任何状态检查请求
      if (statusAbortControllerRef.current) {
        statusAbortControllerRef.current.abort()
        statusAbortControllerRef.current = null
      }

      // 优先按容器ID停止，确保仅影响当前页面实例
      if (containerId) {
        const url = `/api/containers/${containerId}/stop`
        console.log('按容器ID停止，URL:', url)
        try {
          await fetchJson<void>(url, { method: 'POST' })
        } catch (err) {
          const msg = err instanceof Error ? err.message : ''
          if (msg.includes('404')) {
            console.log('容器已不存在，视为成功停止')
          } else {
            throw err
          }
        }
      } else {
        // 回退：没有 containerId 时按课程ID停止（可能会停止同课程的其他页面容器，尽量避免）
        const fallbackUrl = `/api/courses/${courseId}/stop`
        console.log('缺少容器ID，回退按课程ID停止，URL:', fallbackUrl)
        try {
          await fetchJson<void>(fallbackUrl, { method: 'POST' })
        } catch (err) {
          const msg = err instanceof Error ? err.message : ''
          if (!msg.includes('404')) {
            throw err
          }
        }
      }

      // 成功后的状态更新
      setContainerStatus('stopped')
      isConnectedRef.current = false
      connectionErrorRef.current = null
      setContainerId(null)
      // 退出停止守卫阶段（此后如有新启动，允许监控提升状态）
      isStoppingRef.current = false

      // 再次确认停止状态监控（双重保险）
      if (statusCheckIntervalRef.current) {
        console.log('停止定期状态监控')
        clearInterval(statusCheckIntervalRef.current)
        statusCheckIntervalRef.current = null
      }
      if (statusAbortControllerRef.current) {
        statusAbortControllerRef.current.abort()
        statusAbortControllerRef.current = null
      }
      if (startAbortControllerRef.current) {
        startAbortControllerRef.current.abort()
        startAbortControllerRef.current = null
      }

    } catch (error) {
      console.error('停止容器异常:', error)
      setError(error instanceof Error ? error.message : '停止容器失败')
      // 发生错误时，将状态设置为 error，以便用户可以重试或看到错误提示，而不是卡在 stopping
      setContainerStatus('error')
      isStoppingRef.current = false
    }
  }, [containerId])

  const fetchCourse = useCallback(async (id: string, signal?: AbortSignal) => {
    try {
      const data = await fetchJson<{ course: Course }>(`/api/courses/${id}`, { signal })
      setCourse(data.course)
    } catch (err) {
      const maybeAbortError = err as { name?: string }
      if (maybeAbortError?.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])



  // 检查当前课程是否有运行中的容器
  const checkExistingContainer = useCallback(async (currentCourseId: string, signal?: AbortSignal) => {
    try {
      const containers = await fetchJson<ContainerInfo[]>('/api/containers', { signal })
      const existingContainer = containers.find(c => c.courseId === currentCourseId && c.state === 'running')
      
      if (existingContainer) {
        console.log('发现已有运行中容器，自动连接:', existingContainer)
        setContainerId(existingContainer.id)
        setContainerStatus('running')
        // 标记为非启动状态，避免触发启动动画
        setIsStartingContainer(false)

        // 确保 lastAction 状态正确，允许监控提升状态
        lastActionRef.current = 'start'
        isStoppingRef.current = false
        
        // 恢复连接和监控
        isConnectedRef.current = true
        connectionErrorRef.current = null
        
        // 启动状态监控
        startStatusMonitoring(existingContainer.id)
      }
    } catch (err) {
      console.error('检查已有容器失败:', err)
    }
  }, [startStatusMonitoring])

  useEffect(() => {
    if (!courseId) return
    const controller = new AbortController()
    
    // 并行获取课程信息和容器状态
    fetchCourse(courseId, controller.signal)
    checkExistingContainer(courseId, controller.signal)
    
    return () => controller.abort()
  }, [courseId, fetchCourse, checkExistingContainer])

  useEffect(() => {
    return () => {
      // 组件卸载时优先按容器ID停止（使用ref避免闭包问题）
      const id = containerIdRef.current

      // 清理定期状态监控定时器，避免内存泄漏或卸载后仍然轮询
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current)
        statusCheckIntervalRef.current = null
      }
      // 取消正在进行的状态检查请求
      if (statusAbortControllerRef.current) {
        statusAbortControllerRef.current.abort()
        statusAbortControllerRef.current = null
      }
      if (startAbortControllerRef.current) {
        startAbortControllerRef.current.abort()
        startAbortControllerRef.current = null
      }

      if (id) {
        console.log('组件卸载：按容器ID停止容器，containerId:', id)
        fetchJson<void>(`/api/containers/${id}/stop`, { method: 'POST' }).catch(error => {
          console.error('组件卸载时按容器ID停止容器失败:', error)
        })
      } else if (courseIdRef.current) {
        // 回退逻辑：缺少容器ID时按课程ID停止
        console.log('组件卸载：按课程ID停止容器，课程ID:', courseIdRef.current)
        fetchJson<void>(`/api/courses/${courseIdRef.current}/stop`, { method: 'POST' }).catch(error => {
          console.error('组件卸载时按课程ID停止容器失败:', error)
        })
      }
      // 清空容器ID，避免卸载后残留导致重连
      setContainerId(null)
    }
  }, [])

  // Helper functions for navigation
  // 使用 useMemo 缓存当前标题与内容，避免无关渲染
  const currentTitle = useMemo(() => {
    if (currentStep === -1) return '课程介绍'
    if (currentStep >= course?.details.steps.length) return '课程完成'
    return course?.details.steps[currentStep]?.title || ''
  }, [course, currentStep])

  const currentContent = useMemo(() => {
    if (currentStep === -1) return course?.details.intro.content || ''
    if (currentStep >= course?.details.steps.length) return course?.details.finish.content || ''
    return course?.details.steps[currentStep]?.content || ''
  }, [course, currentStep])

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
  const preprocessMarkdown = useCallback((content: string) => {
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
    // 3) 修复行内代码 `cmd`{{exec}} 注入：将命令安全编码，避免属性值中引号等字符破坏 HTML
    //   - data-command-enc 使用 encodeURIComponent 编码的命令
    //   - 文本节点使用基本的 HTML 转义以防止出现尖括号等特殊字符
    return withExecMeta.replace(/`([^`]+)`\s*\{\{\s*exec\s*\}\}/g, (match, rawCmd) => {
      const cmd = String(rawCmd)
      // HTML 文本节点转义（避免 < > & 影响渲染）
      const escapedText = cmd
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      // 属性值采用 URL 编码，避免引号、括号等字符破坏属性边界
      const encoded = encodeURIComponent(cmd)
      // 注入可执行内联代码与按钮（rehype-raw 允许解析为真实 HTML）
      return `<code class="inline-code-exec">${escapedText}</code><button class="exec-btn" data-command-enc="${encoded}" title="执行命令">Run</button>`
    })
  }, [])

  // 处理执行按钮点击事件
  const handleExecButtonClick = useCallback((e: React.MouseEvent) => {
    const button = (e.target as HTMLElement).closest('.exec-btn') as HTMLElement
    if (button) {
      // 优先使用编码的命令，避免 data-attr 中的引号导致解析错误
      let command = button.getAttribute('data-command')
      const encoded = button.getAttribute('data-command-enc')
      if (!command && encoded) {
        try {
          command = decodeURIComponent(encoded)
        } catch {
          // 回退：如果解码失败则直接使用原值
          command = encoded
        }
      }
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
            // 针对 kwbase 后台启动命令的特殊处理：
            // 当使用 --background 启动时，Shell 会立即返回并显示提示符，但后台进程仍在输出日志，
            // 导致提示符出现在日志中间。追加 sleep 延时可让 Shell 等待日志输出完毕后再显示提示符。
            let finalCommand = command;
            // 简单的启发式检测：包含 kwbase 且包含 --background
            if (command.includes('kwbase') && command.includes('--background')) {
               // 追加 sleep 2，给后台进程留出日志输出时间
               finalCommand = `${command}; sleep 2`;
            }
            terminalRef.current.sendCommand(finalCommand)
            terminalRef.current.focus()
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
  }, [handleExecButtonClick, preprocessMarkdown, extractTextFromNode, readNodeMeta])

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
  // const exitCourseAndNavigate = async () => {
  //   await exitCourse()
  //   navigate('/courses')
  // }

  // 处理返回按钮点击事件，显示确认对话框
  const handleBackClick = () => {
    setConfirmDialogMode('back')
    setShowConfirmDialog(true)
  }

  // 处理“退出课程”按钮点击事件，复用返回逻辑但更简短提示
  const handleExitClick = () => {
    setConfirmDialogMode('exit')
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
              {/* 镜像选择器按钮 - 仅在容器停止时显示 */}
              {(containerStatus === 'stopped' || containerStatus === 'error' || containerStatus === 'exited' || containerStatus === 'completed') && (
                <button
                  onClick={() => setShowImageSelector(true)}
                  className="group relative inline-flex items-center justify-center px-3 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
                  title={`镜像源：${imageSourceLabel}（${effectiveImage}）`}
                >
                  <ImageIcon className="w-4 h-4" />
                  <span className="hidden sm:inline ml-2">镜像源</span>
                  <span className="ml-2 inline-block rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600 max-w-40 truncate align-middle">
                    {imageSourceLabel}
                  </span>
                </button>
              )}
              
              {containerStatus === 'stopped' || containerStatus === 'error' || containerStatus === 'exited' || containerStatus === 'completed' ? (
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
              ) : containerStatus === 'running' || containerStatus === 'stopping' ? (
                <button
                  onClick={() => course?.id && stopContainer(course.id)}
                  disabled={containerStatus === 'stopping'}
                  className={`group relative inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-red-500 to-red-600 rounded-lg shadow-lg shadow-red-500/25 hover:shadow-red-500/40 hover:from-red-600 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-300 transform ${containerStatus === 'stopping' ? 'opacity-75 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
                >
                  <div className="flex items-center space-x-2">
                    {containerStatus === 'stopping' ? (
                      <div className="w-2 h-2 rounded-full bg-white animate-spin"></div>
                    ) : (
                      <div className="w-2 h-2 rounded-sm bg-white"></div>
                    )}
                    <span>{containerStatus === 'stopping' ? '停止中...' : '停止容器'}</span>
                  </div>
                  {containerStatus !== 'stopping' && (
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-red-400 to-red-500 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                  )}
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
              onExit={handleExitClick}
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
        message={confirmDialogMode === 'exit' ? '确认要退出当前课程吗？' : '返回课程列表将停止课程容器并丢失所有课程进度，确定要继续吗？'}
        confirmText={confirmDialogMode === 'exit' ? '确定' : '确定退出'}
        cancelText="取消"
        onConfirm={handleConfirmExit}
        onCancel={handleCancelExit}
        variant="warning"
      />

      {/* 端口冲突处理组件 */}
      {course?.id && course?.backend?.port != null && (
        <PortConflictHandler
          courseId={course.id}
          port={course.backend.port}
          isVisible={showPortConflictHandler}
          onClose={handlePortConflictClose}
          onRetry={handlePortConflictRetry}
          onSuccess={handlePortConflictSuccess}
        />
      )}

      {/* 镜像选择器组件 */}
      {course?.id && (
        <ImageSelector
          defaultImage={course?.backend?.imageid || 'kwdb/kwdb:latest'}
          onImageSelect={(image) => {
            setSelectedImage(image)
            setSelectedImageSourceId(localStorage.getItem('imageSourceId')?.trim() || '')
          }}
          isOpen={showImageSelector}
          onClose={() => setShowImageSelector(false)}
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

// 统一的时间与重试常量
const STATUS_CHECK_INTERVAL_MS = 30000
const WAIT_RETRY_MAX = 15
const WAIT_RETRY_INTERVAL_MS = 1500
