import React, { useState, useEffect } from 'react';
import { Check, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

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

  // 从 localStorage 加载保存的镜像源设置
  useEffect(() => {
    const savedSourceId = localStorage.getItem('imageSourceId');
    if (savedSourceId) {
      setSelectedSourceId(savedSourceId);
    }
  }, []);

  // 获取可用的镜像源列表
  useEffect(() => {
    const fetchSources = async () => {
      try {
        const response = await fetch('/api/images/sources');
        if (!response.ok) {
          throw new Error('获取镜像源列表失败');
        }
        const data = await response.json();
        setSources(data.sources || []);
      } catch (err) {
        console.error('获取镜像源列表失败:', err);
        setError(err instanceof Error ? err.message : '获取镜像源列表失败');
      }
    };

    if (isOpen) {
      fetchSources();
    }
  }, [isOpen]);

  // 生成完整的镜像名称
  const getFullImageName = () => {
    const selectedSource = sources.find(s => s.id === selectedSourceId);
    if (!selectedSource) return defaultImage;

    if (selectedSourceId === 'custom') {
      return customImage || defaultImage;
    }

    // 移除默认镜像中可能存在的源前缀
    const baseImage = defaultImage.replace(/^[^/]+\//, '');
    return selectedSource.prefix ? `${selectedSource.prefix}${baseImage}` : baseImage;
  };

  // 检查镜像可用性
  const checkAvailability = async () => {
    setChecking(true);
    setAvailability(null);
    setError(null);

    const imageName = getFullImageName();

    try {
      const response = await fetch('/api/images/check-availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageName }),
      });

      if (!response.ok) {
        throw new Error('检查镜像可用性失败');
      }

      const data = await response.json();
      setAvailability(data);
    } catch (err) {
      console.error('检查镜像可用性失败:', err);
      setError(err instanceof Error ? err.message : '检查镜像可用性失败');
    } finally {
      setChecking(false);
    }
  };

  // 应用选择的镜像源
  const handleApply = () => {
    const fullImageName = getFullImageName();
    
    // 保存选择到 localStorage
    localStorage.setItem('imageSourceId', selectedSourceId);
    if (selectedSourceId === 'custom') {
      localStorage.setItem('customImageName', customImage);
    }

    onImageSelect(fullImageName);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Docker 镜像源选择器</h2>
          <p className="mt-1 text-sm text-gray-600">选择合适的镜像源以提高下载速度</p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* 镜像源列表 */}
          <div className="space-y-3">
            {sources.map((source) => (
              <div
                key={source.id}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  selectedSourceId === source.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => setSelectedSourceId(source.id)}
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0 mt-1">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedSourceId === source.id
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-300'
                      }`}
                    >
                      {selectedSourceId === source.id && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-900">{source.name}</h3>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{source.description}</p>
                    {source.id === 'custom' && selectedSourceId === 'custom' && (
                      <div className="mt-3">
                        <input
                          type="text"
                          placeholder="输入完整的镜像地址，例如: your-registry.com/kwdb/kwdb:latest"
                          value={customImage}
                          onChange={(e) => setCustomImage(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                    {source.id !== 'custom' && (
                      <p className="mt-2 text-xs text-gray-500 font-mono bg-gray-50 p-2 rounded">
                        示例: {source.example}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 当前选择的镜像 */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-2">当前选择的镜像:</h4>
            <p className="text-sm font-mono text-gray-900 break-all">{getFullImageName()}</p>
          </div>

          {/* 可用性检查结果 */}
          {availability && (
            <div
              className={`mt-4 p-4 rounded-lg ${
                availability.available ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}
            >
              <div className="flex items-start">
                {availability.available ? (
                  <Check className="w-5 h-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                )}
                <div className="ml-3">
                  <p className={`text-sm font-medium ${availability.available ? 'text-green-800' : 'text-red-800'}`}>
                    {availability.available ? '镜像可用' : '镜像不可用'}
                  </p>
                  <p className={`mt-1 text-sm ${availability.available ? 'text-green-700' : 'text-red-700'}`}>
                    {availability.message}
                  </p>
                  {availability.responseTime > 0 && (
                    <p className="mt-1 text-xs text-gray-600">响应时间: {availability.responseTime}ms</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 错误信息 */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800">检查失败</p>
                  <p className="mt-1 text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <button
            onClick={checkAvailability}
            disabled={checking}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {checking ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                检查中...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                检查可用性
              </>
            )}
          </button>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              取消
            </button>
            <button
              onClick={handleApply}
              disabled={selectedSourceId === 'custom' && !customImage}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              应用
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
