import React from 'react';

interface Props {
  className?: string;
  showText?: boolean;
  size?: number;
  textColor?: string;
  layout?: 'horizontal' | 'vertical';
}

const Logo: React.FC<Props> = ({
  className = "",
  showText = true,
  size = 48,
  textColor = "currentColor",
  layout = 'horizontal'
}) => {
  return (
    <div className={`flex ${layout === 'vertical' ? 'flex-col justify-center' : 'flex-row'} items-center gap-3 ${className}`}>
      <img
        src="/logo.png"
        alt="BrainWave Logo"
        className="object-contain select-none"
        style={{ width: size, height: size }}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
      {showText && (
        <div className={`flex flex-col ${layout === 'vertical' ? 'items-center mt-2' : 'items-start'}`}>
          <span
            className="font-extrabold tracking-tight text-zinc-900 dark:text-white"
            style={{ fontSize: size * 0.5, lineHeight: 1.1 }}
          >
            BrainWave
          </span>
        </div>
      )}
    </div>
  );
};

export default Logo;
