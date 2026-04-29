import React, { useState, useId, useEffect, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Button } from '@/components/ui/Button';

interface ProposeCourseCardProps {
  className?: string;
  mode?: 'grid' | 'list';
}

type IssueTarget = 'atomgit' | 'github';
type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

const ProposeCourseCard: React.FC<ProposeCourseCardProps> = ({ className, mode = 'grid' }) => {
  const atomgitIssueBaseUrl = 'https://atomgit.com/kwdb/playground/issues/new';
  const githubIssueBaseUrl = 'https://github.com/KWDB/playground/issues/new';
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
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
    if (submitSuccess) setSubmitSuccess(null);
    if (submitStatus !== 'submitting') setSubmitStatus('idle');
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSubmitError(null);
    setSubmitSuccess(null);
    setSubmitStatus('idle');
  };

  const openModal = () => {
    setIsModalOpen(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    setSubmitStatus('idle');
    setIssueTarget('atomgit');
  };

  const canSubmit = formData.courseName.trim().length > 0 && formData.description.trim().length > 0;

  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  useEffect(() => {
    if (isModalOpen) {
      previousActiveElement.current = document.activeElement;
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    } else {
      if (previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus();
      }
    }
  }, [isModalOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusableElements || focusableElements.length === 0) return;
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
    if (e.key === 'Escape') {
      closeModal();
    }
  };

  const submitIssue = async (target: IssueTarget) => {
    if (submitStatus === 'submitting') return;
    setSubmitError(null);
    setSubmitSuccess(null);
    setSubmitStatus('submitting');

    if (!canSubmit) {
      setSubmitError('请填写课程名称和需求描述');
      setSubmitStatus('error');
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
    await new Promise((resolve) => window.setTimeout(resolve, 200));
    const issueWindow = window.open(issueUrl, '_blank', 'noopener,noreferrer');

    if (!issueWindow) {
      setSubmitError('未能打开新窗口，请检查浏览器弹窗设置后重试');
      setSubmitStatus('error');
      return;
    }

    setSubmitStatus('success');
    setSubmitSuccess('已成功打开提交页面，正在为您跳转');
    window.setTimeout(() => {
      closeModal();
      setFormData({ courseName: '', description: '', contact: '' });
    }, 650);
  };

  return (
    <>
      {mode === 'grid' ? (
        <button
          onClick={openModal}
          className={cn(
            'group block w-full p-5 rounded-xl',
            'border border-dashed border-[var(--color-border-default)]',
            'bg-[var(--color-bg-secondary)]',
            'transition-all duration-200 ease-out',
            'hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-bg-tertiary)] hover:shadow-[var(--shadow-sm)]',
            'active:translate-y-[1px]',
            className
          )}
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-[var(--color-bg-tertiary)] flex items-center justify-center group-hover:bg-[var(--color-accent-subtle)] transition-colors duration-200">
              <Plus className="w-5 h-5 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-accent-primary)] transition-colors duration-200" aria-hidden="true" />
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
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] group-hover:bg-[var(--color-accent-subtle)] group-hover:text-[var(--color-accent-primary)] transition-colors duration-200">
                建议
              </span>
            </div>
          </div>
        </button>
      ) : (
        <button
          onClick={openModal}
          className={cn(
            'group flex items-center gap-4 p-5 rounded-xl w-full',
            'border border-dashed border-[var(--color-border-default)]',
            'bg-[var(--color-bg-secondary)]',
            'transition-all duration-200 ease-out',
            'hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-bg-tertiary)] hover:shadow-[var(--shadow-sm)]',
            'active:translate-y-[1px]',
            className
          )}
        >
          <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-[var(--color-bg-tertiary)] flex items-center justify-center group-hover:bg-[var(--color-accent-subtle)] transition-colors duration-200">
            <Plus className="w-5 h-5 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-accent-primary)] transition-colors duration-200" aria-hidden="true" />
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
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] group-hover:bg-[var(--color-accent-subtle)] group-hover:text-[var(--color-accent-primary)] transition-colors duration-200">
              建议
            </span>
          </div>
        </button>
      )}

      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation" onKeyDown={handleKeyDown}>
          <div className="fixed inset-0 bg-black/40" onClick={closeModal} aria-hidden="true" />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="relative z-10 w-full max-w-sm bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border-default)] shadow-[var(--shadow-lg)] overflow-hidden animate-fade-in"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-light)]">
              <div>
                <h3 id={titleId} className="text-sm font-medium text-[var(--color-text-primary)]">反馈/提议新课程</h3>
                <p id={descriptionId} className="text-xs text-[var(--color-text-tertiary)] mt-0.5">反馈您的课程建议或发现的 BUG</p>
              </div>
              <button
                onClick={closeModal}
                aria-label="关闭提议新课程弹窗"
                className="p-1 rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitIssue(issueTarget);
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
                        ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    )}
                    onClick={() => {
                      setIssueTarget('atomgit');
                      if (submitStatus !== 'submitting') {
                        setSubmitError(null);
                        setSubmitSuccess(null);
                        setSubmitStatus('idle');
                      }
                    }}
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
                        ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    )}
                    onClick={() => {
                      setIssueTarget('github');
                      if (submitStatus !== 'submitting') {
                        setSubmitError(null);
                        setSubmitSuccess(null);
                        setSubmitStatus('idle');
                      }
                    }}
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
                  aria-describedby="courseName-hint"
                  aria-invalid={!canSubmit && submitStatus === 'error'}
                />
                <span id="courseName-hint" className="sr-only">最多80个字符</span>
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
                  aria-describedby="description-count"
                  aria-invalid={!canSubmit && submitStatus === 'error'}
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
                  aria-describedby="contact-hint"
                />
                <span id="contact-hint" className="sr-only">最多120个字符</span>
              </div>

              <div id="description-count" className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)] tabular-nums">
                <span>需求描述</span>
                <span>{formData.description.length}/1000</span>
              </div>

              <div className="pt-2 space-y-2">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  disabled={!canSubmit || submitStatus === 'submitting'}
                  loading={submitStatus === 'submitting'}
                >
                  {submitStatus === 'submitting'
                    ? '正在打开提交通道...'
                    : submitStatus === 'success'
                      ? '已打开，正在跳转...'
                      : issueTarget === 'atomgit'
                        ? '提交到 AtomGit'
                        : '提交到 GitHub'}
                </Button>
                {submitStatus === 'error' && submitError && (
                  <p className="text-xs text-[var(--color-error)] text-center mt-2" role="alert">{submitError}</p>
                )}
                {submitStatus === 'success' && submitSuccess && (
                  <p className="text-xs text-[var(--color-success)] text-center mt-2" role="status">{submitSuccess}</p>
                )}
                <p className="text-xs text-[var(--color-text-tertiary)] text-center mt-3">
                  点击后将跳转至对应平台的新建 Issue 页面
                </p>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default ProposeCourseCard;
