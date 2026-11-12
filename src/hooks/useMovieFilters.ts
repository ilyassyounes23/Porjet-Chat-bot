import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { DurationFilter, Movie, MovieFilterState, SortOption } from '@/types/movie';
import { getGenreMatch, movieMatchesQuery } from '@/utils/formatters';

export const DEFAULT_FILTERS: MovieFilterState = {
  query: '',
  genre: 'all',
  year: 'all',
  minImdbRating: 0,
  duration: 'all',
  language: 'all',
  country: 'all',
  popularityFloor: 'all',
  sort: 'most_popular',
  collection: '',
};

function readFiltersFromParams(params: URLSearchParams): MovieFilterState {
  const minRatingRaw = Number.parseFloat(params.get('rating') ?? '0');
  const sortRaw = params.get('sort') as SortOption | null;
  const validSorts: SortOption[] = [
    'most_popular',
    'highest_rated',
    'latest_releases',
    'oldest_releases',
    'alphabetical',
    'shortest_duration',
    'longest_duration',
  ];

  return {
    query: params.get('q') ?? '',
    genre: params.get('genre') ?? 'all',
    year: params.get('year') ?? 'all',
    minImdbRating: Number.isFinite(minRatingRaw) ? minRatingRaw : 0,
    duration: (params.get('duration') as DurationFilter) ?? 'all',
    language: params.get('language') ?? 'all',
    country: params.get('country') ?? 'all',
    popularityFloor:
      (params.get('popularityFloor') as MovieFilterState['popularityFloor']) ?? 'all',
    sort: sortRaw && validSorts.includes(sortRaw) ? sortRaw : 'most_popular',
    collection: params.get('collection') ?? '',
  };
}

