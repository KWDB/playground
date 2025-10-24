import React, { memo } from 'react';

// 轻量本地类型，避免与 Terminal 形成类型导入循环
export interface ImagePullProgressMessageOverlay {
  imageName: string;
  status?: string;
  progress?: string;
  error?: string;
  progressPercent?: number;
}

interface Props {
  show: boolean;
  imagePullProgress: ImagePullProgressMessageOverlay | null;
}

const ImagePullProgressOverlay = memo(({ show, imagePullProgress }: Props) => {
  if (!show || !imagePullProgress) return null;

  const percent = imagePullProgress.progressPercent;
  const widthStyle = percent != null ? { width: `${Math.max(0, Math.min(100, percent))}%` } : undefined;

  return (
    <div className="absolute inset-0 bg-gray-900/95 backdrop-blur-sm flex items-center justify-center z-50 transition-all duration-300">
      <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl border border-gray-700">
        <div className="text-center">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/20 rounded-full mb-4">
              {/* 旋转的加载图标 */}
              <svg className="w-8 h-8 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">正在拉取镜像</h3>
            <p className="text-gray-300 text-sm break-all">{imagePullProgress.imageName}</p>
          </div>
          
          {imagePullProgress.error ? (
            <div className="text-red-400 text-sm bg-red-500/10 rounded-lg p-3 border border-red-500/20">
              <div className="font-medium mb-1">拉取失败</div>
              <div className="text-xs opacity-80">{imagePullProgress.error}</div>
            </div>
          ) : (
            <div className="space-y-3">
              {imagePullProgress.status && (
                <div className="text-blue-300 text-sm font-medium">
                  {imagePullProgress.status} {percent != null && <span className="ml-1 text-gray-300">({percent}%)</span>}
                </div>
              )}
              {imagePullProgress.progress && (
                <div className="text-gray-400 text-xs font-mono bg-gray-700/50 rounded px-3 py-2">
                  {imagePullProgress.progress}
                </div>
              )}

              <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                {percent != null ? (
                  <div className="bg-gradient-to-r from-blue-500 to-blue-400 h-full rounded-full transition-all duration-200" style={widthStyle}></div>
                ) : (
                  <div className="bg-gradient-to-r from-blue-500 to-blue-400 h-full rounded-full animate-pulse"></div>
                )}
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
  );
});

ImagePullProgressOverlay.displayName = 'ImagePullProgressOverlay';

export default ImagePullProgressOverlay;