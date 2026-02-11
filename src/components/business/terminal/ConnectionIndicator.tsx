import React, { memo } from 'react';

interface Props {
  connected: boolean;
}

const ConnectionIndicator = memo(({ connected }: Props) => {
  return (
    <div className="absolute top-3 right-3 z-10">
      <div
        className={`w-2 h-2 rounded-full transition-colors duration-300 ${
          connected ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-tertiary)]'
        }`}
        title={connected ? '已连接' : '未连接'}
      />
    </div>
  );
});

ConnectionIndicator.displayName = 'ConnectionIndicator';

export default ConnectionIndicator;
