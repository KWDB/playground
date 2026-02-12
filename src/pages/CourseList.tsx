import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Clock, AlertCircle, Trash2, CheckCircle, Terminal, Database, LayoutGrid, List as ListIcon, Search, Filter, RefreshCw, Circle } from 'lucide-react';
import { ContainerInfo } from '@/types';
import { api } from '@/lib/api/client';
import { UserProgress } from '@/lib/api/types';
import ProposeCourseCard from '../components/business/ProposeCourseCard';
import { useDebounce } from '../hooks/useDebounce';
import PinyinMatch from 'pinyin-match';
import { Button, Dialog, DialogContent, DialogTitle } from '@/components/ui/Button';

interface Course {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  estimatedMinutes: number;
  tags: string[];
  dockerImage: string;
  sqlTerminal?: boolean;
  totalSteps?: number;
}

interface FilterState {
  type: 'all' | 'sql' | 'shell';
  difficulty: string[];
  tags: string[];
  timeRange: [number, number];
}

export function CourseList() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, UserProgress>>({});
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('courseViewMode') as 'grid' | 'list') || 'grid';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [filters, setFilters] = useState<FilterState>({
    type: 'all',
    difficulty: [],
    tags: [],
    timeRange: [0, 1000],
  });
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('courseViewMode', mode);
  };

  const { availableTags, availableDifficulties, maxDuration } = useMemo(() => {
    if (courses.length === 0) return { availableTags: [], availableDifficulties: [], maxDuration: 120 };
    const tags = Array.from(new Set(courses.flatMap(c => c.tags))).sort();
    const difficulties = Array.from(new Set(courses.map(c => c.difficulty))).sort((a, b) => {
      const weight = (d: string) => (d === 'beginner' ? 0 : d === 'intermediate' ? 1 : d === 'advanced' ? 2 : 99);
      return weight(a) - weight(b);
    });
    const max = Math.max(...courses.map(c => c.estimatedMinutes), 60);
    return { availableTags: tags, availableDifficulties: difficulties, maxDuration: max };
  }, [courses]);

  useEffect(() => {
    if (maxDuration <= 0) return;
    setFilters(prev => {
      if (prev.timeRange[1] !== 1000) return prev;
      return { ...prev, timeRange: [0, maxDuration] };
    });
  }, [maxDuration]);

  const filteredCourses = useMemo(() => {
    return courses.filter(course => {
      if (debouncedSearchQuery) {
        const q = debouncedSearchQuery.trim();
        const basicMatch =
          course.title.toLowerCase().includes(q.toLowerCase()) ||
          course.id.toLowerCase().includes(q.toLowerCase()) ||
          course.description.toLowerCase().includes(q.toLowerCase());
        const pinyinMatch = PinyinMatch.match(course.title, q);
        if (!basicMatch && !pinyinMatch) return false;
      }
      if (filters.type === 'sql' && !course.sqlTerminal) return false;
      if (filters.type === 'shell' && course.sqlTerminal) return false;
      if (filters.difficulty.length > 0 && !filters.difficulty.includes(course.difficulty)) return false;
      if (filters.tags.length > 0) {
        const hasTag = course.tags.some(tag => filters.tags.includes(tag));
        if (!hasTag) return false;
      }
      if (course.estimatedMinutes < filters.timeRange[0] || course.estimatedMinutes > filters.timeRange[1]) return false;
      return true;
    });
  }, [courses, debouncedSearchQuery, filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.type !== 'all') count++;
    count += filters.difficulty.length;
    count += filters.tags.length;
    if (filters.timeRange[0] > 0 || filters.timeRange[1] < maxDuration) count++;
    return count;
  }, [filters, maxDuration]);

  const handleResetFilters = () => {
    setFilters({ type: 'all', difficulty: [], tags: [], timeRange: [0, maxDuration] });
    setSearchQuery('');
  };

  const fetchContainers = async () => {
    try {
      const response = await fetch('/api/containers');
      if (response.ok) {
        const data = await response.json();
        setContainers(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch containers', error);
    }
  };

  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());

  const handleSelectAll = () => {
    if (selectedCourses.size === containers.length) {
      setSelectedCourses(new Set());
    } else {
      setSelectedCourses(new Set(containers.map(c => c.courseId)));
    }
  };

  const handleSelectContainer = (courseId: string) => {
    const newSelected = new Set(selectedCourses);
    if (newSelected.has(courseId)) {
      newSelected.delete(courseId);
    } else {
      newSelected.add(courseId);
    }
    setSelectedCourses(newSelected);
  };

  const formatDuration = (startedAt: string): string => {
    const start = new Date(startedAt).getTime();
    const now = Date.now();
    const diff = now - start;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}天 ${hours % 24}小时`;
    if (hours > 0) return `${hours}小时 ${minutes % 60}分钟`;
    return `${minutes}分钟`;
  };

  const handleCleanup = async () => {
    if (selectedCourses.size === 0) return;
    
    setCleaning(true);
    try {
      const cleanupPromises = Array.from(selectedCourses).map(courseId => 
        fetch(`/api/courses/${courseId}/cleanup-containers`, { method: 'POST' })
      );
      
      await Promise.all(cleanupPromises);
      
      fetchContainers();
      setSelectedCourses(new Set());
      setTimeout(() => {
        if (showCleanupModal) setShowCleanupModal(false);
      }, 1500);
    } finally {
      setCleaning(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const response = await fetch('/api/courses');
      if (!response.ok) throw new Error('Failed to fetch courses');
      const data = await response.json();
      const weight = (d: string) => (d === 'beginner' ? 0 : d === 'intermediate' ? 1 : d === 'advanced' ? 2 : 99);
      const sorted: Course[] = (data.courses || []).slice().sort((a: Course, b: Course) => {
        const wa = weight(a.difficulty);
        const wb = weight(b.difficulty);
        if (wa !== wb) return wa - wb;
        return a.title.localeCompare(b.title, 'zh-CN', { numeric: true });
      });
      setCourses(sorted);

       const progressPromises = sorted.map(course => 
         api.courses.getProgress(course.id)
           .then(res => ({
             id: course.id,
             progress: res.exists && res.progress ? {
               userId: res.progress.user_id,
               courseId: res.progress.course_id,
               stepIndex: res.progress.current_step,
               completed: res.progress.completed,
               createdAt: res.progress.started_at,
               updatedAt: res.progress.updated_at,
             } : null
           }))
           .catch(() => ({ id: course.id, progress: null }))
       );
      
      const results = await Promise.all(progressPromises);
      const newProgressMap: Record<string, UserProgress> = {};
      results.forEach(r => {
        if (r.progress) newProgressMap[r.id] = r.progress;
      });
      setProgressMap(newProgressMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
    fetchContainers();
    const interval = setInterval(fetchContainers, 30000);
    return () => clearInterval(interval);
  }, []);

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return '初级';
      case 'intermediate': return '中级';
      case 'hard': return '高级';
      default: return difficulty;
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-dvh bg-[var(--color-bg-primary)]">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg skeleton" />
            <div className="h-6 w-32 skeleton rounded" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-4 rounded-lg border border-[var(--color-border-light)]">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 skeleton rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 skeleton rounded" />
                    <div className="h-3 w-1/2 skeleton rounded" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-full skeleton rounded" />
                  <div className="h-3 w-5/6 skeleton rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full min-h-dvh bg-[var(--color-bg-primary)] flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-error-subtle)] mb-4">
            <AlertCircle className="w-6 h-6 text-[var(--color-error)]" />
          </div>
          <h2 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">加载失败</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>重新加载</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 bg-[var(--color-bg-primary)]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-medium text-[var(--color-text-primary)]">课程列表</h1>
            <p className="text-sm text-[var(--color-text-tertiary)]">{filteredCourses.length} 门课程</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-[var(--color-border-default)] rounded-lg overflow-hidden">
              <button
                onClick={() => handleViewModeChange('grid')}
                className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'}`}
                aria-label="卡片模式"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleViewModeChange('list')}
                className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'}`}
                aria-label="列表模式"
              >
                <ListIcon className="w-4 h-4" />
              </button>
            </div>
            {containers.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setShowCleanupModal(true)} className="text-[var(--color-error)]">
                <Trash2 className="w-4 h-4" />
                清理 ({containers.length})
              </Button>
            )}
          </div>
        </header>

        <div className="mb-6 p-4 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-primary)]">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索课程..."
                className="input pl-9"
              />
            </div>
            <Button
              variant={filterPanelOpen || activeFilterCount > 0 ? 'primary' : 'secondary'}
              size="md"
              onClick={() => setFilterPanelOpen(!filterPanelOpen)}
              className="gap-2"
            >
              <Filter className="w-4 h-4" />
              筛选
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-xs bg-white/20">{activeFilterCount}</span>
              )}
            </Button>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="md" onClick={handleResetFilters} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                重置
              </Button>
            )}
          </div>

          {filterPanelOpen && (
            <div className="mt-4 pt-4 border-t border-[var(--color-border-light)] space-y-5">
              {/* 类型筛选 */}
              <div>
                <label className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3 block">
                  课程类型
                </label>
                <div className="flex gap-2">
                  {[
                    { value: 'all', label: '全部', icon: null },
                    { value: 'sql', label: 'SQL', icon: Database, color: '#7c3aed' },
                    { value: 'shell', label: 'Shell', icon: Terminal, color: '#16a34a' },
                  ].map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setFilters({ ...filters, type: type.value as FilterState['type'] })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 border ${
                        filters.type === type.value
                          ? type.value === 'sql'
                            ? 'bg-[#ede9fe] text-[#7c3aed] border-[#7c3aed] shadow-sm'
                            : type.value === 'shell'
                            ? 'bg-[#dcfce7] text-[#16a34a] border-[#16a34a] shadow-sm'
                            : 'bg-[var(--color-text-primary)] text-white border-[var(--color-text-primary)] shadow-sm'
                          : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border-light)] hover:border-[var(--color-border-default)] hover:bg-[var(--color-bg-tertiary)]'
                      }`}
                    >
                      {type.icon && <type.icon className="w-4 h-4" />}
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 难度筛选 */}
              <div>
                <label className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3 block">
                  难度等级
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableDifficulties.map((diff) => {
                    const isSelected = filters.difficulty.includes(diff);
                    const getDifficultyColor = (d: string) => {
                      switch (d) {
                        case 'beginner': return { bg: '#dcfce7', text: '#16a34a', border: '#16a34a' };
                        case 'intermediate': return { bg: '#fef3c7', text: '#d97706', border: '#d97706' };
                        case 'advanced': return { bg: '#fee2e2', text: '#dc2626', border: '#dc2626' };
                        default: return { bg: '#f3f4f6', text: '#6b7280', border: '#6b7280' };
                      }
                    };
                    const color = getDifficultyColor(diff);
                    return (
                      <button
                        key={diff}
                        onClick={() => {
                          const next = filters.difficulty.includes(diff)
                            ? filters.difficulty.filter(d => d !== diff)
                            : [...filters.difficulty, diff];
                          setFilters({ ...filters, difficulty: next });
                        }}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5 border shadow-sm ${
                          isSelected
                            ? 'border-transparent'
                            : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border-light)] hover:border-[var(--color-border-default)]'
                        }`}
                        style={isSelected ? {
                          backgroundColor: color.bg,
                          color: color.text,
                          borderColor: color.border
                        } : undefined}
                      >
                        {isSelected && <CheckCircle className="w-3.5 h-3.5" style={{ color: isSelected ? color.text : undefined }} />}
                        {getDifficultyLabel(diff)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 标签筛选 */}
              {availableTags.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3 block">
                    标签筛选
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map((tag) => {
                      const isSelected = filters.tags.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => {
                            const next = filters.tags.includes(tag)
                              ? filters.tags.filter(t => t !== tag)
                              : [...filters.tags, tag];
                            setFilters({ ...filters, tags: next });
                          }}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5 border ${
                            isSelected
                              ? 'bg-[var(--color-accent-primary)] text-white border-[var(--color-accent-primary)] shadow-sm'
                              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border-light)] hover:border-[var(--color-accent-primary)]/50 hover:text-[var(--color-accent-primary)]'
                          }`}
                        >
                          {isSelected && <CheckCircle className="w-3.5 h-3.5" />}
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {filteredCourses.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[var(--color-text-secondary)] mb-4">没有找到符合条件的课程</p>
            <Button variant="secondary" onClick={handleResetFilters}>清除筛选</Button>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-2'}>
            {filteredCourses.map((course) => {
              const isRunning = containers.some(c => c.courseId === course.id && c.state === 'running');
              const isPaused = containers.some(c => c.courseId === course.id && c.state === 'paused');

              const progress = progressMap[course.id];
              const progressPercent = course.totalSteps && progress
                ? Math.round((progress.stepIndex + 1) / course.totalSteps * 100)
                : 0;
              
              let courseStatus: 'completed' | 'in-progress' | 'to-learn' = 'to-learn';
              if (progress?.completed) {
                courseStatus = 'completed';
              } else if (progress) {
                courseStatus = 'in-progress';
              }

              if (viewMode === 'list') {
                return (
                  <Link
                    to={`/learn/${course.id}`}
                    key={course.id}
                    className={`
                      group flex items-center gap-4 p-5 rounded-xl 
                      border bg-[var(--color-bg-primary)]
                      transition-all duration-200 ease-out
                      hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5
                      active:translate-y-0 active:shadow-[var(--shadow-sm)]
                      ${isRunning 
                        ? course.sqlTerminal 
                          ? 'border-l-[3px] border-l-[var(--color-accent-primary)] border-y-[var(--color-border-light)] border-r-[var(--color-border-light)] shadow-[var(--shadow-sm)]' 
                          : 'border-l-[3px] border-l-[#3b82f6] border-y-[var(--color-border-light)] border-r-[var(--color-border-light)] shadow-[var(--shadow-sm)]'
                        : course.sqlTerminal
                          ? 'border-[var(--color-border-light)] hover:border-[var(--color-accent-primary)]'
                          : 'border-[var(--color-border-light)] hover:border-[#3b82f6]'
                      }
                    `}
                  >
                    <div className={`
                      flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center
                      transition-colors duration-200 border-2
                      ${course.sqlTerminal 
                        ? 'bg-[var(--color-accent-subtle)] border-[var(--color-accent-primary)]/20 group-hover:border-[var(--color-accent-primary)]/40' 
                        : 'bg-[rgba(59,130,246,0.1)] border-[#3b82f6]/20 group-hover:border-[#3b82f6]/40'
                      }
                    `}>
                      {course.sqlTerminal ? (
                        <Database className="w-5 h-5 text-[var(--color-accent-primary)]" />
                      ) : (
                        <Terminal className="w-5 h-5 text-[#3b82f6]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate group-hover:text-[var(--color-accent-primary)] transition-colors duration-200">
                          {course.title}
                        </h3>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          course.sqlTerminal 
                            ? 'bg-[#ede9fe] text-[#7c3aed] border border-[#7c3aed]/40' 
                            : 'bg-[#dcfce7] text-[#16a34a] border border-[#16a34a]/40'
                        }`}>
                          {course.sqlTerminal ? 'SQL' : 'SHELL'}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-text-tertiary)] truncate leading-relaxed">
                        {course.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide ${
                        course.difficulty === 'beginner' ? 'bg-[var(--color-success-subtle)] text-[var(--color-success)]' :
                        course.difficulty === 'intermediate' ? 'bg-[var(--color-warning-subtle)] text-[var(--color-warning)]' :
                        'bg-[var(--color-error-subtle)] text-[var(--color-error)]'
                      }`}>
                        {getDifficultyLabel(course.difficulty)}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-[var(--color-text-tertiary)]">
                        <Clock className="w-3.5 h-3.5" />
                        {course.estimatedMinutes} 分钟
                      </span>
                      {progressMap[course.id]?.completed ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--color-success-subtle)] text-[var(--color-success)]">
                          <CheckCircle className="w-3.5 h-3.5" />
                          已完成
                        </span>
                      ) : progressMap[course.id] ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[rgba(59,130,246,0.1)] text-[#3b82f6]">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" />
                          进行中 ({course.totalSteps ? Math.round((progressMap[course.id].stepIndex + 1) / course.totalSteps * 100) : 0}%)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
                          <Circle className="w-3.5 h-3.5" />
                          待学习
                        </span>
                      )}
                      {isRunning && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--color-success-subtle)] text-[var(--color-success)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
                          运行中
                        </span>
                      )}
                      {isPaused && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--color-warning-subtle)] text-[var(--color-warning)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-warning)]" />
                          已暂停
                        </span>
                      )}
                    </div>
                  </Link>
                );
              }

              return (
                <Link
                  to={`/learn/${course.id}`}
                  key={course.id}
                  className={`
                    group block p-5 rounded-xl
                    border transition-all duration-200 ease-out
                    hover:shadow-md hover:-translate-y-0.5
                    active:translate-y-0 active:shadow-sm
                    ${
                      courseStatus === 'completed' 
                        ? 'bg-green-50/40 border-green-200 hover:border-green-300' 
                        : courseStatus === 'in-progress'
                        ? 'bg-blue-50/40 border-blue-200 hover:border-blue-300'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`
                      flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center
                      transition-colors duration-200 border-2
                      ${course.sqlTerminal 
                        ? 'bg-[var(--color-accent-subtle)] border-[var(--color-accent-primary)]/20 group-hover:border-[var(--color-accent-primary)]/40' 
                        : 'bg-[rgba(59,130,246,0.1)] border-[#3b82f6]/20 group-hover:border-[#3b82f6]/40'
                      }
                    `}>
                      {course.sqlTerminal ? (
                        <Database className="w-5 h-5 text-[var(--color-accent-primary)]" />
                      ) : (
                        <Terminal className="w-5 h-5 text-[#3b82f6]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate group-hover:text-[var(--color-accent-primary)] transition-colors duration-200">
                          {course.title}
                        </h3>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          course.sqlTerminal 
                            ? 'bg-[#ede9fe] text-[#7c3aed] border border-[#7c3aed]/40' 
                            : 'bg-[#dcfce7] text-[#16a34a] border border-[#16a34a]/40'
                        }`}>
                          {course.sqlTerminal ? 'SQL' : 'SHELL'}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-text-tertiary)] line-clamp-2 leading-relaxed">
                        {course.description}
                      </p>
                      
                      {courseStatus === 'in-progress' && (
                        <div className="mt-2 h-1.5 w-full bg-blue-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border-light)]">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide ${
                        course.difficulty === 'beginner' ? 'bg-[var(--color-success-subtle)] text-[var(--color-success)]' :
                        course.difficulty === 'intermediate' ? 'bg-[var(--color-warning-subtle)] text-[var(--color-warning)]' :
                        'bg-[var(--color-error-subtle)] text-[var(--color-error)]'
                      }`}>
                        {getDifficultyLabel(course.difficulty)}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-[var(--color-text-tertiary)]">
                        <Clock className="w-3.5 h-3.5" />
                        {course.estimatedMinutes} 分钟
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {courseStatus === 'completed' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">
                          <CheckCircle className="w-3.5 h-3.5" />
                          已完成
                        </span>
                      ) : courseStatus === 'in-progress' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                          进行中 {progressPercent}%
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700">
                          <Circle className="w-3.5 h-3.5" />
                          待学习
                        </span>
                      )}
                      
                      {isRunning && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--color-success-subtle)] text-[var(--color-success)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
                          运行中
                        </span>
                      )}
                      {isPaused && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--color-warning-subtle)] text-[var(--color-warning)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-warning)]" />
                          已暂停
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
            <ProposeCourseCard mode={viewMode} />
          </div>
        )}
      </div>

      {showCleanupModal && (
        <Dialog open={showCleanupModal} onOpenChange={setShowCleanupModal}>
          <DialogContent className="w-[90vw] max-w-4xl min-w-[800px] p-0 overflow-hidden border-none shadow-2xl bg-[var(--color-bg-primary)]">
            <div className="p-8 pb-0">
              <div className="flex items-start gap-5">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[var(--color-error-subtle)] flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-[var(--color-error)]" />
                </div>
                <div className="flex-1">
                  <DialogTitle className="text-xl font-semibold text-[var(--color-text-primary)]">
                    确认清理环境
                  </DialogTitle>
                  <p className="mt-3 text-base text-[var(--color-text-secondary)] leading-relaxed">
                    检测到 {containers.length} 个正在运行的容器环境。选择需要清理的容器，清理后所有未保存的进度和数据将丢失。
                  </p>
                </div>
              </div>
            </div>

            <div className="px-8 py-6">
              <div className="flex items-center justify-between mb-4 px-1">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedCourses.size === containers.length && containers.length > 0}
                    onChange={handleSelectAll}
                    className="w-5 h-5 rounded border-[var(--color-border-default)] text-[var(--color-accent-primary)] focus:ring-[var(--color-accent-primary)] cursor-pointer"
                  />
                  <span className="text-base font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-text-secondary)] transition-colors">
                    全选
                  </span>
                </label>
                <span className="text-sm text-[var(--color-text-tertiary)]">
                  已选择 {selectedCourses.size} / {containers.length} 个
                </span>
              </div>

              <div className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] max-h-[520px] min-h-[300px] overflow-y-auto">
                {containers.map((container, index) => {
                  const course = courses.find(c => c.id === container.courseId);
                  const isSelected = selectedCourses.has(container.courseId);
                  const isSql = course?.sqlTerminal ?? false;
                  
                  return (
                    <div 
                      key={container.id} 
                      className={`flex items-center gap-4 p-5 text-base transition-colors cursor-pointer ${
                        isSelected ? 'bg-[var(--color-accent-subtle)]' : 'hover:bg-[var(--color-bg-tertiary)]'
                      } ${index !== containers.length - 1 ? 'border-b border-[var(--color-border-light)]' : ''}`}
                      onClick={() => handleSelectContainer(container.courseId)}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectContainer(container.courseId)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-5 h-5 rounded border-[var(--color-border-default)] text-[var(--color-accent-primary)] focus:ring-[var(--color-accent-primary)] cursor-pointer shrink-0"
                      />
                      
                      <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                        isSql 
                          ? 'bg-[var(--color-accent-subtle)]' 
                          : 'bg-[rgba(59,130,246,0.1)]'
                      }`}>
                        {isSql ? (
                          <Database className="w-5 h-5 text-[var(--color-accent-primary)]" />
                        ) : (
                          <Terminal className="w-5 h-5 text-[#3b82f6]" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3">
                          <span 
                            className="font-semibold text-[var(--color-text-primary)] text-base leading-snug"
                            title={course?.title || container.name || '未命名容器'}
                          >
                            {course?.title || container.name || '未命名容器'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-xs font-semibold shrink-0 mt-0.5 ${
                            isSql 
                              ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent-primary)]' 
                              : 'bg-[rgba(59,130,246,0.1)] text-[#3b82f6]'
                          }`}>
                            {isSql ? 'SQL' : 'Shell'}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-[var(--color-text-secondary)]">
                          <span className="flex items-center gap-1.5 shrink-0">
                            <Clock className="w-4 h-4" />
                            运行 {formatDuration(container.startedAt)}
                          </span>
                          <span 
                            className="font-mono text-[var(--color-text-tertiary)] truncate max-w-[280px]"
                            title={container.id}
                          >
                            {container.id}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <div className={`w-2.5 h-2.5 rounded-full ${
                          container.state === 'running' ? 'bg-[var(--color-success)]' :
                          container.state === 'paused' ? 'bg-[var(--color-warning)]' :
                          'bg-[var(--color-text-tertiary)]'
                        }`} />
                        <span className="text-sm font-medium text-[var(--color-text-secondary)] capitalize">
                          {container.state === 'running' ? '运行中' :
                           container.state === 'paused' ? '已暂停' :
                           container.state}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {containers.length === 0 && (
                <div className="text-center py-16 text-[var(--color-text-tertiary)]">
                  <p className="text-base">暂无运行中的容器</p>
                </div>
              )}
            </div>

            <div className="p-8 flex items-center justify-between bg-[var(--color-bg-primary)] border-t border-[var(--color-border-light)]">
              <div className="text-base text-[var(--color-text-secondary)]">
                {selectedCourses.size > 0 ? (
                  <span className="text-[var(--color-error)] font-semibold">
                    将清理 {selectedCourses.size} 个容器
                  </span>
                ) : (
                  <span className="text-[var(--color-text-tertiary)]">
                    请选择要清理的容器
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="lg"
                  onClick={() => setShowCleanupModal(false)} 
                  disabled={cleaning}
                  className="hover:bg-[var(--color-bg-secondary)] px-6"
                >
                  取消
                </Button>
                <Button 
                  variant="danger" 
                  size="lg"
                  onClick={handleCleanup} 
                  loading={cleaning}
                  disabled={selectedCourses.size === 0}
                  className="shadow-sm shadow-red-500/20 px-6"
                >
                  {cleaning ? '正在清理...' : `确认清理 (${selectedCourses.size})`}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default CourseList;
