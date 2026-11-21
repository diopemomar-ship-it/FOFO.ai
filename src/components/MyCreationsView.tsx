import React from 'react';
import {
  FolderHeart,
  Play,
  Download,
  Trash2,
  Clock,
  Sparkles,
  Layers,
  Calendar,
  Star,
  Film,
  Share2,
} from 'lucide-react';
import { GeneratedVideo, UserSubscription } from '../types';
import { formatDurationShort } from '../utils/durationFormat';

interface MyCreationsViewProps {
  creations: GeneratedVideo[];
  onOpenVideo: (video: GeneratedVideo) => void;
  onDeleteVideo: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onCreateNew: () => void;
  user: UserSubscription;
}

export const MyCreationsView: React.FC<MyCreationsViewProps> = ({
  creations,
  onOpenVideo,
  onDeleteVideo,
  onToggleFavorite,
  onCreateNew,
  user,
}) => {
  const totalSeconds = creations.reduce((acc, v) => acc + (v.totalEstimatedDuration || 45), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header & Stats Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
            Bibliothèque Créateur
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold font-heading text-zinc-900 dark:text-white">
            Mes Créations Vidéo
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Retrouvez, rééditez et exportez toutes vos vidéos générées.
          </p>
        </div>

        <button
          onClick={onCreateNew}
          className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-heading font-bold text-white electric-button-gradient flex items-center gap-2 hover:scale-[1.01] transition-transform cursor-pointer whitespace-nowrap"
        >
          <Sparkles className="w-4 h-4" />
          <span>Créer une vidéo</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center text-zinc-900 dark:text-white">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Vidéos produites</p>
            <p className="text-xl font-bold text-zinc-900 dark:text-white font-heading tabular-nums">{creations.length}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center text-zinc-900 dark:text-white">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Durée cumulée</p>
            <p className="text-xl font-bold text-zinc-900 dark:text-white font-heading tabular-nums">
              {formatDurationShort(totalSeconds)}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] shadow-xs dark:shadow-none flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center text-zinc-900 dark:text-white">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Abonnement</p>
            <p className="text-xl font-bold font-heading text-zinc-900 dark:text-white">
              {user.plan === 'business' ? 'Business VIP' : user.plan === 'pro' ? 'Pro VIP' : 'Gratuit'}
            </p>
          </div>
        </div>
      </div>

      {/* Video Grid */}
      {creations.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-white/[0.06] text-zinc-500 dark:text-zinc-400 mx-auto flex items-center justify-center">
            <Film className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Aucune vidéo pour le moment</h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
            Saisissez votre première idée de vidéo dans le Studio pour la voir apparaître ici.
          </p>
          <button
            onClick={onCreateNew}
            className="px-6 py-2.5 rounded-xl font-heading text-xs font-bold text-white electric-button-gradient cursor-pointer"
          >
            Lancer ma première création
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {creations.map((v) => {
            const firstScene = v.scenes[0] || {};
            const thumbUrl = firstScene.imageUrl || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&q=80';

            return (
              <div
                key={v.id}
                className="rounded-2xl overflow-hidden bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-300 dark:hover:border-white/25 shadow-xs dark:shadow-none transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="relative aspect-video w-full overflow-hidden bg-black">
                    <img
                      src={thumbUrl}
                      alt={v.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-black/70 backdrop-blur-md text-zinc-200">
                        {v.aspectRatio === '9:16'
                          ? '9:16 Reels'
                          : v.aspectRatio === '4:5'
                          ? '4:5 Instagram'
                          : v.aspectRatio === '16:9'
                          ? '16:9 HD'
                          : '1:1 Carré'}
                      </span>

                      <button
                        onClick={() => onToggleFavorite(v.id)}
                        className={`p-1.5 rounded-full backdrop-blur-md cursor-pointer ${
                          v.isFavorite ? 'bg-amber-400 text-black' : 'bg-black/60 text-zinc-300 hover:text-white'
                        }`}
                      >
                        <Star className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </div>

                    <button
                      onClick={() => onOpenVideo(v)}
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-lg">
                        <Play className="w-5 h-5 ml-0.5 fill-current" />
                      </div>
                    </button>

                    <div className="absolute bottom-2.5 right-3 px-2 py-0.5 rounded-md bg-black/75 text-[10px] font-mono tabular-nums text-white">
                      ~{formatDurationShort(v.totalEstimatedDuration || 45)}
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-white line-clamp-1">
                      {v.title}
                    </h4>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
                      {v.hook || v.description}
                    </p>

                    <div className="flex items-center gap-2 pt-2 text-[11px] text-zinc-500 tabular-nums">
                      <span>{v.scenes.length} scènes</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {v.createdAt ? new Date(v.createdAt).toLocaleDateString('fr-FR') : 'Récemment'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3 border-t border-zinc-200 dark:border-white/[0.08] flex items-center justify-between bg-zinc-50 dark:bg-[#0B0B0D]">
                  <button
                    onClick={() => onOpenVideo(v)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-white hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Ouvrir dans le Studio</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onOpenVideo(v)}
                      className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/70 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                      title="Partager cette vidéo"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onDeleteVideo(v.id)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Supprimer la vidéo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
