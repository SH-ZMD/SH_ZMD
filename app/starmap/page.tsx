import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';
import StarMapCanvas from './StarMapCanvas';
import { siteConfig } from '../../siteConfig';

export const metadata = {
  title: `星图 | ${siteConfig.title}`,
  description: '所有内容化作星辰，散落在时间的银河里',
};

type StarItem = {
  id: string;
  title: string;
  type: 'post' | 'chatter' | 'moment';
  date: string;
  href: string;
  preview: string;
};

function loadStars(): StarItem[] {
  const stars: StarItem[] = [];

  // Posts
  const postsDir = path.join(process.cwd(), 'posts');
  if (fs.existsSync(postsDir)) {
    for (const fileName of fs.readdirSync(postsDir).filter(f => f.endsWith('.md'))) {
      try {
        const { data, content } = matter(fs.readFileSync(path.join(postsDir, fileName), 'utf8'));
        if (data.hidden === true) continue;
        stars.push({
          id: 'post-' + fileName,
          title: data.title || '无标题',
          type: 'post',
          date: data.date || '2026-01-01',
          href: '/posts/' + fileName.replace(/\.md$/, ''),
          preview: (content || '').replace(/[#>*`!\[\]]/g, '').trim().slice(0, 80),
        });
      } catch {}
    }
  }

  // Chatters
  const chattersDir = path.join(process.cwd(), 'chatters');
  if (fs.existsSync(chattersDir)) {
    for (const fileName of fs.readdirSync(chattersDir).filter(f => f.endsWith('.md'))) {
      try {
        const { data, content } = matter(fs.readFileSync(path.join(chattersDir, fileName), 'utf8'));
        if (data.hidden === true) continue;
        if (fileName.startsWith('draft')) continue;
        stars.push({
          id: 'chatter-' + fileName,
          title: data.title || '碎片记录',
          type: 'chatter',
          date: data.date || '2026-01-01',
          href: '/chatter/' + fileName.replace(/\.md$/, ''),
          preview: (content || '').replace(/[#>*`!\[\]]/g, '').trim().slice(0, 80),
        });
      } catch {}
    }
  }

  // Moments
  const momentDirs = [
    path.join(process.cwd(), 'moments'),
    path.join(process.cwd(), 'posts', 'moments'),
  ];
  for (const dir of momentDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const fileName of fs.readdirSync(dir).filter(f => f.endsWith('.md'))) {
      try {
        const { data, content } = matter(fs.readFileSync(path.join(dir, fileName), 'utf8'));
        if (data.hidden === true) continue;
        const text = (content || '').replace(/!\[[^\]]*\]\([^)]+\)/g, '').replace(/<[^>]+>/g, '').trim();
        stars.push({
          id: 'moment-' + dir + '-' + fileName,
          title: text.slice(0, 24) || '新的说说',
          type: 'moment',
          date: data.date || '2026-01-01',
          href: '/moments',
          preview: text.slice(0, 80),
        });
      } catch {}
    }
  }

  return stars.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export default function StarMapPage() {
  const stars = loadStars();

  return (
    <div className="min-h-screen relative">
      <Navbar />
      <PageTransition>
        <StarMapCanvas stars={stars} />
      </PageTransition>
    </div>
  );
}
