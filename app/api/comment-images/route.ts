import { NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getRequestIp, protectPublicMutation } from '../../../lib/abuseProtection';
import { promisify } from 'node:util';

const OWNER = process.env.COMMENT_REPO_OWNER || 'SH-ZMD';
const REPO = process.env.COMMENT_REPO || 'SH_ZMD';
const TOKEN = process.env.COMMENT_GITHUB_TOKEN || process.env.GITHUB_COMMENT_TOKEN || '';
const PRODUCTION_COMMENT_IMAGE_API = process.env.PRODUCTION_COMMENT_IMAGE_API || 'https://sh-zmd.vercel.app/api/comment-images';
const RELEASE_TAG = process.env.COMMENT_IMAGE_RELEASE_TAG || 'comment-images';
const MAX_COMMENT_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const execFileAsync = promisify(execFile);

export const runtime = 'nodejs';

type SharpFactory = (input: Buffer) => any;

let sharpLoader: Promise<SharpFactory | null> | null = null;

async function loadOptionalSharp() {
  if (!sharpLoader) {
    sharpLoader = (async () => {
      try {
        const dynamicImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>;
        const mod = await dynamicImport('sharp');
        return (mod.default || mod) as SharpFactory;
      } catch {
        return null;
      }
    })();
  }
  return sharpLoader;
}

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

async function getWriteToken() {
  if (TOKEN) return TOKEN;

  try {
    const envText = await readFile(path.join(process.cwd(), '.env.local'), 'utf-8');
    const tokenLine = envText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.startsWith('COMMENT_GITHUB_TOKEN=') || line.startsWith('GITHUB_COMMENT_TOKEN='));
    const localToken = tokenLine?.replace(/^[^=]+=/, '').trim().replace(/^["']|["']$/g, '');
    if (localToken) return localToken;
  } catch {
    // Local env file is optional.
  }

  try {
    const { stdout } = await execFileAsync('gh', ['auth', 'token'], { windowsHide: true, timeout: 5000 });
    const ghToken = stdout.trim();
    if (ghToken) return ghToken;
  } catch {
    // GitHub CLI is optional.
  }

  return '';
}

function githubHeaders(token: string) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function extensionForType(type: string) {
  if (type === 'image/jpeg') return 'jpg';
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  if (type === 'image/gif') return 'gif';
  return 'bin';
}

async function ensureImageRelease(token: string) {
  const getRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${RELEASE_TAG}`, {
    headers: githubHeaders(token),
    cache: 'no-store',
  });
  if (getRes.ok) return getRes.json();

  const createRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases`, {
    method: 'POST',
    headers: {
      ...githubHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tag_name: RELEASE_TAG,
      name: 'Comment Images',
      body: 'Images uploaded from the public comment system. These assets do not require a Vercel redeploy.',
      draft: false,
      prerelease: false,
    }),
  });
  const data = await createRes.json().catch(() => ({}));
  if (!createRes.ok) throw new Error(data.message || '创建评论图片存储区失败。');
  return data;
}

async function uploadReleaseAsset(token: string, release: any, name: string, contentType: string, buffer: Buffer) {
  const uploadUrl = String(release.upload_url || '').replace(/\{\?name,label\}$/, '');
  if (!uploadUrl) throw new Error('评论图片存储区缺少上传地址。');
  const body = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

  const res = await fetch(`${uploadUrl}?name=${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: {
      ...githubHeaders(token),
      'Content-Type': contentType,
      'Content-Length': String(buffer.byteLength),
    },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || '上传评论图片失败。');
  return String(data.browser_download_url || '');
}

async function prepareImage(file: File) {
  const original = Buffer.from(await file.arrayBuffer());
  const sourceType = file.type || 'application/octet-stream';
  const sourceExt = extensionForType(sourceType);

  const sharp = await loadOptionalSharp();
  if (!sharp) throw new Error('图片验证服务暂时不可用。');

  const metadata = await sharp(original).metadata();
  const pixels = Number(metadata.width || 0) * Number(metadata.height || 0);
  if (!metadata.format || pixels <= 0 || pixels > 40_000_000) {
    throw new Error('图片内容无效或像素总量过大。');
  }

  if (sourceType === 'image/gif' && metadata.format === 'gif') {
    return {
      imageBuffer: original,
      imageType: sourceType,
      imageExt: sourceExt,
      thumbnailBuffer: original,
      thumbnailType: sourceType,
      thumbnailExt: sourceExt,
    };
  }

  try {
    const imageBuffer = await sharp(original)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    const thumbnailBuffer = await sharp(original)
      .rotate()
      .resize({ width: 520, height: 520, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();

    return {
      imageBuffer,
      imageType: 'image/webp',
      imageExt: 'webp',
      thumbnailBuffer,
      thumbnailType: 'image/webp',
      thumbnailExt: 'webp',
    };
  } catch {
    return {
      imageBuffer: original,
      imageType: sourceType,
      imageExt: sourceExt,
      thumbnailBuffer: original,
      thumbnailType: sourceType,
      thumbnailExt: sourceExt,
    };
  }
}

export async function GET(req: Request) {
  if (!canProxyProductionImages(req)) {
    return NextResponse.json({ error: '评论图片不存在。' }, { status: 404 });
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
  const token = await getWriteToken();
  if (!token) {
    if (canProxyProductionImages(req)) {
      const formData = await req.formData();
      const res = await fetch(PRODUCTION_COMMENT_IMAGE_API, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json(
      { error: '评论图片上传需要 COMMENT_GITHUB_TOKEN。图片不会写入仓库，也不会触发 Vercel 部署。' },
      { status: 503 }
    );
  }

  const formData = await req.formData();
  const protection = await protectPublicMutation(req, {
    turnstileToken: String(formData.get('turnstileToken') || ''),
    rules: [
      { name: 'comment-image-hour', identity: getRequestIp(req), limit: 8, windowSeconds: 3600 },
      { name: 'comment-image-day', identity: getRequestIp(req), limit: 20, windowSeconds: 86400 },
      { name: 'comment-image-global', identity: 'all', limit: 200, windowSeconds: 86400 },
    ],
  });
  if (!protection.ok) {
    return NextResponse.json({ error: protection.error }, { status: protection.status });
  }
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '没有收到图片文件。' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: '只支持 jpg、png、webp、gif 图片。' }, { status: 415 });
  }
  if (file.size > MAX_COMMENT_IMAGE_SIZE) {
    return NextResponse.json({ error: '单张图片不能超过 5MB，请压缩后再上传。' }, { status: 413 });
  }

  const release = await ensureImageRelease(token);
  const prepared = await prepareImage(file);
  const id = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const imageName = `${id}.${prepared.imageExt}`;
  const thumbName = `${id}-thumb.${prepared.thumbnailExt}`;
  const url = await uploadReleaseAsset(token, release, imageName, prepared.imageType, prepared.imageBuffer);
  const thumbnailUrl = prepared.thumbnailBuffer === prepared.imageBuffer
    ? url
    : await uploadReleaseAsset(token, release, thumbName, prepared.thumbnailType, prepared.thumbnailBuffer);

  return NextResponse.json({
    success: true,
    url,
    thumbnailUrl,
  });
}
