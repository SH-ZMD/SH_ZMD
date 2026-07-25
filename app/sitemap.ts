import fs from 'node:fs';
import path from 'node:path';
import type { MetadataRoute } from 'next';
import { siteConfig } from '../siteConfig';

const staticRoutes = ['', '/about', '/chatter', '/friends', '/guestbook', '/key-urls', '/moments', '/music', '/plans', '/recommendations', '/starmap', '/timeline', '/tree'];

export default function sitemap(): MetadataRoute.Sitemap {
  const sources = [
    { fullDirectory: path.join(process.cwd(), 'posts'), prefix: '/posts/' },
    { fullDirectory: path.join(process.cwd(), 'chatters'), prefix: '/chatter/' },
  ];
  const contentRoutes = sources.flatMap(({ fullDirectory, prefix }) => {
    if (!fs.existsSync(fullDirectory)) return [];
    return fs.readdirSync(fullDirectory).filter((name) => name.endsWith('.md') && !name.startsWith('draft_')).map((name) => `${prefix}${name.replace(/\.md$/, '')}`);
  });
  return [...staticRoutes, ...contentRoutes].map((route) => ({ url: `${siteConfig.siteUrl}${route}`, changeFrequency: route ? 'weekly' : 'daily', priority: route ? 0.7 : 1 }));
}
