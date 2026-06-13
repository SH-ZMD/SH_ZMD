import { NextResponse } from 'next/server';

const PRODUCTION_COMMENT_IMAGE_API = 'https://sh-zmd.vercel.app/api/comment-images';

export async function GET(req: Request) {
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
  const formData = await req.formData();
  const res = await fetch(PRODUCTION_COMMENT_IMAGE_API, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
