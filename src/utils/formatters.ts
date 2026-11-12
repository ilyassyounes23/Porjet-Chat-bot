import type { Movie } from '@/types/movie';

export function formatRuntime(minutes: number | null | undefined): string {
  if (!minutes || !Number.isFinite(minutes) || minutes <= 0) {
    return 'Not available';
  }
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

export function formatRuntimeMono(minutes: number | null | undefined): string {
  if (!minutes || !Number.isFinite(minutes) || minutes <= 0) {
    return '— MIN';
  }
  return `${Math.round(minutes)} MIN`;
}

export function formatImdbScore(score: number | null | undefined): string {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return 'Not available';
  }
  return score.toFixed(1);
}

export function formatRottenTomatoes(rt: string | null | undefined): string {
  if (!rt || !rt.trim()) {
    return 'Not available';
  }
  return rt.trim();
}

export function formatReleaseDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Not available';
  const trimmed = dateStr.trim();
  if (/^\d{4}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

export function formatVoteCount(votes: number | null | undefined): string {
  if (!votes || votes <= 0) return '';
  if (votes >= 1_000_000) return `${(votes / 1_000_000).toFixed(1)}M`;
  if (votes >= 1_000) return `${Math.round(votes / 1_000)}K`;
  return String(votes);
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function movieMatchesQuery(movie: Movie, rawQuery: string): boolean {
  const q = normalizeText(rawQuery);
  if (!q) return true;

  const haystacks = [
    movie.title,
    movie.originalTitle ?? '',
    movie.director ?? '',
    String(movie.releaseYear),
    ...movie.genres,
    ...movie.actors,
  ];

  return haystacks.some((item) => normalizeText(item).includes(q));
}

export function getGenreMatch(movie: Movie, genreTarget: string): boolean {
  const target = genreTarget.toLowerCase();
  return movie.genres.some((g) => {
    const lower = g.toLowerCase();
    if (target === 'science fiction') {
      return lower.includes('science fiction') || lower.includes('sci-fi');
    }
    return lower === target || lower.includes(target);
  });
}
