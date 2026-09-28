import { NextResponse } from 'next/server';
import { execFile, spawn } from 'node:child_process';
import { createHash, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { getRequestIp, protectPublicMutation } from '../../../lib/abuseProtection';

type CommentStatus = 'published' | 'deleted';

type CommentImage = {
  url: string;
  thumbnailUrl?: string;
  alt?: string;
};

type StoredComment = {
  schema: 'sh-comment-v2';
  id: string;
  pageId: string;
  parentId: string | null;
  nickname: string;
  emailHash: string | null;
  websiteHash: string | null;
  content: string;
  images: CommentImage[];
  status: CommentStatus;
  ipHash: string;
  userAgentHash: string;
  createdAt: string;
  updatedAt: string;
};

const OWNER = process.env.COMMENT_REPO_OWNER || 'SH-ZMD';
const REPO = process.env.COMMENT_REPO || 'SH_ZMD';
const TOKEN = process.env.COMMENT_GITHUB_TOKEN || process.env.GITHUB_COMMENT_TOKEN || '';
const COMMENT_ADMIN_TOKEN = process.env.COMMENT_ADMIN_TOKEN || '';
const HASH_SALT = process.env.COMMENT_HASH_SALT || `${OWNER}/${REPO}/site-comment`;
const PRODUCTION_COMMENT_API = process.env.PRODUCTION_COMMENT_API || 'https://5487210.xyz/api/comments';
const COMMENT_WINDOW_MS = 60 * 1000;
const COMMENT_LIMIT_PER_WINDOW = 3;
const MAX_CONTENT_LENGTH = 2000;
const MAX_NICKNAME_LENGTH = 32;
const COMMENT_MARKER = 'sh-comment:v2';
const requestWindows = new Map<string, number[]>();
const execFileAsync = promisify(execFile);

export const runtime = 'nodejs';

function normalizePageId(pageId: string) {
  // 引号会破坏 GitHub 搜索语句里的标题匹配边界，直接剔除
  const clean = String(pageId || '/').trim().replace(/\s+/g, '-').replace(/"/g, '').slice(0, 140);
  return clean || '/';
}

function normalizeNickname(value: unknown) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, MAX_NICKNAME_LENGTH);
}

function normalizeContent(value: unknown) {
  return String(value || '').replace(/\r\n/g, '\n').trim().slice(0, MAX_CONTENT_LENGTH);
}

function hashPrivate(value: string) {
  const clean = value.trim();
  if (!clean) return '';
  return createHash('sha256').update(`${HASH_SALT}:${clean}`).digest('hex');
}

function getClientIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = req.headers.get('x-real-ip')?.trim();
  return forwarded || realIp || 'local-client';
}

function getClientHashes(req: Request) {
  return {
    ipHash: hashPrivate(getClientIp(req)),
    userAgentHash: hashPrivate(req.headers.get('user-agent') || 'unknown-agent'),
  };
}

function isLocalRequest(req: Request) {
  const url = new URL(req.url);
  const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || url.host).toLowerCase();
  return host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]');
}

