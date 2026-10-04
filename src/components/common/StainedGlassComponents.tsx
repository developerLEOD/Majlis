import React from 'react';

/**
 * High-precision Islamic Geometric Stained Glass System
 * Jewel-tone glass pieces joined by dark bronze leading (cames).
 */

interface StainedGlassWindowProps {
  className?: string;
  size?: number | string;
  variant?: 'full' | 'compact' | 'arch';
  illuminated?: boolean;
}

export const StainedGlassWindow: React.FC<StainedGlassWindowProps> = ({
  className = '',
  size = 280,
  variant = 'full',
  illuminated = true,
}) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Ambient glass light glow behind window */}
      {illuminated && (
        <div
          className="absolute inset-2 rounded-full pointer-events-none opacity-40 blur-xl"
          style={{
            background:
              'radial-gradient(circle, rgba(233,168,58,0.5) 0%, rgba(25,166,160,0.3) 40%, rgba(23,74,131,0.2) 70%, transparent 100%)',
          }}
        />
      )}

      <svg
        viewBox="0 0 240 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full relative z-10 drop-shadow-md"
      >
        <defs>
          {/* Glass facet shine gradients */}
          <linearGradient id="amberGlass" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FAD872" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#E9A83A" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#C88218" stopOpacity="0.95" />
          </linearGradient>

          <linearGradient id="emeraldGlass" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#128A6D" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#075E4A" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#044133" stopOpacity="0.95" />
          </linearGradient>

          <linearGradient id="lapisGlass" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#256EB7" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#174A83" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#0F335C" stopOpacity="0.95" />
          </linearGradient>

          <linearGradient id="turquoiseGlass" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3CD6CF" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#19A6A0" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#107873" stopOpacity="0.95" />
          </linearGradient>

          <linearGradient id="rubyGlass" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#CD4860" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#A83245" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#7E1C2C" stopOpacity="0.95" />
          </linearGradient>

          {/* Lead came (dark bronze frame) shadow */}
          <filter id="leadShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="0.5" stdDeviation="0.6" floodColor="#180F08" floodOpacity="0.6" />
          </filter>
        </defs>

        {/* Outer Heavy Bronze Frame */}
        <circle cx="120" cy="120" r="114" stroke="#251810" strokeWidth="6" />
        <circle cx="120" cy="120" r="111" stroke="#E9A83A" strokeWidth="1" strokeOpacity="0.6" />
        <circle cx="120" cy="120" r="108" stroke="#302116" strokeWidth="2.5" />

        {/* OUTER RING FACETS (Ruby & Lapis alternation with dark leading) */}
        <g stroke="#261A12" strokeWidth="2.5" strokeLinejoin="round" filter="url(#leadShadow)">
          {/* 16 perimeter trapezoid glass panes */}
          <path d="M 120 12 L 140 22 L 132 46 L 120 44 Z" fill="url(#rubyGlass)" />
          <path d="M 140 22 L 165 37 L 150 58 L 132 46 Z" fill="url(#turquoiseGlass)" />
          <path d="M 165 37 L 188 58 L 166 75 L 150 58 Z" fill="url(#lapisGlass)" />
          <path d="M 188 58 L 203 83 L 176 94 L 166 75 Z" fill="url(#emeraldGlass)" />

          <path d="M 203 83 L 213 103 L 182 108 L 176 94 Z" fill="url(#rubyGlass)" />
          <path d="M 213 103 L 216 120 L 184 120 L 182 108 Z" fill="url(#turquoiseGlass)" />
          <path d="M 216 120 L 213 137 L 182 132 L 184 120 Z" fill="url(#lapisGlass)" />
          <path d="M 213 137 L 203 157 L 176 146 L 182 132 Z" fill="url(#emeraldGlass)" />

          <path d="M 203 157 L 188 182 L 166 165 L 176 146 Z" fill="url(#rubyGlass)" />
          <path d="M 188 182 L 165 203 L 150 182 L 166 165 Z" fill="url(#turquoiseGlass)" />
          <path d="M 165 203 L 140 218 L 132 194 L 150 182 Z" fill="url(#lapisGlass)" />
          <path d="M 140 218 L 120 228 L 120 196 L 132 194 Z" fill="url(#emeraldGlass)" />

          <path d="M 120 228 L 100 218 L 108 194 L 120 196 Z" fill="url(#rubyGlass)" />
          <path d="M 100 218 L 75 203 L 90 182 L 108 194 Z" fill="url(#turquoiseGlass)" />
          <path d="M 75 203 L 52 182 L 74 165 L 90 182 Z" fill="url(#lapisGlass)" />
          <path d="M 52 182 L 37 157 L 64 146 L 74 165 Z" fill="url(#emeraldGlass)" />

          <path d="M 37 157 L 27 137 L 58 132 L 64 146 Z" fill="url(#rubyGlass)" />
          <path d="M 27 137 L 24 120 L 56 120 L 58 132 Z" fill="url(#turquoiseGlass)" />
          <path d="M 24 120 L 27 103 L 58 108 L 56 120 Z" fill="url(#lapisGlass)" />
          <path d="M 27 103 L 37 83 L 64 94 L 58 108 Z" fill="url(#emeraldGlass)" />

          <path d="M 37 83 L 52 58 L 74 75 L 64 94 Z" fill="url(#rubyGlass)" />
          <path d="M 52 58 L 75 37 L 90 58 L 74 75 Z" fill="url(#turquoiseGlass)" />
          <path d="M 75 37 L 100 22 L 108 46 L 90 58 Z" fill="url(#lapisGlass)" />
          <path d="M 100 22 L 120 12 L 120 44 L 108 46 Z" fill="url(#emeraldGlass)" />
        </g>

        {/* MID RING INTERLOCKING GIRIH KITES (Emerald & Lapis Glass) */}
        <g stroke="#261A12" strokeWidth="2.5" strokeLinejoin="round" filter="url(#leadShadow)">
          {/* North Point Kite */}
          <polygon points="120,44 132,68 120,86 108,68" fill="url(#emeraldGlass)" />
          {/* North-East Kite */}
          <polygon points="166,75 160,96 142,94 148,73" fill="url(#lapisGlass)" />
          {/* East Point Kite */}
          <polygon points="184,120 160,132 142,120 160,108" fill="url(#emeraldGlass)" />
          {/* South-East Kite */}
          <polygon points="166,165 148,167 142,146 160,144" fill="url(#lapisGlass)" />
          {/* South Point Kite */}
          <polygon points="120,196 108,172 120,154 132,172" fill="url(#emeraldGlass)" />
          {/* South-West Kite */}
          <polygon points="74,165 80,144 98,146 92,167" fill="url(#lapisGlass)" />
          {/* West Point Kite */}
          <polygon points="56,120 80,108 98,120 80,132" fill="url(#emeraldGlass)" />
          {/* North-West Kite */}
          <polygon points="74,75 92,73 98,94 80,96" fill="url(#lapisGlass)" />
        </g>

        {/* INTERMEDIATE STAR DIAMONDS (Turquoise Light) */}
        <g stroke="#261A12" strokeWidth="2.2" strokeLinejoin="round">
          <polygon points="120,86 134,98 120,106 106,98" fill="url(#turquoiseGlass)" />
          <polygon points="142,94 146,110 134,116 130,100" fill="url(#turquoiseGlass)" />
          <polygon points="142,120 134,124 146,130 154,120" fill="url(#turquoiseGlass)" />
          <polygon points="142,146 130,140 134,124 146,130" fill="url(#turquoiseGlass)" />
          <polygon points="120,154 106,142 120,134 134,142" fill="url(#turquoiseGlass)" />
          <polygon points="98,146 94,130 106,124 110,140" fill="url(#turquoiseGlass)" />
          <polygon points="98,120 106,116 94,110 86,120" fill="url(#turquoiseGlass)" />
          <polygon points="98,94 110,100 106,116 94,110" fill="url(#turquoiseGlass)" />
        </g>

        {/* CENTERPIECE: 8-POINTED GOLD AMBER STAR (KHATIM) */}
        <g stroke="#261A12" strokeWidth="2.8" strokeLinejoin="round" filter="url(#leadShadow)">
          {/* Overlapping rotated squares forming Islamic 8-point Star */}
          <polygon
            points="
              120,88 127,104 143,97 136,113 152,120
              136,127 143,143 127,136 120,152
              113,136 97,143 104,127 88,120
              104,113 97,97 113,104
            "
            fill="url(#amberGlass)"
          />
        </g>

        {/* CENTER INNER ROSETTE CORE */}
        <circle cx="120" cy="120" r="14" fill="#302116" stroke="#E9A83A" strokeWidth="1.5" />
        <circle cx="120" cy="120" r="8" fill="url(#rubyGlass)" stroke="#261A12" strokeWidth="1" />
        <circle cx="120" cy="120" r="2.5" fill="#FFFCF5" />
      </svg>
    </div>
  );
};

