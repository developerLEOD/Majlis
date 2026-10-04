import React from 'react';

interface IslamicStarRosetteProps {
  className?: string;
  size?: number;
  variant?: 'full' | 'gold-outline' | 'watermark';
}

export const IslamicStarRosette: React.FC<IslamicStarRosetteProps> = ({
  className = '',
  size = 36,
  variant = 'full',
}) => {
  if (variant === 'gold-outline') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <path
          d="M50 0 L61.5 25 L88 12 L75 38.5 L100 50 L75 61.5 L88 88 L61.5 75 L50 100 L38.5 75 L12 88 L25 61.5 L0 50 L25 38.5 L12 12 L38.5 25 Z"
          stroke="#D4AF37"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <rect
          x="22"
          y="22"
          width="56"
          height="56"
          stroke="#D4AF37"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <rect
          x="22"
          y="22"
          width="56"
          height="56"
          transform="rotate(45 50 50)"
          stroke="#D4AF37"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <circle cx="50" cy="50" r="14" stroke="#D4AF37" strokeWidth="2.5" />
        <circle cx="50" cy="50" r="6" fill="#D4AF37" />
      </svg>
    );
  }

  if (variant === 'watermark') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <g stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.35">
          {/* Outer Star Interlace */}
          <polygon points="100,0 125,50 180,20 150,75 200,100 150,125 180,180 125,150 100,200 75,150 20,180 50,125 0,100 50,75 20,20 75,50" />
          <rect x="40" y="40" width="120" height="120" />
          <rect x="40" y="40" width="120" height="120" transform="rotate(45 100 100)" />
          <circle cx="100" cy="100" r="45" />
          <polygon points="100,25 118,65 160,40 135,82 175,100 135,118 160,160 118,135 100,175 82,135 40,160 65,118 25,100 65,82 40,40 82,65" />
          <circle cx="100" cy="100" r="18" />
        </g>
      </svg>
    );
  }

  // Full rich rosette with emerald, gold, bronze facets
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <radialGradient id="starCenter" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F5D77F" />
          <stop offset="60%" stopColor="#D4AF37" />
          <stop offset="100%" stopColor="#997316" />
        </radialGradient>
        <linearGradient id="emeraldFacet" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#125F4C" />
          <stop offset="100%" stopColor="#08382D" />
        </linearGradient>
        <linearGradient id="goldFacet" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E9BA53" />
          <stop offset="100%" stopColor="#C4932A" />
        </linearGradient>
      </defs>

      {/* 8 Outer Points */}
      <polygon
        points="50,2 62,26 88,12 74,38 98,50 74,62 88,88 62,74 50,98 38,74 12,88 26,62 2,50 26,38 12,12 38,26"
        fill="url(#emeraldFacet)"
        stroke="#2E2015"
        strokeWidth="2"
      />

      {/* Intersecting Square 1 */}
      <rect
        x="22"
        y="22"
        width="56"
        height="56"
        fill="none"
        stroke="url(#goldFacet)"
        strokeWidth="3.5"
      />

      {/* Intersecting Square 2 (Rotated 45deg) */}
      <rect
        x="22"
        y="22"
        width="56"
        height="56"
        transform="rotate(45 50 50)"
        fill="none"
        stroke="url(#goldFacet)"
        strokeWidth="3.5"
      />

      {/* Inner Central Rosette */}
      <circle cx="50" cy="50" r="16" fill="#0C4537" stroke="#2E2015" strokeWidth="2" />
      <circle cx="50" cy="50" r="10" fill="url(#starCenter)" stroke="#2E2015" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="4" fill="#082A22" />

      {/* Facet Lines */}
      <line x1="50" y1="2" x2="50" y2="34" stroke="#D4AF37" strokeWidth="1.5" />
      <line x1="50" y1="66" x2="50" y2="98" stroke="#D4AF37" strokeWidth="1.5" />
      <line x1="2" y1="50" x2="34" y2="50" stroke="#D4AF37" strokeWidth="1.5" />
      <line x1="66" y1="50" x2="98" y2="50" stroke="#D4AF37" strokeWidth="1.5" />
    </svg>
  );
};

export const SidebarCornerOrnament: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`pointer-events-none select-none overflow-hidden ${className}`}>
      <svg
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-24 h-24 sm:w-28 sm:h-28 text-[#302116]"
      >
        <defs>
          <linearGradient id="cornerEmerald" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0B4236" />
            <stop offset="100%" stopColor="#052820" />
          </linearGradient>
          <linearGradient id="cornerGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#9C771C" />
          </linearGradient>
        </defs>
        {/* Quadrant pattern */}
        <polygon points="0,120 0,60 30,70 60,60 70,30 60,0 120,0 120,30 90,60 120,90 90,120" fill="url(#cornerEmerald)" opacity="0.9" />
        <path d="M 0,120 L 0,80 L 40,80 L 40,120 Z" fill="#D4AF37" opacity="0.3" stroke="#D4AF37" strokeWidth="1.5" />
        <path d="M 0,60 L 60,0" stroke="url(#cornerGold)" strokeWidth="3" />
        <path d="M 0,90 L 90,0" stroke="#302116" strokeWidth="2.5" />
        <path d="M 0,120 L 120,0" stroke="url(#cornerGold)" strokeWidth="3" />
        <path d="M 30,120 L 120,30" stroke="#302116" strokeWidth="2" />
        <path d="M 60,120 L 120,60" stroke="url(#cornerGold)" strokeWidth="2.5" />
        <polygon points="0,120 30,120 15,105" fill="#D4AF37" />
        <polygon points="0,120 0,90 15,105" fill="#0B4236" />
      </svg>
    </div>
  );
};
