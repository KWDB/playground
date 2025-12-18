import React, { useState, useEffect, useRef } from 'react';
import { Search, Filter, Clock, Tag, Layers, Check, RotateCcw, Activity } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind class merging
function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export interface FilterState {
  type: 'all' | 'sql' | 'shell';
  difficulty: string[];
  tags: string[];
  timeRange: [number, number];
}

interface CourseFilterProps {
  onSearch: (query: string) => void;
  onFilterChange: (filters: FilterState) => void;
  onReset: () => void;
  availableTags: string[];
  availableDifficulties: string[];
  maxDuration: number;
  initialFilters: FilterState;
  filterCount: number;
}

export function CourseFilter({
  onSearch,
  onFilterChange,
  onReset,
  availableTags,
  availableDifficulties,
  maxDuration,
  initialFilters,
  filterCount
}: CourseFilterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false); // For mobile/collapsible panel
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const filterRef = useRef<HTMLDivElement>(null);

  // Debounce search internally or just pass up? 
  // The parent handles debounce for the *effect*, but we need to update input immediately.
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    onSearch(e.target.value);
  };

  const handleFilterChange = (key: keyof FilterState, value: string | string[] | [number, number]) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const toggleDifficulty = (diff: string) => {
    const current = filters.difficulty;
    const next = current.includes(diff)
      ? current.filter(d => d !== diff)
      : [...current, diff];
    handleFilterChange('difficulty', next);
  };

  const toggleTag = (tag: string) => {
    const current = filters.tags;
    const next = current.includes(tag)
      ? current.filter(t => t !== tag)
      : [...current, tag];
    handleFilterChange('tags', next);
  };

  // Sync local state with props if reset happens externally
  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  // Handle click outside to close filter panel
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node) && isOpen) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleResetAll = () => {
    setSearchQuery('');
    onSearch('');
    onReset();
    // onReset should reset the filters in parent, which will propagate back via initialFilters prop if we structured it that way,
    // but here we also need to reset local state immediately to feel responsive.
    // Actually, if parent updates initialFilters, the useEffect above will handle it.
    // But let's call onReset and let parent handle it.
  };

  return (
    <div 
      ref={filterRef}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6 transition-all"
    >
      {/* Top Bar: Search & Filter Toggle */}
      <div className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out"
            placeholder="搜索课程名称、编号..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              "flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors w-full md:w-auto",
              isOpen || filterCount > 0
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300"
                : "bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300"
            )}
          >
            <Filter className="h-4 w-4" />
            筛选
            {filterCount > 0 && (
              <span className="ml-1 bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {filterCount}
              </span>
            )}
          </button>
          
          {filterCount > 0 && (
             <button
                onClick={handleResetAll}
                className="flex items-center justify-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
             >
                <RotateCcw className="h-4 w-4" />
                重置
             </button>
          )}
        </div>
      </div>

      {/* Filter Panel */}
      {isOpen && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-6 animate-in slide-in-from-top-2 duration-200">
          
          {/* Course Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Layers className="h-4 w-4" />
              课程类型
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'all', label: '全部' },
                { value: 'sql', label: 'SQL' },
                { value: 'shell', label: 'Shell' },
              ].map((type) => (
                <button
                  key={type.value}
                  onClick={() => handleFilterChange('type', type.value)}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded-full transition-colors border",
                    filters.type === type.value
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
                  )}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Activity className="h-4 w-4" /> {/* Using generic icon if specific one not imported, Check imports */}
              难度
            </label>
            <div className="flex flex-wrap gap-2">
              {availableDifficulties.map((diff) => (
                <button
                  key={diff}
                  onClick={() => toggleDifficulty(diff)}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded-full transition-colors border flex items-center gap-1",
                    filters.difficulty.includes(diff)
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
                  )}
                >
                  {filters.difficulty.includes(diff) && <Check className="h-3 w-3" />}
                  {diff === 'beginner' ? '初级' : diff === 'intermediate' ? '中级' : diff === 'hard' ? '高级' : diff}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Tag className="h-4 w-4" />
              标签
            </label>
            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded-full transition-colors border flex items-center gap-1",
                    filters.tags.includes(tag)
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
                  )}
                >
                  {filters.tags.includes(tag) && <Check className="h-3 w-3" />}
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Time Range */}
          <div className="space-y-2">
             <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              时间范围 (分钟)
            </label>
            <div className="flex items-center gap-4">
              <div className="w-full max-w-xs space-y-4">
                 <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>{filters.timeRange[0]} min</span>
                    <span>{filters.timeRange[1]} min</span>
                 </div>
                 {/* Simple Range Inputs simulation */}
                 <div className="flex items-center gap-2">
                    <input 
                        type="number" 
                        min={0} 
                        max={filters.timeRange[1]}
                        value={filters.timeRange[0]}
                        onChange={(e) => handleFilterChange('timeRange', [Number(e.target.value), filters.timeRange[1]])}
                        className="w-20 px-2 py-1 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600"
                    />
                    <span className="text-gray-400">-</span>
                    <input 
                        type="number" 
                        min={filters.timeRange[0]} 
                        max={maxDuration}
                        value={filters.timeRange[1]}
                        onChange={(e) => handleFilterChange('timeRange', [filters.timeRange[0], Number(e.target.value)])}
                        className="w-20 px-2 py-1 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600"
                    />
                 </div>
                 <input
                    type="range"
                    min={0}
                    max={maxDuration}
                    value={filters.timeRange[1]}
                    onChange={(e) => handleFilterChange('timeRange', [filters.timeRange[0], Number(e.target.value)])}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-indigo-600"
                 />
                 <p className="text-xs text-gray-500">拖动滑块调整最大时间</p>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
