import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import CreativeWorkshopClient from './CreativeWorkshopClient';
import { siteConfig } from '../../siteConfig';

type WorkshopItem = {
  id: string;
  slug: string;
  title: string;
  type: 'post' | 'chatter' | 'moment';
  date: string;
  cover: string | null;
  content: string;
};

function parseItem(fullPath: string, fileName: string, type: WorkshopItem['type']): WorkshopItem {
  const { data, content } = matter(fs.readFileSync(fullPath, 'utf8'));
  const slug = fileName.replace(/\.md$/, '');
  return {
    id: String(data.id || slug),
    slug,
    title: String(data.title || ''),
    type,
    date: String(data.date || '2026-05-01'),
    cover: data.cover || data.image || null,
    content: content.trim(),
  };
}

function readPosts() {
  const directory = path.join(process.cwd(), 'posts');
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter((name) => name.endsWith('.md')).map((name) => parseItem(path.join(process.cwd(), 'posts', name), name, 'post'));
}

function readChatters() {
  const directory = path.join(process.cwd(), 'chatters');
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter((name) => name.endsWith('.md')).map((name) => parseItem(path.join(process.cwd(), 'chatters', name), name, 'chatter'));
}

function readMoments() {
  const directory = path.join(process.cwd(), 'moments');
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter((name) => name.endsWith('.md')).map((name) => parseItem(path.join(process.cwd(), 'moments', name), name, 'moment'));
}

export const metadata = {
  title: `灵境 | ${siteConfig.title}`,
  description: "记忆炼金室与帝江号舰船——灵感与作品的封存之地",
};

export default function CreativeWorkshopPage() {
  return <CreativeWorkshopClient posts={readPosts()} chatters={readChatters()} moments={readMoments()} />;
}
