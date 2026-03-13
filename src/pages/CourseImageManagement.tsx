import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, DatabaseZap, Download, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { TourTooltip } from '@/components/ui/TourTooltip'
import { api } from '@/lib/api/client'
import type {
  Course,
  CourseImageDiagnosticResult,
  LocalImageCleanupItem,
  PreloadCourseImageResult,
} from '@/lib/api/types'
import { cn } from '@/lib/utils'
import { getStepsForPage, getTotalSteps } from '@/config/tourSteps'
import { useTourStore } from '@/store/tourStore'

type SectionError = {
  preload: string
  diagnostics: string
}
type ManagementTab = 'preload' | 'cleanup' | 'diagnostics'
type FeedbackTone = 'success' | 'warning' | 'error' | 'info'

type SectionFeedbackItem = {
  tone: FeedbackTone
  message: string
}

type SectionFeedback = {
  preload: SectionFeedbackItem | null
  diagnostics: SectionFeedbackItem | null
}

type CleanupCourseBrief = {
  id: string
  title: string
}

type ImageSourceOption = {
  id: string
  name: string
  prefix: string
  description: string
  example: string
}

const DEFAULT_IMAGE = 'kwdb/kwdb:latest'
const TAB_ORDER: ManagementTab[] = ['preload', 'cleanup', 'diagnostics']

function buildImageWithSource(originImageName: string, sourcePrefix: string) {
  const imageName = originImageName.trim()
  if (!sourcePrefix.trim()) {
    return imageName
  }
  const firstSegment = imageName.split('/')[0]
  const hasRegistryPrefix =
    imageName.includes('/') && (firstSegment.includes('.') || firstSegment.includes(':') || firstSegment === 'localhost')
  const normalizedPrefix = sourcePrefix.endsWith('/') ? sourcePrefix : `${sourcePrefix}/`
  if (hasRegistryPrefix) {
    const [, ...rest] = imageName.split('/')
    return `${normalizedPrefix}${rest.join('/')}`
  }
  return `${normalizedPrefix}${imageName}`
}