/**
 * Reusable Stained Glass Leaded Divider
 */
export const StainedGlassDivider: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`flex items-center gap-3 w-full select-none ${className}`}>
      <div className="flex-1 h-[1.5px] bg-[#E6DFD5] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#075E4A]/30 to-[#302116]/60" />
      </div>

      {/* Leaded 8-Point Star Jewel */}
      <div className="w-5 h-5 flex items-center justify-center relative shrink-0">
        <svg viewBox="0 0 24 24" className="w-full h-full">
          <polygon
            points="12,2 14.5,8 21,8.5 16,13 18,19.5 12,16 6,19.5 8,13 3,8.5 9.5,8"
            fill="#E9A83A"
            stroke="#302116"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className="flex-1 h-[1.5px] bg-[#E6DFD5] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#174A83]/30 to-[#302116]/60" />
      </div>
    </div>
  );
};

/**
 * Subtle Leaded Glass Geometric Background Texture
 */
export const StainedGlassBackgroundGrid: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`absolute inset-0 pointer-events-none opacity-[0.035] overflow-hidden ${className}`}>
      <svg width="100%" height="100%">
        <defs>
          <pattern id="girihTilePattern" width="60" height="60" patternUnits="userSpaceOnUse">
            {/* 8-pointed geometric interlocking wireframe */}
            <path
              d="M 30 0 L 60 30 L 30 60 L 0 30 Z"
              fill="none"
              stroke="#302116"
              strokeWidth="1"
            />
            <path
              d="M 0 0 L 60 60 M 60 0 L 0 60"
              fill="none"
              stroke="#302116"
              strokeWidth="0.8"
            />
            <circle cx="30" cy="30" r="12" fill="none" stroke="#302116" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#girihTilePattern)" />
      </svg>
    </div>
  );
};
