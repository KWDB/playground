import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Tag, BookOpen, AlertCircle, Trash2, Activity, X, CheckCircle, AlertTriangle, Terminal, Database } from 'lucide-react';
import { ContainerInfo, CleanupResult } from '../types/container';
import ProposeCourseCard from '../components/business/ProposeCourseCard';

interface Course {
  id: string
  title: string
  description: string
  difficulty: string
  estimatedMinutes: number
  tags: string[]
  dockerImage: string
  sqlTerminal?: boolean
}

export function CourseList() {
  const [courses, setCourses] = useState<Course[]>([])
  const [containers, setContainers] = useState<ContainerInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCleanupModal, setShowCleanupModal] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null)

  useEffect(() => {
    fetchCourses()
    fetchContainers()
    const interval = setInterval(fetchContainers, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchContainers = async () => {
    try {
      const response = await fetch('/api/containers')
      if (response.ok) {
        const data = await response.json()
        setContainers(data || [])
      }
    } catch (error) {
      console.error('Failed to fetch containers', error)
    }
  }

  const handleCleanup = async () => {
    setCleaning(true)
    try {
      const response = await fetch('/api/containers', { method: 'DELETE' })
      const result = await response.json()
      setCleanupResult(result)
      if (result.success) {
        fetchContainers()
        // 3秒后自动关闭弹窗
        setTimeout(() => {
           if (showCleanupModal) setShowCleanupModal(false);
           setCleanupResult(null);
        }, 3000)
      }
    } catch (error) {
      console.error('Cleanup failed', error)
      setCleanupResult({ success: false, message: '调用清理接口失败', cleanedContainers: [] })
    } finally {
      setCleaning(false)
    }
  }

  const fetchCourses = async () => {
    try {
      const response = await fetch('/api/courses')
      if (!response.ok) {
        throw new Error('Failed to fetch courses')
      }
      const data = await response.json()
      // 根据难度进行排序：初级 -> 中级 -> 高级；未知难度排在最后
      const weight = (d: string) => (
        d === 'beginner' ? 0 : d === 'intermediate' ? 1 : d === 'advanced' ? 2 : 99
      )
      const sorted: Course[] = (data.courses || []).slice().sort((a: Course, b: Course) => {
        const wa = weight(a.difficulty)
        const wb = weight(b.difficulty)
        if (wa !== wb) return wa - wb
        // 次级排序：同难度按预计时长升序，保证排序稳定
        return (a.estimatedMinutes ?? 0) - (b.estimatedMinutes ?? 0)
      })
      setCourses(sorted)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // 辅助函数：根据难度生成确定的渐变色
  const getDifficultyGradient = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'from-emerald-400 to-teal-500';
      case 'intermediate':
        return 'from-blue-400 to-indigo-500';
      case 'hard':
        return 'from-orange-400 to-red-500';
      default:
        return 'from-gray-400 to-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-20">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-pulse"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-600 rounded-full animate-spin border-t-transparent"></div>
        </div>
        <p className="mt-6 text-lg text-gray-600 font-medium">正在加载精彩课程...</p>
        <p className="mt-2 text-sm text-gray-500">请稍候片刻</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-2xl p-8 text-center shadow-lg">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-6">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-xl font-bold text-red-800 mb-3">哎呀，出了点问题</h3>
        <p className="text-red-600 mb-6">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
        >
          重新加载
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mb-6">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-6">
            课程列表
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            探索我们精心设计的课程，从基础到进阶，助你掌握 KWDB 数据库核心技能
          </p>
          
          {containers.length > 0 && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => setShowCleanupModal(true)}
                className="inline-flex items-center px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                清理所有运行中容器 ({containers.length})
              </button>
            </div>
          )}
        </div>

        {courses.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无课程</h3>
            <p className="text-gray-500">请检查 courses 目录是否包含有效的课程配置</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {courses.map((course, index) => {
              const isRunning = containers.some(c => c.courseId === course.id && c.state === 'running');
              
              return (
                <Link 
                  to={`/learn/${course.id}`}
                  key={course.id} 
                  className="group block bg-white rounded-lg border border-gray-200 shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:shadow-xl hover:scale-105 transition-all duration-300 overflow-hidden h-full flex flex-col"
                  style={{ animationDelay: `${index * 100}ms` }}
                  role="article"
                  aria-labelledby={`course-title-${course.id}`}
                >
                  {/* 16:9 图片占位区域 */}
                  <div className="aspect-video relative overflow-hidden bg-gray-100">
                    {/* 渐变背景 */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${getDifficultyGradient(course.difficulty)} opacity-90 group-hover:scale-110 transition-transform duration-500`}></div>
                    
                    {/* 中心图标 */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      {course.sqlTerminal ? (
                        <Database className="w-12 h-12 text-white/80 drop-shadow-md" />
                      ) : (
                        <Terminal className="w-12 h-12 text-white/80 drop-shadow-md" />
                      )}
                    </div>

                    {/* 右上角：难度标签 */}
                    <div className="absolute top-3 right-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold bg-white/90 backdrop-blur-sm shadow-sm ${
                        course.difficulty === 'beginner' ? 'text-green-700' :
                        course.difficulty === 'intermediate' ? 'text-yellow-700' :
                        'text-red-700'
                      }`}>
                        {course.difficulty === 'beginner' ? '初级' :
                         course.difficulty === 'intermediate' ? '中级' : '高级'}
                      </span>
                    </div>
                    
                    {/* 运行状态条 */}
                    {isRunning && (
                      <div className="absolute bottom-0 left-0 right-0 bg-green-500/90 text-white text-xs py-1.5 px-2 text-center font-medium backdrop-blur-sm flex items-center justify-center">
                        <Activity className="w-3 h-3 mr-1 animate-pulse" />
                        正在运行
                      </div>
                    )}
                  </div>
                  
                  {/* 内容区域 */}
                  <div className="p-4 flex flex-col flex-1">
                    {/* 标题 */}
                    <h3 
                      id={`course-title-${course.id}`} 
                      className="text-[18px] font-medium text-gray-900 leading-tight mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors"
                    >
                      {course.title}
                    </h3>

                    {/* 课程标签 */}
                    {course.tags && course.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {course.tags.slice(0, 3).map((tag, i) => (
                          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                            {tag}
                          </span>
                        ))}
                        {course.tags.length > 3 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-50 text-gray-600 border border-gray-100">
                            +{course.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {/* 描述 */}
                    <p className="text-[14px] text-gray-600 leading-relaxed mb-4 line-clamp-3 flex-1 font-normal">
                      {course.description}
                    </p>
                    
                    {/* 底部元数据 */}
                    <div className="flex items-center justify-between text-xs text-gray-500 mt-auto pt-3 border-t border-gray-100">
                      <div className="flex items-center" title="预计时长">
                        <Clock className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                        <span>{course.estimatedMinutes} 分钟</span>
                      </div>

                      <div className="flex items-center" title="课程类型">
                        <Tag className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                        <span>{course.sqlTerminal ? 'SQL' : 'Shell'}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
            
            {/* 提议新课程卡片 */}
            <ProposeCourseCard className="h-full min-h-[280px]" />
          </div>
        )}
      </div>

      {/* 清理确认弹窗 */}
      {showCleanupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <Trash2 className="w-5 h-5 mr-2 text-red-500" />
                清理确认
              </h3>
              <button 
                onClick={() => !cleaning && setShowCleanupModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={cleaning}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              {!cleanupResult ? (
                <>
                  <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-6 flex items-start">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-red-900 mb-1">警告</h4>
                      <p className="text-sm text-red-700">
                        您即将强制停止并删除 <strong>{containers.length}</strong> 个正在运行的课程容器。此操作不可撤销，所有未保存的数据都将丢失。
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-3 max-h-48 overflow-y-auto mb-6 border border-gray-100 rounded-lg p-2">
                    {containers.map(container => (
                      <div key={container.id} className="flex items-center justify-between text-sm p-2 hover:bg-gray-50 rounded">
                        <span className="font-medium text-gray-700">
                          {courses.find(c => c.id === container.courseId)?.title || container.name}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          container.state === 'running' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {container.state}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowCleanupModal(false)}
                      disabled={cleaning}
                      className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleCleanup}
                      disabled={cleaning}
                      className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium transition-colors flex items-center justify-center"
                    >
                      {cleaning ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                          清理中...
                        </>
                      ) : (
                        '确认清理'
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                    cleanupResult.success ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {cleanupResult.success ? (
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    ) : (
                      <AlertTriangle className="w-8 h-8 text-red-600" />
                    )}
                  </div>
                  <h4 className={`text-lg font-bold mb-2 ${
                    cleanupResult.success ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {cleanupResult.success ? '清理完成' : '清理失败'}
                  </h4>
                  <p className="text-gray-600 mb-6">{cleanupResult.message}</p>
                  
                  {cleanupResult.success && (
                    <div className="text-sm text-gray-500 mb-6">
                      已清理 {cleanupResult.cleanedContainers.length} 个容器
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setShowCleanupModal(false)
                      setCleanupResult(null)
                    }}
                    className="w-full px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 font-medium transition-colors"
                  >
                    关闭
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}