import { NextResponse } from 'next/server';

const PRODUCTION_COMMENT_IMAGE_API = 'https://sh-zmd.vercel.app/api/comment-images';
const MAX_COMMENT_IMAGE_SIZE = 10 * 1024 * 1024;

function canProxyProductionImages(req: Request) {
  try {
    const incomingUrl = new URL(req.url);
    const targetUrl = new URL(PRODUCTION_COMMENT_IMAGE_API);
    const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || incomingUrl.host;
    const sameHost = forwardedHost.toLowerCase() === targetUrl.host.toLowerCase();
    const samePath = incomingUrl.pathname.replace(/\/$/, '') === targetUrl.pathname.replace(/\/$/, '');
    return !(sameHost && samePath);
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  if (!canProxyProductionImages(req)) {
    return NextResponse.json({ error: '留言图片不存在。' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const res = await fetch(`${PRODUCTION_COMMENT_IMAGE_API}?${searchParams.toString()}`, {
    cache: 'no-store',
  });

  return new Response(await res.arrayBuffer(), {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream',
      'Cache-Control': res.headers.get('Cache-Control') || 'no-store',
    },
  });
}

export async function POST(req: Request) {
  if (!canProxyProductionImages(req)) {
    return NextResponse.json(
      { error: '线上图片上传通道未配置，请先使用图片链接，或配置独立图片上传服务。' },
      { status: 503 }
    );
  }

  const formData = await req.formData();
  const file = formData.get('file');
  if (file instanceof File && file.size > MAX_COMMENT_IMAGE_SIZE) {
    return NextResponse.json({ error: '图片不能超过 10MB，请压缩后再上传。' }, { status: 413 });
  }
  const res = await fetch(PRODUCTION_COMMENT_IMAGE_API, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
