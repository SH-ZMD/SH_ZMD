import { NextRequest, NextResponse } from 'next/server';
import { checkLocalRateLimit, getRequestIp } from '../../../lib/abuseProtection';

// 移植自模板 XinghuisamaBlogs 0.3.2：一次请求批量解析网易云歌单，
// 直连网易云官方接口，替代浏览器逐首请求不稳定的第三方 meting 源。
const NET_EASE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Referer: 'https://music.163.com/',
};

type SongResult = {
  id: string;
  name?: string;
  artist?: string;
  author?: string;
  cover?: string;
  pic?: string;
  url?: string;
  lrc?: string;
  error?: string;
};

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams.get('ids');
  if (!ids) {
    return NextResponse.json({ error: 'Missing ids parameter' }, { status: 400 });
  }

  const songIds = ids
    .split(',')
    .map((id) => id.trim())
    .filter((id) => /^\d{1,12}$/.test(id))
    .slice(0, 50);

  if (songIds.length === 0) {
    return NextResponse.json({ error: 'No valid song ids' }, { status: 400 });
  }

  const waitSeconds = checkLocalRateLimit('music-batch', getRequestIp(request), 30, 60);
  if (waitSeconds > 0) {
    return NextResponse.json(
      { error: '解析请求过于频繁，请稍后再试。' },
      { status: 429, headers: { 'Retry-After': String(waitSeconds) } }
    );
  }

  const results: SongResult[] = await Promise.all(
    songIds.map(async (songId): Promise<SongResult> => {
      try {
        const [detailRes, lrcRes] = await Promise.all([
          fetch(`https://music.163.com/api/song/detail/?id=${songId}&ids=[${songId}]`, {
            headers: NET_EASE_HEADERS,
            signal: AbortSignal.timeout(6000),
            next: { revalidate: 1800 },
          }),
          fetch(`https://music.163.com/api/song/lyric?id=${songId}&lv=-1&kv=-1&tv=-1`, {
            headers: NET_EASE_HEADERS,
            signal: AbortSignal.timeout(6000),
            next: { revalidate: 1800 },
          }).catch(() => null),
        ]);

        const detail = await detailRes.json();
        const song = detail.songs?.[0];

        if (!song) {
          return { id: songId, error: 'not_found' };
        }

        let lrcText = '';
        if (lrcRes && lrcRes.ok) {
          try {
            const lrcData = await lrcRes.json();
            lrcText = lrcData.lrc?.lyric || '';
          } catch {
            // 歌词可选，失败不影响主流程
          }
        }

        const artistName = song.artists?.[0]?.name || '未知歌手';

        return {
          id: songId,
          name: song.name,
          artist: artistName,
          author: artistName,
          cover: song.album?.picUrl || '',
          pic: song.album?.picUrl || '',
          url: `https://music.163.com/song/media/outer/url?id=${songId}.mp3`,
          lrc: lrcText,
        };
      } catch {
        return { id: songId, error: 'fetch_failed' };
      }
    })
  );

  return NextResponse.json(results, {
    headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800' },
  });
}
