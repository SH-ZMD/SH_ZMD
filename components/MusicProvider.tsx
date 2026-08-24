"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { siteConfig } from '../siteConfig';

type PlayMode = 'loop' | 'single' | 'random';

type Song = {
  id: string;
  title: string;
  name?: string;
  artist: string;
  author?: string;
  cover: string;
  pic?: string;
  src: string;
  lrc?: string;
  lyric?: string;
  lrcUrl?: string;
  lyrics?: { time: number; text: string }[];
};

interface MusicContextType {
  playlist: Song[];
  currentIndex: number;
  currentSong?: Song;
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  currentLyric: string;
  isLoading: boolean;
  volume: number;
  isMuted: boolean;
  playMode: PlayMode;
  togglePlay: () => void;
  nextSong: () => void;
  prevSong: () => void;
  handleSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  playSong: (index: number) => void;
  selectSong: (index: number) => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
  togglePlayMode: () => void;
  ensurePlaylistReady: () => Promise<void>;
}

const MusicContext = createContext<MusicContextType | null>(null);
const DEFAULT_COVER = 'https://bu.dusays.com/2026/03/24/69c24230a5ff8.jpg';
const musicSignature = JSON.stringify({
  ids: siteConfig.cloudMusicIds || [],
  customMusic: ((siteConfig as any).customMusic || []).map((song: any) => ({
    id: song?.id,
    title: song?.title,
    src: song?.src,
  })),
});
const MUSIC_CACHE_KEY = `xh-music-playlist-v4-${musicSignature}`;

