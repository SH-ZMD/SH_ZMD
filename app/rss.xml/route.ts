import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { siteConfig } from '../../siteConfig';

export const dynamic = 'force-static';

type FeedItem = {
  title: string;
  link: string;
  date: string;
  description: string;
  category: string;
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stripMarkdown(content: string) {
  return content
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[#>*`~\-]{1,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readItems(directory: string, prefix: string, category: string): FeedItem[] {
  const fullDirectory = path.join(process.cwd(), directory);
  if (!fs.existsSync(fullDirectory)) return [];
  return fs
    .readdirSync(fullDirectory)
    .filter((name) => name.endsWith('.md') && !name.startsWith('draft_'))
    .map((name) => {
      const slug = name.replace(/\.md$/, '');
      try {
        const parsed = matter(fs.readFileSync(path.join(fullDirectory, name), 'utf-8'));
        const data = parsed.data || {};
        const hidden = data.hidden === true || data.published === false;
        return {
          title: String(data.title || slug),
          link: `${siteConfig.siteUrl}${prefix}${slug}`,
          date: String(data.date || ''),
          description: String(data.description || data.summary || stripMarkdown(parsed.content).slice(0, 200)),
          category,
          hidden,
        };
      } catch {
        return null;
      }
    })
    .filter((item): item is FeedItem & { hidden: boolean } => item !== null && !item.hidden)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function GET() {
  const items = [
    ...readItems('posts', '/posts/', '文章'),
    ...readItems('chatters', '/chatter/', '杂谈'),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteConfig.title)}</title>
    <link>${escapeXml(siteConfig.siteUrl)}</link>
    <description>${escapeXml(siteConfig.bio)}</description>
    <language>zh-CN</language>
    <atom:link href="${escapeXml(siteConfig.siteUrl)}/rss.xml" rel="self" type="application/rss+xml"/>
${items
  .map(
    (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="true">${escapeXml(item.link)}</guid>
      ${item.date ? `<pubDate>${new Date(item.date).toUTCString()}</pubDate>` : ''}
      <category>${escapeXml(item.category)}</category>
      <description>${escapeXml(item.description)}</description>
    </item>`
  )
  .join('\n')}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
