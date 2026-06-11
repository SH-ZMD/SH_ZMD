"use client";

import { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { siteConfig } from '../siteConfig';

// 【增强版 LRC 歌词解析】
function parseLrc(lrcText: string) {
  if (!lrcText || lrcText.length > 30000) return [];

  const lines = lrcText.split(/\r?\n/);
  const result = [];

  for (let line of lines) {
    const matches = [...line.matchAll(/\[(\d{2,}):(\d{2})(?:\.(\d{2,3}))?\]/g)];
    if (matches.length > 0) {
      let text = line.replace(/\[\d{2,}:\d{2}(?:\.\d{2,3})?\]/g, '').trim();

      // 剔除控制字符
      const cleanText = text.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, "");

      if (cleanText) {
        for (const match of matches) {
          const min = parseInt(match[1]);
          const sec = parseInt(match[2]);
          const ms = match[3] ? parseInt(match[3]) : 0;
          const divisor = match[3] && match[3].length === 3 ? 1000 : 100;
          const time = min * 60 + sec + ms / divisor;
          result.push({ time, text: cleanText });
        }
      }
    }
  }
  return result.sort((a, b) => a.time - b.time);
}

// 🌟 1. 扩充 Context 类型，加入 MusicPage 需要的所有属性
type PlayMode = 'loop' | 'single' | 'random';

interface MusicContextType {
  playlist: any[];
  currentIndex: number;
  currentSong: any; // 扩展了 lyrics 属性
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
  setVolume: (value: number) => void;
  toggleMute: () => void;
  togglePlayMode: () => void;
  selectSong: (index: number) => void;
}

const MusicContext = createContext<MusicContextType | null>(null);
const MUSIC_CACHE_KEY = `xh-music-playlist-${(siteConfig.cloudMusicIds || []).join('-')}-${(((siteConfig as any).customMusic || []).length)}`;

function normalizeSong(song: any, fallbackId: string) {
  return {
    id: String(song?.id || fallbackId),
    title: song?.title || song?.name || '未知歌曲',
    artist: song?.artist || song?.author || '未知歌手',
    cover: song?.cover || song?.pic || 'https://bu.dusays.com/2026/03/24/69c24230a5ff8.jpg',
    src: song?.src || song?.url || '',
    lrcUrl: song?.lrcUrl || song?.lrc || '',
    lyrics: Array.isArray(song?.lyrics) ? song.lyrics : []
  };
}

