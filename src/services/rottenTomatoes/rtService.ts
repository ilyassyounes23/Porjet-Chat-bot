import { fetchVerifiedExternalRatings } from '@/services/imdb/imdbService';

export async function fetchRottenTomatoesRating(params: {
  imdbId?: string | null;
  title: string;
  year?: number;
  existing?: string | null;
}): Promise<string | null> {
  const external = await fetchVerifiedExternalRatings(params);
  if (external?.rottenTomatoes) {
    return external.rottenTomatoes;
  }
  return params.existing ?? null;
}
