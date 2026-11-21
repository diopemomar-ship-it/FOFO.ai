import React, { useState } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Smartphone,
  Send,
  MessageCircle,
} from 'lucide-react';
import { GeneratedVideo } from '../types';

interface SocialShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: GeneratedVideo;
  onShowToast: (message: string) => void;
}

export const SocialShareModal: React.FC<SocialShareModalProps> = ({
  isOpen,
  onClose,
  video,
  onShowToast,
}) => {
  const [copiedCaption, setCopiedCaption] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  if (!isOpen) return null;

  const appUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?v=${encodeURIComponent(video.id)}`
    : `https://fofo.ai/watch?v=${video.id}`;
  const shareCaption = `${video.title}\n\n${video.hook}\n\nLien : ${appUrl}\n\n${video.hashtags.join(' ')}\n\nCréé avec FOFO AI 🎬`;

  // Partage Twitter / X
  const handleTwitterShare = () => {
    const tweetText = `🎬 Découvrez ma nouvelle vidéo IA : "${video.title}" !\n\n${video.hook}\n\nCréé avec @FOFO_AI 🚀\n${video.hashtags.slice(0, 3).join(' ')}`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(appUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    onShowToast('Ouverture de Twitter / X...');
  };

  // Partage TikTok
  const handleTikTokShare = () => {
    navigator.clipboard.writeText(`${video.title}\n\n${video.hook}\n\n${video.hashtags.join(' ')}`);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2500);
    onShowToast('Titre et hashtags copiés ! Redirection vers TikTok...');
    setTimeout(() => {
      window.open('https://www.tiktok.com/upload', '_blank', 'noopener,noreferrer');
    }, 500);
  };

  // Partage Instagram
  const handleInstagramShare = () => {
    navigator.clipboard.writeText(`${video.title}\n\n${video.hook}\n\n${video.hashtags.join(' ')}\n\nVidéo générée avec @fofo.ai`);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2500);
    onShowToast('Description et tags copiés ! Redirection vers Instagram...');
    setTimeout(() => {
      window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
    }, 500);
  };

  // Partage WhatsApp
  const handleWhatsAppShare = () => {
    const waText = `Regarde cette vidéo IA créée avec FOFO AI : "${video.title}" !\n\n${video.hook}\n\n${appUrl}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    onShowToast('Ouverture de WhatsApp...');
  };

  // Partage natif mobile via Web Share API (iPhone / Android)
  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: video.title,
          text: `🎬 Regardez cette vidéo IA créée avec FOFO AI : "${video.title}" !\n${video.hook}\n\nLien :`,
          url: appUrl,
        });
        onShowToast('Partage réussi vers votre application ! 🚀');
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn('Tentative Web Share simplifiée:', err);
        try {
          await navigator.share({
            title: video.title,
            url: appUrl,
          });
          onShowToast('Partage réussi ! 🚀');
          return;
        } catch (innerErr: any) {
          if (innerErr.name === 'AbortError') return;
        }
      }
    }
    handleCopyLink();
  };

  // Copier le lien
  const handleCopyLink = () => {
    navigator.clipboard.writeText(appUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
    onShowToast('Lien copié dans le presse-papier !');
  };

  // Copier le texte complet
  const handleCopyFullCaption = () => {
    navigator.clipboard.writeText(shareCaption);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2500);
    onShowToast('Texte complet et hashtags copiés !');
  };

  const firstScene = video.scenes[0] || {};
  const thumbUrl = firstScene.imageUrl || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&q=80';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.1] p-6 sm:p-8 shadow-2xl relative my-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-zinc-100 dark:bg-[#1C1C20] border border-zinc-200 dark:border-white/[0.08] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl ig-story-ring flex items-center justify-center text-white shrink-0">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-bold font-heading text-zinc-900 dark:text-white tracking-tight">
              Partager ma création vidéo
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Publiez directement sur vos réseaux ou partagez avec votre communauté.
            </p>
          </div>
        </div>

        {/* Video Preview Snippet */}
        <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.06] mb-6">
          <div className="w-16 h-20 rounded-xl overflow-hidden bg-black flex-shrink-0 border border-zinc-200 dark:border-white/[0.08] relative">
            <img src={thumbUrl} alt={video.title} className="w-full h-full object-cover" />
            <span className="absolute bottom-1 right-1 px-1 rounded bg-black/75 text-[9px] font-mono text-zinc-200 tabular-nums">
              {video.aspectRatio}
            </span>
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
              {video.aspectRatio === '9:16'
                ? 'TikTok / Shorts 9:16'
                : video.aspectRatio === '4:5'
                ? 'Instagram 4:5'
                : video.aspectRatio === '16:9'
                ? 'YouTube 16:9'
                : 'Instagram 1:1'}
            </span>
            <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white line-clamp-1">{video.title}</h4>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1">{video.hook}</p>
          </div>
        </div>

        {/* Main Social Platforms Buttons */}
        <div className="space-y-3 mb-6">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Choisir une plateforme de publication :
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* TikTok */}
            <button
              onClick={handleTikTokShare}
              className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-[#09090B] hover:bg-zinc-100 dark:hover:bg-[#18181B] border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-300 dark:hover:border-white/[0.2] transition-all flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-[#18181B] border border-zinc-800 dark:border-white/[0.08] flex items-center justify-center text-white group-hover:scale-105 transition-transform relative">
                <svg className="w-5 h-5 fill-current text-white" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z" />
                </svg>
              </div>
              <div className="text-center">
                <span className="text-xs font-bold text-zinc-900 dark:text-white block">TikTok</span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Copie & Ouvre</span>
              </div>
            </button>

            {/* Instagram */}
            <button
              onClick={handleInstagramShare}
              className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-[#09090B] hover:bg-zinc-100 dark:hover:bg-[#18181B] border border-zinc-200 dark:border-white/[0.08] hover:border-[#DD2A7B]/60 transition-all flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl ig-story-ring flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </div>
              <div className="text-center">
                <span className="text-xs font-bold text-zinc-900 dark:text-white block">Instagram</span>
                <span className="text-[10px] text-pink-600 dark:text-pink-400 font-medium">Reels & Post</span>
              </div>
            </button>

            {/* Twitter / X */}
            <button
              onClick={handleTwitterShare}
              className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-[#09090B] hover:bg-zinc-100 dark:hover:bg-[#18181B] border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-300 dark:hover:border-white/[0.2] transition-all flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-black border border-zinc-800 dark:border-white/[0.1] flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </div>
              <div className="text-center">
                <span className="text-xs font-bold text-zinc-900 dark:text-white block">X / Twitter</span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Post direct</span>
              </div>
            </button>
          </div>
        </div>

        {/* Secondary Sharing Options: WhatsApp, Native Mobile Share, Copy Link */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-6">
          <button
            onClick={handleWhatsAppShare}
            className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-[#09090B] hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-zinc-200 dark:border-white/[0.08] hover:border-emerald-500/40 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-all cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>WhatsApp</span>
          </button>

          <button
            onClick={handleNativeShare}
            className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-[#09090B] hover:bg-zinc-100 dark:hover:bg-[#18181B] border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-300 dark:hover:border-white/[0.2] text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-all cursor-pointer"
          >
            <Smartphone className="w-4 h-4 text-[#0095F6]" />
            <span>Partage mobile</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-[#09090B] hover:bg-zinc-100 dark:hover:bg-[#18181B] border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-300 dark:hover:border-white/[0.2] text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-all cursor-pointer"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />}
            <span>{copiedLink ? 'Copié !' : 'Copier le lien'}</span>
          </button>
        </div>

        {/* Ready-to-use Caption Box with 1-click Copy */}
        <div className="space-y-2 p-3.5 rounded-2xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-white/[0.06]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
              Légende & Hashtags optimisés prêts à coller :
            </span>

            <button
              onClick={handleCopyFullCaption}
              className="flex items-center gap-1 text-[11px] text-[#0095F6] hover:text-zinc-900 dark:hover:text-white font-semibold cursor-pointer"
            >
              {copiedCaption ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCaption ? 'Copié !' : 'Copier tout'}</span>
            </button>
          </div>

          <p className="text-xs text-zinc-600 dark:text-zinc-400 font-mono whitespace-pre-line leading-relaxed max-h-24 overflow-y-auto">
            {shareCaption}
          </p>
        </div>

        {/* Tip for Creators */}
        <div className="mt-4 text-center">
          <p className="text-[11px] text-zinc-500">
            Astuce créateur : exportez votre vidéo en MP4 puis collez cette description lors de la publication sur Instagram Reels ou TikTok.
          </p>
        </div>
      </div>
    </div>
  );
};