export function CourseImageManagement() {
  const {
    seenPages,
    startTour,
    nextStep,
    prevStep,
    skipTour,
    currentPage,
    currentStep,
    isActive,
    hasHydrated,
  } = useTourStore()
  const hasCheckedTour = useRef(false)
  const [courses, setCourses] = useState<Course[]>([])
  const [diagnostics, setDiagnostics] = useState<CourseImageDiagnosticResult[]>([])
  const [imageSources, setImageSources] = useState<ImageSourceOption[]>([])
  const [selectedSourceId, setSelectedSourceId] = useState('docker-hub')
  const [customSourcePrefix, setCustomSourcePrefix] = useState('')
  const [preloadResults, setPreloadResults] = useState<PreloadCourseImageResult[]>([])
  const [cleanupResults, setCleanupResults] = useState<LocalImageCleanupItem[]>([])
  const [sectionError, setSectionError] = useState<SectionError>({
    preload: '',
    diagnostics: '',
  })
  const [sectionFeedback, setSectionFeedback] = useState<SectionFeedback>({
    preload: null,
    diagnostics: null,
  })
  const [loadingState, setLoadingState] = useState({
    preload: false,
    cleanupAll: false,
    diagnostics: false,
  })
  const [tabLoading, setTabLoading] = useState({
    preload: false,
    cleanup: false,
    diagnostics: false,
  })
  const [tabLoaded, setTabLoaded] = useState({
    preload: false,
    cleanup: false,
    diagnostics: false,
  })
  const [confirmCleanupAll, setConfirmCleanupAll] = useState(false)
  const [activeTab, setActiveTab] = useState<ManagementTab>('preload')
  const [cleanupImageName, setCleanupImageName] = useState('')
  const tabButtonRefs = useRef<Record<ManagementTab, HTMLButtonElement | null>>({
    preload: null,
    cleanup: null,
    diagnostics: null,
  })
  const steps = getStepsForPage('image-management')
  const totalSteps = getTotalSteps('image-management')
  const step = steps[currentStep]

  const selectedSourcePrefix = useMemo(() => {
    if (selectedSourceId === 'custom') {
      return customSourcePrefix.trim()
    }
    const source = imageSources.find((item) => item.id === selectedSourceId)
    return source?.prefix || ''
  }, [imageSources, selectedSourceId, customSourcePrefix])

  const selectedSourceName = useMemo(() => {
    if (selectedSourceId === 'custom') {
      return customSourcePrefix.trim() ? '自定义源' : '未设置自定义源'
    }
    return imageSources.find((item) => item.id === selectedSourceId)?.name || '默认源'
  }, [imageSources, selectedSourceId, customSourcePrefix])

  const courseImageGroups = useMemo(() => {
    const grouped = new Map<string, Course[]>()
    courses.forEach((course) => {
      const imageName = (course.backend?.imageid || DEFAULT_IMAGE).trim()
      const list = grouped.get(imageName) || []
      list.push(course)
      grouped.set(imageName, list)
    })
    return Array.from(grouped.entries())
      .map(([originImageName, groupedCourses]) => ({
        imageName: buildImageWithSource(originImageName, selectedSourcePrefix),
        courses: groupedCourses.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN')),
      }))
      .sort((a, b) => a.imageName.localeCompare(b.imageName, 'zh-Hans-CN'))
  }, [courses, selectedSourcePrefix])

  const cleanupImageGroups = useMemo(() => {
    const grouped = new Map<string, CleanupCourseBrief[]>()
    diagnostics.forEach((item) => {
      if (!item.localCached) {
        return
      }
      const imageName = item.imageName.trim()
      if (!imageName) {
        return
      }
      const list = grouped.get(imageName) || []
      if (!list.some((course) => course.id === item.courseId)) {
        list.push({
          id: item.courseId,
          title: item.title,
        })
      }
      grouped.set(imageName, list)
    })
    return Array.from(grouped.entries())
      .map(([imageName, groupedCourses]) => ({
        imageName,
        courses: groupedCourses.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN')),
      }))
      .sort((a, b) => a.imageName.localeCompare(b.imageName, 'zh-Hans-CN'))
  }, [diagnostics])

  const diagnosticsSummary = useMemo(() => {
    const preloadedCount = diagnostics.filter((item) => item.localCached).length
    return {
      preloadedCount,
      unpreloadedCount: diagnostics.length - preloadedCount,
    }
  }, [diagnostics])

  const localReadyImages = useMemo(() => {
    const images = new Set<string>()
    diagnostics.forEach((item) => {
      if (item.localCached) {
        images.add(item.imageName.trim())
      }
    })
    return images
  }, [diagnostics])

  const failedPreloadResults = useMemo(() => preloadResults.filter((item) => item.status === 'failed'), [preloadResults])

  const loadCourses = async () => {
    const data = await api.courses.list()
    setCourses(data.courses || [])
  }

  const loadImageSources = useCallback(async () => {
    const data = await api.images.sources()
    const sources = data.sources || []
    setImageSources(sources)
    if (sources.length === 0) {
      return
    }
    if (!sources.some((source) => source.id === selectedSourceId)) {
      setSelectedSourceId(sources[0].id)
    }
  }, [selectedSourceId])

  const loadDiagnostics = useCallback(async () => {
    setLoadingState((prev) => ({ ...prev, diagnostics: true }))
    setSectionError((prev) => ({ ...prev, diagnostics: '' }))
    try {
      const data = await api.images.courseDiagnostics({ sourcePrefix: selectedSourcePrefix || undefined })
      setDiagnostics(data.results || [])
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : '课程镜像诊断失败'
      setSectionError((prev) => ({ ...prev, diagnostics: message }))
      return false
    } finally {
      setLoadingState((prev) => ({ ...prev, diagnostics: false }))
    }
  }, [selectedSourcePrefix])

  const loadCoursesAndDiagnostics = useCallback(async () => {
    const coursesPromise = loadCourses()
      .then(() => true)
      .catch(() => false)
    const [coursesLoaded, diagnosticsLoaded] = await Promise.all([coursesPromise, loadDiagnostics()])
    return coursesLoaded && diagnosticsLoaded
  }, [loadDiagnostics])

  const loadPreloadTabData = useCallback(async () => {
    setTabLoading((prev) => ({ ...prev, preload: true }))
    const loaded = await loadCoursesAndDiagnostics()
    setTabLoaded((prev) => ({ ...prev, preload: loaded || prev.preload }))
    setTabLoading((prev) => ({ ...prev, preload: false }))
    return loaded
  }, [loadCoursesAndDiagnostics])

  const loadCleanupTabData = useCallback(async () => {
    setTabLoading((prev) => ({ ...prev, cleanup: true }))
    const loaded = await loadCoursesAndDiagnostics()
    setTabLoaded((prev) => ({ ...prev, cleanup: loaded || prev.cleanup }))
    setTabLoading((prev) => ({ ...prev, cleanup: false }))
    return loaded
  }, [loadCoursesAndDiagnostics])

  const loadDiagnosticsTabData = useCallback(async () => {
    setTabLoading((prev) => ({ ...prev, diagnostics: true }))
    const loaded = await loadDiagnostics()
    setTabLoaded((prev) => ({ ...prev, diagnostics: loaded || prev.diagnostics }))
    setTabLoading((prev) => ({ ...prev, diagnostics: false }))
    return loaded
  }, [loadDiagnostics])

  const loadAll = useCallback(async () => {
    setTabLoading({
      preload: true,
      cleanup: true,
      diagnostics: true,
    })
    await loadImageSources()
    const [coursesAndDiagnosticsLoaded, diagnosticsLoaded] = await Promise.all([
      loadCoursesAndDiagnostics(),
      loadDiagnostics(),
    ])
    setTabLoaded({
      preload: coursesAndDiagnosticsLoaded,
      cleanup: coursesAndDiagnosticsLoaded,
      diagnostics: diagnosticsLoaded,
    })
    setTabLoading({
      preload: false,
      cleanup: false,
      diagnostics: false,
    })
  }, [loadCoursesAndDiagnostics, loadDiagnostics, loadImageSources])

  const refreshCleanupData = useCallback(async () => {
    const refreshed = await loadCleanupTabData()
    setTabLoaded((prev) => ({ ...prev, cleanup: refreshed || prev.cleanup }))
    return refreshed
  }, [loadCleanupTabData])

  useEffect(() => {
    void loadImageSources()
  }, [loadImageSources])

  useEffect(() => {
    if (!hasHydrated) return
    if (hasCheckedTour.current) return
    hasCheckedTour.current = true
    const timer = setTimeout(() => {
      if (!seenPages?.['image-management'] && !isActive) {
        startTour('image-management')
      }
    }, 50)
    return () => clearTimeout(timer)
  }, [hasHydrated, seenPages, isActive, startTour])

  useEffect(() => {
    if (activeTab === 'preload' && !tabLoaded.preload) {
      void loadPreloadTabData()
      return
    }
    if (activeTab === 'cleanup' && !tabLoaded.cleanup) {
      void loadCleanupTabData()
      return
    }
    if (activeTab === 'diagnostics' && !tabLoaded.diagnostics) {
      void loadDiagnosticsTabData()
    }
  }, [activeTab, tabLoaded.preload, tabLoaded.cleanup, tabLoaded.diagnostics, loadPreloadTabData, loadCleanupTabData, loadDiagnosticsTabData])

  useEffect(() => {
    if (selectedSourceId === 'custom' && !customSourcePrefix.trim()) {
      return
    }
    const timer = window.setTimeout(() => {
      if (activeTab === 'preload' && tabLoaded.preload) {
        void loadDiagnostics()
        return
      }
      if (activeTab === 'cleanup' && tabLoaded.cleanup) {
        void loadDiagnostics()
        return
      }
      if (activeTab === 'diagnostics' && tabLoaded.diagnostics) {
        void loadDiagnostics()
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [selectedSourceId, customSourcePrefix, activeTab, tabLoaded.preload, tabLoaded.cleanup, tabLoaded.diagnostics, loadDiagnostics])

  const runPreload = async (targetCourseIds: string[]) => {
    if (targetCourseIds.length === 0) {
      setSectionError((prev) => ({ ...prev, preload: '请至少选择一个课程' }))
      setSectionFeedback((prev) => ({
        ...prev,
        preload: {
          tone: 'warning',
          message: '请先在列表中选择至少一个课程后再执行预拉取。',
        },
      }))
      return
    }
    setLoadingState((prev) => ({ ...prev, preload: true }))
    setSectionError((prev) => ({ ...prev, preload: '' }))
    setSectionFeedback((prev) => ({
      ...prev,
      preload: {
        tone: 'info',
        message: `正在预拉取 ${targetCourseIds.length} 门课程镜像到本地，请稍候。`,
      },
    }))
    try {
      const sourcePrefix = selectedSourcePrefix
      if (selectedSourceId === 'custom' && !sourcePrefix) {
        setSectionError((prev) => ({ ...prev, preload: '请先填写自定义镜像源前缀' }))
        setSectionFeedback((prev) => ({
          ...prev,
          preload: {
            tone: 'warning',
            message: '自定义镜像源前缀为空，请填写后再拉取。',
          },
        }))
        return
      }
      const imageOverrides: Record<string, string> = {}
      targetCourseIds.forEach((courseId) => {
        const course = courses.find((item) => item.id === courseId)
        if (!course) {
          return
        }
        const originImage = (course.backend?.imageid || DEFAULT_IMAGE).trim()
        const overrideImage = buildImageWithSource(originImage, sourcePrefix)
        if (overrideImage && overrideImage !== originImage) {
          imageOverrides[courseId] = overrideImage
        }
      })
      const payload = {
        courseIds: targetCourseIds,
        imageOverrides,
      }
      const response = await api.images.preload(payload)
      const results = response.results || []
      setPreloadResults(results)
      const pulledCount = results.filter((item) => item.status === 'pulled').length
      const failedCount = results.filter((item) => item.status === 'failed').length
      const tone: FeedbackTone = failedCount > 0 ? 'warning' : 'success'
      setSectionFeedback((prev) => ({
        ...prev,
        preload: {
          tone,
          message: `预拉取完成：新拉取 ${pulledCount}，失败 ${failedCount}。`,
        },
      }))
      await loadDiagnostics()
    } catch (error) {
      const message = error instanceof Error ? error.message : '镜像预拉取失败'
      setSectionError((prev) => ({ ...prev, preload: message }))
      setSectionFeedback((prev) => ({
        ...prev,
        preload: {
          tone: 'error',
          message,
        },
      }))
    } finally {
      setLoadingState((prev) => ({ ...prev, preload: false }))
    }
  }

  const handlePreloadAll = async () => {
    await runPreload(courses.map((course) => course.id))
  }

  const handlePreloadSingle = async (courseIds: string[]) => {
    await runPreload(courseIds)
  }

  const handleCleanupImage = async (imageName: string) => {
    setCleanupImageName(imageName)
    try {
      const result = await api.images.cleanup({ imageNames: [imageName], sourcePrefix: selectedSourcePrefix || undefined })
      setCleanupResults(result.results || [])
      await refreshCleanupData()
    } catch (error) {
      void error
    } finally {
      setCleanupImageName('')
    }
  }

  const handleCleanupAll = async () => {
    setLoadingState((prev) => ({ ...prev, cleanupAll: true }))
    try {
      const result = await api.images.cleanupAll({ sourcePrefix: selectedSourcePrefix || undefined })
      setCleanupResults(result.results || [])
      await refreshCleanupData()
    } catch (error) {
      void error
    } finally {
      setLoadingState((prev) => ({ ...prev, cleanupAll: false }))
    }
  }

  const handleDiagnosticsRefresh = async () => {
    setSectionFeedback((prev) => ({
      ...prev,
      diagnostics: {
        tone: 'info',
        message: '正在刷新课程镜像预载状态。',
      },
    }))
    const diagnosticsLoaded = await loadDiagnostics()
    setSectionFeedback((prev) => ({
      ...prev,
      diagnostics: {
        tone: diagnosticsLoaded ? 'success' : 'warning',
        message: diagnosticsLoaded ? '镜像状态更新完成，请查看下方结果。' : '镜像状态刷新失败，请查看下方错误信息。',
      },
    }))
  }

  const getFeedbackClassName = (tone: FeedbackTone) => {
    if (tone === 'success') {
      return 'border-[var(--color-success)] bg-[var(--color-success-subtle)] text-[var(--color-success)]'
    }
    if (tone === 'warning') {
      return 'border-[var(--color-warning)] bg-[var(--color-warning-subtle)] text-[var(--color-warning)]'
    }
    if (tone === 'error') {
      return 'border-[var(--color-error)] bg-[var(--color-error-subtle)] text-[var(--color-error)]'
    }
    return 'border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'
  }

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, tab: ManagementTab) => {
    const currentIndex = TAB_ORDER.indexOf(tab)
    if (currentIndex < 0) {
      return
    }
    const switchToTab = (nextTab: ManagementTab) => {
      setActiveTab(nextTab)
      tabButtonRefs.current[nextTab]?.focus()
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      const nextTab = TAB_ORDER[(currentIndex + 1) % TAB_ORDER.length]
      switchToTab(nextTab)
      return
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      const nextTab = TAB_ORDER[(currentIndex - 1 + TAB_ORDER.length) % TAB_ORDER.length]
      switchToTab(nextTab)
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      switchToTab(TAB_ORDER[0])
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      switchToTab(TAB_ORDER[TAB_ORDER.length - 1])
    }
  }

  const tabItems = [
    {
      tab: 'preload' as const,
      title: '镜像预拉取',
      description: '选择课程并预拉取到本地',
      countLabel: `${courseImageGroups.length} 镜像`,
      icon: DatabaseZap,
    },
    {
      tab: 'cleanup' as const,
      title: '镜像清理',
      description: '按镜像或全量清理本地缓存',
      countLabel: `${cleanupImageGroups.length} 镜像`,
      icon: Trash2,
    },
    {
      tab: 'diagnostics' as const,
      title: '镜像诊断',
      description: '课程镜像预载状态诊断',
      countLabel: `${diagnosticsSummary.unpreloadedCount} 未预载`,
      icon: CheckCircle2,
    },
  ]

  return (
    <div className="w-full flex-1 bg-[var(--color-bg-primary)]">
      <div className="w-full max-w-[90rem] mx-auto px-4 sm:px-6 py-8 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div>
            <h1 className="text-xl font-medium text-[var(--color-text-primary)] text-balance">课程镜像管理</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <select
              value={selectedSourceId}
              onChange={(event) => setSelectedSourceId(event.target.value)}
              className="h-9 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] px-3 text-sm text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]"
              aria-label="选择镜像源"
              data-tour-id="image-management-source"
            >
              {imageSources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
            {selectedSourceId === 'custom' && (
              <input
                value={customSourcePrefix}
                onChange={(event) => setCustomSourcePrefix(event.target.value)}
                placeholder="输入自定义镜像源前缀，例如 registry.example.com/team/"
                className="h-9 min-w-[20rem] rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] px-3 text-sm text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]"
              />
            )}
            <Button
              variant="secondary"
              onClick={loadAll}
              className="gap-1.5 whitespace-nowrap"
              aria-label="刷新全部"
              title="刷新全部"
              data-tour-id="image-management-refresh-all"
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </header>

        <div
          role="tablist"
          aria-label="镜像管理功能分区"
          className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] p-1"
          data-tour-id="image-management-tabs"
        >
          {tabItems.map((item) => {
            const Icon = item.icon
            const selected = activeTab === item.tab
            return (
              <button
                key={item.tab}
                type="button"
                role="tab"
                ref={(element) => {
                  tabButtonRefs.current[item.tab] = element
                }}
                id={`image-management-tab-${item.tab}`}
                aria-controls={`image-management-panel-${item.tab}`}
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onKeyDown={(event) => handleTabKeyDown(event, item.tab)}
                onClick={() => setActiveTab(item.tab)}
                className={cn(
                  'rounded-lg px-3 py-2.5 text-sm transition-colors duration-150 text-left',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]',
                  selected
                    ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm border border-[var(--color-border-light)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-transparent'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Icon className="size-4" aria-hidden="true" />
                    {item.title}
                  </span>
                  <span className="text-xs tabular-nums">{item.countLabel}</span>
                </div>
                <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{item.description}</p>
              </button>
            )
          })}
        </div>

        {activeTab === 'preload' && (
          <section
          role="tabpanel"
          id="image-management-panel-preload"
          aria-labelledby="image-management-tab-preload"
          className="w-full space-y-5 pt-1"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">课程镜像预拉取</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                支持批量预拉取与单镜像预拉取，并在下方查看结构化结果。当前镜像源：{selectedSourceName}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="primary" onClick={handlePreloadAll} loading={loadingState.preload} className="gap-1.5 whitespace-nowrap">
                <Download className="size-4" />
                拉取全部
              </Button>
            </div>
          </div>

          {sectionFeedback.preload && (
            <div className={cn('rounded-md border px-3 py-2 text-sm', getFeedbackClassName(sectionFeedback.preload.tone))} aria-live="polite">
              {sectionFeedback.preload.message}
            </div>
          )}

          {sectionError.preload && (
            <div className="rounded-md border border-[var(--color-error)] bg-[var(--color-error-subtle)] px-3 py-2 text-sm text-[var(--color-error)]">
              {sectionError.preload}
            </div>
          )}

          {tabLoading.preload && !tabLoaded.preload ? (
            <div className="rounded-md border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] p-4 text-sm text-[var(--color-text-secondary)] flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              正在加载镜像预拉取数据...
            </div>
          ) : courses.length === 0 ? (
            <div className="rounded-md border border-dashed border-[var(--color-border-default)] p-4 text-sm text-[var(--color-text-secondary)]">
              当前没有可预拉取课程，请先检查课程配置或刷新数据。
            </div>
          ) : (
            <div className="overflow-x-auto border border-[var(--color-border-light)] rounded-lg" data-tour-id="image-management-preload-table">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-secondary)]">
                  <tr className="text-left">
                    <th className="px-3 py-2">镜像</th>
                    <th className="px-3 py-2">关联课程</th>
                    <th className="px-3 py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {courseImageGroups.map((group) => (
                    <tr key={group.imageName} className="border-t border-[var(--color-border-light)]">
                      <td className="px-3 py-2 font-mono text-xs text-[var(--color-text-secondary)]">
                        {group.imageName}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {group.courses.map((course) => (
                            <span
                              key={course.id}
                              className="inline-flex items-center rounded-full px-2 py-1 text-xs bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]"
                            >
                              {course.title}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {(() => {
                          const isReady = localReadyImages.has(group.imageName)
                          return (
                        <Button
                          variant="secondary"
                          onClick={() => handlePreloadSingle(group.courses.map((course) => course.id))}
                          aria-label={isReady ? `镜像 ${group.imageName} 已就绪` : `预拉取镜像 ${group.imageName}`}
                          title={isReady ? `镜像 ${group.imageName} 已在本地缓存` : `预拉取镜像 ${group.imageName}`}
                          className="size-8 p-0"
                          disabled={isReady || loadingState.preload}
                        >
                          {isReady ? (
                            <CheckCircle2 className="size-4 text-[var(--color-success)]" aria-hidden="true" />
                          ) : (
                            <Download className={cn('size-4', loadingState.preload && 'animate-bounce')} aria-hidden="true" />
                          )}
                        </Button>
                          )
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {failedPreloadResults.length > 0 && (
            <div className="grid gap-2">
              {failedPreloadResults.map((result) => (
                <div
                  key={`${result.courseId}-${result.imageName}`}
                  className={cn(
                    'rounded-md border px-3 py-2 text-sm flex items-start justify-between gap-3',
                    result.status === 'failed'
                      ? 'border-[var(--color-error)] bg-[var(--color-error-subtle)]'
                      : 'border-[var(--color-border-light)] bg-[var(--color-bg-secondary)]'
                  )}
                >
                  <div>
                    <p className="font-medium text-[var(--color-text-primary)]">
                      {result.title} <span className="text-xs text-[var(--color-text-tertiary)]">({result.courseId})</span>
                    </p>
                    <p className="text-xs font-mono text-[var(--color-text-secondary)] mt-1">{result.imageName}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">{result.message}</p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-1 text-xs font-medium tabular-nums',
                      result.status === 'failed'
                        ? 'bg-[var(--color-error-subtle)] text-[var(--color-error)]'
                        : 'bg-[var(--color-success-subtle)] text-[var(--color-success)]'
                    )}
                  >
                    {result.status === 'cached' ? '已命中' : result.status === 'pulled' ? '已拉取' : '失败'}
                  </span>
                </div>
              ))}
            </div>
          )}

          </section>
        )}

      {activeTab === 'cleanup' && (
        <section
          role="tabpanel"
          id="image-management-panel-cleanup"
          aria-labelledby="image-management-tab-cleanup"
          className="w-full space-y-5 pt-1"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">本地镜像清理</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">按镜像删除本地缓存，必要时可执行全量清理。当前镜像源：{selectedSourceName}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="danger"
                onClick={() => setConfirmCleanupAll(true)}
                loading={loadingState.cleanupAll}
                className="gap-1.5"
              >
                <Trash2 className="size-4" />
                清理全部
              </Button>
            </div>
          </div>

          {tabLoading.cleanup && !tabLoaded.cleanup ? (
            <div className="rounded-md border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] p-4 text-sm text-[var(--color-text-secondary)] flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              正在加载镜像清理数据...
            </div>
          ) : cleanupImageGroups.length === 0 ? (
            <div className="rounded-md border border-dashed border-[var(--color-border-default)] p-4 text-sm text-[var(--color-text-secondary)] space-y-1">
              <p>当前没有检测到本地缓存镜像。</p>
              <p className="text-xs text-[var(--color-text-tertiary)]">下一步：先执行镜像预拉取或启动课程后再刷新列表。</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {cleanupImageGroups.map((group) => (
                <div
                  key={group.imageName}
                  className="rounded-md border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] px-3 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-[var(--color-text-primary)] font-mono text-xs">{group.imageName}</p>
                      <p className="text-xs text-[var(--color-text-tertiary)] tabular-nums">
                        关联课程数：{group.courses.length}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        {group.courses.map((course) => course.title).join('、')}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => handleCleanupImage(group.imageName)}
                      loading={cleanupImageName === group.imageName}
                      disabled={cleanupImageName !== '' && cleanupImageName !== group.imageName}
                      className="gap-1.5 whitespace-nowrap"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {cleanupResults.length > 0 && (
            <div className="grid gap-2">
              {cleanupResults.map((item) => (
                <div
                  key={item.imageName}
                  className={cn(
                    'rounded-md border px-3 py-2 text-sm',
                    item.status === 'failed'
                      ? 'border-[var(--color-error)] bg-[var(--color-error-subtle)]'
                      : 'border-[var(--color-border-light)] bg-[var(--color-bg-secondary)]'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-[var(--color-text-primary)] break-all">{item.imageName}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{item.message}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                        关联课程：{item.courseTitles.length > 0 ? item.courseTitles.join('、') : '无'}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-1 text-xs font-medium tabular-nums',
                        item.status === 'failed'
                          ? 'bg-[var(--color-error-subtle)] text-[var(--color-error)]'
                          : item.status === 'skipped'
                            ? 'bg-[var(--color-warning-subtle)] text-[var(--color-warning)]'
                            : 'bg-[var(--color-success-subtle)] text-[var(--color-success)]'
                      )}
                    >
                      {item.status === 'removed' ? '已删除' : item.status === 'skipped' ? '无需清理' : '失败'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'diagnostics' && (
        <section
          role="tabpanel"
          id="image-management-panel-diagnostics"
          aria-labelledby="image-management-tab-diagnostics"
          className="w-full space-y-5 pt-1"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">课程镜像诊断</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">展示课程镜像预载状态与建议动作。当前镜像源：{selectedSourceName}</p>
            </div>
            <Button
              variant="secondary"
              onClick={handleDiagnosticsRefresh}
              loading={loadingState.diagnostics}
              className="gap-1.5 whitespace-nowrap"
            >
              <RefreshCw className="size-4" />
              重新诊断
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] px-4 py-3">
              <p className="text-xs text-[var(--color-text-tertiary)]">已预载</p>
              <p className="mt-1 text-lg font-semibold text-[var(--color-text-primary)] tabular-nums">
                {diagnosticsSummary.preloadedCount}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] px-4 py-3">
              <p className="text-xs text-[var(--color-text-tertiary)]">未预载</p>
              <p className="mt-1 text-lg font-semibold text-[var(--color-text-primary)] tabular-nums">
                {diagnosticsSummary.unpreloadedCount}
              </p>
            </div>
          </div>

          {sectionFeedback.diagnostics && (
            <div className={cn('rounded-md border px-3 py-2 text-sm', getFeedbackClassName(sectionFeedback.diagnostics.tone))} aria-live="polite">
              {sectionFeedback.diagnostics.message}
            </div>
          )}

          {sectionError.diagnostics && (
            <div className="rounded-md border border-[var(--color-error)] bg-[var(--color-error-subtle)] px-3 py-2 text-sm text-[var(--color-error)]">
              {sectionError.diagnostics}
            </div>
          )}

          {tabLoading.diagnostics && !tabLoaded.diagnostics ? (
            <div className="rounded-md border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] p-4 text-sm text-[var(--color-text-secondary)] flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              正在加载镜像诊断数据...
            </div>
          ) : null}

          {diagnostics.length === 0 ? (
            <div className="rounded-md border border-dashed border-[var(--color-border-default)] p-4 text-sm text-[var(--color-text-secondary)]">
              暂无课程镜像诊断结果，建议点击“重新诊断”获取最新状态。
            </div>
          ) : (
            <div className="overflow-x-auto border border-[var(--color-border-light)] rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-secondary)]">
                  <tr className="text-left">
                    <th className="px-3 py-2">课程</th>
                    <th className="px-3 py-2">镜像</th>
                    <th className="px-3 py-2">状态</th>
                    <th className="px-3 py-2">诊断信息</th>
                  </tr>
                </thead>
                <tbody>
                  {diagnostics.map((item) => (
                    <tr key={item.courseId} className="border-t border-[var(--color-border-light)]">
                      <td className="px-3 py-2">
                        <p className="font-medium text-[var(--color-text-primary)]">{item.title}</p>
                        <p className="text-xs text-[var(--color-text-tertiary)]">{item.courseId}</p>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-[var(--color-text-secondary)]">{item.imageName}</td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium tabular-nums',
                            item.localCached
                              ? 'bg-[var(--color-success-subtle)] text-[var(--color-success)]'
                              : 'bg-[var(--color-error-subtle)] text-[var(--color-error)]'
                          )}
                        >
                          {item.localCached ? '已预载' : '未预载'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                        <div>{item.message}</div>
                        <div className="mt-1 text-[var(--color-text-tertiary)]">{item.sourceHint}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {loadingState.diagnostics ? (
            <div className="text-xs text-[var(--color-text-tertiary)] flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              诊断数据更新中...
            </div>
          ) : null}
        </section>
      )}

      <ConfirmDialog
        isOpen={confirmCleanupAll}
        title="确认全量清理本地镜像"
        message="将删除当前课程涉及的本地镜像缓存，后续启动课程可能需要重新拉取镜像。确认继续吗？"
        confirmText="确认清理"
        cancelText="取消"
        variant="danger"
        onCancel={() => setConfirmCleanupAll(false)}
        onConfirm={() => {
          setConfirmCleanupAll(false)
          void handleCleanupAll()
        }}
      />
      {step && isActive && currentPage === 'image-management' && (
        <TourTooltip
          isOpen={isActive && currentPage === 'image-management'}
          step={step}
          currentStep={currentStep}
          totalSteps={totalSteps}
          onNext={nextStep}
          onPrev={prevStep}
          onSkip={skipTour}
        />
      )}
      </div>
    </div>
  )
}
