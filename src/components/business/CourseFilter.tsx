import React, { useState, useEffect, useRef } from 'react';
import { Search, Filter, RefreshCw as RotateCcw, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Button } from '@/components/ui/Button';

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
  initialFilters: FilterState;
  filterCount: number;
}

export function CourseFilter({
  onSearch,
  onFilterChange,
  onReset,
  availableTags,
  availableDifficulties,
  initialFilters,
  filterCount
}: CourseFilterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const filterRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node) && isOpen) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => { document.removeEventListener("mousedown", handleClickOutside); };
  }, [isOpen]);

  const handleResetAll = () => {
    setSearchQuery('');
    onSearch('');
    onReset();
  };

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return '初级';
      case 'intermediate': return '中级';
      case 'hard': return '高级';
      default: return difficulty;
    }
  };

  return (
    <div ref={filterRef} className="mb-6">
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="搜索课程..."
            className="input pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={isOpen || filterCount > 0 ? 'primary' : 'secondary'}
            size="md"
            onClick={() => setIsOpen(!isOpen)}
            className="gap-2"
          >
            <Filter className="w-4 h-4" />
            筛选
            {filterCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-xs bg-white/20">{filterCount}</span>
            )}
          </Button>
          {filterCount > 0 && (
            <Button variant="ghost" size="md" onClick={handleResetAll} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              重置
            </Button>
          )}
        </div>
      </div>

      {isOpen && (
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
                  onClick={() => handleFilterChange('type', type.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm transition-colors',
                    filters.type === type.value
                      ? 'bg-[var(--color-accent-primary)] text-white'
                      : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                  )}
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
                  onClick={() => toggleDifficulty(diff)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-1.5 whitespace-nowrap',
                    filters.difficulty.includes(diff)
                      ? 'bg-[var(--color-accent-primary)] text-white'
                      : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                  )}
                >
                  {filters.difficulty.includes(diff) && (
                    <Check className="w-3.5 h-3.5 shrink-0" />
                  )}
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
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-1.5 whitespace-nowrap min-w-0',
                      filters.tags.includes(tag)
                        ? 'bg-[var(--color-accent-primary)] text-white'
                        : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                    )}
                  >
                    {filters.tags.includes(tag) && (
                      <Check className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="truncate">{tag}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
