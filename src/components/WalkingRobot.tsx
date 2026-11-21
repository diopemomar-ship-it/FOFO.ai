import React from 'react';

interface WalkingRobotProps {
  /** 'compact' marche sur place (idéal dans un bouton) ; 'patrol' marche d'un bout à l'autre de sa piste */
  mode?: 'compact' | 'patrol';
  size?: number;
  className?: string;
}

export const WalkingRobot: React.FC<WalkingRobotProps> = ({
  mode = 'compact',
  size = 28,
  className = '',
}) => {
  const robotSvg = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="robot-body-bounce overflow-visible"
      aria-hidden="true"
    >
      {/* Ombre au sol qui pulse doucement avec le pas */}
      <ellipse
        cx="32"
        cy="60"
        rx="13"
        ry="2.5"
        fill="#00D2FF"
        opacity="0.25"
        className="robot-shadow-pulse"
      />

      {/* Bras arrière (gauche) */}
      <g className="robot-arm-left" style={{ transformOrigin: '21px 33px' }}>
        <rect x="14" y="31" width="6" height="14" rx="3" fill="#1E3A8A" stroke="#38BDF8" strokeWidth="1.5" />
        <circle cx="17" cy="46" r="2.5" fill="#00D2FF" />
      </g>

      {/* Jambe arrière (gauche) */}
      <g className="robot-leg-left" style={{ transformOrigin: '26px 46px' }}>
        <rect x="23" y="45" width="6" height="11" rx="2.5" fill="#1E293B" stroke="#60A5FA" strokeWidth="1.5" />
        <rect x="22" y="54" width="9" height="4" rx="2" fill="#00D2FF" />
      </g>

      {/* Jambe avant (droite) */}
      <g className="robot-leg-right" style={{ transformOrigin: '38px 46px' }}>
        <rect x="35" y="45" width="6" height="11" rx="2.5" fill="#1E293B" stroke="#60A5FA" strokeWidth="1.5" />
        <rect x="34" y="54" width="9" height="4" rx="2" fill="#00D2FF" />
      </g>

      {/* Torse */}
      <rect x="20" y="29" width="24" height="18" rx="6" fill="#0F172A" stroke="#38BDF8" strokeWidth="2" />
      {/* Cœur / réacteur central */}
      <circle cx="32" cy="38" r="4" fill="#0284C7" stroke="#00F0FF" strokeWidth="1.5" />
      <circle cx="32" cy="38" r="1.6" fill="#FFFFFF" />

      {/* Antenne */}
      <line x1="32" y1="10" x2="32" y2="4" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
      <circle cx="32" cy="3.5" r="2.5" fill="#00F0FF" />

      {/* Tête & Visière */}
      <rect x="17" y="10" width="30" height="18" rx="7" fill="#0B1222" stroke="#00D2FF" strokeWidth="2" />
      <rect x="21" y="14" width="22" height="10" rx="4" fill="#050811" stroke="#1E40AF" strokeWidth="1" />

      {/* Yeux lumineux avec clignement */}
      <g className="robot-eyes" style={{ transformOrigin: '32px 19px' }}>
        <circle cx="27" cy="19" r="2.4" fill="#00F0FF" />
        <circle cx="37" cy="19" r="2.4" fill="#00F0FF" />
        <circle cx="27.7" cy="18.3" r="0.8" fill="#FFFFFF" />
        <circle cx="37.7" cy="18.3" r="0.8" fill="#FFFFFF" />
      </g>

      {/* Bras avant (droit) */}
      <g className="robot-arm-right" style={{ transformOrigin: '43px 33px' }}>
        <rect x="44" y="31" width="6" height="14" rx="3" fill="#1E3A8A" stroke="#38BDF8" strokeWidth="1.5" />
        <circle cx="47" cy="46" r="2.5" fill="#00D2FF" />
      </g>
    </svg>
  );

  if (mode === 'patrol') {
    return (
      <div className={`relative w-full h-9 overflow-hidden select-none pointer-events-none ${className}`}>
        {/* Fine ligne de sol */}
        <div className="absolute bottom-1 inset-x-2 h-[1px] bg-gradient-to-r from-transparent via-zinc-400/50 dark:via-white/25 to-transparent" />
        <div className="robot-patrol-track absolute bottom-0 inset-x-0 flex items-center">
          <div className="robot-patrol-flip inline-flex">
            {robotSvg}
          </div>
        </div>
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center justify-center shrink-0 ${className}`}>
      {robotSvg}
    </span>
  );
};