function secureTokenMatch(provided: string, expected: string) {
  if (!expected || !provided) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

function hasCommentAdminAccess(req: Request) {
  // 部署在 Vercel 上时不信任转发 Host 头（可被伪造），只认管理 Token
  if (!process.env.VERCEL_ENV && isLocalRequest(req)) return true;
  return secureTokenMatch(req.headers.get('x-comment-admin-token') || '', COMMENT_ADMIN_TOKEN);
}

function canProxyProductionComments(req: Request) {
  try {
    const incomingUrl = new URL(req.url);
    const targetUrl = new URL(PRODUCTION_COMMENT_API);
    const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || incomingUrl.host;
    const sameHost = forwardedHost.toLowerCase() === targetUrl.host.toLowerCase();
    const samePath = incomingUrl.pathname.replace(/\/$/, '') === targetUrl.pathname.replace(/\/$/, '');
    return !(sameHost && samePath);
  } catch {
    return false;
  }
}

function emptyCommentsResponse() {
  return NextResponse.json({ comments: [] });
}

function checkRateLimit(req: Request) {
  const key = hashPrivate(getClientIp(req));
  const now = Date.now();
  const previous = (requestWindows.get(key) || []).filter((time) => now - time < COMMENT_WINDOW_MS);
  if (previous.length >= COMMENT_LIMIT_PER_WINDOW) {
    requestWindows.set(key, previous);
    const first = previous[0] || now;
    return Math.max(1, Math.ceil((COMMENT_WINDOW_MS - (now - first)) / 1000));
  }
  previous.push(now);
  requestWindows.set(key, previous);
  if (requestWindows.size > 5000) {
    for (const [mapKey, timestamps] of requestWindows) {
      if (timestamps.every((time) => now - time >= COMMENT_WINDOW_MS)) requestWindows.delete(mapKey);
    }
  }
  return 0;
}

function repairMojibakeText(value: string) {
  if (!/[\u00c0-\u00ff]/.test(value)) return value;

  try {
    const bytes = Uint8Array.from(Array.from(value), (char) => char.charCodeAt(0) & 0xff);
    const fixed = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return fixed.includes('\uFFFD') ? value : fixed;
  } catch {
    return value;
  }
}

function repairCommentText<T>(value: T): T {
  if (typeof value === 'string') return repairMojibakeText(value) as T;
  if (Array.isArray(value)) return value.map((item) => repairCommentText(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, repairCommentText(item)])
    ) as T;
  }
  return value;
}

function issueTitle(pageId: string) {
  return `[site-comment] ${normalizePageId(pageId)}`;
}

function pageIdFromIssueTitle(title: string) {
  return title.replace(/^\[site-comment\]\s*/, '').trim() || '/';
}

function readGitCredential(input: string) {
  return new Promise<string>((resolve) => {
    const child = spawn('git', ['credential', 'fill'], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    let stdout = '';
    const timer = setTimeout(() => {
      child.kill();
      resolve('');
    }, 5000);

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.on('error', () => {
      clearTimeout(timer);
      resolve('');
    });
    child.on('close', () => {
      clearTimeout(timer);
      resolve(stdout);
    });
    child.stdin.end(input);
  });
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
    const { stdout } = await execFileAsync('gh', ['auth', 'token'], {
      windowsHide: true,
      timeout: 5000,
    });
    const ghToken = stdout.trim();
    if (ghToken) return ghToken;
  } catch {
    // GitHub CLI is optional.
  }

  try {
    const stdout = await readGitCredential('protocol=https\nhost=github.com\n\n');
    const credentialToken = stdout
      .split(/\r?\n/)
      .find((line) => line.startsWith('password='))
      ?.replace(/^password=/, '')
      .trim();
    if (credentialToken) return credentialToken;
  } catch {
    // No saved GitHub credential available.
  }

  return '';
}

