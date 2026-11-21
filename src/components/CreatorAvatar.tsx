import React, { useState, useEffect } from 'react';
import {
  Zap,
  Ghost,
  Mountain,
  Camera,
  Newspaper,
  Flame,
  Smile,
  Sparkles,
  Mic,
  TrendingUp,
  Gamepad2,
  Laugh,
} from 'lucide-react';
import { CreatorPersona } from '../types';

interface CreatorAvatarProps {
  persona: CreatorPersona;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  variant?: 'circle' | 'poster';
  className?: string;
}

export const CreatorAvatar: React.FC<CreatorAvatarProps> = ({
  persona,
  size = 'md',
  variant = 'circle',
  className = '',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [persona.avatarUrl]);

  const sizeClasses =
    size === 'sm'
      ? 'w-16 h-16 text-sm'
      : size === '2xl'
      ? 'w-56 h-56 text-4xl'
      : size === 'xl'
      ? 'w-40 h-40 text-3xl'
      : size === 'lg'
      ? 'w-28 h-28 text-2xl'
      : 'w-20 h-20 text-base';

  const badgeSizeClasses =
    size === '2xl'
      ? 'w-12 h-12 bottom-2 right-2'
      : size === 'xl'
      ? 'w-10 h-10 bottom-1 right-1'
      : size === 'lg'
      ? 'w-8 h-8 -bottom-0.5 -right-0.5'
      : 'w-6 h-6 -bottom-0.5 -right-0.5';

  const iconSize =
    size === '2xl'
      ? 'w-6 h-6'
      : size === 'xl'
      ? 'w-5 h-5'
      : size === 'lg'
      ? 'w-4 h-4'
      : 'w-3 h-3';

  const renderIcon = () => {
    switch (persona.signatureIcon) {
      case 'bolt':
        return <Zap className={iconSize} />;
      case 'ghost':
        return <Ghost className={iconSize} />;
      case 'mountain':
        return <Mountain className={iconSize} />;
      case 'camera':
        return <Camera className={iconSize} />;
      case 'newspaper':
        return <Newspaper className={iconSize} />;
      case 'flame':
        return <Flame className={iconSize} />;
      case 'smile':
        return <Smile className={iconSize} />;
      case 'sparkles':
        return <Sparkles className={iconSize} />;
      case 'mic':
        return <Mic className={iconSize} />;
      case 'trending':
        return <TrendingUp className={iconSize} />;
      case 'gamepad':
        return <Gamepad2 className={iconSize} />;
      case 'laugh':
        return <Laugh className={iconSize} />;
    }
  };

  const showPhoto = Boolean(persona.avatarUrl) && !imgFailed;

  if (variant === 'poster') {
    return (
      <div
        className={`relative w-full h-full overflow-hidden flex items-center justify-center font-heading font-black text-white select-none ${className}`}
        style={{ background: persona.avatarBgGradient }}
      >
        {showPhoto ? (
          <img
            src={persona.avatarUrl}
            alt={`Photo de profil de ${persona.name}`}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="text-5xl tracking-tight" aria-hidden="true">
            {persona.initials}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`relative shrink-0 select-none ${sizeClasses} ${className}`}>
      <div
        className="w-full h-full rounded-full overflow-hidden flex items-center justify-center font-heading font-extrabold text-white shadow-xl ring-4 ring-white dark:ring-[#121214]"
        style={{ background: persona.avatarBgGradient }}
      >
        {showPhoto ? (
          <img
            src={persona.avatarUrl}
            alt={`Photo de profil de ${persona.name}`}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <span aria-hidden="true">{persona.initials}</span>
        )}
      </div>
      {size !== 'sm' && (
        <span
          className={`absolute rounded-full flex items-center justify-center text-white border-[3px] border-white dark:border-[#121214] shadow-md ${badgeSizeClasses}`}
          style={{ backgroundColor: persona.accentColor }}
          aria-hidden="true"
        >
          {renderIcon()}
        </span>
      )}
    </div>
  );
};
