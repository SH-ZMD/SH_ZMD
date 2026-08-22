import { NextResponse } from 'next/server';
import { checkLocalRateLimit, getRequestIp } from '../../../../lib/abuseProtection';

const METING_APIS = [
  'https://meting-api.saop.cc/api',
  'https://api.i-meto.com/meting/api',
  'https://meting-api.9887665.xyz/api',
  'https://api.injahow.cn/meting/',
];
const PRODUCTION_MUSIC_API = 'https://5487210.xyz/api/music/resolve';

function normalizeSong(song: any, id: string) {
  return {
    id: String(song.id || id),
    title: song.name || song.title || '未知歌曲',
    artist: song.author || song.artist || '未知歌手',
    cover: song.pic || song.cover || '/bg/music-default.webp',
    src: song.url || song.src || '',
    lrcUrl: song.lrc || song.lrcUrl || '',
  };
}

async function fetchFromProvider(api: string, id: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${api}?server=netease&type=song&id=${id}`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json,text/plain,*/*',
        'User-Agent': 'Mozilla/5.0',
      },
      next: { revalidate: 1800 },
    });

    const text = await res.text();
    if (!res.ok || text.trim().startsWith('<')) return null;

    const data = JSON.parse(text);
    const song = Array.isArray(data) ? data[0] : data;
    const normalized = normalizeSong(song || {}, id);
    return normalized.src ? normalized : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFromProduction(id: string) {
  try {
    const res = await fetch(`${PRODUCTION_MUSIC_API}?id=${encodeURIComponent(id)}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;

    const song = normalizeSong(await res.json(), id);
    return song.src ? song : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = String(searchParams.get('id') || '').trim();

  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: '歌曲 ID 不正确' }, { status: 400 });
  }

  // 轻量防刷：同 IP 每分钟最多 40 次解析，避免第三方音源 API 配额被滥用
  const waitSeconds = checkLocalRateLimit('music-resolve', getRequestIp(req), 40, 60);
  if (waitSeconds > 0) {
    return NextResponse.json(
      { error: '解析请求过于频繁，请稍后再试。' },
      { status: 429, headers: { 'Retry-After': String(waitSeconds) } }
    );
  }

  for (const api of METING_APIS) {
    const song = await fetchFromProvider(api, id);
    if (song) {
      return NextResponse.json(song);
    }
  }

  const productionSong = await fetchFromProduction(id);
  if (productionSong) {
    return NextResponse.json(productionSong);
  }

  return NextResponse.json({ error: '所有音乐解析源都暂时不可用' }, { status: 502 });
}
