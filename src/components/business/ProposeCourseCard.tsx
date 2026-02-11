import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ProposeCourseCardProps {
  className?: string;
  mode?: 'grid' | 'list';
}

const ProposeCourseCard: React.FC<ProposeCourseCardProps> = ({ className, mode = 'grid' }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    courseName: '',
    description: '',
    contact: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const title = '新课程需求';
    const body = `
课程名称：${formData.courseName}
需求描述：${formData.description}
联系方式：${formData.contact}
`.trim();

    const githubIssueUrl = `https://github.com/KWDB/playground/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;

    window.open(githubIssueUrl, '_blank');
    setIsModalOpen(false);
    setFormData({ courseName: '', description: '', contact: '' });
  };

  return (
    <>
      {mode === 'grid' ? (
        <button
          onClick={() => setIsModalOpen(true)}
          className={`
            group block p-5 rounded-xl 
            border border-dashed border-[var(--color-border-default)]
            bg-[var(--color-bg-secondary)]
            transition-all duration-200 ease-out
            hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-bg-primary)] hover:shadow-[var(--shadow-sm)]
            hover:-translate-y-0.5 active:translate-y-0
            ${className}
          `}
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-[var(--color-bg-tertiary)] flex items-center justify-center group-hover:bg-[var(--color-accent-subtle)] transition-colors duration-200">
              <Plus className="w-5 h-5 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-accent-primary)] transition-colors duration-200" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate group-hover:text-[var(--color-accent-primary)] transition-colors duration-200 text-left">
                提议新课程
              </h3>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1.5 text-left leading-relaxed">
                希望有更多课程？
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-dashed border-[var(--color-border-light)]">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] group-hover:bg-[var(--color-accent-subtle)] group-hover:text-[var(--color-accent-primary)] transition-colors duration-200">
                建议
              </span>
            </div>
          </div>
        </button>
      ) : (
        <button
          onClick={() => setIsModalOpen(true)}
          className={`
            group flex items-center gap-4 p-5 rounded-xl
            border border-dashed border-[var(--color-border-default)]
            bg-[var(--color-bg-secondary)]
            transition-all duration-200 ease-out
            hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-bg-primary)] hover:shadow-[var(--shadow-sm)]
            hover:-translate-y-0.5 active:translate-y-0
            w-full ${className}
          `}
        >
          <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-[var(--color-bg-tertiary)] flex items-center justify-center group-hover:bg-[var(--color-accent-subtle)] transition-colors duration-200">
            <Plus className="w-5 h-5 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-accent-primary)] transition-colors duration-200" />
          </div>
          <div className="flex-1 min-w-0 flex flex-col">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate group-hover:text-[var(--color-accent-primary)] transition-colors duration-200 text-left">
              提议新课程
            </h3>
            <p className="text-xs text-[var(--color-text-tertiary)] truncate text-left">
              希望有更多课程？
            </p>
          </div>
          <div className="flex-shrink-0">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] group-hover:bg-[var(--color-accent-subtle)] group-hover:text-[var(--color-accent-primary)] transition-colors duration-200">
              建议
            </span>
          </div>
        </button>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative z-10 w-full max-w-sm bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border-default)] shadow-xl overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-light)]">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">提议新课程</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label htmlFor="courseName" className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                  课程名称
                </label>
                <input
                  type="text"
                  id="courseName"
                  name="courseName"
                  required
                  value={formData.courseName}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="例如：KWDB 高级查询优化"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                  需求描述
                </label>
                <textarea
                  id="description"
                  name="description"
                  required
                  rows={3}
                  value={formData.description}
                  onChange={handleInputChange}
                  className="input resize-none"
                  placeholder="请简要描述您希望学习的内容..."
                />
              </div>

              <div>
                <label htmlFor="contact" className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                  联系方式 (可选)
                </label>
                <input
                  type="text"
                  id="contact"
                  name="contact"
                  value={formData.contact}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="邮箱或微信号"
                />
              </div>

              <div className="pt-2">
                <Button type="submit" variant="primary" className="w-full">
                  提交反馈
                </Button>
                <p className="text-xs text-[var(--color-text-tertiary)] text-center mt-3">
                  点击后将跳转至 GitHub Issue
                </p>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default ProposeCourseCard;