export function useMovieFilters(movies: Movie[]) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFiltersFromParams(searchParams), [searchParams]);

  const updateFilter = useCallback(
    <K extends keyof MovieFilterState>(key: K, value: MovieFilterState[K]) => {
      setSearchParams(
        (prevParams) => {
          const next = { ...readFiltersFromParams(prevParams), [key]: value };
          const params = new URLSearchParams();
          if (next.query.trim()) params.set('q', next.query.trim());
          if (next.genre !== 'all') params.set('genre', next.genre);
          if (next.year !== 'all') params.set('year', next.year);
          if (next.minImdbRating > 0) params.set('rating', String(next.minImdbRating));
          if (next.duration !== 'all') params.set('duration', next.duration);
          if (next.language !== 'all') params.set('language', next.language);
          if (next.country !== 'all') params.set('country', next.country);
          if (next.popularityFloor !== 'all') params.set('popularityFloor', next.popularityFloor);
          if (next.sort !== 'most_popular') params.set('sort', next.sort);
          if (next.collection) params.set('collection', next.collection);
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const clearFilters = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  // Distinct facet options computed dynamically from the catalog
  const facets = useMemo(() => {
    const genreCounts = new Map<string, number>();
    const langCounts = new Map<string, number>();
    const countryCounts = new Map<string, number>();
    const yearSet = new Set<number>();

    for (const m of movies) {
      for (const g of m.genres) {
        genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
      }
      if (m.language) langCounts.set(m.language, (langCounts.get(m.language) ?? 0) + 1);
      if (m.country) countryCounts.set(m.country, (countryCounts.get(m.country) ?? 0) + 1);
      if (m.releaseYear > 1900) yearSet.add(m.releaseYear);
    }

    const genres = Array.from(genreCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    const languages = Array.from(langCounts.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    const countries = Array.from(countryCounts.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    const years = Array.from(yearSet).sort((a, b) => b - a);

    return { genres, languages, countries, years };
  }, [movies]);

  const filteredMovies = useMemo(() => {
    const result = movies.filter((movie) => {
      if (filters.query.trim() && !movieMatchesQuery(movie, filters.query)) {
        return false;
      }

      if (filters.collection === 'trending') {
        if (!movie.tags?.includes('trending') && movie.releaseYear < 2021) return false;
      }

      if (filters.genre !== 'all' && !getGenreMatch(movie, filters.genre)) {
        return false;
      }

      if (filters.year !== 'all') {
        const yr = movie.releaseYear;
        if (filters.year === '2020s' && (yr < 2020 || yr > 2029)) return false;
        else if (filters.year === '2010s' && (yr < 2010 || yr > 2019)) return false;
        else if (filters.year === '2000s' && (yr < 2000 || yr > 2009)) return false;
        else if (filters.year === '1990s' && (yr < 1990 || yr > 1999)) return false;
        else if (filters.year === '1980s' && (yr < 1980 || yr > 1989)) return false;
        else if (filters.year === 'classic' && yr > 1984) return false;
        else if (/^\d{4}$/.test(filters.year) && yr !== Number.parseInt(filters.year, 10)) {
          return false;
        }
      }

      if (filters.minImdbRating > 0) {
        if (movie.ratings.imdb === null || movie.ratings.imdb < filters.minImdbRating) {
          return false;
        }
      }

      if (filters.duration !== 'all') {
        if (movie.duration === null) return false;
        if (filters.duration === 'under_90' && movie.duration >= 90) return false;
        if (filters.duration === '90_to_120' && (movie.duration < 90 || movie.duration > 120)) {
          return false;
        }
        if (filters.duration === '120_to_150' && (movie.duration <= 120 || movie.duration > 150)) {
          return false;
        }
        if (filters.duration === 'over_150' && movie.duration <= 150) return false;
      }

      if (
        filters.language !== 'all' &&
        movie.language.toLowerCase() !== filters.language.toLowerCase()
      ) {
        return false;
      }

      if (
        filters.country !== 'all' &&
        movie.country.toLowerCase() !== filters.country.toLowerCase()
      ) {
        return false;
      }

      if (filters.popularityFloor !== 'all') {
        const votes = movie.ratings.imdbVotes ?? 0;
        const score = movie.ratings.imdb ?? movie.ratings.tmdbScore ?? 0;
        if (filters.popularityFloor === 'mainstream' && votes < 150000 && movie.popularity < 120) {
          return false;
        }
        if (filters.popularityFloor === 'acclaimed' && score < 7.8) return false;
        if (
          filters.popularityFloor === 'hidden_gems' &&
          !(movie.tags?.includes('hidden_gem') || (score >= 7.2 && votes > 0 && votes <= 90000))
        ) {
          return false;
        }
      }

      return true;
    });

    result.sort((a, b) => {
      switch (filters.sort) {
        case 'highest_rated': {
          const sa = a.ratings.imdb ?? a.ratings.tmdbScore ?? -1;
          const sb = b.ratings.imdb ?? b.ratings.tmdbScore ?? -1;
          return sb - sa;
        }
        case 'latest_releases':
          return b.releaseDate.localeCompare(a.releaseDate);
        case 'oldest_releases':
          return a.releaseDate.localeCompare(b.releaseDate);
        case 'alphabetical':
          return a.title.localeCompare(b.title);
        case 'shortest_duration':
          return (a.duration ?? 9999) - (b.duration ?? 9999);
        case 'longest_duration':
          return (b.duration ?? -1) - (a.duration ?? -1);
        case 'most_popular':
        default:
          return b.popularity - a.popularity;
      }
    });

    return result;
  }, [movies, filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.query.trim()) count++;
    if (filters.genre !== 'all') count++;
    if (filters.year !== 'all') count++;
    if (filters.minImdbRating > 0) count++;
    if (filters.duration !== 'all') count++;
    if (filters.language !== 'all') count++;
    if (filters.country !== 'all') count++;
    if (filters.popularityFloor !== 'all') count++;
    if (filters.collection) count++;
    return count;
  }, [filters]);

  return {
    filters,
    updateFilter,
    clearFilters,
    facets,
    filteredMovies,
    activeFilterCount,
  };
}
