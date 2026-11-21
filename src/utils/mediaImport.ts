import { ImportedMediaItem } from '../types';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Impossible de lire le fichier image'));
    reader.readAsDataURL(file);
  });
}

function captureVideoMetadata(file: File): Promise<{ previewUrl: string; videoUrl: string; durationSeconds: number }> {
  return new Promise((resolve) => {
    const videoUrl = URL.createObjectURL(file);
    const videoEl = document.createElement('video');
    videoEl.preload = 'metadata';
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.src = videoUrl;

    let resolved = false;
    const finish = (previewUrl: string, durationSeconds: number) => {
      if (resolved) return;
      resolved = true;
      resolve({ previewUrl, videoUrl, durationSeconds });
    };

    const fallbackTimer = setTimeout(() => {
      finish(createPlaceholderThumb(file.name), 6);
    }, 3000);

    videoEl.onloadedmetadata = () => {
      const duration = Number.isFinite(videoEl.duration) && videoEl.duration > 0
        ? Math.min(30, Math.max(3, Math.round(videoEl.duration)))
        : 6;
      try {
        videoEl.currentTime = Math.min(0.4, (videoEl.duration || 1) / 4);
      } catch {
        clearTimeout(fallbackTimer);
        finish(createPlaceholderThumb(file.name), duration);
      }
    };

    videoEl.onseeked = () => {
      clearTimeout(fallbackTimer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = videoEl.videoWidth || 720;
        canvas.height = videoEl.videoHeight || 1280;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          const duration = Number.isFinite(videoEl.duration) && videoEl.duration > 0
            ? Math.min(30, Math.max(3, Math.round(videoEl.duration)))
            : 6;
          finish(dataUrl, duration);
          return;
        }
      } catch {
        // ignore
      }
      finish(createPlaceholderThumb(file.name), 6);
    };

    videoEl.onerror = () => {
      clearTimeout(fallbackTimer);
      finish(createPlaceholderThumb(file.name), 6);
    };
  });
}

function createPlaceholderThumb(label: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 720, 720);
    grad.addColorStop(0, '#090D18');
    grad.addColorStop(1, '#0284C7');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 720, 720);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '600 28px "Outfit", "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label.slice(0, 26), 360, 360);
  }
  return canvas.toDataURL('image/jpeg', 0.85);
}

export async function processUploadedMediaFiles(files: FileList | File[]): Promise<ImportedMediaItem[]> {
  const fileArray = Array.from(files);
  const results: ImportedMediaItem[] = [];

  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i];
    const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|avi)$/i.test(file.name);
    const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name);

    if (!isVideo && !isImage) continue;

    if (isVideo) {
      const meta = await captureVideoMetadata(file);
      results.push({
        id: `media-${Date.now()}-${i}`,
        name: file.name,
        mediaType: 'video',
        previewUrl: meta.previewUrl,
        videoUrl: meta.videoUrl,
        durationSeconds: meta.durationSeconds,
      });
    } else {
      const dataUrl = await readFileAsDataUrl(file);
      results.push({
        id: `media-${Date.now()}-${i}`,
        name: file.name,
        mediaType: 'image',
        previewUrl: dataUrl,
        durationSeconds: 6,
      });
    }
  }

  return results;
}
