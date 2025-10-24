import React, { memo } from 'react';

interface Props {
  connected: boolean;
}

const ConnectionIndicator = memo(({ connected }: Props) => {
  return (
    <div className="absolute top-2 right-2 z-10">
      <div
        className={`w-3 h-3 rounded-full transition-colors duration-300 ${
          connected ? 'bg-green-500' : 'bg-red-500'
        }`}
        title={connected ? '已连接' : '未连接'}
      />
    </div>
  );
});

ConnectionIndicator.displayName = 'ConnectionIndicator';

export default ConnectionIndicator;