function parseLrc(lrcText: string) {
  if (!lrcText || lrcText.length > 30000) return [];

  const lines = lrcText.split(/\r?\n/);
  const result: { time: number; text: string }[] = [];

  for (const line of lines) {
    const matches = [...line.matchAll(/\[(\d{2,}):(\d{2})(?:[.:](\d{2,3}))?\]/g)];
    if (matches.length === 0) continue;

    const cleanText = line
      .replace(/\[\d{2,}:\d{2}(?:[.:]\d{2,3})?\]/g, '')
      .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '')
      .trim();

    if (!cleanText) continue;

    for (const match of matches) {
      const min = Number.parseInt(match[1], 10);
      const sec = Number.parseInt(match[2], 10);
      const ms = match[3] ? Number.parseInt(match[3], 10) : 0;
      const divisor = match[3] && match[3].length === 3 ? 1000 : 100;
      result.push({ time: min * 60 + sec + ms / divisor, text: cleanText });
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

function normalizeSong(song: any, fallbackId: string): Song {
  const title = song?.title || song?.name || 'Unknown Song';
  const artist = song?.artist || song?.author || 'Unknown Artist';
  const cover = song?.cover || song?.pic || DEFAULT_COVER;
  const lrc = song?.lrc || song?.lyric || '';
  return {
    id: String(song?.id || fallbackId),
    title,
    name: song?.name || title,
    artist,
    author: song?.author || artist,
    cover,
    pic: song?.pic || cover,
    src: song?.src || song?.url || '',
    lrc,
    lyric: song?.lyric || lrc,
    lrcUrl: song?.lrcUrl || '',
    lyrics: Array.isArray(song?.lyrics) ? song.lyrics : [],
  };
}

function readCachedPlaylist() {
  try {
    const raw = window.localStorage.getItem(MUSIC_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((song: Song) => song?.src) : [];
  } catch {
    return [];
  }
}

function writeCachedPlaylist(list: Song[]) {
  try {
    if (list.length > 0) window.localStorage.setItem(MUSIC_CACHE_KEY, JSON.stringify(list));
  } catch {}
}

async function readStaticPlaylist() {
  try {
    const res = await fetch('/music-data.json', { cache: 'force-cache' });
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data?.playlist) ? data.playlist : [];
    return list
      .filter((song: any) => song?.src)
      .map((song: any, index: number) => normalizeSong(song, song?.id || `static_${index}`));
  } catch {
    return [];
  }
}

function customPlaylist() {
  return ((siteConfig as any).customMusic || [])
    .filter((song: any) => song?.src)
    .map((song: any, index: number) => ({
      ...normalizeSong(song, song.id || `custom_${index}`),
      lyrics: song.lrc ? parseLrc(song.lrc) : [],
    }));
}

export function MusicProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lyrics, setLyrics] = useState<{ time: number; text: string }[]>([]);
  const [currentLyric, setCurrentLyric] = useState('Music standby');
  const [isLoading, setIsLoading] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playMode, setPlayMode] = useState<PlayMode>('loop');
  const hasResolvedRemoteRef = useRef(false);
  const loadingPromiseRef = useRef<Promise<void> | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const playlistRef = useRef<Song[]>([]);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    let cancelled = false;

    const loadLocalFirst = async () => {
      const cached = readCachedPlaylist();
      if (cancelled) return;

      if (cached.length > 0) {
        setPlaylist(cached);
        setCurrentLyric('Music ready');
        return;
      }

      const custom = customPlaylist();
      if (custom.length > 0) {
        setPlaylist(custom);
        setCurrentLyric('Music ready');
        return;
      }

      const staticList = await readStaticPlaylist();
      if (!cancelled && staticList.length > 0) {
        setPlaylist(staticList);
        setCurrentLyric('Music ready');
      }
    };

    loadLocalFirst();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchCloudSong = useCallback(async (id: string) => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`/api/music/resolve?id=${encodeURIComponent(id)}`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data ? normalizeSong(data, id) : null;
    } catch {
      return null;
    } finally {
      window.clearTimeout(timer);
    }
  }, []);

  const ensurePlaylistReady = useCallback(async () => {
    if (loadingPromiseRef.current) return loadingPromiseRef.current;

    loadingPromiseRef.current = (async () => {
      if (hasResolvedRemoteRef.current) return;
      hasResolvedRemoteRef.current = true;
      setIsLoading(true);
      setCurrentLyric('Music ready');

      try {
        const cloudIds = siteConfig.cloudMusicIds || [];
        const cloudResults = await Promise.allSettled(
          cloudIds.map((id) => fetchCloudSong(String(id)))
        );
        const cloudPlaylist = cloudResults
          .map((result) => (result.status === 'fulfilled' ? result.value : null))
          .filter((song): song is Song => Boolean(song?.src));
        const fallbackPlaylist = playlistRef.current.length > 0
          ? playlistRef.current
          : [...customPlaylist(), ...(await readStaticPlaylist())];
        const finalPlaylist = cloudPlaylist.length > 0 ? cloudPlaylist : fallbackPlaylist;

        if (finalPlaylist.length > 0) {
          setPlaylist(finalPlaylist);
          writeCachedPlaylist(finalPlaylist);
          setCurrentLyric('Music ready');
        } else {
          setCurrentLyric('Music ready');
        }
      } finally {
        setIsLoading(false);
        loadingPromiseRef.current = null;
      }
    })();

    return loadingPromiseRef.current;
  }, [fetchCloudSong]);

  useEffect(() => {
    if (pathname === '/music') {
      ensurePlaylistReady();
    }
  }, [ensurePlaylistReady, pathname]);

  useEffect(() => {
    if (playlist.length === 0) return;
    let isMounted = true;
    const currentSong = playlist[currentIndex];

    setLyrics([]);
    setCurrentLyric('Music ready');

    if (currentSong.lrc) {
      const parsed = parseLrc(currentSong.lrc);
      setLyrics(parsed);
      if (parsed.length > 0) {
        setPlaylist((prev) => {
          const next = [...prev];
          next[currentIndex] = { ...next[currentIndex], lyrics: parsed };
          return next;
        });
      }
    } else if (currentSong.lrcUrl) {
      fetch(currentSong.lrcUrl)
        .then((res) => res.text())
        .then((text) => {
          if (!isMounted) return;
          const parsed = parseLrc(text);
          setLyrics(parsed);
          setPlaylist((prev) => {
            const next = [...prev];
            next[currentIndex] = { ...next[currentIndex], lyrics: parsed };
            return next;
          });
        })
        .catch(() => {
          if (isMounted) setCurrentLyric('Music ready');
        });
    }

    if (isPlayingRef.current && audioRef.current) {
      audioRef.current.play().catch(() => setIsPlaying(false));
    }

    return () => {
      isMounted = false;
    };
  }, [currentIndex, playlist.length]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlay = async () => {
    if (!audioRef.current || playlistRef.current.length === 0) {
      await ensurePlaylistReady();
    }

    const audio = audioRef.current;
    if (!audio) return;

    if (isPlayingRef.current) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  const nextSong = () => {
    const length = playlistRef.current.length;
    if (length <= 0) return;
    if (playMode === 'random') {
      setCurrentIndex(Math.floor(Math.random() * length));
    } else {
      setCurrentIndex((prev) => (prev + 1) % length);
    }
  };

  const prevSong = () => {
    const length = playlistRef.current.length;
    if (length <= 0) return;
    if (playMode === 'random') {
      setCurrentIndex(Math.floor(Math.random() * length));
    } else {
      setCurrentIndex((prev) => (prev - 1 + length) % length);
    }
  };

  const playSong = async (index: number) => {
    if (playlistRef.current.length === 0) {
      await ensurePlaylistReady();
    }
    if (index >= 0) setCurrentIndex(index);
    setIsPlaying(true);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;

    const nextCurrentTime = audioRef.current.currentTime;
    const nextDuration = audioRef.current.duration || 0;
    setCurrentTime(nextCurrentTime);
    setDuration(nextDuration);
    setProgress((nextCurrentTime / (nextDuration || 1)) * 100);

    if (lyrics.length > 0) {
      const activeLyric = lyrics.slice().reverse().find((line) => nextCurrentTime >= line.time);
      if (activeLyric) setCurrentLyric(activeLyric.text);
    }
  };

  const handleEnded = () => {
    if (playMode === 'single' && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => setIsPlaying(false));
    } else {
      nextSong();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextProgress = Number(e.target.value);
    setProgress(nextProgress);
    if (audioRef.current?.duration) {
      audioRef.current.currentTime = (nextProgress / 100) * audioRef.current.duration;
    }
  };

  const setVolume = (value: number) => {
    setVolumeState(value);
    if (isMuted && value > 0) setIsMuted(false);
  };

  const toggleMute = () => setIsMuted((value) => !value);
  const togglePlayMode = () => {
    setPlayMode((value) => {
      if (value === 'loop') return 'single';
      if (value === 'single') return 'random';
      return 'loop';
    });
  };

  const currentSong = playlist[currentIndex];

  return (
    <MusicContext.Provider
      value={{
        playlist,
        currentIndex,
        currentSong,
        isPlaying,
        progress,
        currentTime,
        duration,
        currentLyric,
        isLoading,
        volume,
        isMuted,
        playMode,
        togglePlay,
        nextSong,
        prevSong,
        handleSeek,
        playSong,
        selectSong: playSong,
        setVolume,
        toggleMute,
        togglePlayMode,
        ensurePlaylistReady,
      }}
    >
      {children}
      {currentSong && (
        <audio
          ref={audioRef}
          src={currentSong.src}
          preload="none"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onError={nextSong}
          onLoadedMetadata={handleTimeUpdate}
        />
      )}
    </MusicContext.Provider>
  );
}

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) throw new Error('useMusic must be used within MusicProvider');
  return context;
};
