# NOIR — Editorial Cinema Streaming Platform

NOIR is a dark-themed, editorial cinema streaming application inspired by Apple TV+, A24, Criterion Channel, and MUBI. It features a 500+ film catalog, multi-facet discovery and sorting, a parallax cinema detail dossier, personal watchlist & viewing history, optional Supabase authentication/sync, and an integrated HTML5 & trailer cinema theater player.

---

## Quick Launch (Windows 10 & Windows 11)

1. Double-click **`START_NOIR.bat`** in the project root folder.
2. The launcher automatically checks Node.js and npm, runs `npm install` on first launch if `node_modules` is missing, starts Vite on port `5173` (`strictPort: true`), waits until the server is ready, and opens **`http://localhost:5173`** in your default browser.
3. Keep the terminal window open while using NOIR.

### How to Stop the Application

- Focus the `START_NOIR.bat` terminal window and press **`Ctrl + C`** (confirm `Y` if prompted), or simply close the terminal window.

---

## Prerequisites & Installing Node.js

If Node.js is not installed on your machine:

1. Download the **LTS** installer for Windows from [https://nodejs.org/](https://nodejs.org/).
2. Run the installer with default options (this installs both `node` and `npm`).
3. Verify in Command Prompt or PowerShell:
   ```cmd
   node -v
   npm -v
   ```

*(If PowerShell blocks `npm` scripts due to ExecutionPolicy, either run commands in Command Prompt `cmd` or double-click `START_NOIR.bat` directly.)*

---

## Manual Development Commands

```cmd
npm install
npm run dev
```

Production check & build:

```cmd
npm run typecheck
npm run build
```

---

## Environment Variables & API Configuration

NOIR runs immediately out of the box in **Curated Demo Archive Mode** (containing 500+ real films indexed from Wikidata, Wikipedia, official IMDb non-commercial datasets, and verified public-domain/open-cinema streams) with zero API keys required.

To activate live external APIs:

1. Copy `.env.example` to `.env`:
   ```cmd
   copy .env.example .env
   ```
2. Fill in the desired services below and restart `START_NOIR.bat`.

### 1. TMDB Live Movie Catalog (Server-Side Proxy)

TMDB credentials are read **exclusively on the Vite Node server middleware** (`vite.config.ts`) and are never exposed in the browser bundle.

- Register at [https://www.themoviedb.org/settings/api](https://www.themoviedb.org/settings/api).
- Set either `TMDB_READ_ACCESS_TOKEN` or `TMDB_API_KEY` inside `.env`.
- When configured, NOIR fetches paginated TMDB lists across trending, popular, top rated, now playing, classics, and genre discoveries to build a 500+ live catalog.

### 2. OMDb Ratings (Genuine IMDb & Rotten Tomatoes Scores)

NOIR never invents IMDb or Rotten Tomatoes ratings and never presents TMDB community scores as IMDb ratings. Missing scores display `"Not available"`.

- Obtain an API key from [https://www.omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx).
- Set `OMDB_API_KEY` inside `.env` (served exclusively via `/api/ratings`).

### 3. Supabase Authentication, Watchlist & Viewing History

- Create a project at [https://supabase.com/](https://supabase.com/).
- Run `supabase/schema.sql` in **Supabase Dashboard → SQL Editor** to create `profiles`, `watchlists`, `viewing_history`, RLS policies, and the `on_auth_user_created` profile trigger.
- In **Supabase Dashboard → Authentication → URL Configuration**, set Site URL to `http://localhost:5173` and add `http://localhost:5173/auth/callback` to **Redirect URLs**.
- Add `VITE_SUPABASE_URL` and either `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY` to `.env`.

### 4. OAuth Providers (Google, Apple, Reddit)

OAuth buttons never simulate logins if unconfigured:

- **Google / Apple**: Configure the provider inside **Supabase Dashboard → Authentication → Sign In / Providers** (with Client ID & Secret), add `http://localhost:5173/auth/callback` to Supabase Redirect URLs, then set `VITE_SUPABASE_GOOGLE_ENABLED=true` or `VITE_SUPABASE_APPLE_ENABLED=true` in `.env` and restart Vite.
- **Reddit**: Register an app at [https://www.reddit.com/prefs/apps](https://www.reddit.com/prefs/apps) with redirect URI `http://localhost:5173/auth/callback/reddit`, and set `VITE_REDDIT_CLIENT_ID` in `.env`.

### 5. NOIR AI — The Intelligent Cinema Companion (`/cinema-ai`)

NOIR AI integrates a real server-side LLM recommendation & film analysis engine into NOIR on the Vite Node middleware server (`server/apiHandler.ts`):

- **Server-side only credentials**: Add `OPENAI_API_KEY`, `OPENAI_MODEL` (default `gpt-4o-mini`), and `AI_ENABLED=true` in `.env`. Never prefix private keys with `VITE_`.
- **Two Sources of Knowledge**: Combines NOIR's 1,000+ internal catalog (`src/data/demoCatalog.json`) with live TMDB and OMDb metadata, strictly separating films available on NOIR from external TMDB discoveries without inventing scores.
- **Five Conversational Modes**: `Discovery`, `Analysis` (with default Spoiler-Safe shield toggle), `Comparison`, `Hidden Gems`, and `Watch Tonight`.
- **Discuss Any Film**: Click **Discuss with NOIR AI** on any movie detail view to attach structured film metadata (title, ID, synopsis, cast, director, ratings) directly to your AI conversation.
- **Supabase AI Memory & RLS**: Run the updated `supabase/schema.sql` in **Supabase Dashboard → SQL Editor** to provision `ai_conversations`, `ai_messages`, and `ai_saved_recommendations` with strict owner-only Row Level Security (`auth.uid() = user_id`). Unauthenticated/offline sessions automatically persist locally without blocking access.
- **Endpoints**: `GET /api/ai/status`, `GET /api/ai/movies/search`, `GET|POST /api/ai/movie-context`, `POST /api/ai/chat` (SSE streaming), `POST /api/ai/recommend`, `GET|DELETE /api/ai/conversations` (Bearer JWT RLS proxy).

---

## Architecture Overview

```text
server/
  apiHandler.ts      # Unified /api/* middleware (/api/ai/*, /api/tmdb/*, /api/ratings, /api/config/status)
  catalogRetrieval.ts# Bounded hybrid search across 1,000+ catalog & TMDB/OMDb + pick hydration
  systemPrompt.ts    # Mode-aware critic directives, spoiler shield & grounded card protocol
  security.ts        # Payload sanitization, validation, sliding-window rate limits, JWT checks
  providers/         # Pluggable LLM provider abstraction (OpenAI default)
src/
  components/
    layout/          # Navbar, Footer
    navigation/      # MobileDrawer
    ai/              # AiSidebar, AiMessageItem, AiRecommendationCard, AttachMovieModal
    movies/          # HeroSection, MovieCard, MovieRow, EditorialSpotlight, RatingsBadge, PosterFallback
    player/          # CinemaPlayer (HTML5 controls, speed, subtitles, fullscreen)
    forms/           # AuthLayout, TextField, OAuthButtons
    ui/              # Button, Skeleton, EmptyState, Toast
  pages/
    Home/            # Asymmetric Hero + 15 horizontal cinema shelves + spotlights
    Movies/          # Full discovery, search suggestions, filters & 7 sort modes
    CinemaAi/        # Dedicated /cinema-ai editorial research studio workspace
    Genres/          # Genre & cinema movement directory
    Trending/        # Ranked Top 10 ledger + trending grid
    MovieDetails/    # Full-screen parallax detail modal + /movie/:id page ("Discuss with NOIR AI")
    Watchlist/       # Personal saved queue
    Profile/         # Member profile, viewing history & API/account settings
    Watch/           # Cinema screening room & trailer / licensing states
    Login/           # Login with email, password toggle, remember me, forgot password, OAuth
    Register/        # Registration with password confirmation, T&C, OAuth
  services/
    ai/              # /api/ai/* streaming SSE client + Supabase RLS / localStorage persistence
    catalog/         # Source abstraction (Live TMDB vs 1,000+ Curated Demo Catalog)
    tmdb/            # Paginated movie TMDB client via /api/tmdb
    imdb/            # OMDb / legitimate IMDb rating service
    rottenTomatoes/  # OMDb / verified Rotten Tomatoes rating service
    auth/            # Supabase Auth + local studio email fallback + strict OAuth checks
    watchlist/       # Supabase PostgreSQL + localStorage persistence
    supabase/        # Conditional Supabase client
  data/
    demoCatalog.json
```
