import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Tag, BookOpen, AlertCircle, Trash2, Activity, X, CheckCircle, AlertTriangle, Terminal } from 'lucide-react';
import { ContainerInfo, CleanupResult } from '../types/container';

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {courses.map((course, index) => (
              <div 
                key={course.id} 
                // 统一卡片高度与布局：保证按钮可固定在底部
                className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden border border-gray-100 hover:border-blue-200 transform hover:-translate-y-2 h-full min-h-[320px] flex flex-col"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* 课程卡片头部渐变 */}
                <div className="h-2 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600"></div>
                
                {/* 内容容器：flex-1 保证按钮贴底 */}
                <div className="p-8 flex flex-col flex-1">
                  {/* 顶部区：左侧标题与时长；右侧难度与类型标签 */}
                  <div className="flex items-start justify-between mb-4">
                    {/* 左侧：标题与时长 */}
                    <div className="flex-1 mr-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors duration-300 leading-tight">
                          {course.title}
                        </h3>
                        {containers.some(c => c.courseId === course.id && c.state === 'running') && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 animate-pulse">
                            <Activity className="w-3 h-3 mr-1" />
                            运行中
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-500">
                        <Clock className="w-3 h-3 mr-1 text-blue-500" />
                        <span className="font-medium">{course.estimatedMinutes} 分钟</span>
                      </div>
                    </div>
                    {/* 右侧：难度徽章 + 类型标签（SQL/Shell） */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm ${
                        course.difficulty === 'beginner' ? 'bg-gradient-to-r from-green-400 to-green-500 text-white' :
                        course.difficulty === 'intermediate' ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white' :
                        'bg-gradient-to-r from-red-400 to-pink-500 text-white'
                      }`}>
                        {course.difficulty === 'beginner' ? '初级' :
                         course.difficulty === 'intermediate' ? '中级' : '高级'}
                      </span>
                      <span className={`${course.sqlTerminal ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'} px-3 py-1 rounded-full text-xs font-semibold`}>
                        {course.sqlTerminal ? 'SQL' : 'Shell'}
                      </span>
                    </div>
                  </div>

                  {/* 课程标签（提升可见度：置于描述上方） */}
                  {course.tags && course.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 mb-5">
                      {course.tags.map((tag, tagIndex) => (
                        tagIndex < 4 ? (
                          <span 
                            key={tagIndex} 
                            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 border border-blue-200 hover:from-blue-100 hover:to-purple-100 transition-all duration-200"
                          >
                            <Tag className="w-3 h-3 mr-1.5" />
                            {tag}
                          </span>
                        ) : null
                      ))}
                      {course.tags.length > 4 && (
                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          +{course.tags.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {/* 课程描述 */}
                  <p className="text-gray-600 mb-6 line-clamp-3 leading-relaxed">{course.description}</p>
                  
                  {/* 开始学习按钮：使用 mt-auto 固定在卡片底部 */}
                  <Link
                    to={`/learn/${course.id}`}
                    className={`group/btn mt-auto block w-full text-center py-4 px-6 rounded-xl transition-all duration-300 font-semibold text-sm uppercase tracking-wide shadow-lg hover:shadow-xl transform hover:scale-105 relative overflow-hidden ${
                      containers.some(c => c.courseId === course.id && c.state === 'running')
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700'
                    }`}
                  >
                    <span className="relative z-10 flex items-center justify-center">
                      {containers.some(c => c.courseId === course.id && c.state === 'running') ? (
                        <Terminal className="w-4 h-4 mr-2" />
                      ) : (
                        <BookOpen className="w-4 h-4 mr-2 group-hover/btn:rotate-12 transition-transform duration-300" />
                      )}
                      {containers.some(c => c.courseId === course.id && c.state === 'running') ? '进入课程' : '开始学习'}
                    </span>
                    {!containers.some(c => c.courseId === course.id && c.state === 'running') && (
                      <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 transform -skew-x-12 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700"></div>
                    )}
                  </Link>
                </div>
              </div>
            ))}
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