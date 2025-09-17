import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Tag, BookOpen, AlertCircle } from 'lucide-react';

interface Course {
  id: string
  title: string
  description: string
  difficulty: string
  estimatedMinutes: number
  tags: string[]
  dockerImage: string
}

export function CourseList() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCourses()
  }, [])

  const fetchCourses = async () => {
    try {
      const response = await fetch('/api/courses')
      if (!response.ok) {
        throw new Error('Failed to fetch courses')
      }
      const data = await response.json()
      setCourses(data.courses || [])
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
            探索我们精心设计的课程，从基础到进阶，助你掌握数据库核心技能
          </p>
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
              className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden border border-gray-100 hover:border-blue-200 transform hover:-translate-y-2"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* 课程卡片头部渐变 */}
              <div className="h-2 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600"></div>
              
              <div className="p-8">
                {/* 课程标题、时间和难度标签 */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1 mr-4">
                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors duration-300 leading-tight mb-2">
                      {course.title}
                    </h3>
                    {/* 课程时长 */}
                    <div className="flex items-center text-sm text-gray-500">
                      <Clock className="w-3 h-3 mr-1 text-blue-500" />
                      <span className="font-medium">{course.estimatedMinutes} 分钟</span>
                    </div>
                  </div>
                  <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm flex-shrink-0 ${
                    course.difficulty === 'beginner' ? 'bg-gradient-to-r from-green-400 to-green-500 text-white' :
                    course.difficulty === 'intermediate' ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white' :
                    'bg-gradient-to-r from-red-400 to-pink-500 text-white'
                  }`}>
                    {course.difficulty === 'beginner' ? '初级' :
                     course.difficulty === 'intermediate' ? '中级' : '高级'}
                  </span>
                </div>
                
                {/* 课程描述 */}
                <p className="text-gray-600 mb-6 line-clamp-3 leading-relaxed">{course.description}</p>
                
                {/* 课程标签 */}
                {course.tags && course.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-8">
                    {course.tags.map((tag, tagIndex) => (
                      <span 
                        key={tagIndex} 
                        className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 border border-blue-200 hover:from-blue-100 hover:to-purple-100 transition-all duration-200"
                      >
                        <Tag className="w-3 h-3 mr-1.5" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                
                {/* 开始学习按钮 */}
                <Link
                  to={`/learn/${course.id}`}
                  className="group/btn block w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white text-center py-4 px-6 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 font-semibold text-sm uppercase tracking-wide shadow-lg hover:shadow-xl transform hover:scale-105 relative overflow-hidden"
                >
                  <span className="relative z-10 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 mr-2 group-hover/btn:rotate-12 transition-transform duration-300" />
                    开始学习
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 transform -skew-x-12 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700"></div>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </div>
  )
}