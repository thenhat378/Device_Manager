import React from 'react';

interface DUELogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  style?: React.CSSProperties;
}

export const DUELogo: React.FC<DUELogoProps> = ({ 
  className = '', 
  size = 'md',
  showText = false,
  style
}) => {
  // Determine pixel size if size prop is used
  let sizePx = 40;
  if (size === 'sm') sizePx = 28;
  if (size === 'md') sizePx = 40;
  if (size === 'lg') sizePx = 56;
  if (size === 'xl') sizePx = 80;

  return (
    <div className={`inline-flex items-center gap-2 shrink-0 ${className}`} style={style}>
      <svg 
        viewBox="0 0 200 230" 
        className="w-full h-full max-w-full max-h-full drop-shadow-xs"
        style={style?.width || style?.height ? { width: '100%', height: '100%' } : { width: sizePx, height: sizePx * 1.15 }}
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background shield fill */}
        <path 
          d="M100 8 L185 45 V125 C185 175 140 208 100 222 C60 208 15 175 15 125 V45 Z" 
          fill="#FFFFFF" 
          stroke="#0F4C81" 
          strokeWidth="4" 
          strokeLinejoin="round" 
        />
        
        {/* Letter 'D' - Orange */}
        <text 
          x="35" 
          y="125" 
          fill="#F26522" 
          fontFamily="system-ui, -apple-system, sans-serif" 
          fontWeight="900" 
          fontSize="72" 
          letterSpacing="-2"
        >
          D
        </text>

        {/* Letter 'U' - Green */}
        <text 
          x="84" 
          y="125" 
          fill="#009640" 
          fontFamily="system-ui, -apple-system, sans-serif" 
          fontWeight="900" 
          fontSize="72"
          letterSpacing="-2"
        >
          U
        </text>

        {/* Letter 'E' - Blue */}
        <text 
          x="134" 
          y="125" 
          fill="#0056B3" 
          fontFamily="system-ui, -apple-system, sans-serif" 
          fontWeight="900" 
          fontSize="72"
          letterSpacing="-2"
        >
          E
        </text>

        {/* Decorative dash line left */}
        <line x1="38" y1="148" x2="62" y2="148" stroke="#F26522" strokeWidth="3" strokeLinecap="round" />
        
        {/* SINCE 1975 text */}
        <text 
          x="100" 
          y="151" 
          fill="#0F4C81" 
          fontFamily="system-ui, -apple-system, sans-serif" 
          fontWeight="800" 
          fontSize="17" 
          textAnchor="middle"
          letterSpacing="0.5"
        >
          SINCE 1975
        </text>

        {/* Decorative dash line right */}
        <line x1="138" y1="148" x2="162" y2="148" stroke="#F26522" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {showText && (
        <span className="font-extrabold tracking-tight text-slate-900">DUE</span>
      )}
    </div>
  );
};
