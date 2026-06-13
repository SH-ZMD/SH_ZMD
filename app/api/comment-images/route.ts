import { NextResponse } from 'next/server';
import sharp from 'sharp';

const OWNER = process.env.COMMENT_REPO_OWNER || 'SH-ZMD';
const REPO = process.env.COMMENT_REPO || 'SH_ZMD';
const TOKEN = process.env.COMMENT_GITHUB_TOKEN || process.env.GITHUB_COMMENT_TOKEN || '';
const BRANCH = process.env.COMMENT_IMAGE_BRANCH || 'main';
const MAX_IMAGE_EDGE = 1600;
const WEBP_QUALITY = 82;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data: any, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...CORS_HEADERS,
      ...(init?.headers || {}),
    },
  });
}

function extensionFromType(type: string) {
  return ({
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/avif': '.avif',
  } as Record<string, string>)[type] || '.png';
}

async function compressImage(file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  if (file.type === 'image/gif') {
    return { bytes, ext: extensionFromType(file.type), compressed: false };
  }

  try {
    const output = await sharp(bytes, { animated: false })
      .rotate()
      .resize({
        width: MAX_IMAGE_EDGE,
        height: MAX_IMAGE_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    if (output.length < bytes.length) {
      return { bytes: output, ext: '.webp', compressed: true };
    }
  } catch {}

  return { bytes, ext: extensionFromType(file.type), compressed: false };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: Request) {
  try {
    if (!TOKEN) {
      return json({ error: '图片读取还缺 COMMENT_GITHUB_TOKEN。' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const repoPath = searchParams.get('path') || '';

    if (!repoPath.startsWith('public/comment-images/')) {
      return json({ error: '图片路径无效。' }, { status: 400 });
    }

    const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${repoPath}?ref=${BRANCH}`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/vnd.github.raw',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return json({ error: data.message || '图片读取失败。' }, { status: res.status });
    }

    const ext = repoPath.split('.').pop()?.toLowerCase();
    const contentType = ({
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      avif: 'image/avif',
    } as Record<string, string>)[ext || ''] || 'application/octet-stream';

    return new Response(await res.arrayBuffer(), {
      headers: {
        ...CORS_HEADERS,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: any) {
    return json({ error: error.message || '图片读取失败。' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!TOKEN) {
      return json({ error: '图片上传还缺 COMMENT_GITHUB_TOKEN。' }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return json({ error: '请选择图片文件。' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return json({ error: '只能上传图片。' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return json({ error: '图片不能超过 5MB。' }, { status: 400 });
    }

    const image = await compressImage(file);
    const ext = image.ext;
    const filename = `comment-${Date.now()}-${Math.random().toString(16).slice(2, 8)}${ext}`;
    const repoPath = `public/comment-images/${filename}`;
    const content = image.bytes.toString('base64');

    const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${repoPath}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Upload comment image ${filename}`,
        content,
        branch: BRANCH,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return json({ error: data.message || '图片上传失败。' }, { status: res.status });
    }

    return json({
      success: true,
      url: `/api/comment-images?path=${encodeURIComponent(repoPath)}`,
      path: repoPath,
      compressed: image.compressed,
    });
  } catch (error: any) {
    return json({ error: error.message || '图片上传失败。' }, { status: 500 });
  }
}