function githubHeaders(write = false, token = TOKEN) {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  if (write || token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function githubApiError(data: any, status: number, fallback: string) {
  if (status === 401) return '评论服务的 GitHub 写入凭据已失效，请在 Vercel 更新 COMMENT_GITHUB_TOKEN。';
  if (status === 403) return '评论服务没有 GitHub 仓库写入权限，请检查 COMMENT_GITHUB_TOKEN 的 repo 权限。';
  return data?.message || fallback;
}

async function findIssue(pageId: string) {
  const title = issueTitle(pageId);
  const query = encodeURIComponent(`repo:${OWNER}/${REPO} in:title "${title}" type:issue`);
  const res = await fetch(`https://api.github.com/search/issues?q=${query}`, {
    headers: githubHeaders(),
    cache: 'no-store',
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.items?.find((item: any) => item.title === title) || null;
}

async function createIssue(pageId: string, token = TOKEN) {
  if (!token) throw new Error('评论功能缺少 COMMENT_GITHUB_TOKEN，暂时不能写入线上留言箱。');

  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/issues`, {
    method: 'POST',
    headers: {
      ...githubHeaders(true, token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: issueTitle(pageId),
      body: `Public comment box for ${pageId}`,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(githubApiError(data, res.status, '创建评论箱失败。'));
  return data;
}

function serializeMarker(value: unknown) {
  return `<!-- ${COMMENT_MARKER}\n${JSON.stringify(value, null, 2)}\n-->`;
}

function parseMarker<T>(body: string): T | null {
  const match = body.match(/<!--\s*sh-comment:v2\s*([\s\S]*?)\s*-->/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as T;
  } catch {
    return null;
  }
}

function imageMarkdown(images: CommentImage[]) {
  return images
    .map((image) => image.url)
    .filter(Boolean)
    .map((url) => `![评论图片](${url})`)
    .join('\n\n');
}

function serializeComment(comment: StoredComment) {
  const images = imageMarkdown(comment.images);
  const visible = [
    `访客：${comment.nickname}${comment.parentId ? ` | parent:${comment.parentId}` : ''}`,
    '',
    comment.status === 'deleted' ? '这条评论已被站长删除。' : comment.content,
    comment.status === 'published' && images ? `\n${images}` : '',
  ].join('\n').trim();

  return `${serializeMarker(comment)}\n\n${visible}`;
}

function extractLegacyImages(content: string) {
  const images: CommentImage[] = [];
  const text = content.replace(/!\[[^\]]*]\(([^)]+)\)/g, (_, url: string) => {
    images.push({ url: url.trim() });
    return '';
  }).trim();
  return { text, images };
}

function parseLegacyComment(body: string, pageId: string, fallbackId: string, createdAt: string): StoredComment {
  const repairedBody = repairMojibakeText(body || '');
  const match = repairedBody.match(/^访客[:：]\s*(.+?)\n\n([\s\S]*)$/) || repairedBody.match(/^Visitor:\s*(.+?)\n\n([\s\S]*)$/);
  const meta = (match?.[1] || '路过的朋友').trim();
  const parentMatch = meta.match(/\s\|\s*parent:(.+)$/);
  const nickname = parentMatch ? meta.replace(/\s\|\s*parent:.+$/, '').trim() : meta;
  const rawContent = match?.[2]?.trim() || repairedBody.trim();
  const { text, images } = extractLegacyImages(rawContent);

  return {
    schema: 'sh-comment-v2',
    id: fallbackId,
    pageId,
    parentId: parentMatch?.[1]?.trim() || null,
    nickname: nickname || '路过的朋友',
    emailHash: null,
    websiteHash: null,
    content: text || rawContent,
    images,
    status: 'published',
    ipHash: '',
    userAgentHash: '',
    createdAt,
    updatedAt: createdAt,
  };
}

function normalizeStoredComment(value: Partial<StoredComment>, pageId: string, fallbackId: string, createdAt: string): StoredComment {
  const rawStatus = String(value.status || 'published');
  const status: CommentStatus = rawStatus === 'deleted' ? 'deleted' : 'published';
  const images = Array.isArray(value.images)
    ? value.images
        .map((image: any) => typeof image === 'string' ? { url: image } : image)
        .filter((image: any) => image?.url)
        .map((image: any) => ({
          url: String(image.url).trim(),
          thumbnailUrl: image.thumbnailUrl ? String(image.thumbnailUrl).trim() : undefined,
          alt: image.alt ? String(image.alt).slice(0, 80) : undefined,
        }))
        .filter((image) => /^https?:\/\//i.test(image.url) || image.url.startsWith('/comment-images/'))
        .slice(0, 3)
    : [];

  return {
    schema: 'sh-comment-v2',
    id: fallbackId,
    pageId: normalizePageId(value.pageId || pageId),
    parentId: value.parentId ? String(value.parentId).trim().slice(0, 80) : null,
    nickname: normalizeNickname(value.nickname) || '路过的朋友',
    emailHash: value.emailHash ? String(value.emailHash) : null,
    websiteHash: value.websiteHash ? String(value.websiteHash) : null,
    content: normalizeContent(value.content),
    images,
    status,
    ipHash: value.ipHash ? String(value.ipHash) : '',
    userAgentHash: value.userAgentHash ? String(value.userAgentHash) : '',
    createdAt: value.createdAt || createdAt,
    updatedAt: value.updatedAt || createdAt,
  };
}

function parseCommentFromGithub(item: any, pageId: string): StoredComment {
  const id = String(item.id || '');
  const createdAt = item.created_at || new Date().toISOString();
  const structured = parseMarker<StoredComment>(item.body || '');
  if (structured) return repairCommentText(normalizeStoredComment(structured, pageId, id, createdAt));
  return repairCommentText(parseLegacyComment(item.body || '', pageId, id, createdAt));
}

function publicComment(comment: StoredComment) {
  return {
    id: comment.id,
    pageId: comment.pageId,
    parentId: comment.parentId,
    nickname: comment.nickname,
    author: comment.nickname,
    content: comment.content,
    images: comment.images,
    status: comment.status,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}

function adminComment(comment: StoredComment) {
  return {
    ...publicComment(comment),
    emailHash: comment.emailHash,
    websiteHash: comment.websiteHash,
    ipHash: comment.ipHash,
    userAgentHash: comment.userAgentHash,
    pageUrl: comment.pageId.startsWith('/') ? comment.pageId : `/${comment.pageId}`,
  };
}

async function fetchCommentsForIssue(issue: any, pageId: string) {
  const res = await fetch(`${issue.comments_url}?per_page=100`, {
    headers: githubHeaders(),
    cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || '读取评论失败。');
  return (Array.isArray(data) ? data : []).map((item) => parseCommentFromGithub(item, pageId));
}

async function findCommentIssues() {
  const query = encodeURIComponent(`repo:${OWNER}/${REPO} in:title "[site-comment]" type:issue`);
  const res = await fetch(`https://api.github.com/search/issues?q=${query}&sort=updated&order=desc&per_page=50`, {
    headers: githubHeaders(),
    cache: 'no-store',
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || '读取评论列表失败。');
  return Array.isArray(data.items)
    ? data.items.filter((item: any) => typeof item.title === 'string' && item.title.startsWith('[site-comment] '))
    : [];
}

async function listRecentComments(admin = false) {
  const issues = await findCommentIssues();
  const groups = await Promise.all(
    issues.map(async (issue: any) => {
      if (!issue.comments_url || !issue.comments) return [];
      const pageId = pageIdFromIssueTitle(issue.title || '');
      try {
        return await fetchCommentsForIssue(issue, pageId);
      } catch {
        return [];
      }
    })
  );

  const all = groups
    .flat()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const visible = admin ? all : all.filter((comment) => comment.status === 'published');

  return {
    total: visible.length,
    counts: {
      published: all.filter((comment) => comment.status === 'published').length,
      deleted: all.filter((comment) => comment.status === 'deleted').length,
    },
    latestAt: visible[0]?.createdAt || null,
    comments: visible.slice(0, admin ? 120 : 30).map(admin ? adminComment : publicComment),
  };
}

async function proxyProductionComments(req: Request, init?: RequestInit) {
  if (!canProxyProductionComments(req)) {
    if (!init?.method || init.method === 'GET') return emptyCommentsResponse();
    return NextResponse.json(
      { error: '线上评论接口不能代理到自身。请在 Vercel 配置 COMMENT_GITHUB_TOKEN 后再提交评论。' },
      { status: 503 }
    );
  }

  const incomingUrl = new URL(req.url);
  const targetUrl = `${PRODUCTION_COMMENT_API}${incomingUrl.search || ''}`;

  try {
    const res = await fetch(targetUrl, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(repairCommentText(data), { status: res.status });
  } catch (error) {
    if (init?.method && init.method !== 'GET') throw error;

    // PowerShell 单引号字符串不做子表达式插值，只把 ' 转义为 ''，防止查询串里的 $(...) 注入
    const psSafeUrl = targetUrl.replace(/'/g, "''");
    const script = [
      "$ProgressPreference = 'SilentlyContinue'",
      '$wc = New-Object System.Net.WebClient',
      "$wc.Headers.Add('User-Agent', 'my-blog-manager')",
      `$bytes = $wc.DownloadData('${psSafeUrl}')`,
      '[Convert]::ToBase64String($bytes)',
    ].join('; ');
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], {
      windowsHide: true,
      timeout: 60000,
      maxBuffer: 1024 * 1024 * 4,
    });
    const data = JSON.parse(Buffer.from(stdout.trim(), 'base64').toString('utf-8') || '{}');
    return NextResponse.json(repairCommentText(data));
  }
}

async function getGithubComment(commentId: string) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/issues/comments/${commentId}`, {
    headers: githubHeaders(),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || '读取评论失败。');
  return data;
}

async function patchGithubComment(commentId: string, comment: StoredComment, token: string) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/issues/comments/${commentId}`, {
    method: 'PATCH',
    headers: {
      ...githubHeaders(true, token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body: serializeComment(comment) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(githubApiError(data, res.status, '更新评论失败。'));
  return data;
}

async function deleteGithubComment(commentId: string, token: string) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/issues/comments/${commentId}`, {
    method: 'DELETE',
    headers: githubHeaders(true, token),
  });
  if (res.status === 204) return;
  const data = await res.json().catch(() => ({}));
  throw new Error(githubApiError(data, res.status, '删除评论失败。'));
}

function parseImages(value: unknown): CommentImage[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 3)
    .map((item) => typeof item === 'string' ? { url: item } : item)
    .filter((item: any) => item?.url)
    .map((item: any) => ({
      url: String(item.url).trim().slice(0, 1000),
      thumbnailUrl: item.thumbnailUrl ? String(item.thumbnailUrl).trim().slice(0, 1000) : undefined,
      alt: item.alt ? String(item.alt).trim().slice(0, 80) : undefined,
    }))
    .filter((item) => /^https?:\/\//i.test(item.url) || item.url.startsWith('/comment-images/'));
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const admin = searchParams.get('admin') === '1' && hasCommentAdminAccess(req);

    if (searchParams.get('summary') === '1') {
      try {
        const localSummary = await listRecentComments(admin);
        if (localSummary.total > 0 || admin) return NextResponse.json(localSummary);
        if (canProxyProductionComments(req)) return proxyProductionComments(req);
        return NextResponse.json(localSummary);
      } catch {
        if (canProxyProductionComments(req)) return proxyProductionComments(req);
        return NextResponse.json({ total: 0, latestAt: null, comments: [], counts: { published: 0, deleted: 0 } });
      }
    }

    const pageId = normalizePageId(searchParams.get('pageId') || '/');
    const issue = await findIssue(pageId);
    if (!issue) {
      if (canProxyProductionComments(req)) return proxyProductionComments(req);
      return emptyCommentsResponse();
    }

    const comments = await fetchCommentsForIssue(issue, pageId);
    const visible = admin ? comments : comments.filter((comment) => comment.status === 'published');
    const mapped = visible
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(admin ? adminComment : publicComment);

    if (mapped.length === 0 && !admin && canProxyProductionComments(req)) return proxyProductionComments(req);
    return NextResponse.json({ comments: mapped });
  } catch (error: any) {
    if (canProxyProductionComments(req)) return proxyProductionComments(req);
    return NextResponse.json({ error: error.message || '读取评论失败。' }, { status: 502 });
  }
}

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const body = JSON.parse(bodyText || '{}');
    const honeypot = String(body.company || body.websiteConfirm || body.trap || '').trim();
    if (honeypot) {
      return NextResponse.json({ error: '评论提交失败，请刷新后再试。' }, { status: 400 });
    }

    const pageId = normalizePageId(body.pageId || body.postId || body.categoryId || '/');
    const nickname = normalizeNickname(body.nickname ?? body.author);
    const content = normalizeContent(body.content);
    const parentId = body.parentId ? String(body.parentId).trim().slice(0, 80) : null;
    const images = parseImages(body.images);

    if (!nickname) return NextResponse.json({ error: '请先填写昵称。' }, { status: 400 });
    if (!content) return NextResponse.json({ error: '评论内容不能为空。' }, { status: 400 });

    const protection = await protectPublicMutation(req, {
      turnstileToken: String(body.turnstileToken || ''),
      rules: [
        { name: 'comment-ip-minute', identity: getRequestIp(req), limit: 3, windowSeconds: 60 },
        { name: 'comment-nickname', identity: nickname.toLowerCase(), limit: 5, windowSeconds: 600 },
        { name: 'comment-page', identity: pageId, limit: 30, windowSeconds: 60 },
        { name: 'comment-global', identity: 'all', limit: 120, windowSeconds: 60 },
      ],
    });
    if (!protection.ok) {
      return NextResponse.json(
        { error: protection.error },
        { status: protection.status, headers: protection.retryAfter ? { 'Retry-After': String(protection.retryAfter) } : undefined },
      );
    }

    const remaining = checkRateLimit(req);
    if (remaining > 0) {
      return NextResponse.json({ error: `发送太快了，请 ${remaining}s 后再试。同一访客 1 分钟最多 3 条。` }, { status: 429 });
    }

    const writeToken = await getWriteToken();
    if (!writeToken) return proxyProductionComments(req, { method: 'POST', body: bodyText });

    const hashes = getClientHashes(req);
    const now = new Date().toISOString();
    const draft: StoredComment = {
      schema: 'sh-comment-v2',
      id: `draft_${Date.now()}`,
      pageId,
      parentId,
      nickname,
      emailHash: body.email ? hashPrivate(String(body.email).toLowerCase()) : null,
      websiteHash: body.website ? hashPrivate(String(body.website).toLowerCase()) : null,
      content,
      images,
      status: 'published',
      ipHash: hashes.ipHash,
      userAgentHash: hashes.userAgentHash,
      createdAt: now,
      updatedAt: now,
    };

    const issue = await findIssue(pageId) || await createIssue(pageId, writeToken);
    const res = await fetch(issue.comments_url, {
      method: 'POST',
      headers: {
        ...githubHeaders(true, writeToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body: serializeComment(draft) }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw new Error(githubApiError(data, res.status, '评论写入失败。'));
      return proxyProductionComments(req, { method: 'POST', body: bodyText });
    }

    const saved = {
      ...draft,
      id: String(data.id),
      createdAt: data.created_at || draft.createdAt,
      updatedAt: data.created_at || draft.updatedAt,
    };
    patchGithubComment(saved.id, saved, writeToken).catch(() => undefined);

    return NextResponse.json({
      success: true,
      status: saved.status,
      message: '评论已发布。',
      comment: publicComment(saved),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '提交评论失败。' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    if (!hasCommentAdminAccess(req)) {
      return NextResponse.json({ error: '只有本地后台可以管理评论。' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const commentId = String(body.commentId || '').trim();
    const status = String(body.status || '').trim() as CommentStatus;
    if (!/^\d+$/.test(commentId)) return NextResponse.json({ error: '评论 ID 不正确。' }, { status: 400 });
    if (!['published', 'deleted'].includes(status)) return NextResponse.json({ error: '评论状态不正确。' }, { status: 400 });

    const token = await getWriteToken();
    if (!token) throw new Error('本地缺少 GitHub 写入权限，请先登录 GitHub CLI 或配置 COMMENT_GITHUB_TOKEN。');

    const githubComment = await getGithubComment(commentId);
    const parsed = parseCommentFromGithub(githubComment, normalizePageId(body.pageId || '/'));
    const nextComment: StoredComment = {
      ...parsed,
      id: commentId,
      status,
      updatedAt: new Date().toISOString(),
    };
    await patchGithubComment(commentId, nextComment, token);
    return NextResponse.json({ success: true, comment: adminComment(nextComment) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '管理评论失败。' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    if (!hasCommentAdminAccess(req)) {
      return NextResponse.json({ error: '只有本地后台可以删除评论。' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    const commentId = String(body.commentId || url.searchParams.get('commentId') || '').trim();
    const hard = body.hard === true || url.searchParams.get('hard') === '1';
    if (!/^\d+$/.test(commentId)) return NextResponse.json({ error: '评论 ID 不正确。' }, { status: 400 });

    const token = await getWriteToken();
    if (!token) throw new Error('本地缺少 GitHub 删除权限，请先登录 GitHub CLI 或配置 COMMENT_GITHUB_TOKEN。');

    if (hard) {
      await deleteGithubComment(commentId, token);
      return NextResponse.json({ success: true, hardDeleted: true });
    }

    const githubComment = await getGithubComment(commentId);
    const parsed = parseCommentFromGithub(githubComment, normalizePageId(body.pageId || '/'));
    const nextComment: StoredComment = {
      ...parsed,
      id: commentId,
      status: 'deleted',
      updatedAt: new Date().toISOString(),
    };
    await patchGithubComment(commentId, nextComment, token);
    return NextResponse.json({ success: true, comment: adminComment(nextComment) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '删除评论失败。' }, { status: 500 });
  }
}