function readCachedPlaylist() {
  try {
    const raw = window.localStorage.getItem(MUSIC_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((song: any) => song?.src) : [];
  } catch {
    return [];
  }
}

function writeCachedPlaylist(list: any[]) {
  try {
    if (list.length > 0) window.localStorage.setItem(MUSIC_CACHE_KEY, JSON.stringify(list));
  } catch {}
}

export function MusicProvider({ children }: { children: ReactNode }) {
  const [playlist, setPlaylist] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lyrics, setLyrics] = useState<{ time: number; text: string }[]>([]);
  const [currentLyric, setCurrentLyric] = useState("正在连接高可用神经云端...");
  const [isLoading, setIsLoading] = useState(true);

  // 🌟 2. 新增音量和播放模式状态
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playMode, setPlayMode] = useState<PlayMode>('loop');

  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchSong = async (id: string) => {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 8000);
      try {
        const localRes = await fetch(`/api/music/resolve?id=${encodeURIComponent(id)}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (localRes.ok) return await localRes.json();

        const res = await fetch(`https://api.injahow.cn/meting/?server=netease&type=song&id=${id}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        return Array.isArray(data) ? normalizeSong(data[0], id) : normalizeSong(data, id);
      } catch {
        return null;
      } finally {
        window.clearTimeout(timer);
      }
    };

    const fetchMusicData = async () => {
      try {
        const cachedPlaylist = readCachedPlaylist();
        if (cachedPlaylist.length > 0 && isMounted) {
          setPlaylist(cachedPlaylist);
          setIsLoading(false);
        }

        const fetchPromises = (siteConfig.cloudMusicIds || []).map(id => fetchSong(String(id)));
        const results = await Promise.all(fetchPromises);

        const neteasePlaylist = results
          .filter(res => res && (res.src || res.url))
          .map((res, index) => normalizeSong(res, String((siteConfig.cloudMusicIds || [])[index] || Math.random())))
          .filter(song => song.src);

        const customPlaylist = ((siteConfig as any).customMusic || [])
          .filter((song: any) => song && song.src)
          .map((song: any, index: number) => ({
            id: song.id || `custom_${index}`,
            title: song.title || '自定义音频',
            artist: song.artist || '自定义音频',
            cover: song.cover || 'https://bu.dusays.com/2026/03/24/69c24230a5ff8.jpg',
            src: song.src,
            lrc: song.lrc || '',
            lyrics: song.lrc ? parseLrc(song.lrc) : []
          }));

        const mergedPlaylist = [...neteasePlaylist, ...customPlaylist];

        if (isMounted) {
          if (mergedPlaylist.length > 0) {
            setPlaylist(mergedPlaylist);
            writeCachedPlaylist(mergedPlaylist);
          } else if (cachedPlaylist.length === 0) {
            setCurrentLyric("云端链路受阻");
          }
          setIsLoading(false);
        }
      } catch (error) {
        if (isMounted) {
          if (playlist.length === 0) setCurrentLyric("网络初始化失败");
          setIsLoading(false);
        }
      }
    };

    if (siteConfig.cloudMusicIds?.length > 0 || ((siteConfig as any).customMusic || []).length > 0) fetchMusicData();
    else setIsLoading(false);

    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (playlist.length === 0) return;
    let isMounted = true;
    const currentSong = playlist[currentIndex];
    setLyrics([]);
    setCurrentLyric("♪ 正在缓冲 ♪");

    if (currentSong.lrc) {
      const parsed = parseLrc(currentSong.lrc);
      setLyrics(parsed);
      setPlaylist(prev => {
        const newPlaylist = [...prev];
        newPlaylist[currentIndex].lyrics = parsed;
        return newPlaylist;
      });
    } else if (currentSong.lrcUrl) {
      fetch(currentSong.lrcUrl)
        .then(res => res.text())
        .then(text => {
          if (isMounted) {
             const parsed = parseLrc(text);
             setLyrics(parsed);
             // 🌟 3. 将解析好的歌词反向写入到 playlist 的 currentSong 中，供 MusicPage 读取！
             setPlaylist(prev => {
                const newPlaylist = [...prev];
                newPlaylist[currentIndex].lyrics = parsed;
                return newPlaylist;
             });
          }
        })
        .catch(() => { if (isMounted) setCurrentLyric("♪ 纯享音乐 ♪"); });
    }

    if (isPlaying && audioRef.current) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => setIsPlaying(false));
      }
    }
    return () => { isMounted = false; };
  }, [currentIndex, playlist.length]); // 移除 playlist 依赖防止无限循环，只依赖长度

  // 🌟 4. 同步音量到 audio 元素
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play().catch(() => setIsPlaying(false));
      setIsPlaying(!isPlaying);
    }
  };

  // 🌟 5. 重写 nextSong，加入对随机模式的处理
  const nextSong = () => {
    if (playMode === 'random') {
      setCurrentIndex(Math.floor(Math.random() * playlist.length));
    } else {
      setCurrentIndex((prev) => (prev + 1) % playlist.length);
    }
  };

  const prevSong = () => {
    if (playMode === 'random') {
      setCurrentIndex(Math.floor(Math.random() * playlist.length));
    } else {
      setCurrentIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
    }
  };

  // 🌟 6. 暴露直接播放指定歌曲的方法
  const playSong = (index: number) => {
    setCurrentIndex(index);
    if (!isPlaying) setIsPlaying(true); // 保证切歌后自动播放
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const { currentTime, duration } = audioRef.current;
      setCurrentTime(currentTime);
      setDuration(duration || 0);
      setProgress((currentTime / (duration || 1)) * 100);

      if (lyrics.length > 0) {
        const activeLyric = lyrics.slice().reverse().find(l => currentTime >= l.time);
        if (activeLyric && activeLyric.text !== currentLyric) {
          setCurrentLyric(activeLyric.text);
        }
      }
    }
  };

  // 🌟 7. 处理歌曲结束
  const handleEnded = () => {
    if (playMode === 'single' && audioRef.current) {
       audioRef.current.currentTime = 0;
       audioRef.current.play();
    } else {
       nextSong();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newProgress = Number(e.target.value);
    setProgress(newProgress);
    if (audioRef.current && audioRef.current.duration) {
      audioRef.current.currentTime = (newProgress / 100) * audioRef.current.duration;
    }
  };

  const setVolume = (val: number) => {
    setVolumeState(val);
    if (isMuted && val > 0) setIsMuted(false);
  };

  const toggleMute = () => setIsMuted(!isMuted);

  const togglePlayMode = () => {
    setPlayMode(prev => {
      if (prev === 'loop') return 'single';
      if (prev === 'single') return 'random';
      return 'loop';
    });
  };

  const currentSong = playlist[currentIndex];

  return (
    <MusicContext.Provider value={{
        playlist, currentIndex, currentSong, isPlaying, progress, currentTime, duration, currentLyric, isLoading,
        volume, isMuted, playMode, // 暴露新状态
        togglePlay, nextSong, prevSong, handleSeek,
        playSong, selectSong: playSong, setVolume, toggleMute, togglePlayMode // 暴露新方法
    }}>
      {children}
      {currentSong && (
        <audio
          ref={audioRef}
          src={currentSong.src}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded} // 使用我们重写的结束处理
          onLoadedMetadata={handleTimeUpdate}
        />
      )}
    </MusicContext.Provider>
  );
}

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) throw new Error("useMusic must be used within MusicProvider");
  return context;
};
