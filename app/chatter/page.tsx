import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';
import ChatterBoard from './ChatterBoard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: "杂谈 | SH_ZMD の 博客",
  description: "日常碎片与灵感记录",
};

// 列表卡片只展示纯文本摘要，避免 ###、**、![]() 这类标记直接露在卡片上
function toPlainExcerpt(markdown: string, maxLength = 200) {
  const text = markdown
    .replace(/^\s{0,3}#{1,6}\s+.*(\n|$)/, '')      // 去掉正文第一个标题（与文章标题重复）
    .replace(/```[\s\S]*?```/g, ' ')            // 代码块
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')       // 图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')     // 链接保留文字
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')            // 其余标题标记
    .replace(/^\s{0,3}>\s?/gm, '')                 // 引用标记
    .replace(/^\s{0,3}([-*+]|\d+[.)])\s+/gm, '')  // 列表标记
    .replace(/^\s*\|.*\|\s*$/gm, ' ')            // 表格行
    .replace(/^\s*[-:|\s]{3,}$/gm, ' ')
    .replace(/[*_`~]/g, '')                        // 强调符
    .replace(/<[^>]*>/g, ' ')                       // 行内 HTML
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

export default function ChatterPage() {
  const chattersDirectory = path.join(process.cwd(), 'chatters');
  let chatters: any[] = [];

  try {
    if (!fs.existsSync(chattersDirectory)) {
      fs.mkdirSync(chattersDirectory);
    }

    const fileNames = fs.readdirSync(chattersDirectory).filter(fileName => fileName.endsWith('.md'));

    chatters = fileNames.map(fileName => {
      const slug = fileName.replace(/\.md$/, '');
      const fileContents = fs.readFileSync(path.join(chattersDirectory, fileName), 'utf8');
      const { data, content } = matter(fileContents);

      return {
        slug,
        title: data.title || '',
        date: data.date || '1970-01-01', // 👇 核心修复：加上日期兜底防崩溃
        tags: data.tags || [],
        mood: data.mood || '',
        cover: data.cover || '',
        hidden: data.hidden === true,
        content: toPlainExcerpt(content)
      };
    }).sort((a, b) => (new Date(b.date).getTime() - new Date(a.date).getTime()));
  } catch (e) {
    console.error("读取杂谈文件失败:", e);
  }

  return (
    <div className="min-h-screen relative pb-10">
      <Navbar />
      <PageTransition>
        <ChatterBoard chatters={chatters} />
      </PageTransition>
    </div>
  );
}
