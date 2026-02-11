import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Clock, BookOpen, AlertCircle, Trash2, CheckCircle, Terminal, Database, LayoutGrid, List as ListIcon, Search, Filter, RefreshCw } from 'lucide-react';
import { ContainerInfo } from '@/types';
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
}

interface FilterState {
  type: 'all' | 'sql' | 'shell';
  difficulty: string[];
  tags: string[];
  timeRange: [number, number];
}

export function CourseList() {
  const [courses, setCourses] = useState<Course[]>([]);
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

  const handleCleanup = async () => {
    setCleaning(true);
    try {
      const response = await fetch('/api/containers', { method: 'DELETE' });
      if (response.ok) {
        fetchContainers();
        setTimeout(() => {
          if (showCleanupModal) setShowCleanupModal(false);
        }, 1500);
      }
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
    <div className="w-full min-h-dvh bg-[var(--color-bg-primary)]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-light)]">
              <BookOpen className="w-5 h-5 text-[var(--color-text-primary)]" />
            </div>
            <div>
              <h1 className="text-xl font-medium text-[var(--color-text-primary)]">课程列表</h1>
              <p className="text-sm text-[var(--color-text-tertiary)]">{filteredCourses.length} 门课程</p>
            </div>
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
            <div className="mt-4 pt-4 border-t border-[var(--color-border-light)] space-y-4">
              <div>
                <label className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2 block">类型</label>
                <div className="flex gap-2">
                  {[
                    { value: 'all', label: '全部' },
                    { value: 'sql', label: 'SQL' },
                    { value: 'shell', label: 'Shell' },
                  ].map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setFilters({ ...filters, type: type.value as FilterState['type'] })}
                      className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                        filters.type === type.value
                          ? 'bg-[var(--color-accent-primary)] text-white'
                          : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2 block">难度</label>
                <div className="flex flex-wrap gap-2">
                  {availableDifficulties.map((diff) => (
                    <button
                      key={diff}
                      onClick={() => {
                        const next = filters.difficulty.includes(diff)
                          ? filters.difficulty.filter(d => d !== diff)
                          : [...filters.difficulty, diff];
                        setFilters({ ...filters, difficulty: next });
                      }}
                      className={`px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-1.5 ${
                        filters.difficulty.includes(diff)
                          ? 'bg-[var(--color-accent-primary)] text-white'
                          : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                      }`}
                    >
                      {filters.difficulty.includes(diff) && <CheckCircle className="w-3.5 h-3.5" />}
                      {getDifficultyLabel(diff)}
                    </button>
                  ))}
                </div>
              </div>

              {availableTags.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2 block">标签</label>
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => {
                          const next = filters.tags.includes(tag)
                            ? filters.tags.filter(t => t !== tag)
                            : [...filters.tags, tag];
                          setFilters({ ...filters, tags: next });
                        }}
                        className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                          filters.tags.includes(tag)
                            ? 'bg-[var(--color-accent-primary)] text-white'
                            : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                        }`}
                      >
                        {filters.tags.includes(tag) && <CheckCircle className="w-3.5 h-3.5" />}
                        {tag}
                      </button>
                    ))}
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

              if (viewMode === 'list') {
                return (
                  <Link
                    to={`/learn/${course.id}`}
                    key={course.id}
                    className="flex items-center gap-4 p-4 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] hover:border-[var(--color-border-default)] transition-colors"
                  >
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                      course.sqlTerminal ? 'bg-[var(--color-bg-secondary)]' : 'bg-[var(--color-bg-secondary)]'
                    }`}>
                      {course.sqlTerminal ? (
                        <Database className="w-5 h-5 text-[var(--color-text-primary)]" />
                      ) : (
                        <Terminal className="w-5 h-5 text-[var(--color-text-primary)]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-[var(--color-text-primary)] truncate">{course.title}</h3>
                      <p className="text-xs text-[var(--color-text-tertiary)] truncate mt-0.5">{course.description}</p>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        course.difficulty === 'beginner' ? 'bg-[var(--color-success-subtle)] text-[var(--color-success)]' :
                        course.difficulty === 'intermediate' ? 'bg-[var(--color-warning-subtle)] text-[var(--color-warning)]' :
                        'bg-[var(--color-error-subtle)] text-[var(--color-error)]'
                      }`}>
                        {getDifficultyLabel(course.difficulty)}
                      </span>
                      <span className="text-xs text-[var(--color-text-tertiary)]">{course.estimatedMinutes} 分钟</span>
                      {isRunning && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-success-subtle)] text-[var(--color-success)]">
                          运行中
                        </span>
                      )}
                      {isPaused && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-warning-subtle)] text-[var(--color-warning)]">
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
                  className="group block p-4 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] hover:border-[var(--color-border-default)] transition-colors"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                      course.sqlTerminal ? 'bg-[var(--color-bg-secondary)]' : 'bg-[var(--color-bg-secondary)]'
                    }`}>
                      {course.sqlTerminal ? (
                        <Database className="w-5 h-5 text-[var(--color-text-primary)]" />
                      ) : (
                        <Terminal className="w-5 h-5 text-[var(--color-text-primary)]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-[var(--color-text-primary)] truncate group-hover:text-[var(--color-accent-primary)] transition-colors">
                        {course.title}
                      </h3>
                      <p className="text-xs text-[var(--color-text-tertiary)] mt-1 line-clamp-2">{course.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
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
                    {isRunning && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-success-subtle)] text-[var(--color-success)]">
                        运行中
                      </span>
                    )}
                    {isPaused && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-warning-subtle)] text-[var(--color-warning)]">
                        已暂停
                      </span>
                    )}
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
          <DialogContent className="max-w-sm">
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-[var(--color-error)]" />
              清理确认
            </DialogTitle>
            <div className="mt-4">
              <div className="p-3 rounded-lg bg-[var(--color-error-subtle)] border border-[var(--color-error)] mb-4">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  即将清理 {containers.length} 个运行中的容器。此操作不可撤销。
                </p>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
                {containers.map(container => (
                  <div key={container.id} className="flex items-center justify-between text-sm p-2 rounded bg-[var(--color-bg-secondary)]">
                    <span className="text-[var(--color-text-primary)]">
                      {courses.find(c => c.id === container.courseId)?.title || container.name}
                    </span>
                    <span className="text-xs text-[var(--color-text-tertiary)]">{container.state}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setShowCleanupModal(false)} disabled={cleaning}>
                  取消
                </Button>
                <Button variant="danger" className="flex-1" onClick={handleCleanup} loading={cleaning}>
                  {cleaning ? '清理中...' : '确认清理'}
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
