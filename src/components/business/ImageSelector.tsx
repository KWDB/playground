import React, { useState, useEffect } from 'react';
import { Check, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';

interface ImageSource {
  id: string;
  name: string;
  prefix: string;
  description: string;
  example: string;
}

interface ImageAvailability {
  available: boolean;
  imageName: string;
  message: string;
  checkedAt: string;
  responseTime: number;
}

interface ImageSelectorProps {
  defaultImage: string;
  onImageSelect: (imageWithSource: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageSelector({ defaultImage, onImageSelect, isOpen, onClose }: ImageSelectorProps) {
  const [sources, setSources] = useState<ImageSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string>('docker-hub');
  const [customImage, setCustomImage] = useState<string>('');
  const [checking, setChecking] = useState<boolean>(false);
  const [availability, setAvailability] = useState<ImageAvailability | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedSourceId = localStorage.getItem('imageSourceId');
    const savedCustomImage = localStorage.getItem('customImageName');
    if (savedSourceId) setSelectedSourceId(savedSourceId);
    if (savedCustomImage && savedSourceId === 'custom') setCustomImage(savedCustomImage);
  }, []);

  useEffect(() => {
    const fetchSources = async () => {
      try {
        const response = await fetch('/api/images/sources');
        if (!response.ok) throw new Error('获取镜像源列表失败');
        const data = await response.json();
        setSources(data.sources || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取镜像源列表失败');
      }
    };
    if (isOpen) fetchSources();
  }, [isOpen]);

  const getFullImageName = () => {
    const selectedSource = sources.find(s => s.id === selectedSourceId);
    if (!selectedSource) return defaultImage;
    if (selectedSourceId === 'custom') return customImage || defaultImage;
    const hasRegistryPrefix = /^[a-zA-Z0-9.-]+[.:][0-9]+\//.test(defaultImage) || /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\//.test(defaultImage);
    if (hasRegistryPrefix) {
      const lastSlashIndex = defaultImage.lastIndexOf('/');
      const imageName = lastSlashIndex >= 0 ? defaultImage.substring(lastSlashIndex + 1) : defaultImage;
      return selectedSource.prefix ? `${selectedSource.prefix}${imageName}` : imageName;
    }
    return selectedSource.prefix ? `${selectedSource.prefix}${defaultImage}` : defaultImage;
  };

  const checkAvailability = async () => {
    setChecking(true);
    setAvailability(null);
    setError(null);
    const imageName = getFullImageName();
    try {
      const response = await fetch('/api/images/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageName }),
      });
      if (!response.ok) throw new Error('检查镜像可用性失败');
      const data = await response.json();
      setAvailability(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '检查镜像可用性失败');
    } finally {
      setChecking(false);
    }
  };

  const handleApply = () => {
    const fullImageName = getFullImageName();
    localStorage.setItem('imageSourceId', selectedSourceId);
    if (selectedSourceId === 'custom') localStorage.setItem('customImageName', customImage);
    localStorage.setItem('selectedImageFullName', fullImageName);
    onImageSelect(fullImageName);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border-default)] shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-light)]">
          <div>
            <h2 className="text-sm font-medium text-[var(--color-text-primary)]">容器镜像源</h2>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">选择合适的镜像源以提高下载速度</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {sources.map((source) => (
            <button
              key={source.id}
              onClick={() => setSelectedSourceId(source.id)}
              className={`w-full p-3 rounded-lg border text-left transition-colors ${
                selectedSourceId === source.id
                  ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-subtle)]'
                  : 'border-[var(--color-border-light)] hover:border-[var(--color-border-default)]'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                  selectedSourceId === source.id
                    ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]'
                    : 'border-[var(--color-border-default)]'
                }`}>
                  {selectedSourceId === source.id && <Check className="w-3 h-3 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-[var(--color-text-primary)]">{source.name}</h3>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{source.description}</p>
                  {source.id === 'custom' && selectedSourceId === 'custom' && (
                    <input
                      type="text"
                      placeholder="输入完整的镜像地址"
                      value={customImage}
                      onChange={(e) => setCustomImage(e.target.value)}
                      className="input mt-2"
                    />
                  )}
                  {source.id !== 'custom' && (
                    <p className="text-xs text-[var(--color-text-tertiary)] mt-1 font-mono">示例: {source.example}</p>
                  )}
                </div>
              </div>
            </button>
          ))}

          <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-light)]">
            <p className="text-xs text-[var(--color-text-secondary)] mb-1">当前选择:</p>
            <p className="text-sm font-mono text-[var(--color-text-primary)] break-all">{getFullImageName()}</p>
          </div>

          {availability && (
            <div className={`p-3 rounded-lg border ${
              availability.available
                ? 'bg-[var(--color-success-subtle)] border-[var(--color-success)]'
                : 'bg-[var(--color-error-subtle)] border-[var(--color-error)]'
            }`}>
              <div className="flex items-start gap-2">
                {availability.available ? (
                  <Check className="w-4 h-4 text-[var(--color-success)] mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-[var(--color-error)] mt-0.5" />
                )}
                <div>
                  <p className={`text-sm font-medium ${
                    availability.available ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'
                  }`}>
                    {availability.available ? '镜像可用' : '镜像不可用'}
                  </p>
                  <p className={`text-xs mt-0.5 ${
                    availability.available ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-secondary)]'
                  }`}>
                    {availability.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-[var(--color-error-subtle)] rounded-lg border border-[var(--color-error)]">
              <p className="text-sm text-[var(--color-error)]">{error}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border-light)] bg-[var(--color-bg-secondary)]">
          <Button variant="secondary" size="sm" onClick={checkAvailability} disabled={checking} className="gap-1.5">
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? '检查中...' : '检查可用性'}
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>取消</Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleApply}
              disabled={selectedSourceId === 'custom' && !customImage}
            >
              应用
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
