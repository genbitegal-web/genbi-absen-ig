// Helper utilities for multi-platform attendance (Instagram & YouTube)

export type TaskPlatform = 'INSTAGRAM' | 'YOUTUBE' | 'MIXED';

/**
 * Checks if a URL points to YouTube (videos, shorts, live, youtu.be)
 */
export function isYouTubeUrl(url?: string | null): boolean {
  if (!url) return false;
  const lower = url.trim().toLowerCase();
  return lower.includes('youtube.com') || lower.includes('youtu.be');
}

/**
 * Checks if a URL points to Instagram
 */
export function isInstagramUrl(url?: string | null): boolean {
  if (!url) return false;
  const lower = url.trim().toLowerCase();
  return lower.includes('instagram.com');
}

/**
 * Extracts YouTube Video ID (11 characters)
 */
export function getYouTubeVideoId(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  
  // Standard watch, shorts, live, embed, and youtu.be patterns
  const match = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

/**
 * Returns high quality thumbnail URL for YouTube video
 */
export function getYouTubeThumbnail(url?: string | null): string | null {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) return null;
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Returns YouTube embed URL
 */
export function getYouTubeEmbedUrl(url?: string | null): string | null {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) return null;
  return `https://www.youtube.com/embed/${videoId}`;
}

/**
 * Automatically detects platform from list of URLs or declared platform
 */
export function detectPlatform(urls: string[] = [], declaredPlatform?: string): TaskPlatform {
  if (declaredPlatform === 'YOUTUBE' || declaredPlatform === 'INSTAGRAM' || declaredPlatform === 'MIXED') {
    return declaredPlatform;
  }

  const validUrls = urls.filter(u => u && u.trim().length > 0);
  if (validUrls.length === 0) return 'INSTAGRAM';

  const ytCount = validUrls.filter(isYouTubeUrl).length;
  const igCount = validUrls.filter(isInstagramUrl).length;

  if (ytCount > 0 && igCount === 0) return 'YOUTUBE';
  if (igCount > 0 && ytCount === 0) return 'INSTAGRAM';
  if (ytCount > 0 && igCount > 0) return 'MIXED';

  return 'INSTAGRAM';
}

/**
 * Formats label for a given link index in a task
 */
export function getLinkActionLabel(url: string, index: number, totalLinks: number): {
  platform: 'YOUTUBE' | 'INSTAGRAM' | 'LINK';
  label: string;
  buttonLabel: string;
  instructions: string;
} {
  const isYT = isYouTubeUrl(url);
  const isIG = isInstagramUrl(url);
  const numberSuffix = totalLinks > 1 ? ` #${index + 1}` : '';

  if (isYT) {
    return {
      platform: 'YOUTUBE',
      label: `Video YouTube${numberSuffix}`,
      buttonLabel: `Buka Video YouTube${numberSuffix}`,
      instructions: 'Tonton video, berikan Like, tinggalkan Komentar dengan menyertakan Nama & NPM, lalu unggah tangkapan layar (screenshot) bukti di bawah ini.'
    };
  }

  if (isIG) {
    return {
      platform: 'INSTAGRAM',
      label: `Postingan Instagram${numberSuffix}`,
      buttonLabel: `Buka Postingan IG${numberSuffix}`,
      instructions: 'Buka postingan, berikan Like & Komentar, lalu unggah screenshot bukti di bawah ini.'
    };
  }

  return {
    platform: 'LINK',
    label: `Tautan Tugas${numberSuffix}`,
    buttonLabel: `Buka Tautan${numberSuffix}`,
    instructions: 'Buka tautan tugas dan unggah screenshot bukti partisipasi Anda di bawah ini.'
  };
}
