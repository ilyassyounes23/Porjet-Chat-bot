import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Subtitles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { Movie } from '@/types/movie';
import { formatTimecode } from '@/utils/formatters';

interface CinemaPlayerProps {
  movie: Movie;
  initialProgressSeconds?: number;
  onProgress?: (seconds: number, duration: number) => void;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function CinemaPlayer({
  movie,
  initialProgressSeconds = 0,
  onProgress,
}: CinemaPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [subtitlesOn, setSubtitlesOn] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);

  const hideTimerRef = useRef<number | null>(null);

  // Build dynamic WebVTT caption track for archive screening notes
  const vttBlobUrl = useMemo(() => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:07.000',
      `${movie.title} (${movie.releaseYear}) — NOIR Archive Screening`,
      '',
      '00:00:07.500 --> 00:00:14.000',
      `${movie.playableStream?.licenseLabel ?? 'Authorized Open Cinema'}`,
      '',
    ].join('\n');
    return URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
  }, [movie.title, movie.releaseYear, movie.playableStream?.licenseLabel]);

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(vttBlobUrl);
    };
  }, [vttBlobUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const track = video.textTracks?.[0];
    if (track) {
      track.mode = subtitlesOn ? 'showing' : 'hidden';
    }
  }, [subtitlesOn]);

  useEffect(() => {
    const onFsChange = () => {
      setFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const revealControls = () => {
    setControlsVisible(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    if (playing) {
      hideTimerRef.current = window.setTimeout(() => setControlsVisible(false), 3200);
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  };

  const seekBy = (delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + delta));
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      if (e.key === ' ' || e.key.toLowerCase() === 'k') {
        e.preventDefault();
        togglePlay();
      } else if (e.key.toLowerCase() === 'm') {
        setMuted((prev) => {
          const next = !prev;
          if (videoRef.current) videoRef.current.muted = next;
          return next;
        });
      } else if (e.key.toLowerCase() === 'f') {
        void toggleFullscreen();
      } else if (e.key === 'ArrowLeft') {
        seekBy(-10);
      } else if (e.key === 'ArrowRight') {
        seekBy(10);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!movie.playableStream) {
    return null;
  }

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={revealControls}
      onMouseLeave={() => playing && setControlsVisible(false)}
      className="relative w-full aspect-video max-h-[82vh] bg-black border border-white/12 overflow-hidden select-none group"
    >
      <video
        ref={videoRef}
        src={movie.playableStream.url}
        poster={movie.backdropUrl ?? movie.posterUrl ?? undefined}
        playsInline
        preload="metadata"
        onClick={togglePlay}
        onPlay={() => {
          setPlaying(true);
          revealControls();
        }}
        onPause={() => {
          setPlaying(false);
          setBuffering(false);
          setControlsVisible(true);
        }}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          const total = v.duration || 0;
          setDuration(total);
          v.volume = volume;
          v.playbackRate = speed;
          if (initialProgressSeconds > 5 && total > 30 && initialProgressSeconds < total - 10) {
            v.currentTime = initialProgressSeconds;
            setCurrentTime(initialProgressSeconds);
          }
        }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          setCurrentTime(v.currentTime);
          if (v.buffered.length > 0) {
            setBuffered(v.buffered.end(v.buffered.length - 1));
          }
          if (onProgress && Math.floor(v.currentTime) % 5 === 0) {
            onProgress(v.currentTime, v.duration || 0);
          }
        }}
        onError={() =>
          setVideoError(
            'Unable to reach the remote public-domain media file. Verify your network connection or try the trailer.'
          )
        }
        className="w-full h-full object-contain bg-black cursor-pointer"
      >
        <track
          kind="subtitles"
          src={vttBlobUrl}
          srcLang="en"
          label="Archive Notes (EN)"
          default={false}
        />
      </video>

      {/* Buffering Indicator */}
      {buffering && playing && !videoError && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="p-3 bg-black/70 border border-white/15">
            <Loader2 className="w-6 h-6 text-[#C6A46A] animate-spin" />
          </div>
        </div>
      )}

      {/* Center Play Overlay when Paused */}
      {!playing && !videoError && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play video"
          className="absolute inset-0 flex items-center justify-center bg-black/35 hover:bg-black/25 transition-colors cursor-pointer"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 border border-[#C6A46A] bg-[#090909]/85 flex items-center justify-center text-[#C6A46A] hover:scale-105 transition-transform">
            <Play className="w-7 h-7 fill-current ml-0.5" />
          </div>
        </button>
      )}

      {/* Error State */}
      {videoError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#090909]/95 p-6 text-center space-y-3">
          <p className="font-serif-display text-2xl text-[#F5F5F5]">Stream Interruption</p>
          <p className="text-xs text-[#929292] max-w-md">{videoError}</p>
        </div>
      )}

      {/* Bottom Theater Controls */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/85 to-transparent px-4 sm:px-6 pt-12 pb-4 transition-opacity duration-300 ${
          controlsVisible || !playing ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Scrub Timeline */}
        <div className="relative h-2 bg-white/15 mb-4 cursor-pointer group/bar">
          <div
            className="absolute inset-y-0 left-0 bg-white/25 pointer-events-none"
            style={{ width: `${bufferedPct}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 bg-[#C6A46A] pointer-events-none"
            style={{ width: `${progressPct}%` }}
          />
          <input
            type="range"
            aria-label="Seek timeline"
            min={0}
            max={duration || 100}
            step={0.5}
            value={currentTime}
            onChange={(e) => {
              const target = Number.parseFloat(e.target.value);
              if (videoRef.current) videoRef.current.currentTime = target;
              setCurrentTime(target);
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left Transport */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? 'Pause' : 'Play'}
              className="text-[#F5F5F5] hover:text-[#C6A46A] transition-colors cursor-pointer"
            >
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
            </button>

            <button
              type="button"
              onClick={() => seekBy(-10)}
              aria-label="Rewind 10 seconds"
              className="text-[#b4b4b4] hover:text-[#F5F5F5] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => seekBy(10)}
              aria-label="Forward 10 seconds"
              className="text-[#b4b4b4] hover:text-[#F5F5F5] transition-colors cursor-pointer"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const nextMuted = !muted;
                  setMuted(nextMuted);
                  if (videoRef.current) videoRef.current.muted = nextMuted;
                }}
                aria-label={muted ? 'Unmute' : 'Mute'}
                className="text-[#b4b4b4] hover:text-[#F5F5F5] cursor-pointer"
              >
                {muted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                aria-label="Volume"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => {
                  const val = Number.parseFloat(e.target.value);
                  setVolume(val);
                  setMuted(val === 0);
                  if (videoRef.current) {
                    videoRef.current.volume = val;
                    videoRef.current.muted = val === 0;
                  }
                }}
                className="w-16 sm:w-20 accent-[#C6A46A] cursor-pointer hidden sm:block"
              />
            </div>

            <span className="font-mono-tech text-[11px] text-[#d4d4d4] tabular-nums">
              {formatTimecode(currentTime)} <span className="text-[#6a6a6a]">/</span>{' '}
              {formatTimecode(duration)}
            </span>
          </div>

          {/* Right Speed, Subtitles & Fullscreen */}
          <div className="flex items-center gap-3">
            <select
              aria-label="Playback speed"
              value={speed}
              onChange={(e) => {
                const s = Number.parseFloat(e.target.value);
                setSpeed(s);
                if (videoRef.current) videoRef.current.playbackRate = s;
              }}
              className="bg-[#121212] border border-white/15 px-2 py-1 font-mono-tech text-[11px] text-[#F5F5F5] cursor-pointer focus:outline-none"
            >
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {s}x
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setSubtitlesOn((prev) => !prev)}
              aria-label="Toggle subtitles"
              title="Toggle Archive Captions / Subtitles"
              className={`p-1.5 border transition-colors cursor-pointer ${
                subtitlesOn
                  ? 'border-[#C6A46A] text-[#C6A46A] bg-[#C6A46A]/10'
                  : 'border-white/15 text-[#929292] hover:text-[#F5F5F5]'
              }`}
            >
              <Subtitles className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              className="p-1.5 border border-white/15 text-[#b4b4b4] hover:text-[#F5F5F5] cursor-pointer"
            >
              {fullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
