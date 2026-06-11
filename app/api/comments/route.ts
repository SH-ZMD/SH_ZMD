import { NextResponse } from 'next/server';

const OWNER = process.env.COMMENT_REPO_OWNER || 'SH-ZMD';
const REPO = process.env.COMMENT_REPO || 'SH_ZMD';
const TOKEN = process.env.COMMENT_GITHUB_TOKEN || process.env.GITHUB_COMMENT_TOKEN || '';

function normalizePageId(pageId: string) {
  return (pageId || '/').replace(/\s+/g, '-').slice(0, 80);
}

function issueTitle(pageId: string) {
  return `[site-comment] ${normalizePageId(pageId)}`;
}

function githubHeaders(write = false) {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  if (write || TOKEN) {
    headers.Authorization = `Bearer ${TOKEN}`;
  }

  return headers;
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

async function findCommentIssues() {
  const query = encodeURIComponent(`repo:${OWNER}/${REPO} in:title "[site-comment]" type:issue`);
  const res = await fetch(`https://api.github.com/search/issues?q=${query}&sort=updated&order=desc&per_page=30`, {
    headers: githubHeaders(),
    cache: 'no-store',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || '读取留言提醒失败');
  }

  return Array.isArray(data.items)
    ? data.items.filter((item: any) => typeof item.title === 'string' && item.title.startsWith('[site-comment] '))
    : [];
}

async function createIssue(pageId: string) {
  if (!TOKEN) {
    throw new Error('留言功能还缺 COMMENT_GITHUB_TOKEN 环境变量。');
  }

  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/issues`, {
    method: 'POST',
    headers: {
      ...githubHeaders(true),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: issueTitle(pageId),
      body: `Public comment box for ${pageId}`,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || '创建留言箱失败');
  }

  return data;
}

function parseComment(body: string) {
  const match = body.match(/^访客：(.+?)\n\n([\s\S]*)$/);
  if (!match) {
    return { author: '路过的朋友', content: body };
  }

  return {
    author: match[1].trim() || '路过的朋友',
    content: match[2].trim(),
  };
}

function pageIdFromIssueTitle(title: string) {
  return title.replace(/^\[site-comment\]\s*/, '').trim() || '/';
}

async function listRecentComments() {
  const issues = await findCommentIssues();
  const groups = await Promise.all(
    issues.map(async (issue: any) => {
      if (!issue.comments_url || !issue.comments) return [];

      const lastPage = Math.max(1, Math.ceil(Number(issue.comments || 0) / 20));
      const res = await fetch(`${issue.comments_url}?per_page=20&page=${lastPage}`, {
        headers: githubHeaders(),
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) return [];

      const pageId = pageIdFromIssueTitle(issue.title || '');
      return data.map((item: any) => {
        const parsed = parseComment(item.body || '');
        return {
          id: String(item.id),
          pageId,
          pageUrl: pageId.startsWith('/') ? pageId : `/${pageId}`,
          author: parsed.author,
          content: parsed.content,
          createdAt: item.created_at,
        };
      });
    })
  );

  const comments = groups
    .flat()
    .filter((comment: any) => comment.createdAt)
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    total: comments.length,
    latestAt: comments[0]?.createdAt || null,
    comments: comments.slice(0, 30),
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('summary') === '1') {
      return NextResponse.json(await listRecentComments());
    }

    const pageId = normalizePageId(searchParams.get('pageId') || '/');
    const issue = await findIssue(pageId);

    if (!issue) {
      return NextResponse.json({ comments: [] });
    }

    const res = await fetch(issue.comments_url, {
      headers: githubHeaders(),
      cache: 'no-store',
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || '读取留言失败');
    }

    const comments = (Array.isArray(data) ? data : []).map((item: any) => {
      const parsed = parseComment(item.body || '');
      return {
        id: String(item.id),
        author: parsed.author,
        content: parsed.content,
        createdAt: item.created_at,
      };
    }).reverse();

    return NextResponse.json({ comments });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '读取留言失败' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!TOKEN) {
      return NextResponse.json({ error: '留言功能还缺 COMMENT_GITHUB_TOKEN 环境变量。' }, { status: 500 });
    }

    const body = await req.json();
    const pageId = normalizePageId(body.pageId || '/');
    const author = String(body.author || '路过的朋友').trim().slice(0, 40) || '路过的朋友';
    const content = String(body.content || '').trim().slice(0, 2000);

    if (!content) {
      return NextResponse.json({ error: '留言内容不能为空。' }, { status: 400 });
    }

    const issue = await findIssue(pageId) || await createIssue(pageId);
    const res = await fetch(issue.comments_url, {
      method: 'POST',
      headers: {
        ...githubHeaders(true),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        body: `访客：${author}\n\n${content}`,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || '发送留言失败');
    }

    return NextResponse.json({
      comment: {
        id: String(data.id),
        author,
        content,
        createdAt: data.created_at,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '发送留言失败' }, { status: 500 });
  }
}
