import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Button } from '@/components/ui/Button';

interface ProposeCourseCardProps {
  className?: string;
  mode?: 'grid' | 'list';
}

type IssueTarget = 'atomgit' | 'github';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

const ProposeCourseCard: React.FC<ProposeCourseCardProps> = ({ className, mode = 'grid' }) => {
  const atomgitIssueBaseUrl = 'https://atomgit.com/kwdb/playground/issues/new';
  const githubIssueBaseUrl = 'https://github.com/KWDB/playground/issues/new';
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [issueTarget, setIssueTarget] = useState<IssueTarget>('atomgit');
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
    if (submitError) setSubmitError(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSubmitError(null);
  };

  const openModal = () => {
    setIsModalOpen(true);
    setSubmitError(null);
    setIssueTarget('atomgit');
  };

  const canSubmit = formData.courseName.trim().length > 0 && formData.description.trim().length > 0;

  const submitIssue = (target: IssueTarget) => {
    if (!canSubmit) {
      setSubmitError('请填写课程名称和需求描述');
      return;
    }

    const title = '新课程需求';
    const body = [
      `课程名称：${formData.courseName.trim()}`,
      `需求描述：${formData.description.trim()}`,
      `联系方式：${formData.contact.trim() || '未提供'}`
    ].join('\n');
    const params = new URLSearchParams({
      title,
      body,
    });
    const issueBaseUrl = target === 'atomgit' ? atomgitIssueBaseUrl : githubIssueBaseUrl;
    const issueUrl = `${issueBaseUrl}?${params.toString()}`;
    const issueWindow = window.open(issueUrl, '_blank', 'noopener,noreferrer');

    if (!issueWindow) {
      setSubmitError('未能打开新窗口，请检查浏览器弹窗设置后重试');
      return;
    }

    closeModal();
    setFormData({ courseName: '', description: '', contact: '' });
  };

  return (
    <>
      {mode === 'grid' ? (
        <button
          onClick={openModal}
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
                反馈/提议新课程
              </h3>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1.5 text-left leading-relaxed">
                发现 BUG？希望有更多课程？
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
          onClick={openModal}
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
              反馈/提议新课程
            </h3>
            <p className="text-xs text-[var(--color-text-tertiary)] truncate text-left">
              发现 BUG？希望有更多课程？
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
          <div className="fixed inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative z-10 w-full max-w-sm bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border-default)] shadow-xl overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-light)]">
              <div>
                <h3 className="text-sm font-medium text-[var(--color-text-primary)]">反馈/提议新课程</h3>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">反馈您的课程建议或发现的 BUG</p>
              </div>
              <button
                onClick={closeModal}
                aria-label="关闭提议新课程弹窗"
                className="p-1 rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitIssue(issueTarget);
              }}
              className="p-4 space-y-4"
            >
              <div className="space-y-2">
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">提交渠道</p>
                <div role="tablist" aria-label="Issue 提交渠道" className="grid grid-cols-2 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-1">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={issueTarget === 'atomgit'}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-sm transition-colors duration-150',
                      issueTarget === 'atomgit'
                        ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    )}
                    onClick={() => setIssueTarget('atomgit')}
                  >
                    AtomGit
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={issueTarget === 'github'}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-sm transition-colors duration-150',
                      issueTarget === 'github'
                        ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    )}
                    onClick={() => setIssueTarget('github')}
                  >
                    GitHub
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="courseName" className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                  课程名称
                </label>
                <input
                  type="text"
                  id="courseName"
                  name="courseName"
                  required
                  maxLength={80}
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
                  maxLength={1000}
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
                  maxLength={120}
                  value={formData.contact}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="邮箱或微信号"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)] tabular-nums">
                <span>需求描述</span>
                <span>{formData.description.length}/1000</span>
              </div>

              <div className="pt-2 space-y-2">
                <Button type="submit" variant="primary" className="w-full" disabled={!canSubmit}>
                  {issueTarget === 'atomgit' ? '提交到 AtomGit' : '提交到 GitHub'}
                </Button>
                {submitError && (
                  <p className="text-xs text-[var(--color-error)] text-center mt-2">{submitError}</p>
                )}
                <p className="text-xs text-[var(--color-text-tertiary)] text-center mt-3">
                  点击后将跳转至对应平台的新建 Issue 页面
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
