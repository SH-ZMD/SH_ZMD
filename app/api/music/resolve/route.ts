import { NextResponse } from 'next/server';

const METING_API = 'https://api.injahow.cn/meting/';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = String(searchParams.get('id') || '').trim();

  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: '歌曲 ID 不正确' }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${METING_API}?server=netease&type=song&id=${id}`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json,text/plain,*/*',
        'User-Agent': 'Mozilla/5.0',
      },
      next: { revalidate: 3600 },
    });
    clearTimeout(timer);

    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json({ error: `音乐解析失败：${res.status}` }, { status: 502 });
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: '音乐解析返回了无效数据' }, { status: 502 });
    }

    const song = Array.isArray(data) ? data[0] : data;
    if (!song || !song.url) {
      return NextResponse.json({ error: '没有拿到可播放音频地址' }, { status: 404 });
    }

    return NextResponse.json({
      id: String(song.id || id),
      title: song.name || song.title || '未知歌曲',
      artist: song.author || song.artist || '未知歌手',
      cover: song.pic || song.cover || 'https://bu.dusays.com/2026/03/24/69c24230a5ff8.jpg',
      src: song.url,
      lrcUrl: song.lrc || '',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.name === 'AbortError' ? '音乐解析超时' : '音乐解析接口暂时不可用' }, { status: 504 });
  }
}
