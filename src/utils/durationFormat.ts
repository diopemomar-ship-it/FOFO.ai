export function formatDurationShort(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(Number(totalSeconds) || 0));
  if (safe < 60) {
    return `${safe}s`;
  }
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    if (minutes === 0 && seconds === 0) return `${hours}h`;
    if (seconds === 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }

  if (seconds === 0) return `${minutes}m`;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

export function formatTimecode(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function estimateSceneCountForDuration(durationSeconds: number): number {
  const d = Math.max(15, Number(durationSeconds) || 45);
  if (d <= 30) return 4;
  if (d <= 60) return 6;
  if (d <= 180) return 8;
  if (d <= 600) return 10;
  if (d <= 1800) return 14;
  if (d <= 3600) return 18;
  return 24;
}
