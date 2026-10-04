import React from 'react';

interface LoungeArcLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export const LoungeArcLogo: React.FC<LoungeArcLogoProps> = ({
  className = '',
  size = 'md',
  showText = false,
}) => {
  const sizeMap = {
    xs: 'w-5 h-5',
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
    xl: 'w-14 h-14',
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <div className={`${currentSize} shrink-0 flex items-center justify-center relative`}>
        <svg
          viewBox="0 0 100 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          <defs>
            <linearGradient id="logoAmber" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FBD771" />
              <stop offset="100%" stopColor="#E9A83A" />
            </linearGradient>
            <linearGradient id="logoEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#108064" />
              <stop offset="100%" stopColor="#075E4A" />
            </linearGradient>
            <linearGradient id="logoLapis" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#256EB7" />
              <stop offset="100%" stopColor="#174A83" />
            </linearGradient>
            <linearGradient id="logoTurquoise" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3CD6CF" />
              <stop offset="100%" stopColor="#19A6A0" />
            </linearGradient>
          </defs>

          {/* Outer Leaded Bronze Arch Silhouette */}
          <path
            d="M 12 114 L 12 50 C 12 22, 30 4, 50 2 C 70 4, 88 22, 88 50 L 88 114 Z"
            fill="#302116"
            stroke="#261A12"
            strokeWidth="2"
          />

          {/* Stained Glass Spandrels (Emerald & Lapis facets) */}
          <path
            d="M 18 50 C 18 28, 32 12, 48 8 L 48 30 C 36 34, 26 42, 22 52 Z"
            fill="url(#logoEmerald)"
            stroke="#261A12"
            strokeWidth="1.5"
          />
          <path
            d="M 82 50 C 82 28, 68 12, 52 8 L 52 30 C 64 34, 74 42, 78 52 Z"
            fill="url(#logoLapis)"
            stroke="#261A12"
            strokeWidth="1.5"
          />

          {/* Inner Arched Stained Glass Window Pane */}
          <path
            d="M 24 114 L 24 54 C 24 34, 35 18, 50 14 C 65 18, 76 34, 76 54 L 76 114 Z"
            fill="#FFFCF5"
            stroke="#302116"
            strokeWidth="2.5"
          />

          {/* Lower Colored Glass Panels */}
          <rect x="26" y="86" width="22" height="26" fill="url(#logoLapis)" stroke="#261A12" strokeWidth="1.5" />
          <rect x="52" y="86" width="22" height="26" fill="url(#logoEmerald)" stroke="#261A12" strokeWidth="1.5" />

          {/* Middle Turquoise Transom Glass */}
          <path d="M 26 56 Q 50 38 74 56 L 74 84 L 26 84 Z" fill="url(#logoTurquoise)" stroke="#261A12" strokeWidth="1.5" opacity="0.9" />

          {/* Top Amber Glass Keystone Star */}
          <polygon
            points="50,4 52.5,10 58,10.5 53.5,14 55.5,19.5 50,16 44.5,19.5 46.5,14 42,10.5 47.5,10"
            fill="url(#logoAmber)"
            stroke="#261A12"
            strokeWidth="1.2"
          />

          {/* Center Leading Grid Line */}
          <line x1="50" y1="20" x2="50" y2="114" stroke="#302116" strokeWidth="2" />
          <line x1="24" y1="84" x2="76" y2="84" stroke="#302116" strokeWidth="2" />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8E7E73] leading-none">
            The Wisdom Lounge
          </span>
          <span className="text-sm font-semibold text-[#1C1917] tracking-tight leading-tight mt-0.5">
            Majlis
          </span>
        </div>
      )}
    </div>
  );
};
